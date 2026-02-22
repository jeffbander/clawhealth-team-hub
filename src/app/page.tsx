"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Task {
  id: number;
  title: string;
  assignee: string;
  priority: string;
  col: string;
  desc: string;
  updatedAt?: string;
}

interface Message {
  id: number;
  sender: string;
  text: string;
  time: string;
}

interface AgentStatus {
  agent: string;
  workingOn: string;
  updatedAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLS = ["backlog", "progress", "review", "done"] as const;
const COL_LABELS: Record<string, string> = {
  backlog: "Backlog",
  progress: "In Progress",
  review: "Review",
  done: "Done",
};

const POLL_INTERVAL = 3000; // 3 seconds

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function badgeColor(val: string): string {
  const map: Record<string, string> = {
    albert: "bg-indigo-50 text-indigo-700",
    manny: "bg-cyan-50 text-cyan-700",
    jeff: "bg-amber-50 text-amber-700",
    high: "bg-red-50 text-red-600",
    med: "bg-amber-50 text-amber-600",
    low: "bg-green-50 text-green-600",
  };
  return map[val.toLowerCase()] || "bg-gray-100 text-gray-600";
}

function avatarColor(sender: string): string {
  const map: Record<string, string> = {
    albert: "bg-indigo-600",
    manny: "bg-cyan-600",
    jeff: "bg-amber-600",
  };
  return map[sender.toLowerCase()] || "bg-gray-500";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TeamHub() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [statuses, setStatuses] = useState<AgentStatus[]>([]);
  const [tab, setTab] = useState<"board" | "feed">("board");
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCol, setModalCol] = useState("backlog");
  const [loading, setLoading] = useState(true);

  // Form state
  const [fTitle, setFTitle] = useState("");
  const [fAssignee, setFAssignee] = useState("Manny");
  const [fPriority, setFPriority] = useState("med");
  const [fDesc, setFDesc] = useState("");

  // Message form
  const [msgSender, setMsgSender] = useState("Manny");
  const [msgText, setMsgText] = useState("");

