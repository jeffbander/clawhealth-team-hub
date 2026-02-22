import { NextRequest, NextResponse } from "next/server";
import { getStatuses, saveStatuses } from "@/lib/store";

// GET /api/status — return all agent statuses
export async function GET() {
  const statuses = await getStatuses();
  return NextResponse.json({ statuses });
}

// POST /api/status — update an agent's "currently working on" status
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agent, workingOn } = body;
  if (!agent) return NextResponse.json({ error: "Agent required" }, { status: 400 });

  const statuses = await getStatuses();
  const idx = statuses.findIndex((s) => s.agent === agent);
  if (idx >= 0) {
    statuses[idx].workingOn = workingOn || "";
    statuses[idx].updatedAt = new Date().toISOString();
  } else {
    statuses.push({ agent, workingOn: workingOn || "", updatedAt: new Date().toISOString() });
  }
  await saveStatuses(statuses);
  return NextResponse.json({ success: true, statuses });
}
