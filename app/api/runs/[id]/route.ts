import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { prototypeRuns } from "@/db/schema";
import { serializeRun } from "../../workflow";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const [run] = await getDb().select().from(prototypeRuns).where(eq(prototypeRuns.id, id)).limit(1);
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  return Response.json(serializeRun(run));
}
