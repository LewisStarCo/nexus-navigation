"use client";

import Link from "next/link";
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";

import { useNexusData } from "@/src/app/hooks/useNexusData";
import { DEFAULT_PROVIDER_CONFIGS } from "@/src/core/config";
import {
  addDays,
  dateKey,
  findEventConflicts,
  generateRecurringEvents,
  markPastPendingEventsUnfinished,
  moveEvent as moveEventInList,
  updateCurrentEvent,
  type RecurringEventDraft,
  type EventConflict,
} from "@/src/modules/calendar/domain";
import {
  createExternalEvent,
  parseImportText,
  prepareImportPreview,
  type ImportSource,
} from "@/src/modules/import-export";
import { loadRemoteScript } from "@/src/platform/browser/oauthScriptLoader";
import {
  parseAIJson,
  validateCalendarPlanningSuggestion,
  validateResourceSuggestion,
  type CalendarPlanningSuggestion,
} from "@/src/modules/ai-planner/domain/suggestions";
import { requestAIText } from "@/src/modules/ai-planner/services/providerClient";
import { setTheme as applyTheme } from "@/src/modules/settings";
import type {
  AIUsagePermissions,
  CustomProviderConfig,
  NexusEvent,
  Theme,
} from "@/src/shared/types";

type EventForm = RecurringEventDraft;
type View = "day" | "week";
type PendingCalendarChange = {
  additions: NexusEvent[];
  replacements: NexusEvent[];
  ignoreEventIds: string[];
  closeEditor?: boolean;
  closeAi?: boolean;
};
type ConflictWarning = {
  change: PendingCalendarChange;
  conflicts: EventConflict[];
  proposed: NexusEvent[];
};
type ExternalWindow = Window & { google?: { accounts: { oauth2: { initTokenClient: (config: Record<string, unknown>) => { requestAccessToken: () => void } } } }; msal?: { PublicClientApplication: new (config: Record<string, unknown>) => { initialize: () => Promise<void>; loginPopup: (request: Record<string, unknown>) => Promise<{ accessToken: string }> } } };
const emptyForm: EventForm = { title: "", category: "", date: dateKey(new Date()), startTime: "09:00", endTime: "10:00", priority: "Medium", type: "task", resources: [], repeatUnit: "none", repeatInterval: 1, repeatCount: 8 };
const providerDefaults = DEFAULT_PROVIDER_CONFIGS;

function resolveState<T>(action: SetStateAction<T>, current: T): T {
  return typeof action === "function"
    ? (action as (value: T) => T)(current)
    : action;
}

