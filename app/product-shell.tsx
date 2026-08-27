"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  Command,
  Eye,
  FileText,
  Gauge,
  History,
  Keyboard,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  MousePointer2,
  Network,
  Play,
  Plus,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TestTube2,
  Users,
  WandSparkles,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type View = "overview" | "scenario" | "live" | "findings" | "personas" | "history";
type Severity = "Critical" | "High" | "Medium" | "Low";

interface Persona {
  id: string;
  name: string;
  description: string;
  traits: string[];
  accessibility?: string | null;
  patience: number;
  confidence: number;
}

interface Finding {
  id: string;
  title: string;
  summary: string;
  severity: Severity;
  confidence: number;
  persona: string;
  journeyStep: string;
  recommendation: string;
  status: string;
  reviewNote?: string;
  reviewedAt?: string;
  ticketId?: string;
  ticketStatus?: string;
  evidence: {
    signal: string;
    selector: string;
    screenshot: string;
  };
}

interface AgentEvent {
  id: string;
  agent: string;
  title: string;
  detail: string;
  progress: number;
  kind: string;
  createdAt?: string;
}

interface TestRun {
  id: string;
  name: string;
  goal: string;
  targetUrl: string;
  status: string;
  score: number;
  personas: number;
  findings: number;
  createdAt: string;
}

interface TicketDraft {
  id: string;
  findingId?: string;
  title: string;
  severity: string;
  status: string;
  createdAt?: string;
}

interface AiRuntime {
  provider: "openai" | "demo";
  model: string | null;
  configured: boolean;
  liveBrowser: boolean;
}

type CustomPersonaInput = Omit<Persona, "id">;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:4000/api" : "/api");

const personaSeeds: Persona[] = [
  {
    id: "new-user",
    name: "First-time Explorer",
    description: "Relies on clear labels, progressive guidance, and familiar patterns.",
    traits: ["low familiarity", "cautious", "reads guidance"],
    patience: 62,
    confidence: 34,
  },
  {
    id: "impatient-shopper",
    name: "Impatient Shopper",
    description: "Scans quickly, skips detail, and abandons after repeated friction.",
    traits: ["fast scanning", "mobile-first", "low patience"],
    patience: 24,
    confidence: 78,
  },
  {
    id: "keyboard-user",
    name: "Keyboard Navigator",
    description: "Completes every task without a mouse and expects predictable focus.",
    traits: ["keyboard-only", "systematic", "accessibility"],
    accessibility: "Keyboard-only navigation",
    patience: 76,
    confidence: 70,
  },
  {
    id: "cautious-buyer",
    name: "Cautious Buyer",
    description: "Looks for reassurance, price clarity, and reversible choices.",
    traits: ["risk-aware", "detail-oriented", "trust-sensitive"],
    patience: 84,
    confidence: 45,
  },
];

const findingSeeds: Finding[] = [
  {
    id: "finding-focus",
    title: "Keyboard focus skips the size selector",
    summary: "The keyboard-only persona cannot reach the required size options in the expected tab sequence.",
    severity: "Critical",
    confidence: 98,
    persona: "Keyboard Navigator",
    journeyStep: "Product · Select size",
    evidence: {
      signal: "Focus moved from gallery to add-to-cart",
      selector: "[role='radiogroup'][aria-label='Size']",
      screenshot: "product-focus-order.png",
    },
    recommendation: "Use native radio inputs or roving tabindex, expose the group label, and add a visible focus treatment.",
    status: "Needs review",
  },
  {
    id: "finding-delivery",
    title: "Delivery cost appears too late",
    summary: "Three personas paused or backtracked when the delivery fee first appeared during checkout.",
    severity: "High",
    confidence: 94,
    persona: "Cautious Buyer",
    journeyStep: "Checkout · Delivery",
    evidence: {
      signal: "14.2s dwell · 2 backtracks",
      selector: "[data-testid='delivery-total']",
      screenshot: "checkout-delivery.png",
    },
    recommendation: "Show an estimated delivery range on product and cart pages, then preserve the amount through checkout.",
    status: "Needs review",
  },
  {
    id: "finding-promo",
    title: "Promo field distracts from payment",
    summary: "First-time and impatient personas repeatedly searched for a code and delayed payment completion.",
    severity: "Medium",
    confidence: 87,
    persona: "First-time Explorer",
    journeyStep: "Checkout · Payment",
    evidence: {
      signal: "3 expansions · 18.7s combined dwell",
      selector: "#promotion-code",
      screenshot: "checkout-promo.png",
    },
    recommendation: "Move the promo control below the order summary and keep it collapsed behind a low-emphasis action.",
    status: "Approved",
  },
];

const eventSeeds: AgentEvent[] = [
  {
    id: "e1",
    agent: "planner",
    title: "Journey plan created",
    detail: "Mapped discovery, product evaluation, cart, checkout, and confirmation checkpoints.",
    progress: 18,
    kind: "plan",
  },
  {
    id: "e2",
    agent: "persona",
    title: "Four behavior policies loaded",
    detail: "Applied patience, confidence, reading depth, device, and accessibility behavior.",
    progress: 30,
    kind: "reasoning",
  },
  {
    id: "e3",
    agent: "browser",
    title: "Browser journeys completed",
    detail: "Executed 36 interactions across four isolated persona sessions.",
    progress: 64,
    kind: "action",
  },
  {
    id: "e4",
    agent: "verifier",
    title: "Evidence package verified",
    detail: "Retained three reproducible UX risks and removed two unsupported observations.",
    progress: 100,
    kind: "guardrail",
  },
];

const runSeeds: TestRun[] = [
  {
    id: "run-checkout",
    name: "Checkout confidence",
    goal: "Find anything that prevents a new customer from completing checkout.",
    targetUrl: "demo.traceux.app/checkout",
    status: "Review",
    score: 72,
    personas: 4,
    findings: 3,
    createdAt: "Today, 14:28",
  },
  {
    id: "run-search",
    name: "Product discovery",
    goal: "Validate search and filtering for an impatient mobile shopper.",
    targetUrl: "demo.traceux.app/search",
    status: "Completed",
    score: 84,
    personas: 3,
    findings: 2,
    createdAt: "Yesterday, 17:42",
  },
  {
    id: "run-onboarding",
    name: "Account onboarding",
    goal: "Measure clarity and trust during registration and verification.",
    targetUrl: "demo.traceux.app/signup",
    status: "Completed",
    score: 91,
    personas: 4,
    findings: 1,
    createdAt: "Jul 30, 11:06",
  },
];

const localAgentStages: Omit<AgentEvent, "id">[] = [
  { agent: "orchestrator", title: "Run initialized", detail: "Validated target, success criteria, and safety boundaries.", progress: 7, kind: "guardrail" },
  { agent: "planner", title: "Journey plan created", detail: "Generated checkpoints and completion criteria from the business goal.", progress: 18, kind: "plan" },
  { agent: "persona", title: "Persona policies loaded", detail: "Applied patience, confidence, accessibility, and reading behavior.", progress: 30, kind: "reasoning" },
  { agent: "browser", title: "Browser journeys executing", detail: "Navigating, selecting, retrying, and validating the target journey.", progress: 48, kind: "action" },
  { agent: "observer", title: "Behavior evidence captured", detail: "Collected dwell, retries, focus order, DOM state, and screenshots.", progress: 64, kind: "evidence" },
  { agent: "analyst", title: "UX risks reasoned", detail: "Correlated observed behavior with visible page context.", progress: 79, kind: "reasoning" },
  { agent: "verifier", title: "Findings verified", detail: "Removed claims without reproducible supporting evidence.", progress: 90, kind: "guardrail" },
  { agent: "reporter", title: "Review package ready", detail: "Prioritized findings and prepared implementation-ready recommendations.", progress: 100, kind: "output" },
];

const navItems: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "scenario", label: "Scenario studio", icon: WandSparkles },
  { id: "live", label: "Live run", icon: Activity },
  { id: "findings", label: "Findings", icon: Radar },
  { id: "personas", label: "Persona lab", icon: Users },
  { id: "history", label: "Run history", icon: History },
];

