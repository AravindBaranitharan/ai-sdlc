import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { prototypeRuns } from "@/db/schema";
import { serializeRun } from "../workflow";

export async function GET() {
  try {
    const rows = await getDb()
      .select()
      .from(prototypeRuns)
      .orderBy(desc(prototypeRuns.createdAt))
      .limit(20);
    return Response.json(rows.map(serializeRun));
  } catch {
    return Response.json([]);
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    projectName?: string;
    targetUrl?: string;
    goal?: string;
    successCriteria?: string;
    personaIds?: string[];
  };

  if (!payload.projectName || !payload.targetUrl || !payload.goal || !payload.successCriteria || !payload.personaIds?.length) {
    return Response.json({ error: "Complete the scenario and choose at least one persona." }, { status: 400 });
  }

  const run = {
    id: crypto.randomUUID(),
    projectName: payload.projectName,
    targetUrl: payload.targetUrl,
    goal: payload.goal,
    successCriteria: payload.successCriteria,
    personaIds: JSON.stringify(payload.personaIds),
    status: "QUEUED",
  };

  try {
    const [created] = await getDb().insert(prototypeRuns).values(run).returning();
    return Response.json(serializeRun(created), { status: 201 });
  } catch {
    return Response.json({ error: "Persistent run storage is temporarily unavailable." }, { status: 503 });
  }
}