  // Status form
  const [statusAgent, setStatusAgent] = useState("Manny");
  const [statusText, setStatusText] = useState("");

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [tRes, mRes, sRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/messages"),
        fetch("/api/status"),
      ]);
      const tData = await tRes.json();
      const mData = await mRes.json();
      const sData = await sRes.json();
      setTasks(tData.tasks || []);
      setMessages(mData.messages || []);
      setStatuses(sData.statuses || []);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function createTask() {
    if (!fTitle.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        title: fTitle,
        assignee: fAssignee,
        priority: fPriority,
        col: modalCol,
        desc: fDesc,
      }),
    });
    setFTitle("");
    setFDesc("");
    setModalOpen(false);
    fetchAll();
  }

  async function moveTask(id: number, direction: number) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", id, direction }),
    });
    fetchAll();
  }

  async function deleteTask(id: number) {
    if (!confirm("Delete this task?")) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    fetchAll();
  }

  async function sendMessage() {
    if (!msgText.trim()) return;
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: msgSender, text: msgText }),
    });
    setMsgText("");
    fetchAll();
  }

  async function updateStatus() {
    await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: statusAgent, workingOn: statusText }),
    });
    setStatusText("");
    fetchAll();
  }

  // ─── Computed ──────────────────────────────────────────────────────────────

  const activeTasks = tasks.filter((t) => t.col !== "done");
  const byAssignee: Record<string, number> = {};
  activeTasks.forEach((c) => {
    byAssignee[c.assignee] = (byAssignee[c.assignee] || 0) + 1;
  });
  const doneCount = tasks.filter((t) => t.col === "done").length;
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-sm">Loading Team Hub...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="w-4 h-4"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="font-bold text-[15px] text-[#1a1a2e] tracking-tight">
            ClawHealth
          </span>
          <span className="text-[11px] text-gray-400 font-medium ml-2 px-2 py-0.5 bg-gray-100 rounded-full">
            Team Hub
          </span>
          <span className="text-[10px] text-green-600 font-medium ml-1 px-2 py-0.5 bg-green-50 rounded-full">
            ● Live Sync
          </span>
        </div>
        <div className="text-xs text-gray-400">Albert · Manny · Jeff</div>
      </header>

      {/* Agent Status Bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-6 text-xs">
        <span className="text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
          Currently working on:
        </span>
        {statuses.map((s) => (
          <div key={s.agent} className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                s.workingOn ? "bg-green-400" : "bg-gray-300"
              }`}
            />
            <span className="font-semibold text-[#1a1a2e]">{s.agent}:</span>
            <span className="text-gray-500">
              {s.workingOn || "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-6 py-4 flex-wrap">
        {[
          { label: "Manny", val: byAssignee["Manny"] || 0, sub: "active tasks" },
          { label: "Albert", val: byAssignee["Albert"] || 0, sub: "active tasks" },
          { label: "Jeff", val: byAssignee["Jeff"] || 0, sub: "approvals needed" },
          { label: "Completed", val: doneCount, sub: "tasks done" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex-1 min-w-[140px]"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
              {s.label}
            </div>
            <div className="text-[22px] font-bold text-[#1a1a2e]">{s.val}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-6 border-b border-gray-200 bg-white">
        {(["board", "feed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all ${
              tab === t
                ? "text-brand border-brand"
                : "text-gray-400 border-transparent hover:text-gray-500"
            }`}
          >
            {t === "board" ? "Board" : "Activity Feed"}
          </button>
        ))}
      </div>

      {/* Board View */}
      {tab === "board" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 px-6 py-4">
          {COLS.map((col) => {
            const colTasks = tasks.filter((t) => t.col === col);
            return (
              <div key={col} className="bg-gray-50 rounded-xl p-2.5 min-h-[300px]">
                <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-500">
                    {COL_LABELS[col]}
                  </span>
                  <span className="text-[11px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                    {colTasks.length}
                  </span>
                </div>
                {colTasks.map((card) => (
                  <div
                    key={card.id}
                    className="bg-white border border-gray-200 rounded-lg p-3 mb-2 cursor-pointer hover:shadow-sm hover:border-gray-300 transition-all"
                    onClick={() =>
                      setExpandedCard(expandedCard === card.id ? null : card.id)
                    }
                  >
                    <div className="text-[13px] font-semibold text-[#1a1a2e] mb-1.5 leading-snug">
                      {card.title}
                    </div>
                    {expandedCard === card.id && card.desc && (
                      <div className="text-[11px] text-gray-400 mb-2 leading-relaxed">
                        {card.desc}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColor(
                          card.assignee
                        )}`}
                      >
                        {card.assignee}
                      </span>
                      {card.col !== "done" && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColor(
                            card.priority
                          )}`}
                        >
                          {card.priority}
                        </span>
                      )}
                    </div>
                    {expandedCard === card.id && (
                      <div className="flex gap-1 mt-2">
                        {col !== "backlog" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTask(card.id, -1);
                            }}
                            className="text-[10px] px-2 py-1 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 font-medium"
                          >
                            ← Back
                          </button>
                        )}
                        {col !== "done" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTask(card.id, 1);
                            }}
                            className="text-[10px] px-2 py-1 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 font-medium"
                          >
                            Next →
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(card.id);
                          }}
                          className="text-[10px] px-2 py-1 rounded border border-gray-200 bg-white text-red-500 hover:bg-red-50 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    setModalCol(col);
                    setModalOpen(true);
                  }}
                  className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-400 text-[12px] font-medium hover:border-gray-400 hover:text-gray-500 transition-all"
                >
                  + Add task
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity Feed View */}
      {tab === "feed" && (
        <div className="px-6 py-4 max-w-2xl">
          {/* Update Status */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Update your status
            </div>
            <div className="flex gap-2">
              <select
                value={statusAgent}
                onChange={(e) => setStatusAgent(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] bg-white outline-none"
              >
                <option>Manny</option>
                <option>Albert</option>
                <option>Jeff</option>
              </select>
              <input
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && updateStatus()}
                placeholder="What are you working on right now?"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-brand transition-colors"
              />
              <button
                onClick={updateStatus}
                className="px-4 py-2 bg-brand text-white rounded-lg text-[13px] font-semibold hover:bg-[#12124a] transition-colors"
              >
                Update
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-0">
            {sortedMessages.map((m) => (
              <div
                key={m.id}
                className="flex gap-2.5 py-3 border-b border-gray-100"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0 ${avatarColor(
                    m.sender
                  )}`}
                >
                  {m.sender[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-[#1a1a2e]">
                      {m.sender}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {timeAgo(m.time)}
                    </span>
                  </div>
                  <div className="text-[13px] text-gray-600 leading-relaxed">
                    {m.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Post message */}
          <div className="flex gap-2 mt-4">
            <select
              value={msgSender}
              onChange={(e) => setMsgSender(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-[13px] bg-white outline-none"
            >
              <option>Manny</option>
              <option>Albert</option>
              <option>Jeff</option>
            </select>
            <input
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Post an update..."
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-brand transition-colors"
            />
            <button
              onClick={sendMessage}
              className="px-5 py-2.5 bg-brand text-white rounded-lg text-[13px] font-semibold hover:bg-[#12124a] transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-[90%] max-w-[440px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-bold text-[#1a1a2e] mb-4">
              New Task
            </h3>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1">
              Title
            </label>
            <input
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-brand mb-3"
              autoFocus
            />
            <label className="block text-[12px] font-semibold text-gray-500 mb-1">
              Assignee
            </label>
            <select
              value={fAssignee}
              onChange={(e) => setFAssignee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-brand mb-3 bg-white"
            >
              <option>Manny</option>
              <option>Albert</option>
              <option>Jeff</option>
            </select>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1">
              Priority
            </label>
            <select
              value={fPriority}
              onChange={(e) => setFPriority(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-brand mb-3 bg-white"
            >
              <option value="high">High</option>
              <option value="med">Medium</option>
              <option value="low">Low</option>
            </select>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1">
              Column
            </label>
            <select
              value={modalCol}
              onChange={(e) => setModalCol(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-brand mb-3 bg-white"
            >
              <option value="backlog">Backlog</option>
              <option value="progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1">
              Description
            </label>
            <textarea
              value={fDesc}
              onChange={(e) => setFDesc(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-brand mb-4 h-[60px] resize-y"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createTask}
                className="px-4 py-2 bg-brand text-white rounded-lg text-[13px] font-semibold hover:bg-[#12124a]"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