const agentNames: Record<string, string> = {
  orchestrator: "Orchestrator",
  planner: "Scenario planner",
  persona: "Persona agent",
  browser: "Browser agent",
  observer: "Observer",
  analyst: "UX analyst",
  verifier: "Evidence verifier",
  reporter: "Reporter",
};

function normalizeFinding(raw: Record<string, unknown>): Finding {
  const severity = String(raw.severity ?? "MEDIUM");
  const formattedSeverity = `${severity.charAt(0)}${severity.slice(1).toLowerCase()}` as Severity;
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    title: String(raw.title ?? "UX finding"),
    summary: String(raw.summary ?? "Observed behavioral friction."),
    severity: formattedSeverity,
    confidence: Number(raw.confidence ?? 80),
    persona: String(raw.persona ?? "Multiple personas"),
    journeyStep: String(raw.journeyStep ?? "Journey"),
    recommendation: String(raw.recommendation ?? "Review the evidence and update the interaction."),
    status: String(raw.status ?? "Needs review"),
    reviewNote: raw.reviewNote ? String(raw.reviewNote) : undefined,
    reviewedAt: raw.reviewedAt ? String(raw.reviewedAt) : undefined,
    ticketId: raw.ticketId ? String(raw.ticketId) : undefined,
    ticketStatus: raw.ticketStatus ? String(raw.ticketStatus) : undefined,
    evidence: (raw.evidence as Finding["evidence"]) ?? {
      signal: "Behavior signal captured",
      selector: "page element",
      screenshot: "evidence.png",
    },
  };
}

