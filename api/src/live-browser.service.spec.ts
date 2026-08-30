import { LiveBrowserService } from "./live-browser.service";

describe("LiveBrowserService safety guard", () => {
  const service = new LiveBrowserService();

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://10.0.0.8",
    "http://192.168.1.20",
    "http://[::1]:3000",
    "http://[::ffff:127.0.0.1]:3000",
  ])("rejects local or private target %s before launching Chromium", async (target) => {
    await expect(service.capture(target)).rejects.toThrow(/private|local/i);
  });

  it("rejects non-web protocols", async () => {
    await expect(service.capture("file:///etc/passwd")).rejects.toThrow(/HTTP and HTTPS/i);
  });
});
