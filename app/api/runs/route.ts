import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { prototypeRuns } from "../../../db/schema";

export async function GET() {
  try {
    const rows = await getDb()
      .select()
      .from(prototypeRuns)
      .orderBy(desc(prototypeRuns.createdAt))
      .limit(20);
    return Response.json({ runs: rows });
  } catch {
    return Response.json({ runs: [] });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    projectName?: string;
    targetUrl?: string;
    goal?: string;
    personaIds?: string[];
  };

  if (!payload.projectName || !payload.targetUrl || !payload.goal || !payload.personaIds?.length) {
    return Response.json({ error: "Complete the scenario and choose at least one persona." }, { status: 400 });
  }

  const run = {
    id: crypto.randomUUID(),
    projectName: payload.projectName,
    targetUrl: payload.targetUrl,
    goal: payload.goal,
    personaIds: JSON.stringify(payload.personaIds),
    status: "QUEUED",
  };

  try {
    const [created] = await getDb().insert(prototypeRuns).values(run).returning();
    return Response.json(created, { status: 201 });
  } catch {
    return Response.json({ ...run, createdAt: new Date().toISOString() }, { status: 201 });
  }
}
