export type AgentKey =
  | "orchestrator"
  | "planner"
  | "persona"
  | "browser"
  | "observer"
  | "analyst"
  | "verifier"
  | "reporter";

export interface AgentStage {
  agent: AgentKey;
  title: string;
  detail: string;
  progress: number;
  kind: "plan" | "action" | "evidence" | "reasoning" | "guardrail" | "output";
}

export const agentStages: AgentStage[] = [
  {
    agent: "orchestrator",
    title: "Run initialized",
    detail: "Validated the target, success criteria, and selected persona boundaries.",
    progress: 7,
    kind: "guardrail",
  },
  {
    agent: "planner",
    title: "Journey plan created",
    detail: "Mapped discovery, product evaluation, cart, checkout, and confirmation checkpoints.",
    progress: 18,
    kind: "plan",
  },
  {
    agent: "persona",
    title: "Persona policies loaded",
    detail: "Applied patience, confidence, reading depth, device, and accessibility behavior.",
    progress: 30,
    kind: "reasoning",
  },
  {
    agent: "browser",
    title: "Browser journeys executing",
    detail: "Performed navigation, search, selection, cart, and checkout interactions in isolation.",
    progress: 48,
    kind: "action",
  },
  {
    agent: "observer",
    title: "Behavior evidence captured",
    detail: "Recorded retries, dwell time, focus order, console signals, DOM state, and screenshots.",
    progress: 64,
    kind: "evidence",
  },
  {
    agent: "analyst",
    title: "UX risks reasoned",
    detail: "Correlated behavior signals with page context to identify likely confusion and drop-off.",
    progress: 79,
    kind: "reasoning",
  },
  {
    agent: "verifier",
    title: "Findings verified",
    detail: "Removed unsupported claims and retained only issues with reproducible evidence.",
    progress: 90,
    kind: "guardrail",
  },
  {
    agent: "reporter",
    title: "Review package ready",
    detail: "Prioritized findings and generated clear, implementation-ready recommendations.",
    progress: 100,
    kind: "output",
  },
];
