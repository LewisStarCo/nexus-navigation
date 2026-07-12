"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type NexusEvent = { id: string; title: string; category: string; priority: "High" | "Medium" | "Low"; type: "task" | "schedule"; date: string; startTime: string; endTime: string; duration: number; status: "pending" | "completed" | "unfinished"; source: "local" | "calendar" | "google-calendar" | "outlook-calendar" | "apple-calendar" | "ai-suggestion" };
type View = "day" | "week";
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };
const minutesToTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const emptyForm = { title: "", category: "", date: dateKey(new Date()), startTime: "09:00", endTime: "10:00", priority: "Medium" as NexusEvent["priority"], type: "task" as NexusEvent["type"] };

export default function CalendarPage() {
  const [events, setEvents] = useState<NexusEvent[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [ready, setReady] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState("OpenAI");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => { try { const raw = localStorage.getItem("nexus-data-v1"); if (raw) { const data = JSON.parse(raw); if (Array.isArray(data.events)) setEvents(data.events.map((item: NexusEvent) => item.date < dateKey(new Date()) && item.status === "pending" ? { ...item, status: "unfinished" } : item)); if (data.theme === "light") setTheme("light"); if (data.aiPlanner?.provider) setAiProvider(data.aiPlanner.provider); if (data.aiPlanner?.apiKey) setApiKey(data.aiPlanner.apiKey); } } catch {} setReady(true); }, []);
  useEffect(() => { if (!ready) return; try { const data = JSON.parse(localStorage.getItem("nexus-data-v1") || "{}"); localStorage.setItem("nexus-data-v1", JSON.stringify({ ...data, events, theme, aiPlanner: { provider: aiProvider, apiKey } })); } catch {} }, [events, theme, aiProvider, apiKey, ready]);

  const weekStart = useMemo(() => { const date = new Date(anchor); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date; }, [anchor]);
  const days = view === "day" ? [anchor] : Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const visibleEvents = events.filter((event) => days.some((day) => dateKey(day) === event.date));
  const hours = Array.from({ length: 15 }, (_, index) => index + 8);

  function saveEvent(event: FormEvent) { event.preventDefault(); const [sh, sm] = form.startTime.split(":").map(Number); const [eh, em] = form.endTime.split(":").map(Number); const duration = Math.max(1, eh * 60 + em - sh * 60 - sm); const next = { ...form, title: form.title.trim(), category: form.category.trim() || "其他", duration }; if (!next.title) return; if (editingId) setEvents((items) => items.map((item) => item.id === editingId ? { ...item, ...next } : item)); else setEvents((items) => [...items, { ...next, id: crypto.randomUUID(), status: "pending", source: "local" }]); setEditorOpen(false); setEditingId(null); setForm({ ...emptyForm, date: dateKey(anchor) }); }
  function openEdit(item: NexusEvent) { setEditingId(item.id); setForm({ title: item.title, category: item.category, date: item.date, startTime: item.startTime, endTime: item.endTime, priority: item.priority, type: item.type }); setEditorOpen(true); }
  function moveEvent(id: string, date: string, hour: number) { setEvents((items) => items.map((item) => { if (item.id !== id || item.type === "schedule") return item; const start = hour * 60; return { ...item, date, startTime: minutesToTime(start), endTime: minutesToTime(Math.min(23 * 60 + 59, start + item.duration)) }; })); }
  const shift = (amount: number) => setAnchor((date) => addDays(date, amount * (view === "week" ? 7 : 1)));

  return <main className={`calendar-shell theme-${theme}`}>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="calendar-topbar"><a className="brand" href="/"><span className="brand-mark">N</span><span>Nexus</span></a><nav><a href="/">Workspace</a><span>/</span><strong>Calendar</strong></nav><div><button className="theme-toggle" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀" : "☾"}</button><button className="ai-button" onClick={() => setAiOpen(true)}>✦ AI Planner</button></div></header>
    <section className="calendar-heading"><div><p className="eyebrow"><span /> TIME MANAGEMENT</p><h1>Nexus Calendar</h1><p>安排你的时间，也为真正重要的事情留出空间。</p></div><button className="new-event" onClick={() => { setEditingId(null); setForm({ ...emptyForm, date: dateKey(anchor) }); setEditorOpen(true); }}>＋ New Event</button></section>
    <section className="calendar-toolbar"><div className="date-nav"><button onClick={() => shift(-1)}>←</button><button onClick={() => setAnchor(new Date())}>Today</button><button onClick={() => shift(1)}>→</button><strong>{anchor.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: view === "day" ? "numeric" : undefined })}</strong></div><div className="view-switch"><button className={view === "day" ? "active" : ""} onClick={() => setView("day")}>Day</button><button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button></div></section>
    <section className={`calendar-board view-${view}`}>
      <div className="calendar-corner" />{days.map((day) => <div className={`day-head ${dateKey(day) === dateKey(new Date()) ? "today" : ""}`} key={dateKey(day)}><span>{day.toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{day.getDate()}</strong></div>)}
      {hours.map((hour) => [<time className="hour-label" key={`time-${hour}`}>{String(hour).padStart(2, "0")}:00</time>, ...days.map((day) => <div className="calendar-slot" key={`${dateKey(day)}-${hour}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveEvent(event.dataTransfer.getData("text/event-id"), dateKey(day), hour)}>{visibleEvents.filter((item) => item.date === dateKey(day) && Number(item.startTime.slice(0, 2)) === hour).map((item) => <article draggable={item.type === "task"} onDragStart={(event) => event.dataTransfer.setData("text/event-id", item.id)} onClick={() => openEdit(item)} className={`calendar-event ${item.type} ${item.status}`} key={item.id}><span>{item.startTime}</span><strong>{item.title}</strong><small>{item.category} · {item.duration} min</small>{item.type === "schedule" && <b>Fixed schedule</b>}{item.status === "unfinished" && <b>Task unfinished · Change Time</b>}</article>)}</div>)])}
    </section>
    <p className="calendar-hint">拖动 Task 可以调整时间；固定 Schedule 不会被意外移动。所有安排仅保存在当前浏览器。</p>

    {editorOpen && <div className="calendar-modal"><button className="modal-backdrop" onClick={() => setEditorOpen(false)} /><form className="event-editor" onSubmit={saveEvent}><header><div><small>EVENT</small><h2>{editingId ? "Edit Event" : "New Event"}</h2></div><button type="button" onClick={() => setEditorOpen(false)}>×</button></header><label>标题<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label><div className="editor-grid"><label>日期<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label>分类<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label><label>开始<input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label><label>结束<input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label><label>优先级<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as NexusEvent["priority"] })}><option>High</option><option>Medium</option><option>Low</option></select></label><label>类型<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as NexusEvent["type"] })}><option value="task">Task</option><option value="schedule">Schedule</option></select></label></div><footer>{editingId && <button type="button" className="delete-event" onClick={() => { setEvents((items) => items.filter((item) => item.id !== editingId)); setEditorOpen(false); }}>Delete</button>}<button type="button" onClick={() => setEditorOpen(false)}>Cancel</button><button className="save-event">Save Event</button></footer></form></div>}
    {aiOpen && <div className="calendar-modal"><button className="modal-backdrop" onClick={() => setAiOpen(false)} /><section className="ai-planner"><header><div><small>OPTIONAL · BYOK</small><h2>✦ AI Planner</h2></div><button onClick={() => setAiOpen(false)}>×</button></header><p>AI 只提供建议，不会自动修改你的日程。即使不启用，Nexus 的全部时间管理功能仍然可用。</p><label>Provider<select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}><option>OpenAI</option><option>Claude</option><option>Gemini</option><option>DeepSeek</option></select></label><label>API Key<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="仅保存在此浏览器" /></label><div className="ai-suggestion"><small>SUGGESTION PREVIEW</small><strong>今天有一段可用的专注时间。</strong><p>19:00–20:30 · 完成 Rust Learning</p><em>建议仅供参考；接受前不会改变任何安排。</em><div><button>Ignore</button><button>Choose Time</button><button className="accept-ai">Accept</button></div></div></section></div>}
  </main>;
}
