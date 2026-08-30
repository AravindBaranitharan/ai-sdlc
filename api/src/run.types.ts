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
    detail: "Mapped the submitted goal and success criteria into observable page checks.",
    progress: 18,
    kind: "plan",
  },
  {
    agent: "persona",
    title: "Persona policies loaded",
    detail: "Loaded patience, confidence, reading depth, and accessibility context for analysis.",
    progress: 30,
    kind: "reasoning",
  },
  {
    agent: "browser",
    title: "Read-only browser capture executing",
    detail: "Opening the submitted public target in an isolated Chromium session without clicks or submissions.",
    progress: 48,
    kind: "action",
  },
  {
    agent: "observer",
    title: "Behavior evidence captured",
    detail: "Recorded the real viewport, focus sequence, accessibility names, DOM structure, network failures, and console signals.",
    progress: 64,
    kind: "evidence",
  },
  {
    agent: "analyst",
    title: "UX risks reasoned",
    detail: "Correlated captured page evidence with the stated journey and selected persona context.",
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
