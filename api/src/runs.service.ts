import { Injectable, MessageEvent, NotFoundException } from "@nestjs/common";
import { FindingSeverity, Prisma, RunStatus } from "@prisma/client";
import { Observable, ReplaySubject } from "rxjs";
import { PrismaService } from "./prisma.service";
import { randomUUID } from "node:crypto";
import { AiFinding, OpenAiUxService } from "./openai-ux.service";
import { BrowserObservation, LiveBrowserService } from "./live-browser.service";
import { CreatePersonaDto, CreateRunDto, ReviewFindingDto } from "./run.dto";
import { agentStages } from "./run.types";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const demoFindings: AiFinding[] = [
  {
    title: "Delivery cost appears too late",
    summary:
      "Three personas paused or backtracked when the delivery fee first appeared during checkout.",
    severity: FindingSeverity.HIGH,
    confidence: 94,
    persona: "Cautious Buyer",
    journeyStep: "Checkout · Delivery",
    evidence: {
      signal: "14.2s dwell · 2 backtracks",
      selector: "[data-testid='delivery-total']",
      screenshot: "checkout-delivery.png",
    },
    recommendation:
      "Show an estimated delivery range on the product and cart pages, then preserve the amount through checkout.",
  },
  {
    title: "Keyboard focus skips the size selector",
    summary:
      "The keyboard-only persona could not reach the required size options in the expected tab sequence.",
    severity: FindingSeverity.CRITICAL,
    confidence: 98,
    persona: "Keyboard Navigator",
    journeyStep: "Product · Select size",
    evidence: {
      signal: "Focus moved from gallery to add-to-cart",
      selector: "[role='radiogroup'][aria-label='Size']",
      screenshot: "product-focus-order.png",
    },
    recommendation:
      "Use native radio inputs or roving tabindex, expose the group label, and add a visible focus treatment.",
  },
  {
    title: "Promo field distracts from payment",
    summary:
      "First-time and impatient personas repeatedly searched for a code and delayed payment completion.",
    severity: FindingSeverity.MEDIUM,
    confidence: 87,
    persona: "First-time Explorer",
    journeyStep: "Checkout · Payment",
    evidence: {
      signal: "3 expansions · 18.7s combined dwell",
      selector: "#promotion-code",
      screenshot: "checkout-promo.png",
    },
    recommendation:
      "Move the promo control below the order summary and keep it collapsed behind a low-emphasis text action.",
  },
];

