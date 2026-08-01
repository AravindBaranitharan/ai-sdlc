import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { prototypePersonas } from "@/db/schema";

const seedPersonas = [
  { id: "new-user", name: "First-time Explorer", description: "Relies on clear labels, progressive guidance, and familiar patterns.", traits: ["low familiarity", "cautious", "reads guidance"], patience: 62, confidence: 34, accessibility: null },
  { id: "impatient-shopper", name: "Impatient Shopper", description: "Scans quickly, skips detail, and abandons after repeated friction.", traits: ["fast scanning", "mobile-first", "low patience"], patience: 24, confidence: 78, accessibility: null },
  { id: "keyboard-user", name: "Keyboard Navigator", description: "Completes every task without a mouse and expects predictable focus.", traits: ["keyboard-only", "systematic", "accessibility"], patience: 76, confidence: 70, accessibility: "Keyboard-only navigation" },
  { id: "cautious-buyer", name: "Cautious Buyer", description: "Looks for reassurance, price clarity, and reversible choices.", traits: ["risk-aware", "detail-oriented", "trust-sensitive"], patience: 84, confidence: 45, accessibility: null },
];

export async function GET() {
  try {
    const rows = await getDb().select().from(prototypePersonas).orderBy(asc(prototypePersonas.name));
    return Response.json([
      ...seedPersonas,
      ...rows.map((row) => ({ ...row, traits: JSON.parse(row.traitsJson) as string[] })),
    ]);
  } catch {
    return Response.json(seedPersonas);
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    name?: string;
    description?: string;
    traits?: string[];
    patience?: number;
    confidence?: number;
    accessibility?: string;
  };
  if (!payload.name || !payload.description || !payload.traits?.length || payload.patience == null || payload.confidence == null) {
    return Response.json({ error: "Complete the persona behavior policy." }, { status: 400 });
  }
  const persona = {
    id: `custom-${crypto.randomUUID()}`,
    name: payload.name.trim(),
    description: payload.description.trim(),
    traitsJson: JSON.stringify(payload.traits.map((trait) => trait.trim()).filter(Boolean).slice(0, 6)),
    patience: Math.max(0, Math.min(100, Math.round(payload.patience))),
    confidence: Math.max(0, Math.min(100, Math.round(payload.confidence))),
    accessibility: payload.accessibility?.trim() || null,
  };
  try {
    const [created] = await getDb().insert(prototypePersonas).values(persona).returning();
    return Response.json({ ...created, traits: JSON.parse(created.traitsJson) as string[] }, { status: 201 });
  } catch {
    return Response.json({ error: "Persona storage is temporarily unavailable." }, { status: 503 });
  }
}
