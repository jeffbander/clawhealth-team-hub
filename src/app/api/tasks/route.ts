import { NextRequest, NextResponse } from "next/server";
import { getTasks, saveTasks, getNextTaskId, Task } from "@/lib/store";

// GET /api/tasks — return all tasks
export async function GET() {
  const tasks = await getTasks();
  return NextResponse.json({ tasks });
}

// POST /api/tasks — create, update, move, or delete a task
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const tasks = await getTasks();
    const newTask: Task = {
      id: await getNextTaskId(),
      title: body.title || "Untitled",
      assignee: body.assignee || "Manny",
      priority: body.priority || "med",
      col: body.col || "backlog",
      desc: body.desc || "",
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    await saveTasks(tasks);
    return NextResponse.json({ success: true, task: newTask });
  }

  if (action === "update") {
    const tasks = await getTasks();
    const idx = tasks.findIndex((t) => t.id === body.id);
    if (idx === -1) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    tasks[idx] = { ...tasks[idx], ...body.fields, updatedAt: new Date().toISOString() };
    await saveTasks(tasks);
    return NextResponse.json({ success: true, task: tasks[idx] });
  }

  if (action === "move") {
    const COLS = ["backlog", "progress", "review", "done"];
    const tasks = await getTasks();
    const idx = tasks.findIndex((t) => t.id === body.id);
    if (idx === -1) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const colIdx = COLS.indexOf(tasks[idx].col) + (body.direction || 0);
    if (colIdx >= 0 && colIdx < COLS.length) {
      tasks[idx].col = COLS[colIdx];
      tasks[idx].updatedAt = new Date().toISOString();
      await saveTasks(tasks);
    }
    return NextResponse.json({ success: true, task: tasks[idx] });
  }

  if (action === "delete") {
    let tasks = await getTasks();
    tasks = tasks.filter((t) => t.id !== body.id);
    await saveTasks(tasks);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
