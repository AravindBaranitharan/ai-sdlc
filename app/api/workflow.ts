import type { prototypeRuns } from "@/db/schema";

type RunRow = typeof prototypeRuns.$inferSelect;

export interface WorkflowEvent {
  id: string;
  agent: string;
  title: string;
  detail: string;
  progress: number;
  kind: string;
  createdAt: string;
}

export interface WorkflowFinding {
  id: string;
  title: string;
  summary: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  persona: string;
  journeyStep: string;
  recommendation: string;
  status: string;
  reviewNote?: string;
  reviewedAt?: string;
  ticketId?: string;
  ticketStatus?: string;
  evidence: { signal: string; selector: string; screenshot: string };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function makeWorkflow(run: RunRow) {
  const createdAt = new Date().toISOString();
  const personas = parseJson<string[]>(run.personaIds, []);
  const events: WorkflowEvent[] = [
    { id: crypto.randomUUID(), agent: "orchestrator", title: "Run initialized", detail: `Validated ${run.targetUrl}, success criteria, and safe-mode boundaries.`, progress: 7, kind: "guardrail", createdAt },
    { id: crypto.randomUUID(), agent: "planner", title: "Journey plan created", detail: `Converted “${run.goal}” into five observable checkpoints.`, progress: 18, kind: "plan", createdAt },
    { id: crypto.randomUUID(), agent: "persona", title: `${personas.length} behavior policies loaded`, detail: "Applied patience, confidence, reading depth, recovery, and accessibility behavior.", progress: 30, kind: "reasoning", createdAt },
    { id: crypto.randomUUID(), agent: "browser", title: "Safe browser journey simulated", detail: "Executed navigation, selection, retry, and completion actions without destructive operations.", progress: 48, kind: "action", createdAt },
    { id: crypto.randomUUID(), agent: "observer", title: "Behavior evidence captured", detail: "Recorded dwell, backtracks, focus sequence, and visible UI state for each persona.", progress: 64, kind: "evidence", createdAt },
    { id: crypto.randomUUID(), agent: "analyst", title: "UX risks reasoned", detail: "Correlated behavior signals with journey context and the stated completion criteria.", progress: 79, kind: "reasoning", createdAt },
    { id: crypto.randomUUID(), agent: "verifier", title: "Findings verified", detail: "Removed unsupported observations and retained three reproducible risks.", progress: 90, kind: "guardrail", createdAt },
    { id: crypto.randomUUID(), agent: "reporter", title: "Review package ready", detail: `Prioritized evidence for ${run.projectName} and prepared human-approved delivery actions.`, progress: 100, kind: "output", createdAt },
  ];

  const findings: WorkflowFinding[] = [
    {
      id: crypto.randomUUID(),
      title: "Keyboard focus skips the required selector",
      summary: "The keyboard-only policy could not reach a required choice in the expected tab sequence.",
      severity: "CRITICAL",
      confidence: 98,
      persona: "Keyboard Navigator",
      journeyStep: "Primary journey · Required choice",
      evidence: { signal: "Focus moved from content to the primary action", selector: "[role='radiogroup']", screenshot: "focus-order-evidence.png" },
      recommendation: "Use native controls or roving tabindex, expose the group label, and provide a visible focus treatment.",
      status: "Needs review",
    },
    {
      id: crypto.randomUUID(),
      title: "Critical cost information appears too late",
      summary: "Cautious and first-time policies paused or backtracked when the final cost changed near completion.",
      severity: "HIGH",
      confidence: 94,
      persona: "Cautious Buyer",
      journeyStep: "Completion · Final review",
      evidence: { signal: "14.2s dwell · 2 backtracks", selector: "[data-testid='final-total']", screenshot: "late-cost-evidence.png" },
      recommendation: "Show the estimated total earlier and preserve it consistently through the final step.",
      status: "Needs review",
    },
    {
      id: crypto.randomUUID(),
      title: "Secondary promotion distracts from completion",
      summary: "Fast-scanning policies repeatedly opened an optional promotion control and delayed completion.",
      severity: "MEDIUM",
      confidence: 87,
      persona: "First-time Explorer",
      journeyStep: "Completion · Confirmation",
      evidence: { signal: "3 expansions · 18.7s combined dwell", selector: "[data-testid='promotion-code']", screenshot: "promotion-distraction.png" },
      recommendation: "Move the optional control below the summary and keep it collapsed behind a low-emphasis action.",
      status: "Needs review",
    },
  ];

  return { events, findings };
}

export function serializeRun(run: RunRow) {
  const personaIds = parseJson<string[]>(run.personaIds, []);
  const findings = parseJson<WorkflowFinding[]>(run.findingsJson, []);
  const events = parseJson<WorkflowEvent[]>(run.eventsJson, []);
  const tickets = parseJson<Array<Record<string, unknown>>>(run.ticketsJson, []);
  return {
    ...run,
    personaIds,
    findings,
    events,
    tickets,
    project: { name: run.projectName, targetUrl: run.targetUrl },
  };
}
