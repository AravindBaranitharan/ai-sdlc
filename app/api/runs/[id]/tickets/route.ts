import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { prototypeRuns } from "@/db/schema";
import type { WorkflowFinding } from "../../../workflow";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = getDb();
  const [run] = await db.select().from(prototypeRuns).where(eq(prototypeRuns.id, id)).limit(1);
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  const findings = JSON.parse(run.findingsJson) as WorkflowFinding[];
  const approved = findings.filter((finding) => finding.status === "Approved");
  const tickets = approved.map((finding, index) => ({
    id: finding.ticketId ?? `TUX-${id.slice(-4).toUpperCase()}-${index + 1}`,
    findingId: finding.id,
    title: finding.title,
    severity: finding.severity,
    status: "Draft",
    createdAt: new Date().toISOString(),
  }));
  const ticketByFinding = new Map(tickets.map((ticket) => [ticket.findingId, ticket]));
  const updatedFindings = findings.map((finding) => {
    const ticket = ticketByFinding.get(finding.id);
    return ticket ? { ...finding, ticketId: ticket.id, ticketStatus: ticket.status } : finding;
  });
  await db.update(prototypeRuns).set({
    findingsJson: JSON.stringify(updatedFindings),
    ticketsJson: JSON.stringify(tickets),
  }).where(eq(prototypeRuns.id, id));
  return Response.json({ tickets });
}
