import { Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { chromium, type BrowserContext, type Page, type Route } from "playwright";

export interface BrowserObservation {
  mode: "live";
  requestedUrl: string;
  finalUrl: string;
  title: string;
  screenshot: string;
  capturedAt: string;
  responseStatus: number;
  loadTimeMs: number;
  viewport: { width: number; height: number };
  metrics: {
    links: number;
    buttons: number;
    formControls: number;
    images: number;
    missingAltImages: number;
    unlabeledControls: number;
    headings: number;
    h1Count: number;
    consoleErrors: number;
    failedRequests: number;
    blockedMutations: number;
    horizontalOverflow: boolean;
  };
  selectors: {
    missingAltImages: string[];
    unlabeledControls: string[];
    headings: string[];
    interactive: string[];
  };
  focusSequence: string[];
  consoleMessages: string[];
  visibleText: string;
}

const VIEWPORT = { width: 1280, height: 800 };
const MAX_CAPTURED_ITEMS = 12;

function isBlockedIpv4(address: string) {
  const octets = address.split(".").map(Number);
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("::ffff:") ||
    normalized.startsWith("2001:db8") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

function isBlockedAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

@Injectable()
export class LiveBrowserService {
  enabled() {
    return process.env.ENABLE_LIVE_BROWSER === "true";
  }

  async capture(targetUrl: string): Promise<BrowserObservation> {
    const requestedUrl = this.normalizeTarget(targetUrl);
    const hostnameDecisions = new Map<string, boolean>();
    await this.assertPublicUrl(requestedUrl, hostnameDecisions);

    const consoleMessages: string[] = [];
    let failedRequests = 0;
    let blockedMutations = 0;
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        locale: "en-US",
        colorScheme: "light",
        serviceWorkers: "block",
        acceptDownloads: false,
      });
      await this.applyReadOnlyGuard(context, hostnameDecisions, () => {
        blockedMutations += 1;
      });

      const page = await context.newPage();
      page.setDefaultNavigationTimeout(30_000);
      page.setDefaultTimeout(8_000);
      page.on("console", (message) => {
        if (message.type() === "error" && consoleMessages.length < MAX_CAPTURED_ITEMS) {
          consoleMessages.push(message.text().slice(0, 300));
        }
      });
      page.on("pageerror", (error) => {
        if (consoleMessages.length < MAX_CAPTURED_ITEMS) {
          consoleMessages.push(error.message.slice(0, 300));
        }
      });
      page.on("requestfailed", () => {
        failedRequests += 1;
      });

      const startedAt = Date.now();
      const response = await page.goto(requestedUrl, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      const loadTimeMs = Date.now() - startedAt;
      const finalUrl = page.url();
      await this.assertPublicUrl(finalUrl, hostnameDecisions);

      const pageSignals = await this.readPageSignals(page);
      const focusSequence = await this.captureFocusSequence(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(250);
      const screenshotBuffer = await page.screenshot({
        type: "jpeg",
        quality: 78,
        fullPage: false,
        animations: "disabled",
      });

      return {
        mode: "live",
        requestedUrl,
        finalUrl,
        title: await page.title(),
        screenshot: `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`,
        capturedAt: new Date().toISOString(),
        responseStatus: response?.status() ?? 0,
        loadTimeMs,
        viewport: VIEWPORT,
        metrics: {
          ...pageSignals.metrics,
          consoleErrors: consoleMessages.length,
          failedRequests,
          blockedMutations,
        },
        selectors: pageSignals.selectors,
        focusSequence,
        consoleMessages,
        visibleText: pageSignals.visibleText,
      };
    } finally {
      await browser.close();
    }
  }

  private normalizeTarget(targetUrl: string) {
    const value = targetUrl.trim();
    if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) {
      throw new Error("Only HTTP and HTTPS targets are supported.");
    }
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error("Only HTTP and HTTPS targets are supported.");
    }
    url.username = "";
    url.password = "";
    return url.toString();
  }

  private async assertPublicUrl(urlValue: string, cache: Map<string, boolean>) {
    const url = new URL(urlValue);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error("The browser agent blocked a non-web URL.");
    }

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      throw new Error("Private and local network targets are blocked by safe mode.");
    }

    if (cache.has(hostname)) {
      if (!cache.get(hostname)) throw new Error("The target resolves to a private network address.");
      return;
    }

    const literalVersion = isIP(hostname);
    const addresses = literalVersion
      ? [{ address: hostname }]
      : await lookup(hostname, { all: true, verbatim: true });
    const allowed = addresses.length > 0 && addresses.every(({ address }) => !isBlockedAddress(address));
    cache.set(hostname, allowed);
    if (!allowed) throw new Error("Private and local network targets are blocked by safe mode.");
  }

  private async applyReadOnlyGuard(
    context: BrowserContext,
    cache: Map<string, boolean>,
    onBlockedMutation: () => void,
  ) {
    await context.route("**/*", async (route: Route) => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) {
        onBlockedMutation();
        await route.abort("blockedbyclient");
        return;
      }

      try {
        const protocol = new URL(request.url()).protocol;
        if (protocol === "data:" || protocol === "blob:") {
          await route.continue();
          return;
        }
        await this.assertPublicUrl(request.url(), cache);
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });
  }

  private readPageSignals(page: Page) {
    return page.evaluate((maxItems) => {
      const selectorFor = (element: Element) => {
        if (element.id) return `#${CSS.escape(element.id)}`;
        const testId = element.getAttribute("data-testid");
        if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
        const ariaLabel = element.getAttribute("aria-label");
        if (ariaLabel) return `${element.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
        const segments: string[] = [];
        let current: Element | null = element;
        while (current && current !== document.body && segments.length < 4) {
          const tag = current.tagName.toLowerCase();
          const siblings = current.parentElement
            ? [...current.parentElement.children].filter((child) => child.tagName === current?.tagName)
            : [];
          const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : "";
          segments.unshift(`${tag}${suffix}`);
          current = current.parentElement;
        }
        return segments.join(" > ") || element.tagName.toLowerCase();
      };

      const isVisible = (element: Element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };

      const accessibleName = (element: Element) => {
        const id = element.getAttribute("id");
        const explicitLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : "";
        return (
          element.getAttribute("aria-label") ||
          element.getAttribute("aria-labelledby") ||
          explicitLabel ||
          element.closest("label")?.textContent ||
          element.getAttribute("title") ||
          element.getAttribute("alt") ||
          element.textContent ||
          ""
        ).trim();
      };

      const controls = [...document.querySelectorAll("button, input, select, textarea, [role='button'], [role='link']")].filter(isVisible);
      const images = [...document.querySelectorAll("img")].filter(isVisible);
      const missingAltImages = images.filter((image) => !image.hasAttribute("alt"));
      const unlabeledControls = controls.filter((control) => !accessibleName(control));
      const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(isVisible);
      const interactive = [...document.querySelectorAll("a[href], button, input, select, textarea")].filter(isVisible);
      const bodyText = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 6_000);

      return {
        metrics: {
          links: document.querySelectorAll("a[href]").length,
          buttons: document.querySelectorAll("button, [role='button']").length,
          formControls: document.querySelectorAll("input, select, textarea").length,
          images: images.length,
          missingAltImages: missingAltImages.length,
          unlabeledControls: unlabeledControls.length,
          headings: headings.length,
          h1Count: document.querySelectorAll("h1").length,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        },
        selectors: {
          missingAltImages: missingAltImages.slice(0, maxItems).map(selectorFor),
          unlabeledControls: unlabeledControls.slice(0, maxItems).map(selectorFor),
          headings: headings.slice(0, maxItems).map(selectorFor),
          interactive: interactive.slice(0, maxItems).map(selectorFor),
        },
        visibleText: bodyText,
      };
    }, MAX_CAPTURED_ITEMS);
  }

  private async captureFocusSequence(page: Page) {
    const sequence: string[] = [];
    await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      active?.blur();
      window.scrollTo(0, 0);
    });

    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return "document body";
        const name = (
          element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.textContent ||
          element.getAttribute("placeholder") ||
          "unnamed"
        ).replace(/\s+/g, " ").trim().slice(0, 80);
        const identifier = element.id ? `#${element.id}` : element.tagName.toLowerCase();
        return `${identifier}: ${name}`;
      });
      if (focused && !sequence.includes(focused)) sequence.push(focused);
    }
    return sequence;
  }
}
