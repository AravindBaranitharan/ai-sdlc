import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { prototypeRuns } from "@/db/schema";
import type { WorkflowFinding } from "../../../../workflow";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; findingId: string }> }) {
  const { id, findingId } = await context.params;
  const payload = (await request.json()) as { status?: "Approved" | "Dismissed"; note?: string };
  if (!payload.status || !["Approved", "Dismissed"].includes(payload.status)) {
    return Response.json({ error: "Choose Approved or Dismissed." }, { status: 400 });
  }
  const db = getDb();
  const [run] = await db.select().from(prototypeRuns).where(eq(prototypeRuns.id, id)).limit(1);
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  const findings = JSON.parse(run.findingsJson) as WorkflowFinding[];
  const index = findings.findIndex((finding) => finding.id === findingId);
  if (index < 0) return Response.json({ error: "Finding not found" }, { status: 404 });
  findings[index] = {
    ...findings[index],
    status: payload.status,
    reviewNote: payload.note ?? (payload.status === "Approved" ? "Approved by a human reviewer for delivery planning." : "Dismissed after human evidence review."),
    reviewedAt: new Date().toISOString(),
  };
  await db.update(prototypeRuns).set({ findingsJson: JSON.stringify(findings) }).where(eq(prototypeRuns.id, id));
  return Response.json(findings[index]);
}
