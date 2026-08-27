import { OpenAiUxService } from "./openai-ux.service";

describe("OpenAiUxService", () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = { ...originalEnvironment };
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it("uses the deterministic fallback when OpenAI is not configured", async () => {
    process.env.AI_PROVIDER = "demo";
    delete process.env.OPENAI_API_KEY;

    const service = new OpenAiUxService();

    expect(service.status()).toMatchObject({
      provider: "demo",
      configured: false,
      model: null,
    });
  });

  it("reports the configured OpenAI model without exposing the key", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key-not-used-for-network-calls";
    process.env.MODEL = "gpt-4o";

    const service = new OpenAiUxService();

    expect(service.status()).toEqual({
      provider: "openai",
      configured: true,
      model: "gpt-4o",
      liveBrowser: false,
    });
    expect(JSON.stringify(service.status())).not.toContain(process.env.OPENAI_API_KEY);
  });
});
