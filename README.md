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

The prototype uses the OpenAI Responses API with Structured Outputs when `AI_PROVIDER=openai` and `OPENAI_API_KEY` are configured. It falls back to a deterministic engine when the model is unavailable, so the demo remains usable without exposing a key to the browser. A real Playwright executor can be connected at the existing browser-agent boundary without changing the UI contract.

## One-command local setup

Install Node.js 22+ and Docker Desktop. Then clone the project and run:

```bash
npm run traceux
```

The launcher is compatible with Windows, macOS, and Linux. `npm run traceUX` is also accepted on Windows if that capitalization is used.

That single command installs dependencies, starts PostgreSQL, applies migrations, adds the demo personas, and launches both the web application and NestJS API. Open `http://localhost:3000`.

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
- Recommendations are evidence-linked and verified before display.
- Ticket creation and product changes remain behind human approval.
- Production browser execution should add URL allowlists, isolated workers, secrets management, PII redaction, and artifact retention policies.