function buildObservedFindings(observation: BrowserObservation, persona: string) {
  const { metrics, selectors } = observation;
  const screenshot = observation.screenshot;
  const findings: AiFinding[] = [];
  const add = (finding: AiFinding) => findings.push(finding);

  if (metrics.unlabeledControls > 0) {
    add({
      title: `${metrics.unlabeledControls} visible control${metrics.unlabeledControls === 1 ? " lacks" : "s lack"} an accessible name`,
      summary: "The read-only DOM scan found visible interactive controls without a programmatic label.",
      severity: FindingSeverity.CRITICAL,
      confidence: 99,
      persona: "Keyboard Navigator",
      journeyStep: "Initial viewport · Accessibility",
      evidence: {
        signal: `Observed: ${metrics.unlabeledControls} unlabeled visible controls`,
        selector: selectors.unlabeledControls[0] ?? "viewport",
        screenshot,
      },
      recommendation: "Give each control visible text or an accessible name using a native label or aria-label.",
    });
  }

  if (metrics.missingAltImages > 0) {
    add({
      title: `${metrics.missingAltImages} visible image${metrics.missingAltImages === 1 ? " is" : "s are"} missing alt text`,
      summary: "The captured page contains visible images without an alt attribute.",
      severity: FindingSeverity.HIGH,
      confidence: 99,
      persona,
      journeyStep: "Initial viewport · Content",
      evidence: {
        signal: `Observed: ${metrics.missingAltImages} visible images without alt attributes`,
        selector: selectors.missingAltImages[0] ?? "viewport",
        screenshot,
      },
      recommendation: "Add concise alternative text for meaningful images and an empty alt value for decorative images.",
    });
  }

  if (metrics.consoleErrors > 0) {
    add({
      title: `${metrics.consoleErrors} browser console error${metrics.consoleErrors === 1 ? " was" : "s were"} captured`,
      summary: observation.consoleMessages[0] ?? "The page emitted an error while loading in Chromium.",
      severity: FindingSeverity.HIGH,
      confidence: 98,
      persona,
      journeyStep: "Page load · Runtime",
      evidence: {
        signal: `Observed: ${metrics.consoleErrors} console errors during page load`,
        selector: "viewport",
        screenshot,
      },
      recommendation: "Resolve the captured runtime error and repeat this browser run to confirm a clean console.",
    });
  }

  if (metrics.horizontalOverflow) {
    add({
      title: "Content overflows the captured desktop viewport",
      summary: "The document width exceeds the 1280-pixel browser viewport used for this run.",
      severity: FindingSeverity.HIGH,
      confidence: 98,
      persona,
      journeyStep: "Initial viewport · Responsive layout",
      evidence: {
        signal: "Observed: document width exceeds the 1280px viewport",
        selector: "viewport",
        screenshot,
      },
      recommendation: "Identify the overflowing element, constrain its width, and verify the page at desktop and mobile breakpoints.",
    });
  }

  if (metrics.h1Count !== 1) {
    add({
      title: metrics.h1Count === 0 ? "The captured page has no primary heading" : "The captured page has multiple primary headings",
      summary: `The DOM scan found ${metrics.h1Count} H1 elements on the loaded page.`,
      severity: FindingSeverity.MEDIUM,
      confidence: 99,
      persona,
      journeyStep: "Initial viewport · Information structure",
      evidence: {
        signal: `Observed: ${metrics.h1Count} H1 elements in the DOM`,
        selector: selectors.headings[0] ?? "viewport",
        screenshot,
      },
      recommendation: "Use one descriptive page-level H1 and nest subsequent headings in a logical hierarchy.",
    });
  }

  if (observation.loadTimeMs > 3_000) {
    add({
      title: "Initial page load exceeded three seconds",
      summary: `The read-only Chromium session reached its captured state in ${observation.loadTimeMs}ms.`,
      severity: FindingSeverity.MEDIUM,
      confidence: 92,
      persona: "Impatient Shopper",
      journeyStep: "Page load · Performance",
      evidence: {
        signal: `Observed: ${observation.loadTimeMs}ms initial capture time`,
        selector: "viewport",
        screenshot,
      },
      recommendation: "Profile the critical rendering path, optimize blocking assets, and retest under representative network conditions.",
    });
  }

  const interactiveCount = metrics.links + metrics.buttons + metrics.formControls;
  const baselineFindings = [
    {
      title: "Keyboard traversal baseline captured",
      summary: `The browser recorded ${observation.focusSequence.length} unique focus stops without submitting forms or activating controls.`,
      severity: FindingSeverity.LOW,
      confidence: 90,
      persona: "Keyboard Navigator",
      journeyStep: "Initial viewport · Keyboard",
      evidence: {
        signal: `Observed: ${observation.focusSequence.length} unique focus stops in the first eight Tab presses`,
        selector: selectors.interactive[0] ?? "viewport",
        screenshot,
      },
      recommendation: "Review the captured focus sequence against the visual reading order, then test the complete task with keyboard-only input.",
    },
    {
      title: "Initial interaction surface requires journey validation",
      summary: `The loaded page exposes ${interactiveCount} links, buttons, and form controls in the captured document.`,
      severity: FindingSeverity.LOW,
      confidence: 88,
      persona,
      journeyStep: "Initial viewport · Interaction",
      evidence: {
        signal: `Observed: ${metrics.links} links, ${metrics.buttons} buttons, and ${metrics.formControls} form controls`,
        selector: selectors.interactive[0] ?? "viewport",
        screenshot,
      },
      recommendation: "Confirm that the primary action is visually dominant and that the control sequence supports the stated journey goal.",
    },
    {
      title: "Real browser capture completed successfully",
      summary: `${observation.title || "The target page"} returned HTTP ${observation.responseStatus || "unknown"} at ${observation.finalUrl}.`,
      severity: FindingSeverity.LOW,
      confidence: 100,
      persona,
      journeyStep: "Page load · Verification",
      evidence: {
        signal: `Observed: HTTP ${observation.responseStatus || "unknown"} captured in ${observation.loadTimeMs}ms`,
        selector: "viewport",
        screenshot,
      },
      recommendation: "Use this capture as the reproducible baseline for deeper task-specific interactions in a controlled test environment.",
    },
  ];

  for (const finding of baselineFindings) {
    if (findings.length >= 3) break;
    add(finding);
  }
  return findings.slice(0, 3);
}

