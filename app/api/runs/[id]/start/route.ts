import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { prototypeRuns } from "@/db/schema";
import { makeWorkflow, serializeRun } from "../../../workflow";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = getDb();
  const [run] = await db.select().from(prototypeRuns).where(eq(prototypeRuns.id, id)).limit(1);
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  const { events, findings } = makeWorkflow(run);
  const [completed] = await db.update(prototypeRuns).set({
    status: "REVIEW",
    progress: 100,
    uxScore: 72,
    completionRate: 76,
    frictionCount: findings.length,
    eventsJson: JSON.stringify(events),
    findingsJson: JSON.stringify(findings),
    completedAt: new Date().toISOString(),
  }).where(eq(prototypeRuns.id, id)).returning();
  return Response.json(serializeRun(completed));
}