function normalizeRun(raw: Record<string, unknown>): TestRun {
  const createdAt = raw.createdAt ? new Date(String(raw.createdAt)) : null;
  const personaIds = Array.isArray(raw.personaIds)
    ? raw.personaIds
    : (() => {
        try {
          return JSON.parse(String(raw.personaIds ?? "[]")) as string[];
        } catch {
          return [];
        }
      })();
  const project = raw.project as { name?: string } | undefined;
  const rawStatus = String(raw.status ?? "QUEUED");
  return {
    id: String(raw.id),
    name: String(project?.name ?? raw.projectName ?? "UX simulation"),
    goal: String(raw.goal ?? "Behavior simulation"),
    targetUrl: String(raw.targetUrl ?? "").replace(/^https?:\/\//, ""),
    status: rawStatus.charAt(0) + rawStatus.slice(1).toLowerCase(),
    score: Number(raw.uxScore ?? raw.score ?? 0),
    personas: personaIds.length,
    findings: Array.isArray(raw.findings) ? raw.findings.length : Number(raw.frictionCount ?? 0),
    createdAt: createdAt && !Number.isNaN(createdAt.valueOf())
      ? createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "Recent",
  };
}

function downloadText(filename: string, textContent: string, type: string) {
  const url = URL.createObjectURL(new Blob([textContent], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function ProductShell() {
  const [view, setView] = useState<View>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>(personaSeeds);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([
    "new-user",
    "impatient-shopper",
    "keyboard-user",
    "cautious-buyer",
  ]);
  const [events, setEvents] = useState<AgentEvent[]>(eventSeeds);
  const [findings, setFindings] = useState<Finding[]>(findingSeeds);
  const [runs, setRuns] = useState<TestRun[]>(runSeeds);
  const [progress, setProgress] = useState(100);
  const [runStatus, setRunStatus] = useState("Ready for review");
  const [runtime, setRuntime] = useState<"connected" | "demo">("demo");
  const [aiRuntime, setAiRuntime] = useState<AiRuntime>({ provider: "demo", model: null, configured: false, liveBrowser: false });
  const [isLaunching, setIsLaunching] = useState(false);
  const [toast, setToast] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [ticketDrafts, setTicketDrafts] = useState<TicketDraft[]>([]);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [safeMode, setSafeMode] = useState(true);
  const [evidenceCapture, setEvidenceCapture] = useState(true);
  const [projectName, setProjectName] = useState("Nova Commerce");
  const [targetUrl, setTargetUrl] = useState("https://demo.traceux.app/checkout");
  const [goal, setGoal] = useState("Find anything that prevents a first-time customer from completing checkout confidently.");
  const [successCriteria, setSuccessCriteria] = useState("Order confirmation is visible and the final price matches the cart.");
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    async function loadRuntime() {
      try {
        const [healthResponse, personaResponse, runsResponse] = await Promise.all([
          fetch(`${API_URL}/health`),
          fetch(`${API_URL}/personas`),
          fetch(`${API_URL}/runs`),
        ]);
        if (!healthResponse.ok || !personaResponse.ok) return;
        const healthData = (await healthResponse.json()) as { ai?: AiRuntime };
        const personaData = (await personaResponse.json()) as Persona[];
        setPersonas(personaData);
        setRuntime("connected");
        if (healthData.ai) setAiRuntime(healthData.ai);
        if (runsResponse.ok) {
          const remoteRuns = (await runsResponse.json()) as Array<Record<string, unknown>>;
          if (remoteRuns.length) {
            setRuns((current) => [
              ...remoteRuns.slice(0, 8).map(normalizeRun),
              ...current,
            ].filter((run, index, all) => all.findIndex((candidate) => candidate.id === run.id) === index).slice(0, 10));
          }
        }
      } catch {
        setRuntime("demo");
      }
    }

    void loadRuntime();
    return () => eventSourceRef.current?.close();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = window.localStorage.getItem("traceux-settings");
      if (!stored) return;
      try {
        const settings = JSON.parse(stored) as { safeMode?: boolean; evidenceCapture?: boolean };
        setSafeMode(settings.safeMode ?? true);
        setEvidenceCapture(settings.evidenceCapture ?? true);
      } catch {
        window.localStorage.removeItem("traceux-settings");
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeEvent = events.at(-1);
  const criticalCount = findings.filter((finding) => finding.severity === "Critical" || finding.severity === "High").length;
  const selectedFinding = findings[0];

  const personaCoverage = useMemo(() => {
    const selected = personas.filter((persona) => selectedPersonas.includes(persona.id));
    return {
      patience: selected.length ? Math.round(selected.reduce((sum, persona) => sum + persona.patience, 0) / selected.length) : 0,
      confidence: selected.length ? Math.round(selected.reduce((sum, persona) => sum + persona.confidence, 0) / selected.length) : 0,
    };
  }, [personas, selectedPersonas]);

  function navigate(nextView: View) {
    setView(nextView);
    setMobileNav(false);
  }

  function togglePersona(id: string) {
    setSelectedPersonas((current) =>
      current.includes(id) ? current.filter((personaId) => personaId !== id) : [...current, id],
    );
  }

  function handleRemoteEvent(event: Event) {
    const message = event as MessageEvent<string>;
    const data = JSON.parse(message.data) as AgentEvent;
    setEvents((current) => [...current, data]);
    setProgress(data.progress);
    setRunStatus(`${agentNames[data.agent] ?? data.agent} working`);
  }

  function connectRunStream(id: string) {
    eventSourceRef.current?.close();
    const source = new EventSource(`${API_URL}/runs/${id}/events`);
    eventSourceRef.current = source;
    ["plan", "action", "evidence", "reasoning", "guardrail", "output"].forEach((type) => {
      source.addEventListener(type, handleRemoteEvent);
    });
    source.addEventListener("complete", (event) => {
      const message = event as MessageEvent<string>;
      const run = JSON.parse(message.data) as { findings?: Array<Record<string, unknown>> };
      setFindings(run.findings?.map(normalizeFinding) ?? findingSeeds);
      setProgress(100);
      setRunStatus("Ready for review");
      setIsLaunching(false);
      setToast("Simulation complete — three verified findings are ready.");
      setRuns((current) => current.map((item) => item.id === id ? { ...item, status: "Review", score: 72, findings: run.findings?.length ?? 3 } : item));
      source.close();
    });
    source.onerror = () => {
      source.close();
      window.setTimeout(async () => {
        try {
          const response = await fetch(`${API_URL}/runs/${id}`);
          if (!response.ok) throw new Error("Run recovery failed");
          const run = await response.json() as Record<string, unknown>;
          if (String(run.status) === "REVIEW") {
            setEvents(Array.isArray(run.events) ? (run.events as AgentEvent[]) : []);
            setFindings(Array.isArray(run.findings) ? (run.findings as Array<Record<string, unknown>>).map(normalizeFinding) : []);
            setProgress(100);
            setRunStatus("Ready for review");
            setIsLaunching(false);
            setToast("Simulation complete — the verified run was recovered.");
          }
        } catch {
          setIsLaunching(false);
          setToast("The live stream disconnected. Reopen the saved run from history.");
        }
      }, 700);
    };
  }

  async function animatePersistedRun(run: Record<string, unknown>) {
    const storedEvents = Array.isArray(run.events) ? run.events as Array<Record<string, unknown>> : [];
    const stages = storedEvents.length
      ? storedEvents.map((event) => ({
          id: String(event.id ?? crypto.randomUUID()),
          agent: String(event.agent),
          title: String(event.title),
          detail: String(event.detail),
          progress: Number(event.progress),
          kind: String(event.kind),
          createdAt: event.createdAt ? String(event.createdAt) : undefined,
        }))
      : localAgentStages.map((stage) => ({ ...stage, id: crypto.randomUUID() }));
    for (let index = 0; index < stages.length; index += 1) {
      await sleep(260);
      const stage = stages[index];
      setEvents((current) => [...current, { ...stage, id: `local-${Date.now()}-${index}` }]);
      setProgress(stage.progress);
      setRunStatus(`${agentNames[stage.agent] ?? stage.agent} working`);
    }
    const storedFindings = Array.isArray(run.findings) ? run.findings as Array<Record<string, unknown>> : [];
    setFindings(storedFindings.map(normalizeFinding));
    setRunStatus("Ready for review");
    setIsLaunching(false);
    setToast("Simulation complete — three verified findings are ready.");
    const id = String(run.id);
    setRuns((current) => current.map((item) => item.id === id ? { ...normalizeRun(run), createdAt: item.createdAt } : item));
  }

  async function launchSimulation(event: FormEvent) {
    event.preventDefault();
    if (!selectedPersonas.length) {
      setToast("Choose at least one persona before launching.");
      return;
    }

    setIsLaunching(true);
    setView("live");
    setEvents([]);
    setFindings([]);
    setProgress(2);
    setRunStatus("Initializing run");

    const payload = { projectName, targetUrl, goal, successCriteria, personaIds: selectedPersonas };
    try {
      const createdResponse = await fetch(`${API_URL}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!createdResponse.ok) throw new Error("Runtime unavailable");
      const created = (await createdResponse.json()) as { id: string };
      setActiveRunId(created.id);
      const streamingRuntime = API_URL.startsWith("http");
      if (streamingRuntime) connectRunStream(created.id);
      const startResponse = await fetch(`${API_URL}/runs/${created.id}/start`, { method: "POST" });
      if (!startResponse.ok) throw new Error("Run did not start");
      const started = (await startResponse.json()) as Record<string, unknown>;
      setRuntime("connected");
      setRuns((current) => [
        {
          id: created.id,
          name: projectName,
          goal,
          targetUrl: targetUrl.replace(/^https?:\/\//, ""),
          status: "Running",
          score: 0,
          personas: selectedPersonas.length,
          findings: 0,
          createdAt: "Just now",
        },
        ...current,
      ]);
      if (!streamingRuntime && String(started.status) === "REVIEW") {
        await animatePersistedRun(started);
      }
    } catch {
      eventSourceRef.current?.close();
      setIsLaunching(false);
      setRuntime("demo");
      setView("scenario");
      setToast("The run could not start. Your scenario is preserved — retry when the runtime is available.");
    }
  }

  async function reviewFinding(id: string, nextStatus: "Approved" | "Dismissed") {
    const previous = findings;
    setFindings((current) => current.map((finding) => (finding.id === id ? { ...finding, status: nextStatus } : finding)));
    if (!activeRunId) {
      setToast(nextStatus === "Approved" ? "Demo finding approved. Launch a run to save review decisions." : "Demo finding dismissed. Launch a run to save review decisions.");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/runs/${activeRunId}/findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Review was not saved");
      const saved = normalizeFinding(await response.json() as Record<string, unknown>);
      setFindings((current) => current.map((finding) => finding.id === id ? saved : finding));
      setToast(nextStatus === "Approved" ? "Finding approved and saved to the delivery workflow." : "Finding dismissed and the audit decision was saved.");
    } catch {
      setFindings(previous);
      setToast("The review decision could not be saved. Please retry.");
    }
  }

  async function openRun(id: string) {
    try {
      const response = await fetch(`${API_URL}/runs/${id}`);
      if (!response.ok) throw new Error("Run unavailable");
      const run = await response.json() as Record<string, unknown>;
      setActiveRunId(id);
      setProjectName(String((run.project as { name?: string } | undefined)?.name ?? run.projectName ?? "UX simulation"));
      setTargetUrl(String(run.targetUrl ?? ""));
      setGoal(String(run.goal ?? "Behavior simulation"));
      setSuccessCriteria(String(run.successCriteria ?? "The defined journey completes successfully."));
      if (Array.isArray(run.personaIds)) setSelectedPersonas(run.personaIds.map(String));
      setEvents(Array.isArray(run.events) ? (run.events as Array<Record<string, unknown>>).map((event) => ({
        id: String(event.id), agent: String(event.agent), title: String(event.title), detail: String(event.detail), progress: Number(event.progress), kind: String(event.kind), createdAt: event.createdAt ? String(event.createdAt) : undefined,
      })) : eventSeeds);
      setFindings(Array.isArray(run.findings) ? (run.findings as Array<Record<string, unknown>>).map(normalizeFinding) : findingSeeds);
      setProgress(Number(run.progress ?? 100));
      setRunStatus(String(run.status) === "RUNNING" ? "Agents working" : "Ready for review");
      navigate("live");
    } catch {
      navigate("live");
      setToast("This sample run is read-only. Launch a new run for persistent workflow actions.");
    }
  }

  function exportReport() {
    const lines = [
      `# TraceUX report — ${projectName}`,
      "",
      `Target: ${targetUrl}`,
      `Goal: ${goal}`,
      `Success criteria: ${successCriteria}`,
      "",
      ...findings.flatMap((finding, index) => [
        `## ${index + 1}. ${finding.title}`,
        `Severity: ${finding.severity} · Confidence: ${finding.confidence}% · Status: ${finding.status}`,
        `Persona: ${finding.persona} · Journey: ${finding.journeyStep}`,
        "",
        finding.summary,
        "",
        `Evidence: ${finding.evidence.signal} (${finding.evidence.selector})`,
        `Recommendation: ${finding.recommendation}`,
        finding.ticketId ? `Ticket draft: ${finding.ticketId}` : "",
        "",
      ]),
    ];
    downloadText(`traceux-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.md`, lines.join("\n"), "text/markdown");
    setToast("Report exported with findings, evidence, and review status.");
  }

  async function createTickets() {
    const approved = findings.filter((finding) => finding.status === "Approved");
    if (!approved.length) {
      setToast("Approve at least one finding before creating ticket drafts.");
      return;
    }
    try {
      let tickets: TicketDraft[];
      if (activeRunId) {
        const response = await fetch(`${API_URL}/runs/${activeRunId}/tickets`, { method: "POST" });
        if (!response.ok) throw new Error("Ticket drafts were not created");
        tickets = ((await response.json()) as { tickets: TicketDraft[] }).tickets;
      } else {
        tickets = approved.map((finding, index) => ({ id: `TUX-DEMO-${index + 1}`, title: finding.title, severity: finding.severity, status: "Draft" }));
      }
      setTicketDrafts(tickets);
      setTicketsOpen(true);
      setFindings((current) => current.map((finding) => {
        const ticket = tickets.find((candidate) => candidate.findingId === finding.id || candidate.title === finding.title);
        return ticket ? { ...finding, ticketId: ticket.id, ticketStatus: ticket.status } : finding;
      }));
      setToast(`${tickets.length} human-approved ticket draft${tickets.length === 1 ? "" : "s"} created.`);
    } catch {
      setToast("Ticket drafts could not be created. Review decisions are still saved.");
    }
  }

  async function createPersona(input: CustomPersonaInput) {
    const response = await fetch(`${API_URL}/personas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error("Persona was not saved");
    const persona = await response.json() as Persona;
    setPersonas((current) => [...current, persona]);
    setSelectedPersonas((current) => [...current, persona.id]);
    setPersonaOpen(false);
    setToast(`${persona.name} was saved and selected for the next run.`);
  }

  function saveSettings(nextSafeMode: boolean, nextEvidenceCapture: boolean) {
    setSafeMode(nextSafeMode);
    setEvidenceCapture(nextEvidenceCapture);
    window.localStorage.setItem("traceux-settings", JSON.stringify({ safeMode: nextSafeMode, evidenceCapture: nextEvidenceCapture }));
    setSettingsOpen(false);
    setToast("Execution preferences saved for this device.");
  }

  function prepareNewRun() {
    eventSourceRef.current?.close();
    setIsLaunching(false);
    navigate("scenario");
  }

  return (
    <div className="product-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <button className="brand" onClick={() => navigate("overview")} aria-label="Open TraceUX overview">
            <span className="brand-mark"><Command size={18} /></span>
            <span>Trace<span>UX</span></span>
          </button>
          <button className="sidebar-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <div className="workspace-picker">
          <span className="workspace-avatar">HX</span>
          <span><small>Workspace</small>Hexaware</span>
          <ChevronDown size={15} />
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? "nav-active" : ""} onClick={() => navigate(item.id)}>
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === "findings" && <span className="nav-count">{findings.length}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="runtime-card">
          <div className="runtime-title"><span className={`runtime-dot ${runtime}`} />{runtime === "connected" ? (aiRuntime.provider === "openai" ? "OpenAI agent runtime" : "Agent runtime online") : "Demo runtime ready"}</div>
          <p>{runtime === "connected" ? (aiRuntime.provider === "openai" ? `${aiRuntime.model ?? "OpenAI"} · review gated` : "Persistent workflow · review gated") : "Runtime connection required"}</p>
        </div>
        <button className="nav-settings" onClick={() => setSettingsOpen(true)}><Settings size={18} />Settings</button>
        <div className="profile-row">
          <span className="profile-avatar">KV</span>
          <span><strong>Kaviya</strong><small>Product workspace</small></span>
          <ChevronRight size={16} />
        </div>
      </aside>

      {mobileNav && <button className="sidebar-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Hexaware</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.id === view)?.label}</strong></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search" aria-expanded={searchOpen} onClick={() => { setSearchOpen((open) => !open); setNotificationOpen(false); }}><Search size={18} /></button>
            <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationOpen} onClick={() => { setNotificationOpen((open) => !open); setSearchOpen(false); }}><MessageSquareText size={18} /><span /></button>
            <button className="button-primary compact" onClick={() => navigate("scenario")}><Plus size={17} />New simulation</button>
            {searchOpen && <SearchPanel runs={runs} findings={findings} onNavigate={(next) => { setSearchOpen(false); navigate(next); }} onOpenRun={(id) => { setSearchOpen(false); void openRun(id); }} />}
            {notificationOpen && <NotificationPanel findings={findings} onNavigate={(next) => { setNotificationOpen(false); navigate(next); }} />}
          </div>
        </header>

        <div className="content-area">
          {view === "overview" && (
            <OverviewView
              findings={findings}
              runs={runs}
              criticalCount={criticalCount}
              onNavigate={navigate}
            />
          )}
          {view === "scenario" && (
            <ScenarioView
              projectName={projectName}
              setProjectName={setProjectName}
              targetUrl={targetUrl}
              setTargetUrl={setTargetUrl}
              goal={goal}
              setGoal={setGoal}
              successCriteria={successCriteria}
              setSuccessCriteria={setSuccessCriteria}
              personas={personas}
              selectedPersonas={selectedPersonas}
              togglePersona={togglePersona}
              coverage={personaCoverage}
              onSubmit={launchSimulation}
              isLaunching={isLaunching}
            />
          )}
          {view === "live" && (
            <LiveRunView
              projectName={projectName}
              targetUrl={targetUrl}
              personaCount={selectedPersonas.length}
              progress={progress}
              status={runStatus}
              events={events}
              findings={findings}
              activeEvent={activeEvent}
              runtime={runtime}
              aiRuntime={aiRuntime}
              onViewFindings={() => navigate("findings")}
              onNewRun={prepareNewRun}
            />
          )}
          {view === "findings" && (
            <FindingsView findings={findings.length ? findings : findingSeeds} onReview={reviewFinding} onExport={exportReport} onCreateTickets={createTickets} />
          )}
          {view === "personas" && (
            <PersonasView personas={personas} selectedPersonas={selectedPersonas} togglePersona={togglePersona} onUse={() => navigate("scenario")} onCreate={() => setPersonaOpen(true)} />
          )}
          {view === "history" && <HistoryView runs={runs} onOpen={(id) => void openRun(id)} onExport={() => {
            const rows = [["Simulation", "Status", "Coverage", "Findings", "UX score", "Target"], ...runs.map((run) => [run.name, run.status, String(run.personas), String(run.findings), String(run.score), run.targetUrl])];
            downloadText("traceux-run-history.csv", rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n"), "text/csv");
            setToast("Run history exported as CSV.");
          }} />}
        </div>
      </main>

      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
      {settingsOpen && <SettingsDialog safeMode={safeMode} evidenceCapture={evidenceCapture} onClose={() => setSettingsOpen(false)} onSave={saveSettings} />}
      {personaOpen && <PersonaDialog onClose={() => setPersonaOpen(false)} onCreate={createPersona} />}
      {ticketsOpen && <TicketDialog tickets={ticketDrafts} onClose={() => setTicketsOpen(false)} onExport={() => {
        downloadText("traceux-ticket-drafts.json", JSON.stringify(ticketDrafts, null, 2), "application/json");
        setToast("Ticket drafts exported as integration-ready JSON.");
      }} />}
      {selectedFinding && <span className="sr-only">Top finding: {selectedFinding.title}</span>}
    </div>
  );
}

function PageHeading({ eyebrow, title, copy, actions }: { eyebrow: string; title: string; copy: string; actions?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

function OverviewView({ findings, runs, criticalCount, onNavigate }: { findings: Finding[]; runs: TestRun[]; criticalCount: number; onNavigate: (view: View) => void }) {
  return (
    <div className="view-stack overview-view">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker"><Sparkles size={15} />Pre-release behavior intelligence</span>
          <h1>Catch the moment users get stuck—<em>before release.</em></h1>
          <p>Agentic UX testing that plans journeys, behaves like real people, verifies the evidence, and gives your team a fixable answer.</p>
          <div className="hero-actions">
            <button className="button-primary" onClick={() => onNavigate("scenario")}><Play size={17} fill="currentColor" />Run a simulation</button>
            <button className="button-secondary" onClick={() => onNavigate("live")}><Eye size={17} />Open latest run</button>
          </div>
          <div className="hero-proof">
            <span><ShieldCheck size={16} />Human-approved output</span>
            <span><Network size={16} />8 specialized agents</span>
            <span><Code2 size={16} />Evidence attached</span>
          </div>
        </div>
        <div className="journey-radar-card">
          <div className="radar-top"><span>Checkout confidence</span><span className="status-pill review">Needs review</span></div>
          <div className="score-row">
            <div className="score-ring"><strong>72</strong><span>UX score</span></div>
            <div><p>4 personas · 36 actions</p><strong>{criticalCount} release blockers</strong><span>Predicted completion 76%</span></div>
          </div>
          <div className="journey-track" aria-label="Journey risk by step">
            {[{ label: "Discover", value: 28 }, { label: "Product", value: 68 }, { label: "Cart", value: 42 }, { label: "Checkout", value: 88 }, { label: "Confirm", value: 18 }].map((item) => (
              <div key={item.label}><span>{item.label}</span><div><i style={{ width: `${item.value}%` }} /></div><small>{item.value}</small></div>
            ))}
          </div>
          <button className="text-button" onClick={() => onNavigate("findings")}>Review evidence <ArrowRight size={15} /></button>
        </div>
      </section>

      <section className="metrics-grid">
        <Metric icon={TestTube2} label="Journeys tested" value="36" note="+12 this sprint" tone="violet" />
        <Metric icon={AlertTriangle} label="Release blockers" value={String(criticalCount || 2)} note="2 need review" tone="coral" />
        <Metric icon={Users} label="Persona coverage" value="84%" note="4 active profiles" tone="blue" />
        <Metric icon={Gauge} label="Average UX score" value="82" note="+6 after fixes" tone="green" />
      </section>

      <section className="dashboard-grid">
        <div className="panel findings-panel">
          <div className="panel-heading"><div><p className="eyebrow">Prioritized evidence</p><h2>What needs attention</h2></div><button className="text-button" onClick={() => onNavigate("findings")}>View all <ArrowRight size={14} /></button></div>
          <div className="finding-list compact-list">
            {(findings.length ? findings : findingSeeds).slice(0, 3).map((finding) => (
              <button key={finding.id} className="finding-row" onClick={() => onNavigate("findings")}>
                <span className={`severity-mark ${finding.severity.toLowerCase()}`}><AlertTriangle size={16} /></span>
                <span className="finding-main"><strong>{finding.title}</strong><small>{finding.journeyStep} · {finding.persona}</small></span>
                <span className={`severity-pill ${finding.severity.toLowerCase()}`}>{finding.severity}</span>
                <span className="confidence"><strong>{finding.confidence}%</strong><small>confidence</small></span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </div>

        <div className="panel runs-panel">
          <div className="panel-heading"><div><p className="eyebrow">Recent activity</p><h2>Simulation runs</h2></div><button className="icon-button small" onClick={() => onNavigate("history")} aria-label="Open run history"><History size={16} /></button></div>
          <div className="mini-run-list">
            {runs.slice(0, 3).map((run) => (
              <button key={run.id} onClick={() => onNavigate("live")}>
                <span className={`run-status-dot ${run.status.toLowerCase()}`} />
                <span><strong>{run.name}</strong><small>{run.createdAt} · {run.personas} personas</small></span>
                <span className="mini-score">{run.score || "—"}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, note, tone }: { icon: LucideIcon; label: string; value: string; note: string; tone: string }) {
  return (
    <div className="metric-card">
      <span className={`metric-icon ${tone}`}><Icon size={19} /></span>
      <div><p>{label}</p><strong>{value}</strong><small>{note}</small></div>
    </div>
  );
}

function ScenarioView({ projectName, setProjectName, targetUrl, setTargetUrl, goal, setGoal, successCriteria, setSuccessCriteria, personas, selectedPersonas, togglePersona, coverage, onSubmit, isLaunching }: {
  projectName: string; setProjectName: (value: string) => void; targetUrl: string; setTargetUrl: (value: string) => void; goal: string; setGoal: (value: string) => void; successCriteria: string; setSuccessCriteria: (value: string) => void; personas: Persona[]; selectedPersonas: string[]; togglePersona: (id: string) => void; coverage: { patience: number; confidence: number }; onSubmit: (event: FormEvent) => void; isLaunching: boolean;
}) {
  return (
    <div className="view-stack">
      <PageHeading eyebrow="Scenario studio" title="Design the human journey" copy="Describe the outcome. The planner and persona agents turn it into an observable, evidence-producing simulation." />
      <form className="scenario-layout" onSubmit={onSubmit}>
        <div className="scenario-main">
          <section className="panel form-section">
            <div className="section-number">01</div>
            <div className="section-copy"><h2>Target and intent</h2><p>Give the agents a safe environment and a clear business outcome.</p></div>
            <div className="field-grid two-columns">
              <label><span>Project name</span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} required /></label>
              <label><span>Target URL</span><div className="input-with-icon"><Target size={16} /><input type="url" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} required /></div></label>
            </div>
            <label><span>Journey goal</span><textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} required /><small>Write the outcome in plain language; the scenario planner creates the steps.</small></label>
            <label><span>Success criteria</span><input value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} required /></label>
          </section>

          <section className="panel form-section">
            <div className="section-number">02</div>
            <div className="section-copy"><h2>Human behavior coverage</h2><p>Select distinct behavior policies. Each persona executes in an isolated browser context.</p></div>
            <div className="persona-selector-grid">
              {personas.map((persona) => {
                const selected = selectedPersonas.includes(persona.id);
                return (
                  <button type="button" key={persona.id} className={`persona-select-card ${selected ? "selected" : ""}`} onClick={() => togglePersona(persona.id)} aria-pressed={selected}>
                    <span className="persona-card-top"><span className="persona-glyph">{persona.name.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span><span className="selection-check">{selected && <Check size={14} />}</span></span>
                    <strong>{persona.name}</strong><p>{persona.description}</p>
                    <span className="trait-row">{persona.traits.slice(0, 2).map((trait) => <small key={trait}>{trait}</small>)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel form-section compact-section">
            <div className="section-number">03</div>
            <div className="section-copy"><h2>Execution guardrails</h2><p>The prototype runs read-only interactions and requires human approval for external actions.</p></div>
            <div className="guardrail-row">
              <span><ShieldCheck size={18} /><span><strong>Safe interaction mode</strong><small>No destructive or purchase actions</small></span></span>
              <span><Eye size={18} /><span><strong>Evidence capture</strong><small>DOM, behavior, console, and screenshots</small></span></span>
              <span><BadgeCheck size={18} /><span><strong>Human review</strong><small>No ticket or change without approval</small></span></span>
            </div>
          </section>
        </div>

        <aside className="scenario-summary panel">
          <p className="eyebrow">Run configuration</p><h2>Ready to simulate</h2>
          <div className="summary-target"><span><Target size={17} /></span><div><small>Target</small><strong>{targetUrl.replace(/^https?:\/\//, "")}</strong></div></div>
          <div className="summary-stat-row"><div><strong>{selectedPersonas.length}</strong><span>personas</span></div><div><strong>5</strong><span>journey phases</span></div><div><strong>8</strong><span>AI agents</span></div></div>
          <div className="coverage-block"><div><span>Average patience</span><strong>{coverage.patience}%</strong></div><div className="coverage-bar"><i style={{ width: `${coverage.patience}%` }} /></div><div><span>User confidence</span><strong>{coverage.confidence}%</strong></div><div className="coverage-bar secondary"><i style={{ width: `${coverage.confidence}%` }} /></div></div>
          <div className="agent-chain-mini">
            {["Plan", "Behave", "Observe", "Reason", "Verify", "Report"].map((step, index) => <span key={step}><i>{index + 1}</i>{step}</span>)}
          </div>
          <button className="button-primary launch-button" type="submit" disabled={isLaunching || !selectedPersonas.length}>{isLaunching ? <Activity className="spin" size={18} /> : <Play size={17} fill="currentColor" />}Launch simulation</button>
          <p className="summary-note"><Clock3 size={14} />Prototype runs complete in about 5 seconds.</p>
        </aside>
      </form>
    </div>
  );
}

function LiveRunView({ projectName, targetUrl, personaCount, progress, status, events, findings, activeEvent, runtime, aiRuntime, onViewFindings, onNewRun }: { projectName: string; targetUrl: string; personaCount: number; progress: number; status: string; events: AgentEvent[]; findings: Finding[]; activeEvent?: AgentEvent; runtime: "connected" | "demo"; aiRuntime: AiRuntime; onViewFindings: () => void; onNewRun: () => void }) {
  const isComplete = progress === 100;
  return (
    <div className="view-stack live-view">
      <PageHeading eyebrow="Run command center" title={projectName} copy={`${personaCount} behavior ${personaCount === 1 ? "policy is" : "policies are"} testing the defined journey.`} actions={<><span className={`live-status ${isComplete ? "complete" : "running"}`}><span />{isComplete ? "Ready for review" : status}</span><button className="button-secondary compact" onClick={onNewRun}><Plus size={16} />New run</button></>} />
      <section className="run-progress-panel panel">
        <div className="run-progress-copy"><span>{isComplete ? <CheckCircle2 size={18} /> : <Activity size={18} />}</span><div><strong>{isComplete ? "Simulation complete" : status}</strong><small>{activeEvent?.detail ?? "All verified evidence is ready for human review."}</small></div></div>
        <div className="progress-wrap"><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div>
        <span className="runtime-chip"><CircleDot size={14} />{runtime === "connected" ? (aiRuntime.provider === "openai" ? `OpenAI · ${aiRuntime.model ?? "connected"}` : "Persistent agent runtime") : "Runtime reconnecting"}</span>
      </section>
      <section className="command-grid">
        <BrowserPreview progress={progress} targetUrl={targetUrl} />
        <div className="panel agent-feed">
          <div className="panel-heading"><div><p className="eyebrow">Agent activity</p><h2>Reasoning trace</h2></div><span className="event-count">{events.length} events</span></div>
          <div className="event-list">
            {events.length ? events.map((event, index) => <AgentEventRow key={event.id ?? `${event.agent}-${index}`} event={event} active={index === events.length - 1 && !isComplete} />) : <div className="empty-feed"><BrainCircuit size={28} /><strong>Agents are preparing the run</strong><span>The first planning event will appear here.</span></div>}
          </div>
        </div>
      </section>
      <section className="live-bottom-grid">
        <div className="panel behavior-panel">
          <div className="panel-heading"><div><p className="eyebrow">Behavior telemetry</p><h2>Journey signals</h2></div><span className="status-pill neutral">{personaCount} personas</span></div>
          <div className="signal-grid"><Signal icon={MousePointer2} value="36" label="Interactions" /><Signal icon={Clock3} value="14.2s" label="Peak dwell" /><Signal icon={AlertTriangle} value="5" label="Hesitations" /><Signal icon={Keyboard} value="1" label="Focus failure" /></div>
          <div className="persona-lanes">
            {[{ name: "First-time Explorer", progress: 82, state: "Completed" }, { name: "Impatient Shopper", progress: 64, state: "Abandoned" }, { name: "Keyboard Navigator", progress: 48, state: "Blocked" }, { name: "Cautious Buyer", progress: 76, state: "Completed" }].map((persona) => <div key={persona.name}><span>{persona.name}</span><div><i style={{ width: `${persona.progress}%` }} /></div><small className={persona.state.toLowerCase()}>{persona.state}</small></div>)}
          </div>
        </div>
        <div className="panel verified-panel">
          <div className="verified-icon"><ShieldCheck size={24} /></div><p className="eyebrow">Verified output</p><h2>{findings.length || 3} findings with evidence</h2><p>The verifier removed unsupported observations. Every retained issue includes behavior signals, a page locator, and a recommended fix.</p>
          <div className="verified-stats"><span><strong>{findings.filter((finding) => finding.severity === "Critical").length || 1}</strong>critical</span><span><strong>94%</strong>avg confidence</span><span><strong>2</strong>personas blocked</span></div>
        <button className="button-primary" onClick={onViewFindings} disabled={!isComplete}>Review findings <ArrowRight size={16} /></button>
        </div>
      </section>
    </div>
  );
}

function BrowserPreview({ progress, targetUrl }: { progress: number; targetUrl: string }) {
  const [paymentReady, setPaymentReady] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  return (
    <div className="panel browser-panel">
      <div className="browser-bar"><span className="window-dots"><i /><i /><i /></span><div className="browser-address"><ShieldCheck size={13} />{targetUrl.replace(/^https?:\/\//, "")}</div><span className="viewport-pill">1280 × 800</span></div>
      <div className="browser-stage">
        <div className="mock-store-header"><strong>NOVA</strong><span>New in&nbsp;&nbsp;&nbsp; Women&nbsp;&nbsp;&nbsp; Men&nbsp;&nbsp;&nbsp; Journal</span><span><Search size={15} /><Users size={15} /></span></div>
        <div className="checkout-layout">
          <div className="checkout-form"><span className="mock-back">← Return to cart</span><h3>{paymentReady ? "Payment ready" : "Secure checkout"}</h3><div className="step-pills"><span className="done">1</span><i /><span className="done">2</span><i /><span className={paymentReady ? "done" : ""}>3</span></div><label>Email address<input value="alex@example.com" readOnly /></label><div className="field-pair"><label>First name<input value="Alex" readOnly /></label><label>Last name<input value="Morgan" readOnly /></label></div><label>Delivery option<div className="mock-radio selected"><CircleDot size={15} /><span>Express delivery<small>Arrives tomorrow</small></span><strong>₹240</strong></div></label><button type="button" onClick={() => setPaymentReady(true)}>{paymentReady ? "Payment step reached" : "Continue to payment"}</button></div>
          <div className="order-card"><p>Order summary</p><div className="product-thumb" /><strong>Everyday Runner</strong><small>Cloud / EU 39</small><hr /><span><small>Subtotal</small><strong>₹6,490</strong></span><span className="risk-line"><small>Delivery</small><strong>₹240</strong><i>Late reveal</i></span><span><small>Total</small><strong>₹6,730</strong></span><button type="button" className="promo-control" aria-expanded={promoOpen} onClick={() => setPromoOpen((open) => !open)}>Add promotion code <ChevronDown size={14} /></button>{promoOpen && <input className="promo-input" aria-label="Promotion code" placeholder="Enter code" />}</div>
        </div>
        {progress > 35 && progress < 100 && <div className="agent-cursor" style={{ left: `${Math.min(78, 28 + progress / 2)}%`, top: `${Math.max(34, 70 - progress / 3)}%` }}><MousePointer2 size={16} /><span>{progress < 65 ? "Impatient Shopper" : "Observer"}</span></div>}
        {progress === 100 && <><div className="risk-outline delivery-risk"><span>01</span></div><div className="risk-outline promo-risk"><span>02</span></div></>}
      </div>
      <div className="browser-footer"><span><span className={`runtime-dot ${progress === 100 ? "connected" : "demo"}`} />{progress === 100 ? "Evidence capture complete" : "Session recording"}</span><span>DOM + A11y + Console + Behavior</span></div>
    </div>
  );
}

function AgentEventRow({ event, active }: { event: AgentEvent; active: boolean }) {
  const icons: Record<string, LucideIcon> = { planner: Target, persona: Users, browser: MousePointer2, observer: Eye, analyst: BrainCircuit, verifier: ShieldCheck, reporter: FileText, orchestrator: Network };
  const Icon = icons[event.agent] ?? Bot;
  return <div className={`agent-event ${active ? "active" : ""}`}><span className="agent-event-icon"><Icon size={16} /></span><div><span><strong>{agentNames[event.agent] ?? event.agent}</strong><small>{event.progress}%</small></span><h3>{event.title}</h3><p>{event.detail}</p></div>{active ? <Activity className="spin" size={15} /> : <Check size={15} />}</div>;
}

function Signal({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return <div><Icon size={17} /><span><strong>{value}</strong><small>{label}</small></span></div>;
}

function FindingsView({ findings, onReview, onExport, onCreateTickets }: { findings: Finding[]; onReview: (id: string, status: "Approved" | "Dismissed") => void; onExport: () => void; onCreateTickets: () => void }) {
  const [selectedId, setSelectedId] = useState(findings[0]?.id ?? "");
  const [sortMode, setSortMode] = useState<"priority" | "confidence">("priority");
  const selected = findings.find((finding) => finding.id === selectedId) ?? findings[0];
  const severityRank: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const sortedFindings = [...findings].sort((a, b) => sortMode === "priority" ? severityRank[b.severity] - severityRank[a.severity] : b.confidence - a.confidence);
  if (!selected) return null;
  return (
    <div className="view-stack findings-view">
      <PageHeading eyebrow="Evidence review" title="Verified UX findings" copy="Each issue has passed the evidence check. Approve what should enter the delivery workflow." actions={<><button className="button-secondary compact" onClick={onExport}><FileText size={16} />Export report</button><button className="button-primary compact" onClick={onCreateTickets}><Zap size={16} />Create tickets</button></>} />
      <section className="review-layout">
        <div className="panel finding-queue">
          <div className="queue-toolbar"><span><strong>{findings.length}</strong> verified findings</span><label className="compact-select"><BarChart3 size={15} /><span className="sr-only">Sort findings</span><select aria-label="Sort findings" value={sortMode} onChange={(event) => setSortMode(event.target.value as "priority" | "confidence")}><option value="priority">Priority order</option><option value="confidence">Confidence</option></select><ChevronDown size={14} /></label></div>
          {sortedFindings.map((finding) => <button key={finding.id} className={`queue-item ${selected.id === finding.id ? "selected" : ""}`} onClick={() => setSelectedId(finding.id)}><span className={`severity-mark ${finding.severity.toLowerCase()}`}><AlertTriangle size={16} /></span><span><span className="queue-title"><strong>{finding.title}</strong><span className={`severity-pill ${finding.severity.toLowerCase()}`}>{finding.severity}</span></span><small>{finding.journeyStep}</small><p>{finding.summary}</p><span className="queue-meta"><small>{finding.persona}</small><small>{finding.confidence}% confidence</small><small className={finding.status.toLowerCase().replace(" ", "-")}>{finding.status}</small>{finding.ticketId && <small>{finding.ticketId}</small>}</span></span><ChevronRight size={17} /></button>)}
        </div>
        <article className="finding-detail">
          <div className="panel detail-header"><div className="detail-title-row"><span className={`severity-mark large ${selected.severity.toLowerCase()}`}><AlertTriangle size={20} /></span><div><span className={`severity-pill ${selected.severity.toLowerCase()}`}>{selected.severity} severity</span><h2>{selected.title}</h2><p>{selected.summary}</p></div></div><div className="confidence-block"><strong>{selected.confidence}%</strong><span>confidence</span></div></div>
          <div className="panel evidence-card"><div className="panel-heading"><div><p className="eyebrow">Reproducible evidence</p><h2>What the agent observed</h2></div><span className="verified-badge"><BadgeCheck size={15} />Verified</span></div><div className="evidence-preview"><div className="evidence-screen"><div className="evidence-nav" /><div className="evidence-product"><div /><span /><span /><span className="focus-gap" /></div><div className="evidence-label"><Keyboard size={14} />Focus jumped over this control</div></div><div className="evidence-facts"><span><small>Behavior signal</small><strong>{selected.evidence.signal}</strong></span><span><small>Page element</small><code>{selected.evidence.selector}</code></span><span><small>Persona</small><strong>{selected.persona}</strong></span></div></div></div>
          <div className="panel recommendation-card"><span className="recommendation-icon"><Sparkles size={19} /></span><div><p className="eyebrow">Recommended fix</p><h2>Make the interaction reachable and explicit</h2><p>{selected.recommendation}</p><div className="code-hint"><Code2 size={16} /><span>Engineering note</span><code>Prefer semantic controls · preserve expected focus order</code></div></div></div>
          <div className="review-actions"><button className="button-ghost" onClick={() => onReview(selected.id, "Dismissed")}><X size={16} />Dismiss with note</button><button className="button-primary" onClick={() => onReview(selected.id, "Approved")}><Check size={17} />Approve finding</button></div>
        </article>
      </section>
    </div>
  );
}

function PersonasView({ personas, selectedPersonas, togglePersona, onUse, onCreate }: { personas: Persona[]; selectedPersonas: string[]; togglePersona: (id: string) => void; onUse: () => void; onCreate: () => void }) {
  return (
    <div className="view-stack personas-view">
      <PageHeading eyebrow="Persona lab" title="Model meaningful human differences" copy="Behavior policies influence reading depth, patience, confidence, device habits, recovery, and accessibility needs." actions={<button className="button-primary compact" onClick={onUse}><Play size={16} />Use selected personas</button>} />
      <section className="persona-hero panel"><div><span className="hero-kicker"><BrainCircuit size={15} />Behavior, not demographics</span><h2>Test the reasons people behave differently.</h2><p>Each persona is a transparent, reusable policy. Combine them to expose friction that fixed scripts cannot model.</p></div><div className="behavior-orbit"><span className="orbit-center"><Users size={24} /></span>{["Patience", "Trust", "Literacy", "Mobility"].map((label, index) => <span key={label} className={`orbit-node node-${index + 1}`}>{label}</span>)}</div></section>
      <section className="persona-library">
        {personas.map((persona, index) => { const selected = selectedPersonas.includes(persona.id); return <article className={`persona-profile panel ${selected ? "selected" : ""}`} key={persona.id}><div className="persona-profile-top"><span className={`profile-symbol symbol-${index + 1}`}>{persona.name.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span><button onClick={() => togglePersona(persona.id)} aria-pressed={selected}>{selected ? <><Check size={14} />Selected</> : <><Plus size={14} />Select</>}</button></div><h2>{persona.name}</h2><p>{persona.description}</p><div className="persona-traits">{persona.traits.map((trait) => <span key={trait}>{trait}</span>)}</div><div className="behavior-bars"><div><span>Patience<strong>{persona.patience}%</strong></span><i><b style={{ width: `${persona.patience}%` }} /></i></div><div><span>Confidence<strong>{persona.confidence}%</strong></span><i><b style={{ width: `${persona.confidence}%` }} /></i></div></div>{persona.accessibility && <div className="accessibility-note"><Keyboard size={15} />{persona.accessibility}</div>}</article>; })}
        <button className="new-persona-card" onClick={onCreate}><span><Plus size={22} /></span><strong>Create custom persona</strong><p>Define a behavior policy for your product or customer segment.</p></button>
      </section>
    </div>
  );
}

function HistoryView({ runs, onOpen, onExport }: { runs: TestRun[]; onOpen: (id: string) => void; onExport: () => void }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const visibleRuns = runs
    .filter((run) => statusFilter === "All" || run.status === statusFilter)
    .filter((run) => `${run.name} ${run.targetUrl} ${run.goal}`.toLowerCase().includes(query.toLowerCase()))
    .filter((run, index, all) => all.findIndex((candidate) => candidate.id === run.id) === index);
  if (sortOrder === "oldest") visibleRuns.reverse();
  return (
    <div className="view-stack history-view">
      <PageHeading eyebrow="Run history" title="Track UX quality over time" copy="Compare behavior coverage, evidence, and outcomes across every release candidate." actions={<button className="button-secondary compact" onClick={onExport}><FileText size={16} />Export history</button>} />
      <section className="history-summary"><div className="panel"><span><BarChart3 size={18} /></span><div><small>UX score trend</small><strong>+11 points</strong><p>Across the last 30 days</p></div></div><div className="panel"><span><BadgeCheck size={18} /></span><div><small>Verified fixes</small><strong>18 shipped</strong><p>82% resolution rate</p></div></div><div className="panel"><span><Clock3 size={18} /></span><div><small>Feedback speed</small><strong>4.8 minutes</strong><p>Average simulation time</p></div></div></section>
      <section className="panel history-table-wrap"><div className="table-toolbar"><div className="search-field"><Search size={16} /><input aria-label="Search runs" placeholder="Search simulations" value={query} onChange={(event) => setQuery(event.target.value)} /></div><label className="toolbar-select"><span className="sr-only">Filter by status</span><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Review</option><option>Completed</option><option>Running</option><option>Queued</option></select><ChevronDown size={14} /></label><label className="toolbar-select"><span className="sr-only">Sort run history</span><select aria-label="Sort run history" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><ChevronDown size={14} /></label></div><div className="history-table"><div className="history-head"><span>Simulation</span><span>Status</span><span>Coverage</span><span>Findings</span><span>UX score</span><span /></div>{visibleRuns.map((run) => <button className="history-row" key={run.id} onClick={() => onOpen(run.id)}><span><span className="run-icon"><TestTube2 size={17} /></span><span><strong>{run.name}</strong><small>{run.targetUrl} · {run.createdAt}</small></span></span><span><i className={`status-pill ${run.status.toLowerCase()}`}>{run.status}</i></span><span>{run.personas} personas</span><span>{run.findings} findings</span><span><strong className={`table-score ${run.score > 0 && run.score < 75 ? "risk" : ""}`}>{run.score || "—"}</strong></span><span><ChevronRight size={17} /></span></button>)}{!visibleRuns.length && <div className="empty-table"><Search size={22} /><strong>No simulations match</strong><span>Adjust the search or status filter.</span></div>}</div></section>
    </div>
  );
}

function SearchPanel({ runs, findings, onNavigate, onOpenRun }: { runs: TestRun[]; findings: Finding[]; onNavigate: (view: View) => void; onOpenRun: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const navResults = navItems.filter((item) => !normalized || item.label.toLowerCase().includes(normalized));
  const runResults = runs.filter((run) => !normalized || `${run.name} ${run.targetUrl}`.toLowerCase().includes(normalized)).slice(0, 3);
  const findingResults = findings.filter((finding) => normalized && finding.title.toLowerCase().includes(normalized)).slice(0, 3);
  return (
    <div className="utility-popover search-popover" role="dialog" aria-label="Search TraceUX">
      <div className="popover-search"><Search size={16} /><input autoFocus aria-label="Search workspace" placeholder="Search runs, findings, or pages" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="search-results">
        {navResults.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => onNavigate(item.id)}><span><Icon size={15} /></span><div><strong>{item.label}</strong><small>Workspace page</small></div><ChevronRight size={14} /></button>; })}
        {runResults.map((run) => <button key={run.id} onClick={() => onOpenRun(run.id)}><span><TestTube2 size={15} /></span><div><strong>{run.name}</strong><small>{run.status} · {run.targetUrl}</small></div><ChevronRight size={14} /></button>)}
        {findingResults.map((finding) => <button key={finding.id} onClick={() => onNavigate("findings")}><span><AlertTriangle size={15} /></span><div><strong>{finding.title}</strong><small>{finding.severity} · {finding.status}</small></div><ChevronRight size={14} /></button>)}
        {!navResults.length && !runResults.length && !findingResults.length && <div className="search-empty">No matching workspace items.</div>}
      </div>
    </div>
  );
}

function NotificationPanel({ findings, onNavigate }: { findings: Finding[]; onNavigate: (view: View) => void }) {
  const pending = findings.filter((finding) => finding.status === "Needs review").length;
  return (
    <div className="utility-popover notification-popover" role="dialog" aria-label="Notifications">
      <div className="popover-title"><div><p className="eyebrow">Workflow inbox</p><h2>Notifications</h2></div><span>{pending + 1}</span></div>
      <button onClick={() => onNavigate("findings")}><span className="notification-icon critical"><AlertTriangle size={15} /></span><div><strong>{pending} findings need review</strong><small>Evidence is verified and ready for a human decision.</small></div></button>
      <button onClick={() => onNavigate("history")}><span className="notification-icon complete"><CheckCircle2 size={15} /></span><div><strong>Latest simulation completed</strong><small>The persistent run record is available in history.</small></div></button>
    </div>
  );
}

function SettingsDialog({ safeMode, evidenceCapture, onClose, onSave }: { safeMode: boolean; evidenceCapture: boolean; onClose: () => void; onSave: (safeMode: boolean, evidenceCapture: boolean) => void }) {
  const [safe, setSafe] = useState(safeMode);
  const [evidence, setEvidence] = useState(evidenceCapture);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-heading"><div><p className="eyebrow">Workspace controls</p><h2 id="settings-title">Execution settings</h2></div><button className="icon-button" aria-label="Close settings" onClick={onClose}><X size={17} /></button></div>
        <p>These device preferences control how every new prototype run is presented and reviewed.</p>
        <label className="setting-row"><span><ShieldCheck size={18} /><span><strong>Safe interaction mode</strong><small>Blocks destructive, purchase, and submission actions.</small></span></span><input type="checkbox" checked={safe} onChange={(event) => setSafe(event.target.checked)} /></label>
        <label className="setting-row"><span><Eye size={18} /><span><strong>Evidence capture</strong><small>Retains behavior, accessibility, DOM, and console signals.</small></span></span><input type="checkbox" checked={evidence} onChange={(event) => setEvidence(event.target.checked)} /></label>
        <div className="modal-actions"><button className="button-ghost" onClick={onClose}>Cancel</button><button className="button-primary" onClick={() => onSave(safe, evidence)}>Save settings</button></div>
      </section>
    </div>
  );
}

function PersonaDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (input: CustomPersonaInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [traits, setTraits] = useState("careful, mobile-first");
  const [accessibility, setAccessibility] = useState("");
  const [patience, setPatience] = useState(55);
  const [confidence, setConfidence] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onCreate({ name, description, traits: traits.split(",").map((trait) => trait.trim()).filter(Boolean), accessibility: accessibility || null, patience, confidence });
    } catch {
      setError("The persona could not be saved. Check the fields and runtime connection.");
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modal-card persona-dialog" role="dialog" aria-modal="true" aria-labelledby="persona-title" onSubmit={submit}>
        <div className="modal-heading"><div><p className="eyebrow">Persona lab</p><h2 id="persona-title">Create behavior policy</h2></div><button type="button" className="icon-button" aria-label="Close persona editor" onClick={onClose}><X size={17} /></button></div>
        <div className="dialog-field-grid"><label><span>Persona name</span><input required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Trust-sensitive subscriber" /></label><label><span>Behavior summary</span><textarea required minLength={8} maxLength={240} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Looks for cancellation clarity before committing." /></label><label><span>Traits, comma separated</span><input required value={traits} onChange={(event) => setTraits(event.target.value)} /></label><label><span>Accessibility need (optional)</span><input value={accessibility} onChange={(event) => setAccessibility(event.target.value)} placeholder="Reduced motion" /></label></div>
        <div className="range-grid"><label><span>Patience <strong>{patience}%</strong></span><input type="range" min="0" max="100" value={patience} onChange={(event) => setPatience(Number(event.target.value))} /></label><label><span>Confidence <strong>{confidence}%</strong></span><input type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label></div>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button-ghost" onClick={onClose}>Cancel</button><button className="button-primary" disabled={saving}>{saving ? <Activity className="spin" size={16} /> : <Plus size={16} />}Save persona</button></div>
      </form>
    </div>
  );
}

function TicketDialog({ tickets, onClose, onExport }: { tickets: TicketDraft[]; onClose: () => void; onExport: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-title">
        <div className="modal-heading"><div><p className="eyebrow">Delivery handoff</p><h2 id="ticket-title">Human-approved ticket drafts</h2></div><button className="icon-button" aria-label="Close ticket drafts" onClick={onClose}><X size={17} /></button></div>
        <p>Drafts are ready for review. Export the integration payload before sending them to an external work tracker.</p>
        <div className="ticket-list">{tickets.map((ticket) => <article key={ticket.id}><span><Zap size={15} /></span><div><small>{ticket.id} · {ticket.severity}</small><strong>{ticket.title}</strong></div><i>{ticket.status}</i></article>)}</div>
        <div className="modal-actions"><button className="button-ghost" onClick={onClose}>Close</button><button className="button-primary" onClick={onExport}><FileText size={16} />Export integration JSON</button></div>
      </section>
    </div>
  );
}
