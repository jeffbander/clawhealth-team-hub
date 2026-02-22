import fs from "fs";
import path from "path";

// Use /tmp for Vercel serverless (persists within same instance)
// For local dev, use project root
const DATA_DIR =
  process.env.NODE_ENV === "production" ? "/tmp" : path.join(process.cwd(), "data");

const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const STATUS_FILE = path.join(DATA_DIR, "status.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Task {
  id: number;
  title: string;
  assignee: string;
  priority: string;
  col: string;
  desc: string;
  workingOn?: boolean;
  updatedAt?: string;
}

export interface Message {
  id: number;
  sender: string;
  text: string;
  time: string;
}

export interface AgentStatus {
  agent: string;
  workingOn: string;
  updatedAt: string;
}

// ─── Default Data ────────────────────────────────────────────────────────────

const DEFAULT_TASKS: Task[] = [
  { id: 1, title: "Patient risk score trends chart", assignee: "Albert", priority: "med", col: "backlog", desc: "Chart showing patient risk level changes over time" },
  { id: 2, title: "Voice strategy document", assignee: "Manny", priority: "high", col: "backlog", desc: "ElevenLabs integration strategy — which patients get calls vs SMS, frequency, voice persona" },
  { id: 3, title: "Prompt architecture clinical review", assignee: "Manny", priority: "high", col: "backlog", desc: "Review three-tier prompt system for clinical accuracy edge cases" },
  { id: 4, title: "Pencil/Figma MCP research", assignee: "Manny", priority: "med", col: "backlog", desc: "How to use Pencil.dev and Figma MCP for AI-assisted design" },
  { id: 5, title: "Medication interaction checker", assignee: "Albert", priority: "med", col: "backlog", desc: "Flag drug-drug interactions in patient medication lists" },
  { id: 6, title: "Dashboard design polish — remaining pages", assignee: "Albert", priority: "high", col: "progress", desc: "Patients list, patient detail, settings pages need the new light design" },
  { id: 7, title: "ABIM question bank expansion", assignee: "Manny", priority: "med", col: "progress", desc: "Expand beyond initial 100 questions" },
  { id: 8, title: "Multi-agent architecture decision", assignee: "Jeff", priority: "high", col: "review", desc: "Approve or defer 1-agent-per-patient OpenClaw architecture" },
  { id: 9, title: "Joel Landau phone number", assignee: "Jeff", priority: "high", col: "review", desc: "Need phone number to create ClawHealth bot for Joel from Landau portal data" },
  { id: 10, title: "12 disease templates", assignee: "Manny", priority: "high", col: "done", desc: "CKD, COPD, thyroid, obesity, anxiety, DVT/PE, PAD, valvular, post-surgery, hyperlipidemia, chronic pain, sleep apnea" },
  { id: 11, title: "Light sidebar redesign", assignee: "Albert", priority: "high", col: "done", desc: "Replaced dark navy sidebar with clean white sidebar + SVG icons" },
  { id: 12, title: "Patient Timeline feature", assignee: "Albert", priority: "high", col: "done", desc: "Unified chronological event feed with filters and pagination" },
  { id: 13, title: "ABIM Quiz App deployed", assignee: "Manny", priority: "med", col: "done", desc: "100+ cardiology board questions at abim-quiz.vercel.app" },
  { id: 14, title: "Hero page live on clawmd.ai", assignee: "Manny", priority: "high", col: "done", desc: "Patient-facing marketing page deployed to clawmd.ai" },
  { id: 15, title: "Three-tier prompt management", assignee: "Albert", priority: "high", col: "done", desc: "Disease templates + patient overrides + base prompt, all DB-stored and dashboard-editable" },
  { id: 16, title: "Physician Action Center", assignee: "Albert", priority: "high", col: "done", desc: "Messaging, alert resolution with clinical notes, patient inbox" },
  { id: 17, title: "CCM Revenue Engine", assignee: "Albert", priority: "high", col: "done", desc: "Automated patient outreach + billing dashboard with CPT codes" },
];

const DEFAULT_MESSAGES: Message[] = [
  { id: 1, sender: "Albert", text: "Deployed light sidebar + SVG icons to app.clawmd.ai. All 3 PRs merged to master.", time: "2026-02-22T07:00:00Z" },
  { id: 2, sender: "Albert", text: "Imported Manny's 12 disease templates. 18 total active in production DB.", time: "2026-02-22T01:30:00Z" },
  { id: 3, sender: "Manny", text: "ABIM question bank delivered — 100+ board-style questions with self-contained quiz app.", time: "2026-02-22T00:30:00Z" },
  { id: 4, sender: "Albert", text: "clawmd.ai now shows hero page, app.clawmd.ai shows physician portal. Domains properly split.", time: "2026-02-22T08:00:00Z" },
  { id: 5, sender: "Jeff", text: "You and Manny need to work together more closely and collaboratively. Build an app if you need one.", time: "2026-02-22T08:20:00Z" },
  { id: 6, sender: "Albert", text: "Building this Team Hub so we have a shared coordination space. No more async git commits.", time: "2026-02-22T08:25:00Z" },
];

const DEFAULT_STATUS: AgentStatus[] = [
  { agent: "Manny", workingOn: "", updatedAt: new Date().toISOString() },
  { agent: "Albert", workingOn: "", updatedAt: new Date().toISOString() },
  { agent: "Jeff", workingOn: "", updatedAt: new Date().toISOString() },
];

// ─── Read / Write helpers ────────────────────────────────────────────────────

function readJSON<T>(filePath: string, defaults: T): T {
  ensureDir();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {
    // corrupted file — reset
  }
  fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2));
  return defaults;
}

function writeJSON<T>(filePath: string, data: T): void {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getTasks(): Task[] {
  return readJSON(TASKS_FILE, DEFAULT_TASKS);
}

export function saveTasks(tasks: Task[]): void {
  writeJSON(TASKS_FILE, tasks);
}

export function getMessages(): Message[] {
  return readJSON(MESSAGES_FILE, DEFAULT_MESSAGES);
}

export function saveMessages(messages: Message[]): void {
  writeJSON(MESSAGES_FILE, messages);
}

export function getStatuses(): AgentStatus[] {
  return readJSON(STATUS_FILE, DEFAULT_STATUS);
}

export function saveStatuses(statuses: AgentStatus[]): void {
  writeJSON(STATUS_FILE, statuses);
}

export function getNextTaskId(): number {
  const tasks = getTasks();
  return tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
}

export function getNextMessageId(): number {
  const msgs = getMessages();
  return msgs.length > 0 ? Math.max(...msgs.map((m) => m.id)) + 1 : 1;
}