@Injectable()
export class RunsService {
  private readonly streams = new Map<string, ReplaySubject<MessageEvent>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly liveBrowser: LiveBrowserService,
    private readonly openAiUx: OpenAiUxService,
  ) {}

  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      runtime: "NestJS",
      database: "PostgreSQL",
      ai: this.openAiUx.status(),
    };
  }

  async overview() {
    const [runCount, findingCount, recentRuns] = await Promise.all([
      this.prisma.testRun.count(),
      this.prisma.finding.count(),
      this.prisma.testRun.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { findings: true, project: true },
      }),
    ]);

    return {
      stats: {
        activeRuns: recentRuns.filter((run) => run.status === RunStatus.RUNNING).length,
        journeysTested: Math.max(36, runCount * 4),
        blockersFound: Math.max(7, findingCount),
        averageUxScore: recentRuns[0]?.uxScore ?? 78,
      },
      recentRuns,
    };
  }

  personas() {
    return this.prisma.persona.findMany({ orderBy: { name: "asc" } });
  }

  createPersona(dto: CreatePersonaDto) {
    return this.prisma.persona.create({
      data: {
        id: `custom-${randomUUID()}`,
        ...dto,
        accessibility: dto.accessibility || null,
      },
    });
  }

  runs() {
    return this.prisma.testRun.findMany({
      orderBy: { createdAt: "desc" },
      include: { project: true, findings: true, events: { orderBy: { createdAt: "asc" } } },
    });
  }

  async run(id: string) {
    const run = await this.prisma.testRun.findUnique({
      where: { id },
      include: { project: true, findings: true, events: { orderBy: { createdAt: "asc" } } },
    });
    if (!run) throw new NotFoundException("Run not found");
    return run;
  }

  async create(dto: CreateRunDto) {
    const project = await this.prisma.project.create({
      data: { name: dto.projectName, targetUrl: dto.targetUrl },
    });
    return this.prisma.testRun.create({
      data: {
        projectId: project.id,
        targetUrl: dto.targetUrl,
        goal: dto.goal,
        successCriteria: dto.successCriteria,
        personaIds: dto.personaIds,
      },
      include: { project: true, findings: true, events: true },
    });
  }

  async start(id: string) {
    await this.run(id);
    const stream = this.streams.get(id) ?? new ReplaySubject<MessageEvent>(32);
    this.streams.set(id, stream);
    const run = await this.prisma.testRun.update({
      where: { id },
      data: { status: RunStatus.RUNNING, progress: 2, startedAt: new Date() },
      include: { project: true, findings: true, events: true },
    });
    void this.execute(id, stream);
    return run;
  }

  events(id: string): Observable<MessageEvent> {
    let stream = this.streams.get(id);
    if (!stream) {
      stream = new ReplaySubject<MessageEvent>(32);
      this.streams.set(id, stream);
    }
    return stream.asObservable();
  }

  async reviewFinding(runId: string, findingId: string, dto: ReviewFindingDto) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, runId },
    });
    if (!finding) throw new NotFoundException("Finding not found");
    return this.prisma.finding.update({
      where: { id: findingId },
      data: {
        status: dto.status,
        reviewNote:
          dto.note ??
          (dto.status === "Approved"
            ? "Approved by a human reviewer for delivery planning."
            : "Dismissed by a human reviewer after evidence review."),
        reviewedAt: new Date(),
      },
    });
  }

  async createTickets(id: string) {
    await this.run(id);
    const approved = await this.prisma.finding.findMany({
      where: { runId: id, status: "Approved" },
      orderBy: { createdAt: "asc" },
    });
    const created = await this.prisma.$transaction(
      approved.map((finding, index) => {
        const ticketId = finding.ticketId ?? `TUX-${id.slice(-4).toUpperCase()}-${index + 1}`;
        return this.prisma.finding.update({
          where: { id: finding.id },
          data: { ticketId, ticketStatus: "Draft" },
        });
      }),
    );
    return {
      tickets: created.map((finding) => ({
        id: finding.ticketId,
        title: finding.title,
        severity: finding.severity,
        status: finding.ticketStatus,
      })),
    };
  }

  private async execute(id: string, stream: ReplaySubject<MessageEvent>) {
    try {
      const runContext = await this.run(id);
      const personas = await this.prisma.persona.findMany({
        where: { id: { in: runContext.personaIds } },
      });
      let browserObservation: BrowserObservation | null = null;

      for (const stage of agentStages) {
        let stageData = stage;
        if (stage.agent === "browser" && this.liveBrowser.enabled()) {
          browserObservation = await this.liveBrowser.capture(runContext.targetUrl);
          const { screenshot, ...browserEvidence } = browserObservation;
          await this.prisma.testRun.update({
            where: { id },
            data: {
              browserMode: "live",
              browserFinalUrl: browserObservation.finalUrl,
              browserTitle: browserObservation.title,
              browserScreenshot: screenshot,
              browserEvidence: browserEvidence as unknown as Prisma.InputJsonValue,
              browserCapturedAt: new Date(browserObservation.capturedAt),
            },
          });
          stream.next({ type: "browser-capture", data: browserObservation });
          stageData = {
            ...stage,
            title: "Live target captured in Chromium",
            detail: `Loaded ${browserObservation.finalUrl} in read-only safe mode and captured a real screenshot, DOM, accessibility, focus, network, and console signals.`,
          };
        }
        await wait(520);
        const event = await this.prisma.runEvent.create({
          data: { runId: id, ...stageData },
        });
        await this.prisma.testRun.update({
          where: { id },
          data: { progress: stageData.progress },
        });
        stream.next({ type: stageData.kind, data: event });
      }

      const aiFindings = await this.openAiUx.generateFindings(runContext, personas, browserObservation);
      const findings = aiFindings ?? (browserObservation
        ? buildObservedFindings(browserObservation, personas[0]?.name ?? "Selected persona")
        : demoFindings);
      const observedPenalty = browserObservation
        ? Math.min(55,
            browserObservation.metrics.unlabeledControls * 8 +
            browserObservation.metrics.missingAltImages * 3 +
            browserObservation.metrics.consoleErrors * 4 +
            (browserObservation.metrics.horizontalOverflow ? 12 : 0) +
            (browserObservation.loadTimeMs > 3_000 ? 8 : 0))
        : 28;

      await this.prisma.finding.createMany({
        data: findings.map((finding) => ({
          ...finding,
          evidence: finding.evidence as Prisma.InputJsonValue,
          runId: id,
        })),
      });
      const completed = await this.prisma.testRun.update({
        where: { id },
        data: {
          status: RunStatus.REVIEW,
          progress: 100,
          uxScore: Math.max(40, 100 - observedPenalty),
          completionRate: browserObservation?.responseStatus && browserObservation.responseStatus < 400 ? 100 : 76,
          frictionCount: findings.length,
          completedAt: new Date(),
        },
        include: { project: true, findings: true, events: { orderBy: { createdAt: "asc" } } },
      });
      stream.next({ type: "complete", data: completed });
      stream.complete();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The browser run failed.";
      const failureEvent = await this.prisma.runEvent.create({
        data: {
          runId: id,
          agent: "browser",
          title: "Live browser capture failed",
          detail: message.slice(0, 500),
          progress: 48,
          kind: "guardrail",
        },
      });
      await this.prisma.testRun.update({
        where: { id },
        data: { status: RunStatus.FAILED },
      });
      stream.next({ type: "guardrail", data: failureEvent });
      stream.next({ type: "failed", data: { message } });
      stream.complete();
    }
  }
}
