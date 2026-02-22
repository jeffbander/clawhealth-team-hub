/**
 * GitHub API-based persistent storage for ClawHealth Team Hub.
 *
 * Replaces the previous /tmp JSON file approach that lost state on Vercel cold starts.
 * Stores board state as JSON files in the jeffbander/clawhealth-team-hub repo
 * under a `data/` directory on a `data` branch, read/written via GitHub Contents API.
 *
 * Falls back to in-memory cache with defaults if GitHub is unreachable.
 */

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

// ─── Config ──────────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const REPO_OWNER = "jeffbander";
const REPO_NAME = "clawhealth-team-hub";
const DATA_BRANCH = "data";
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

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

// ─── In-memory cache with SHA tracking ───────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  sha: string | null;
  lastFetched: number;
}

const cache: {
  tasks: CacheEntry<Task[]> | null;
  messages: CacheEntry<Message[]> | null;
  status: CacheEntry<AgentStatus[]> | null;
} = {
  tasks: null,
  messages: null,
  status: null,
};

// Cache TTL: 5 seconds — prevents hammering GitHub API on rapid polling
const CACHE_TTL = 5000;

// ─── GitHub API helpers ──────────────────────────────────────────────────────

const headers: Record<string, string> = {
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "ClawHealth-TeamHub",
};

if (GITHUB_TOKEN) {
  headers["Authorization"] = `token ${GITHUB_TOKEN}`;
}

async function ensureDataBranch(): Promise<void> {
  // Check if the data branch exists; if not, create it from main
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${DATA_BRANCH}`,
    { headers }
  );
  if (res.ok) return;

  // Get default branch SHA (try master first, then main)
  let mainRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/master`,
    { headers }
  );
  if (!mainRes.ok) {
    mainRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/main`,
      { headers }
    );
  }
  if (!mainRes.ok) {
    throw new Error("Cannot find default branch to create data branch");
  }
  const mainData = await mainRes.json();
  const sha = mainData.object.sha;

  // Create data branch
  await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${DATA_BRANCH}`, sha }),
    }
  );
}

async function readGitHubFile<T>(filePath: string, defaults: T): Promise<{ data: T; sha: string | null }> {
  try {
    const url = `${API_BASE}/${filePath}?ref=${DATA_BRANCH}`;
    const res = await fetch(url, { headers, cache: "no-store" });

    if (res.status === 404) {
      // File doesn't exist yet — write defaults and return
      const sha = await writeGitHubFile(filePath, defaults, null);
      return { data: defaults, sha };
    }

    if (!res.ok) {
      console.error(`GitHub API error (${res.status}): ${await res.text()}`);
      return { data: defaults, sha: null };
    }

    const json = await res.json();
    const content = Buffer.from(json.content, "base64").toString("utf-8");
    const data = JSON.parse(content) as T;
    return { data, sha: json.sha };
  } catch (err) {
    console.error("GitHub read error:", err);
    return { data: defaults, sha: null };
  }
}

async function writeGitHubFile<T>(filePath: string, data: T, sha: string | null): Promise<string | null> {
  try {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
    const body: Record<string, unknown> = {
      message: `Update ${filePath}`,
      content,
      branch: DATA_BRANCH,
    };
    if (sha) {
      body.sha = sha;
    }

    const url = `${API_BASE}/${filePath}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      // If SHA conflict (409), refetch and retry once
      if (res.status === 409 || res.status === 422) {
        console.warn(`SHA conflict on ${filePath}, refetching...`);
        const fresh = await readGitHubFile(filePath, data);
        // Retry with fresh SHA — but write the NEW data, not the fetched data
        const retryBody = {
          message: `Update ${filePath} (retry)`,
          content,
          branch: DATA_BRANCH,
          sha: fresh.sha,
        };
        const retryRes = await fetch(url, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(retryBody),
        });
        if (retryRes.ok) {
          const retryJson = await retryRes.json();
          return retryJson.content?.sha || null;
        }
        console.error(`Retry failed for ${filePath}: ${await retryRes.text()}`);
        return null;
      }
      console.error(`GitHub write error (${res.status}): ${errText}`);
      return null;
    }

    const json = await res.json();
    return json.content?.sha || null;
  } catch (err) {
    console.error("GitHub write error:", err);
    return null;
  }
}

// ─── Initialization ──────────────────────────────────────────────────────────

let branchReady = false;

async function ensureReady(): Promise<void> {
  if (!branchReady && GITHUB_TOKEN) {
    try {
      await ensureDataBranch();
      branchReady = true;
    } catch (err) {
      console.error("Failed to ensure data branch:", err);
    }
  }
}

// ─── Generic cached read/write ───────────────────────────────────────────────

type StoreKey = "tasks" | "messages" | "status";

const FILE_MAP: Record<StoreKey, string> = {
  tasks: "data/tasks.json",
  messages: "data/messages.json",
  status: "data/status.json",
};

const DEFAULTS_MAP: Record<StoreKey, unknown> = {
  tasks: DEFAULT_TASKS,
  messages: DEFAULT_MESSAGES,
  status: DEFAULT_STATUS,
};

async function readStore<T>(key: StoreKey): Promise<T> {
  await ensureReady();

  const cached = cache[key] as CacheEntry<T> | null;
  if (cached && Date.now() - cached.lastFetched < CACHE_TTL) {
    return cached.data;
  }

  if (!GITHUB_TOKEN) {
    // No token — use in-memory defaults only
    const defaults = DEFAULTS_MAP[key] as T;
    if (!cache[key]) {
      (cache as Record<string, CacheEntry<unknown>>)[key] = {
        data: defaults,
        sha: null,
        lastFetched: Date.now(),
      };
    }
    return (cache[key] as CacheEntry<T>).data;
  }

  const { data, sha } = await readGitHubFile<T>(FILE_MAP[key], DEFAULTS_MAP[key] as T);
  (cache as Record<string, CacheEntry<unknown>>)[key] = {
    data,
    sha,
    lastFetched: Date.now(),
  };
  return data;
}

async function writeStore<T>(key: StoreKey, data: T): Promise<void> {
  await ensureReady();

  const cached = cache[key] as CacheEntry<T> | null;
  const currentSha = cached?.sha || null;

  if (GITHUB_TOKEN) {
    const newSha = await writeGitHubFile(FILE_MAP[key], data, currentSha);
    (cache as Record<string, CacheEntry<unknown>>)[key] = {
      data,
      sha: newSha,
      lastFetched: Date.now(),
    };
  } else {
    (cache as Record<string, CacheEntry<unknown>>)[key] = {
      data,
      sha: null,
      lastFetched: Date.now(),
    };
  }
}

// ─── Public API (async versions) ─────────────────────────────────────────────

export async function getTasks(): Promise<Task[]> {
  return readStore<Task[]>("tasks");
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  return writeStore("tasks", tasks);
}

export async function getMessages(): Promise<Message[]> {
  return readStore<Message[]>("messages");
}

export async function saveMessages(messages: Message[]): Promise<void> {
  return writeStore("messages", messages);
}

export async function getStatuses(): Promise<AgentStatus[]> {
  return readStore<AgentStatus[]>("status");
}

export async function saveStatuses(statuses: AgentStatus[]): Promise<void> {
  return writeStore("status", statuses);
}

export async function getNextTaskId(): Promise<number> {
  const tasks = await getTasks();
  return tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
}

export async function getNextMessageId(): Promise<number> {
  const msgs = await getMessages();
  return msgs.length > 0 ? Math.max(...msgs.map((m) => m.id)) + 1 : 1;
}