export default function CalendarPage() {
  const { data, storageError, setData, saveNow, updateAndSave } = useNexusData();
  const events = data.events;
  const resources = data.resources;
  const theme = data.settings.theme;
  const aiProvider = data.aiPlanner.provider;
  const apiKey = data.aiPlanner.apiKey;
  const aiModel = data.aiPlanner.model;
  const customProvider = data.aiPlanner.customProvider;
  const aiPermissions = data.aiPlanner.permissions;
  const setEvents = useCallback<Dispatch<SetStateAction<NexusEvent[]>>>((action) => setData((current) => {
    const next = resolveState(action, current.events);
    return next === current.events ? current : { ...current, events: next };
  }), [setData]);
  const setTheme = useCallback<Dispatch<SetStateAction<Theme>>>((action) => setData((current) => ({ ...current, settings: applyTheme(current.settings, resolveState(action, current.settings.theme)) })), [setData]);
  const setAiProvider = useCallback((provider: string) => setData((current) => ({ ...current, aiPlanner: { ...current.aiPlanner, provider } })), [setData]);
  const setApiKey = useCallback((apiKeyValue: string) => setData((current) => ({ ...current, aiPlanner: { ...current.aiPlanner, apiKey: apiKeyValue } })), [setData]);
  const setAiModel = useCallback((model: string) => setData((current) => ({ ...current, aiPlanner: { ...current.aiPlanner, model } })), [setData]);
  const setCustomProvider = useCallback((value: CustomProviderConfig) => setData((current) => ({ ...current, aiPlanner: { ...current.aiPlanner, customProvider: value } })), [setData]);
  const setAiPermissions = useCallback((permissions: AIUsagePermissions) => setData((current) => ({ ...current, aiPlanner: { ...current.aiPlanner, permissions } })), [setData]);
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSaveMessage, setAiSaveMessage] = useState("");
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiProposal, setAiProposal] = useState<CalendarPlanningSuggestion | null>(null);
  const [conflictWarning, setConflictWarning] = useState<ConflictWarning | null>(null);
  const [resourceSuggestion, setResourceSuggestion] = useState<{ ids: string[]; reason: string } | null>(null);
  const [resourceSuggestionLoading, setResourceSuggestionLoading] = useState(false);
  const [resourceSuggestionMessage, setResourceSuggestionMessage] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importSource, setImportSource] = useState<ImportSource>("apple-calendar");
  const [importPreview, setImportPreview] = useState<NexusEvent[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const [importMode, setImportMode] = useState<"account" | "file">("account");
  const [importStart, setImportStart] = useState(dateKey(new Date()));
  const [importEnd, setImportEnd] = useState(dateKey(addDays(new Date(), 90)));
  const [accountLoading, setAccountLoading] = useState(false);

  const weekStart = useMemo(() => { const date = new Date(anchor); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date; }, [anchor]);
  const days = view === "day" ? [anchor] : Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const displayEvents = useMemo(
    () => markPastPendingEventsUnfinished(events, dateKey(new Date())),
    [events],
  );
  const visibleEvents = displayEvents.filter((event) => days.some((day) => dateKey(day) === event.date));
  const hours = Array.from({ length: 15 }, (_, index) => index + 8);
  const categoryName = (categoryId?: string) => data.categories.find((category) => category.id === categoryId)?.name ?? "";

  function buildEvents(input: typeof emptyForm, source: NexusEvent["source"] = "local") {
    return generateRecurringEvents(input, source, { createId: () => crypto.randomUUID(), resourceIds: resources.map((resource) => resource.id) });
  }
  function finishEditor() { setEditorOpen(false); setEditingId(null); setForm({ ...emptyForm, resources: [], date: dateKey(anchor) }); setResourceSuggestion(null); setResourceSuggestionMessage(""); }
  function applyCalendarChange(change: PendingCalendarChange) {
    const replacements = new Map(change.replacements.map((item) => [item.id, item]));
    setEvents((items) => [...items.map((item) => replacements.get(item.id) ?? item), ...change.additions]);
    setConflictWarning(null);
    if (change.closeEditor) finishEditor();
    if (change.closeAi) { setAiProposal(null); setAiPrompt(""); setAiChatOpen(false); }
  }
  function stageCalendarChange(change: PendingCalendarChange) {
    const proposed = [...change.replacements, ...change.additions];
    const conflicts = findEventConflicts(proposed, events, { ignoreEventIds: change.ignoreEventIds });
    if (conflicts.length) { setConflictWarning({ change, conflicts, proposed }); return; }
    applyCalendarChange(change);
  }
  function saveEvent(event: FormEvent) {
    event.preventDefault(); if (!form.title.trim()) return;
    if (editingId) {
      const current = events.find((item) => item.id === editingId); if (!current) return;
      const replacement = updateCurrentEvent(current, form, { createId: () => crypto.randomUUID(), resourceIds: resources.map((resource) => resource.id) });
      stageCalendarChange({ additions: [], replacements: [replacement], ignoreEventIds: [editingId], closeEditor: true });
    } else {
      stageCalendarChange({ additions: buildEvents(form), replacements: [], ignoreEventIds: [], closeEditor: true });
    }
  }
  function openEdit(item: NexusEvent) { setEditingId(item.id); setForm({ title: item.title, category: item.category, date: item.date, startTime: item.startTime, endTime: item.endTime, priority: item.priority, type: item.type, resources: item.resources || [], repeatUnit: "none", repeatInterval: 1, repeatCount: 1 }); setResourceSuggestion(null); setResourceSuggestionMessage(""); setEditorOpen(true); }
  function moveEvent(id: string, date: string, hour: number) { setEvents((items) => moveEventInList(items, id, date, hour)); }
  const shift = (amount: number) => setAnchor((date) => addDays(date, amount * (view === "week" ? 7 : 1)));
  async function saveAiSettings() { try { await saveNow(); setAiSaveMessage("已保存到当前浏览器"); window.setTimeout(() => setAiSaveMessage(""), 2400); } catch { setAiSaveMessage("保存失败，请检查浏览器设置"); } }
  async function clearAiKey() { setAiChatOpen(false); try { await updateAndSave((current) => ({ ...current, aiPlanner: { ...current.aiPlanner, apiKey: "" } })); setAiSaveMessage("API Key 已删除"); } catch { setAiSaveMessage("删除失败，请检查浏览器设置"); } }
  function toggleFormResource(id: string) { setForm((current) => ({ ...current, resources: current.resources.includes(id) ? current.resources.filter((item) => item !== id) : [...current.resources, id] })); setResourceSuggestionMessage(""); }
  async function suggestResources() {
    if (!apiKey || !aiPermissions.planning || !resources.length || !form.title.trim()) return;
    setResourceSuggestionLoading(true); setResourceSuggestion(null); setResourceSuggestionMessage("");
    const catalog = resources.map((resource) => ({ id: resource.id, title: resource.name, type: resource.type, categoryId: resource.categoryId, url: resource.type === "website" ? resource.url : undefined, appIdentifier: resource.type === "application" ? resource.appIdentifier : undefined }));
    const instruction = `你是 Nexus 的 Event Resource 推荐助手。当前事件：${JSON.stringify({ title: form.title, category: form.category, date: form.date, startTime: form.startTime, endTime: form.endTime, type: form.type })}。只能从以下资源中选择，且只能返回其中已有的 id：${JSON.stringify(catalog)}。请只返回 JSON，不要 markdown：{"resourceIds":["existing-id"],"reason":"简短原因"}。可以返回空数组。不要创建资源，不要保存事件，不要修改 Navigation，也不要启动 Application。`;
    try {
      const text = await requestAIText(data.aiPlanner, { purpose: "planning", prompt: instruction, temperature: 0, maxTokens: 300 });
      const suggestion = validateResourceSuggestion(parseAIJson(text), resources);
      setResourceSuggestion({ ids: suggestion.resourceIds, reason: suggestion.reason });
    } catch (error) { setResourceSuggestionMessage(error instanceof Error ? error.message : "暂时无法获取 Resource 建议"); } finally { setResourceSuggestionLoading(false); }
  }
  function acceptResourceSuggestion() { if (!resourceSuggestion) return; setForm((current) => ({ ...current, resources: resourceSuggestion.ids })); setResourceSuggestionMessage("已采用建议；保存 Event 前仍可修改。"); setResourceSuggestion(null); }
  function modifyResourceSuggestion() { if (!resourceSuggestion) return; setForm((current) => ({ ...current, resources: [...new Set([...current.resources, ...resourceSuggestion.ids])] })); setResourceSuggestionMessage("建议已加入选择，请在 Resource 列表中继续调整。"); setResourceSuggestion(null); }
  async function askAi(event: FormEvent) {
    event.preventDefault(); if (!aiPrompt.trim() || !apiKey || !aiPermissions.calendar) return; setAiLoading(true); setAiError(""); setAiProposal(null);
    const nearbyEvents = events.filter((item) => item.date >= dateKey(new Date())).slice(0, 30);
    const nearby = JSON.stringify(nearbyEvents.map((item) => ({ id: item.id, title: item.title, date: item.date, startTime: item.startTime, endTime: item.endTime, type: item.type, status: item.status })));
    const plannerResources = aiPermissions.planning ? resources.map((resource) => ({ id: resource.id, title: resource.name, type: resource.type, categoryId: resource.categoryId })) : [];
    const instruction = `你是 Nexus Calendar 的规划顾问。今天是 ${dateKey(new Date())}。用户需求：${aiPrompt}\n已有安排（只能使用其中真实 id）：${nearby || "[]"}\n可关联的 Resource（resources 只能填写其中已有 id；列表为空时必须返回空数组）：${JSON.stringify(plannerResources)}\n如新安排与已有安排冲突，可以建议移动已有 Event，但只能调整 date、startTime、endTime，不得删除、完成、改标题或改资源。请只返回 JSON，不要 markdown：{"summary":"一句建议","reason":"简短原因","event":{"title":"","category":"","date":"YYYY-MM-DD","startTime":"HH:mm","endTime":"HH:mm","priority":"High|Medium|Low","type":"task|schedule","resources":[],"repeatUnit":"none|week|month","repeatInterval":1,"repeatCount":1},"adjustments":[{"eventId":"已有 Event 的真实 id","date":"YYYY-MM-DD","startTime":"HH:mm","endTime":"HH:mm","reason":"调整原因"}]}。没有需要移动的日程时 adjustments 返回空数组。你只能提供建议；不要保存、修改或删除任何日程，不要创建资源，不要启动 Application。`;
    try {
      const text = await requestAIText(data.aiPlanner, { purpose: "calendar", prompt: instruction, temperature: .4, maxTokens: 900 });
      const proposal = validateCalendarPlanningSuggestion(parseAIJson(text), nearbyEvents, resources, emptyForm, aiPermissions.planning);
      if (!proposal) throw new Error("AI 返回的日程格式无效，请调整描述后重试。");
      setAiProposal(proposal);
    } catch (error) { setAiError(error instanceof Error ? error.message : "暂时无法获取建议。请检查 Provider、模型、Key 和网络设置。"); } finally { setAiLoading(false); }
  }
  function updateAiAdjustment(index: number, patch: Partial<CalendarPlanningSuggestion["adjustments"][number]>) { setAiProposal((current) => current ? { ...current, adjustments: current.adjustments.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current); }
  function acceptAiProposal() {
    if (!aiProposal) return;
    const invalidNewEvent = !/^\d{4}-\d{2}-\d{2}$/.test(aiProposal.event.date) || aiProposal.event.startTime >= aiProposal.event.endTime;
    const invalidAdjustment = aiProposal.adjustments.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || item.startTime >= item.endTime);
    if (invalidNewEvent || invalidAdjustment) { setAiError("请检查建议中的日期与时间：结束时间必须晚于开始时间。"); return; }
    const replacements = aiProposal.adjustments.map((adjustment) => {
      const current = events.find((item) => item.id === adjustment.eventId); if (!current) return null;
      return updateCurrentEvent(current, { title: current.title, category: current.category, date: adjustment.date, startTime: adjustment.startTime, endTime: adjustment.endTime, priority: current.priority, type: current.type, resources: current.resources }, { createId: () => crypto.randomUUID(), resourceIds: resources.map((resource) => resource.id) });
    }).filter((item): item is NexusEvent => Boolean(item));
    stageCalendarChange({ additions: buildEvents(aiProposal.event, "ai-suggestion"), replacements, ignoreEventIds: replacements.map((item) => item.id), closeAi: true });
  }
  function editAiProposal() { if (!aiProposal) return; setForm(aiProposal.event); setEditingId(null); setEditorOpen(true); setAiChatOpen(false); }
  async function readImportFile(file?: File) { if (!file) return; if (!importStart || !importEnd || importEnd < importStart) { setImportMessage("请选择有效的开始日期和结束日期。"); return; } setImportMessage(""); try { const text = await file.text(); const parsed = parseImportText(text, file.name, importSource, { createId: () => crypto.randomUUID(), now: () => new Date(), resourceIds: resources.map((resource) => resource.id) }); const preview = prepareImportPreview(parsed, events, importStart, importEnd); setImportPreview(preview.unique); setImportMessage(parsed.length ? `${parsed.length} 个项目已读取，仅保留 ${importStart} 至 ${importEnd} 的 ${preview.inRange.length} 个项目；${preview.duplicateCount} 个重复项目已过滤。` : "没有识别到可导入的日程。请检查文件格式。"); } catch { setImportPreview([]); setImportMessage("文件读取失败。请使用 UTF-8 编码的 ICS、CSV 或 JSON 文件。"); } }
  function confirmImport() { setEvents((items) => [...items, ...importPreview]); setImportMessage(`已导入 ${importPreview.length} 个项目。`); setImportPreview([]); window.setTimeout(() => setImportOpen(false), 700); }
  function externalEvent(input: { id: string; title: string; category?: string; start: Date; end?: Date; completed?: boolean; type?: NexusEvent["type"] }, source: ImportSource): NexusEvent { return createExternalEvent(input, source, { createId: () => crypto.randomUUID(), now: () => new Date(), resourceIds: resources.map((resource) => resource.id) }); }
  function prepareAccountPreview(items: NexusEvent[]) { const preview = prepareImportPreview(items, events, importStart, importEnd); setImportPreview(preview.unique); setImportMessage(`${items.length} 个项目已读取，${preview.duplicateCount} 个重复项目已过滤。`); }
  async function importGoogleAccount() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID; if (!clientId) { setImportMessage("网站管理员尚未配置 Google OAuth Client ID。请先在 Vercel 环境变量中添加 NEXT_PUBLIC_GOOGLE_CLIENT_ID。"); return; } setAccountLoading(true); setImportMessage("");
    try { await loadRemoteScript("https://accounts.google.com/gsi/client", "google-identity-services"); const google = (window as ExternalWindow).google; if (!google) throw new Error("Google 登录组件不可用"); const tokenClient = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: "https://www.googleapis.com/auth/calendar.readonly", callback: async (token: { access_token?: string; error?: string }) => { try { if (!token.access_token) throw new Error(token.error || "Google 授权失败"); const imported: NexusEvent[] = []; let pageToken = ""; do { const params = new URLSearchParams({ timeMin: new Date(`${importStart}T00:00:00`).toISOString(), timeMax: new Date(`${importEnd}T23:59:59`).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "2500", ...(pageToken ? { pageToken } : {}) }); const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers: { Authorization: `Bearer ${token.access_token}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Google Calendar 读取失败"); for (const item of data.items || []) { if (item.status === "cancelled") continue; const start = new Date(item.start?.dateTime || `${item.start?.date}T09:00:00`); const end = new Date(item.end?.dateTime || `${item.end?.date || item.start?.date}T10:00:00`); imported.push(externalEvent({ id: item.id, title: item.summary || "Google Calendar Event", category: "Google Calendar", start, end }, "google-calendar")); } pageToken = data.nextPageToken || ""; } while (pageToken); prepareAccountPreview(imported); } catch (error) { setImportMessage(error instanceof Error ? error.message : "Google Calendar 导入失败"); } finally { setAccountLoading(false); } } }); tokenClient.requestAccessToken(); } catch (error) { setImportMessage(error instanceof Error ? error.message : "Google 登录失败"); setAccountLoading(false); }
  }
  async function importMicrosoftAccount() {
    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID; if (!clientId) { setImportMessage("网站管理员尚未配置 Microsoft OAuth Client ID。请先在 Vercel 环境变量中添加 NEXT_PUBLIC_MICROSOFT_CLIENT_ID。"); return; } setAccountLoading(true); setImportMessage("");
    try { await loadRemoteScript("https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js", "microsoft-msal"); const Msal = (window as ExternalWindow).msal; if (!Msal) throw new Error("Microsoft 登录组件不可用"); const app = new Msal.PublicClientApplication({ auth: { clientId, authority: "https://login.microsoftonline.com/common", redirectUri: `${window.location.origin}/calendar` }, cache: { cacheLocation: "sessionStorage" } }); await app.initialize(); const auth = await app.loginPopup({ scopes: importSource === "microsoft-todo" ? ["Tasks.Read"] : ["Calendars.Read"] }); const headers = { Authorization: `Bearer ${auth.accessToken}` }; const imported: NexusEvent[] = [];
      if (importSource === "outlook-calendar") { let url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(`${importStart}T00:00:00`)}&endDateTime=${encodeURIComponent(`${importEnd}T23:59:59`)}&$top=1000`; while (url) { const response = await fetch(url, { headers }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Outlook Calendar 读取失败"); for (const item of data.value || []) imported.push(externalEvent({ id: item.id, title: item.subject || "Outlook Event", category: item.categories?.[0] || "Outlook Calendar", start: new Date(item.start?.dateTime), end: new Date(item.end?.dateTime) }, "outlook-calendar")); url = data["@odata.nextLink"] || ""; } }
      else { const listsResponse = await fetch("https://graph.microsoft.com/v1.0/me/todo/lists", { headers }); const listsData = await listsResponse.json(); if (!listsResponse.ok) throw new Error(listsData.error?.message || "Microsoft To Do 列表读取失败"); for (const list of listsData.value || []) { let url = `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(list.id)}/tasks?$top=100`; while (url) { const response = await fetch(url, { headers }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Microsoft To Do 读取失败"); for (const task of data.value || []) { const due = task.dueDateTime?.dateTime || task.startDateTime?.dateTime; if (!due) continue; const start = new Date(due); const key = dateKey(start); if (key < importStart || key > importEnd) continue; imported.push(externalEvent({ id: task.id, title: task.title || "Microsoft To Do", category: list.displayName || "Microsoft To Do", start, completed: task.status === "completed", type: "task" }, "microsoft-todo")); } url = data["@odata.nextLink"] || ""; } } } prepareAccountPreview(imported);
    } catch (error) { setImportMessage(error instanceof Error ? error.message : "Microsoft 导入失败"); } finally { setAccountLoading(false); }
  }

  return <main className={`calendar-shell theme-${theme}`}>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    {storageError && <div className="capture-notice" role="alert">本地数据暂时无法读取。为保护原始内容，本页不会覆盖现有存储：{storageError.message}</div>}
    <header className="calendar-topbar"><Link className="brand" href="/"><span className="brand-mark">N</span><span>Nexus</span></Link><nav><Link href="/">Workspace</Link><span>/</span><strong>Calendar</strong></nav><div><button className="theme-toggle" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀" : "☾"}</button><button className="ai-button" onClick={() => setAiOpen(true)}>✦ AI Planner</button></div></header>
    <section className="calendar-heading"><div><p className="eyebrow"><span /> TIME MANAGEMENT</p><h1>Nexus Calendar</h1><p>安排你的时间，也为真正重要的事情留出空间。</p></div><div className="calendar-heading-actions"><button className="import-events" onClick={() => { setImportPreview([]); setImportMessage(""); setImportOpen(true); }}>⇩ Import</button><button className="new-event" onClick={() => { setEditingId(null); setForm({ ...emptyForm, resources: [], date: dateKey(anchor) }); setResourceSuggestion(null); setResourceSuggestionMessage(""); setEditorOpen(true); }}>＋ New Event</button></div></section>
    <section className="calendar-toolbar"><div className="date-nav"><button onClick={() => shift(-1)}>←</button><button onClick={() => setAnchor(new Date())}>Today</button><button onClick={() => shift(1)}>→</button><strong>{anchor.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: view === "day" ? "numeric" : undefined })}</strong></div><div className="view-switch"><button className={view === "day" ? "active" : ""} onClick={() => setView("day")}>Day</button><button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button></div></section>
    <section className={`calendar-board view-${view}`}>
      <div className="calendar-corner" />{days.map((day) => <div className={`day-head ${dateKey(day) === dateKey(new Date()) ? "today" : ""}`} key={dateKey(day)}><span>{day.toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{day.getDate()}</strong></div>)}
      {hours.map((hour) => [<time className="hour-label" key={`time-${hour}`}>{String(hour).padStart(2, "0")}:00</time>, ...days.map((day) => <div className="calendar-slot" key={`${dateKey(day)}-${hour}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveEvent(event.dataTransfer.getData("text/event-id"), dateKey(day), hour)}>{visibleEvents.filter((item) => item.date === dateKey(day) && Number(item.startTime.slice(0, 2)) === hour).map((item) => <article draggable={item.type === "task"} onDragStart={(event) => event.dataTransfer.setData("text/event-id", item.id)} onClick={() => openEdit(item)} className={`calendar-event ${item.type} ${item.status}`} key={item.id}><span>{item.startTime}</span><strong>{item.title}</strong><small>{item.category} · {item.duration} min</small>{item.type === "schedule" && <b>Fixed schedule</b>}{item.status === "unfinished" && <b>Task unfinished · Change Time</b>}</article>)}</div>)])}
    </section>
    <p className="calendar-hint">拖动 Task 可以调整时间；固定 Schedule 不会被意外移动。所有安排仅保存在当前浏览器。</p>
    {apiKey && aiPermissions.calendar && <button className="ai-robot" onClick={() => setAiChatOpen(true)} aria-label="打开 AI 规划助手"><span>🤖</span><b>Ask AI</b></button>}
    {importOpen && <a className="import-readme-link" href="https://github.com/LewisStarCo/nexus-navigation#从外部应用导入" target="_blank" rel="noreferrer">不会操作？查看各平台导入教程 ↗</a>}

    {editorOpen && <div className="calendar-modal"><button className="modal-backdrop" onClick={() => setEditorOpen(false)} /><form className="event-editor" onSubmit={saveEvent}><header><div><small>EVENT</small><h2>{editingId ? "Edit Event" : "New Event"}</h2></div><button type="button" onClick={() => setEditorOpen(false)}>×</button></header><label>标题<input value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setResourceSuggestion(null); }} required /></label><div className="editor-grid"><label>日期<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label>分类<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label><label>开始<input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label><label>结束<input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label><label>优先级<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as NexusEvent["priority"] })}><option>High</option><option>Medium</option><option>Low</option></select></label><label>类型<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as NexusEvent["type"] })}><option value="task">Task</option><option value="schedule">Schedule</option></select></label><label className="repeat-field">重复<select value={form.repeatUnit} disabled={!!editingId} onChange={(e) => setForm({ ...form, repeatUnit: e.target.value as typeof form.repeatUnit })}><option value="none">不重复</option><option value="week">每 X 周</option><option value="month">每 X 月</option></select></label>{form.repeatUnit !== "none" && <><label>间隔<input type="number" min="1" max="52" value={form.repeatInterval} onChange={(e) => setForm({ ...form, repeatInterval: Number(e.target.value) })} /></label><label>重复次数<input type="number" min="1" max="52" value={form.repeatCount} onChange={(e) => setForm({ ...form, repeatCount: Number(e.target.value) })} /></label></>}</div><section className="event-resource-section"><div className="resource-selector-header"><div><small>RESOURCES</small><strong>Website &amp; Application</strong></div>{apiKey && aiPermissions.planning && resources.length > 0 && <button type="button" className="suggest-resources" onClick={() => void suggestResources()} disabled={resourceSuggestionLoading || !form.title.trim()}>{resourceSuggestionLoading ? "Suggesting…" : "✦ Suggest Resources"}</button>}</div>{resources.length ? <div className="resource-selector">{resources.map((resource) => <label className={`resource-option ${form.resources.includes(resource.id) ? "selected" : ""}`} key={resource.id}><input type="checkbox" checked={form.resources.includes(resource.id)} onChange={() => toggleFormResource(resource.id)} /><span aria-hidden="true">{resource.type === "application" ? "💻" : "🌐"}</span><span><strong>{resource.name}</strong><small>{resource.type === "application" ? "Application" : "Website"}{resource.categoryId ? " · " + categoryName(resource.categoryId) : ""}</small></span></label>)}</div> : <p className="resource-empty">还没有可关联的 Resource。请先在 Workspace 中添加 Website 或 Application。</p>}{resourceSuggestionMessage && <p className="resource-suggestion-message">{resourceSuggestionMessage}</p>}{resourceSuggestion && <div className="resource-ai-suggestion"><small>AI SUGGESTION</small><p>{resourceSuggestion.reason}</p><div>{resourceSuggestion.ids.length ? resourceSuggestion.ids.map((id) => { const resource = resources.find((item) => item.id === id); return resource ? <span key={id}>{resource.type === "application" ? "💻" : "🌐"} {resource.name}</span> : null; }) : <span>不建议关联现有 Resource</span>}</div><footer><button type="button" onClick={() => setResourceSuggestion(null)}>Ignore</button><button type="button" onClick={modifyResourceSuggestion}>Modify</button><button type="button" onClick={acceptResourceSuggestion}>Accept</button></footer></div>}</section>{editingId && <p className="repeat-note">编辑重复日程时只修改当前这一项。</p>}<footer>{editingId && <button type="button" className="delete-event" onClick={() => { setEvents((items) => items.filter((item) => item.id !== editingId)); setEditorOpen(false); }}>Delete</button>}<button type="button" onClick={() => setEditorOpen(false)}>Cancel</button><button className="save-event">Save Event</button></footer></form></div>}
    {importOpen && <div className="calendar-modal"><button className="modal-backdrop" onClick={() => setImportOpen(false)} /><section className="import-panel"><header><div><small>CALENDAR CONNECTION</small><h2>Import Calendar</h2></div><button onClick={() => setImportOpen(false)}>×</button></header><p>连接账户并选择日期范围，或使用本地文件。只有用户确认后，日程才会写入 Nexus。</p><div className="import-mode"><button className={importMode === "account" ? "active" : ""} onClick={() => { setImportMode("account"); setImportPreview([]); setImportMessage(""); }}>Connect Account</button><button className={importMode === "file" ? "active" : ""} onClick={() => { setImportMode("file"); setImportPreview([]); setImportMessage(""); }}>Import File</button></div><div className="import-sources">{(["apple-calendar", "google-calendar", "outlook-calendar", "microsoft-todo"] as ImportSource[]).map((source) => <button className={importSource === source ? "active" : ""} onClick={() => { setImportSource(source); setImportPreview([]); setImportMessage(""); }} key={source}>{source === "apple-calendar" ? "Apple Calendar" : source === "google-calendar" ? "Google Calendar" : source === "outlook-calendar" ? "Outlook" : "Microsoft To Do"}</button>)}</div>{importMode === "account" ? <div className="account-import"><div className="import-range"><label>开始日期<input type="date" value={importStart} onChange={(e) => setImportStart(e.target.value)} /></label><label>结束日期<input type="date" value={importEnd} min={importStart} onChange={(e) => setImportEnd(e.target.value)} /></label></div>{importSource === "apple-calendar" ? <div className="import-guide"><strong>Apple Calendar 无法从普通网页连接</strong><span>iPhone/iPad 没有导出日历功能，Apple 也没有提供 iCloud Calendar 网页 OAuth API。Mac 用户可在 Calendar 中使用“文件 → 导出 → 导出”生成 ICS；移动设备的一键读取需要未来开发原生 App。</span></div> : <><div className="import-guide"><strong>{importSource === "google-calendar" ? "Google Calendar 只读授权" : importSource === "outlook-calendar" ? "Microsoft Calendar 只读授权" : "Microsoft To Do 只读授权"}</strong><span>Nexus 会打开官方登录窗口，并只请求读取日程所需的最小权限。</span></div><button className="connect-calendar" disabled={accountLoading || !importStart || !importEnd || importEnd < importStart} onClick={importSource === "google-calendar" ? importGoogleAccount : importMicrosoftAccount}>{accountLoading ? "Connecting…" : `Connect ${importSource === "google-calendar" ? "Google" : "Microsoft"} & Preview`}</button></>}</div> : <><div className="import-range file-range"><label>只导入从<input type="date" value={importStart} onChange={(e) => setImportStart(e.target.value)} /></label><label>到<input type="date" value={importEnd} min={importStart} onChange={(e) => setImportEnd(e.target.value)} /></label></div><div className="import-guide">{importSource === "apple-calendar" ? <><strong>仅 macOS Calendar 可以导出</strong><span>在 Mac Calendar 中选择“文件 → 导出 → 导出”并上传 ICS。iPhone/iPad 自带日历没有此选项。</span></> : importSource === "microsoft-todo" ? <><strong>支持 CSV 或 JSON</strong><span>从 Microsoft 账户的数据导出中取得任务文件。</span></> : <><strong>支持 ICS 日历文件</strong><span>在对应日历应用中选择“导出”或“下载”，然后上传生成的 .ics 文件。</span></>}</div><label className="import-drop"><input type="file" accept={importSource === "microsoft-todo" ? ".csv,.json,.ics" : ".ics"} onChange={(event) => readImportFile(event.target.files?.[0])} /><span>选择文件</span><small>{importSource === "microsoft-todo" ? ".csv · .json · .ics" : ".ics"}</small></label></>}{importMessage && <p className="import-message">{importMessage}</p>}{importPreview.length > 0 && <><div className="import-preview"><div><strong>准备导入</strong><span>{importPreview.length} items</span></div>{importPreview.slice(0, 6).map((item) => <article key={item.id}><time>{item.date}<br />{item.startTime}</time><p><strong>{item.title}</strong><small>{item.category} · {item.source}</small></p></article>)}{importPreview.length > 6 && <small>以及另外 {importPreview.length - 6} 个项目…</small>}</div><button className="confirm-import" onClick={confirmImport}>Import {importPreview.length} Events</button></>}</section></div>}
    {aiOpen && <div className="calendar-modal"><button className="modal-backdrop" onClick={() => setAiOpen(false)} /><section className="ai-planner"><header><div><small>OPTIONAL · BYOK</small><h2>✦ AI Planner Settings</h2></div><button onClick={() => setAiOpen(false)}>×</button></header><p>AI 只在你允许的功能中、并由你主动操作时提供建议。它不会自动整理 Resource 或修改日程。</p><div className="ai-permissions"><span>AI 使用权限</span><div><button type="button" className={aiPermissions.calendar ? "active" : ""} onClick={() => setAiPermissions({ ...aiPermissions, calendar: !aiPermissions.calendar })}><strong>Used in Calendar</strong><small>允许生成可编辑的日程建议</small></button><button type="button" className={aiPermissions.category ? "active" : ""} onClick={() => setAiPermissions({ ...aiPermissions, category: !aiPermissions.category })}><strong>Used in Category</strong><small>允许为 Resource 推荐现有分类</small></button><button type="button" className={aiPermissions.planning ? "active" : ""} onClick={() => setAiPermissions({ ...aiPermissions, planning: !aiPermissions.planning })}><strong>Used in Planning</strong><small>允许为 Event 推荐已有 Website 与 Application</small></button><button type="button" className={!aiPermissions.calendar && !aiPermissions.category && !aiPermissions.planning ? "active danger" : "danger"} onClick={() => { setAiPermissions({ calendar: false, category: false, planning: false }); setAiChatOpen(false); setResourceSuggestion(null); }}><strong>Do not use AI in any situation</strong><small>关闭 Calendar、Category 与 Planning 中的 AI 请求</small></button></div></div><label>Provider<select value={aiProvider} onChange={(e) => { const value = e.target.value; setAiProvider(value); if (providerDefaults[value]) setAiModel(providerDefaults[value].model); }}><option>OpenAI</option><option>Qwen</option><option>Claude</option><option>Gemini</option><option>DeepSeek</option><option>智谱 AI</option><option value="Custom">自定义 Provider</option></select></label>{aiProvider === "Custom" && <div className="custom-provider"><label>Provider 名称<input value={customProvider.name} onChange={(e) => setCustomProvider({ ...customProvider, name: e.target.value })} placeholder="例如：Moonshot" /></label><label>API Base URL<input value={customProvider.baseUrl} onChange={(e) => setCustomProvider({ ...customProvider, baseUrl: e.target.value })} placeholder="https://api.example.com/v1" /></label></div>}<label>模型名称<input value={aiProvider === "Custom" ? customProvider.model : aiModel} onChange={(e) => aiProvider === "Custom" ? setCustomProvider({ ...customProvider, model: e.target.value }) : setAiModel(e.target.value)} placeholder="模型 ID" /></label><label>API Key<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="使用你自己的 API Key" /></label><p className="api-key-note">Provider 配置、权限与密钥只保存在当前浏览器，不会上传到 Nexus 服务器。</p><div className="ai-save-row"><button className="clear-ai-key" onClick={clearAiKey} disabled={!apiKey}>删除密钥</button><span>{aiSaveMessage}</span><button className="save-ai-settings" onClick={saveAiSettings}>保存到本地</button></div></section></div>}
    {aiChatOpen && <div className="calendar-modal"><button className="modal-backdrop" onClick={() => setAiChatOpen(false)} /><section className="ai-chat"><header><div><small>{aiProvider === "Custom" ? customProvider.name || "CUSTOM" : aiProvider} · {aiProvider === "Custom" ? customProvider.model : aiModel}</small><h2>🤖 Plan with AI</h2></div><button onClick={() => setAiChatOpen(false)}>×</button></header><p>告诉 AI 你想完成什么，也可以说明突发安排。AI 可以建议移动已有日程，但只有你确认后才会实际修改。</p><form onSubmit={askAi}><textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="例如：今天 15:00 突然有一个会议，请帮我为原来的学习安排建议一个新时间。" autoFocus /><button disabled={aiLoading || !aiPrompt.trim()}>{aiLoading ? "Planning…" : "Generate Plan"}</button></form>{aiError && <div className="ai-error">{aiError}</div>}{aiProposal && <div className="ai-proposal"><small>AI SUGGESTION · REVIEW REQUIRED</small><h3>{aiProposal.summary}</h3><p>{aiProposal.reason}</p><div className="ai-proposed-event"><strong>{aiProposal.event.title}</strong><label>日期<input type="date" value={aiProposal.event.date} onChange={(e) => setAiProposal({ ...aiProposal, event: { ...aiProposal.event, date: e.target.value } })} /></label><span><label>开始<input type="time" value={aiProposal.event.startTime} onChange={(e) => setAiProposal({ ...aiProposal, event: { ...aiProposal.event, startTime: e.target.value } })} /></label><label>结束<input type="time" value={aiProposal.event.endTime} onChange={(e) => setAiProposal({ ...aiProposal, event: { ...aiProposal.event, endTime: e.target.value } })} /></label></span><em>{aiProposal.event.repeatUnit === "none" ? "单次安排" : `每 ${aiProposal.event.repeatInterval} ${aiProposal.event.repeatUnit === "week" ? "周" : "月"} · 共 ${aiProposal.event.repeatCount} 次`}</em>{aiProposal.event.resources.length > 0 && <em>Resources · {aiProposal.event.resources.map((id) => resources.find((resource) => resource.id === id)?.name).filter(Boolean).join(" · ")}</em>}</div>{aiProposal.adjustments.length > 0 && <section className="ai-adjustments"><small>建议调整现有日程</small>{aiProposal.adjustments.map((adjustment, index) => { const current = events.find((item) => item.id === adjustment.eventId); return current ? <article key={adjustment.eventId}><div><strong>{current.title}</strong><span>原安排 · {current.date} {current.startTime}–{current.endTime}</span><p>{adjustment.reason}</p></div><label>新日期<input type="date" value={adjustment.date} onChange={(e) => updateAiAdjustment(index, { date: e.target.value })} /></label><label>新开始<input type="time" value={adjustment.startTime} onChange={(e) => updateAiAdjustment(index, { startTime: e.target.value })} /></label><label>新结束<input type="time" value={adjustment.endTime} onChange={(e) => updateAiAdjustment(index, { endTime: e.target.value })} /></label></article> : null; })}</section>}<p className="ai-advisor-note">AI Advisor, Not Decision Maker · 点击“确认并应用”前，Nexus 不会改变任何日程。</p><footer><button onClick={() => setAiProposal(null)}>Ignore</button><button onClick={editAiProposal}>单独编辑新日程</button><button className="accept-ai" onClick={acceptAiProposal}>确认并应用</button></footer></div>}</section></div>}

    {conflictWarning && <div className="calendar-modal" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title"><button className="modal-backdrop" onClick={() => setConflictWarning(null)} aria-label="返回调整" /><section className="conflict-dialog"><header><div><small>SCHEDULE CONFLICT</small><h2 id="conflict-title">这个时间已有安排</h2></div><button onClick={() => setConflictWarning(null)}>×</button></header><p>发现 {conflictWarning.conflicts.length} 处时间重叠。这只是提醒；如果你确实需要同时进行，可以继续保存。</p><div className="conflict-list">{conflictWarning.conflicts.slice(0, 5).map((conflict, index) => { const proposed = conflictWarning.proposed.find((item) => item.id === conflict.proposedId); const existing = events.find((item) => item.id === conflict.existingId) ?? conflictWarning.proposed.find((item) => item.id === conflict.existingId); return <article key={`${conflict.proposedId}-${conflict.existingId}-${index}`}><time>{conflict.date}<br />{conflict.overlapStart}–{conflict.overlapEnd}</time><p><strong>{proposed?.title || "新日程"}</strong><span>与 {existing?.title || "已有日程"} 重叠</span></p></article>; })}{conflictWarning.conflicts.length > 5 && <small>还有 {conflictWarning.conflicts.length - 5} 处重叠未展开。</small>}</div><footer><button onClick={() => setConflictWarning(null)}>返回调整</button><button className="continue-conflict" onClick={() => applyCalendarChange(conflictWarning.change)}>仍然保存</button></footer></section></div>}
  </main>;
}
