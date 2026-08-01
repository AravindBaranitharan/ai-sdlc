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

The prototype uses a deterministic AI-compatible runtime by default, so the complete demo works without an external model key. The agent stages expose typed boundaries where a production LLM and real Playwright executor can be connected without changing the UI contract.

## Local setup

Requirements: Node.js 22+, PostgreSQL, and Redis. PostgreSQL should contain a `traceux` database and user matching `api/.env.example`.

```bash
npm install
npm --prefix api install
npm --prefix api run prisma:generate
npm --prefix api run prisma:migrate -- --name init
npm --prefix api run prisma:seed
```

Run the application in two terminals:

```bash
npm run dev
```

```bash
npm run dev:api
```

Open `http://localhost:3000`. The API health endpoint is available at `http://localhost:4000/api/health`.

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
