# TraceUX

TraceUX is an end-to-end hackathon prototype for agentic UX testing. It turns a business journey into persona-driven browser simulations, captures behavioral evidence, reasons about likely friction, verifies the evidence, and produces findings that require human approval.

## Product surfaces

- Product overview and quality signals
- Scenario Studio with target, goal, success criteria, and persona selection
- Live Run Command Center with browser preview, progress, telemetry, and agent trace
- Evidence review with severity, confidence, page locator, and recommended fix
- Persona Lab and simulation history
- Hosted demo-mode fallback when the NestJS runtime is unavailable

## Architecture

- `app/`: Next.js-compatible Vinext frontend deployed through Sites
- `api/`: NestJS REST and SSE API
- PostgreSQL and Prisma: projects, personas, runs, agent events, and findings
- D1 and Drizzle: persistent hosted-demo run records
- Agent pipeline: orchestrator → planner → persona → browser → observer → analyst → verifier → reporter → human review

The local prototype uses a read-only Playwright Chromium worker to load the submitted public URL, capture the real viewport, DOM/accessibility structure, focus sequence, network failures, and console errors. The OpenAI Responses API analyzes that evidence with Structured Outputs when `AI_PROVIDER=openai` and `OPENAI_API_KEY` are configured. Without a key, the product returns deterministic findings derived from the captured browser signals.

## One-command local setup

Install Node.js 22+ and Docker Desktop. Then clone the project and run:

```bash
npm run traceux
```

The launcher is compatible with Windows, macOS, and Linux. `npm run traceUX` is also accepted on Windows if that capitalization is used.

That single command installs dependencies and Chromium, starts PostgreSQL, applies migrations, adds the demo personas, and launches both the web application and NestJS API. Open `http://localhost:3000`.

The first run creates a git-ignored `.env` file automatically. The product works immediately with its safe fallback engine. For live OpenAI analysis, add a fresh key to that one file and restart the command:

```dotenv
OPENAI_API_KEY=your_new_key_here
```

Replace the entire placeholder with the new key. Do not add backslashes before underscores, and do not commit the `.env` file.

Press `Ctrl+C` to stop the application. PostgreSQL remains available for the next launch; use `docker stop traceux-postgres` when you want to stop it too.

## Validation

```bash
npm run build:all
npm test
npx tsc --noEmit
```

## Prototype safety

- Simulation targets are treated as read-only by the prototype runtime.
- Private/local network targets, non-HTTP URLs, form submissions, downloads, and non-GET requests are blocked by the live browser worker.
- Recommendations are evidence-linked and verified before display.
- Ticket creation and product changes remain behind human approval.
- Production browser execution should add URL allowlists, isolated workers, secrets management, PII redaction, and artifact retention policies.
