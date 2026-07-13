"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

// ResourceType is intentionally extensible: future native clients can add files,
// folders or shortcuts without changing the workspace model.
type ResourceType = "website" | "application";
type Resource = { id: string; title: string; type: ResourceType; url: string; appIdentifier: string; icon: string; category: string; order: number; createdAt: string; updatedAt: string; description: string; mark: string; color: string };
type ClockZone = { label: string; zone: string };
type SearchEngine = { label: string; url: string };
type NexusEvent = { id: string; title: string; category: string; priority: "High" | "Medium" | "Low"; type: "task" | "schedule"; date: string; startTime: string; endTime: string; duration: number; status: "pending" | "completed" | "unfinished"; source: "local" | "calendar" | "google-calendar" | "outlook-calendar" | "apple-calendar" | "microsoft-todo" | "ai-suggestion"; resources: string[]; recurrence?: { unit: "week" | "month"; interval: number; count: number; seriesId: string } };
type AiPermissions = { calendar: boolean; category: boolean; planning: boolean };
type AiPlannerConfig = { provider: string; apiKey: string; model: string; customProvider: { name: string; baseUrl: string; model: string }; permissions: AiPermissions };
type ExtensionCapture = { id?: string; title?: string; url?: string; category?: string; requestAi?: boolean };

const defaultCategories = ["复旦学习", "AI 工具", "编程开发", "知识资源"];
const TEMP_CATEGORY = "__nexus_temporary__";
const UNCLASSIFIED_CATEGORY = "__nexus_unclassified__";
const palette = ["blue", "indigo", "violet", "cyan", "sky", "teal", "emerald", "amber", "orange", "rose", "purple", "pink"];
const defaultZones: ClockZone[] = [{ label: "北京时间", zone: "Asia/Shanghai" }, { label: "旧金山时间", zone: "America/Los_Angeles" }];
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const createDefaultEvents = (): NexusEvent[] => [
  { id: "event-math", title: "Engineering Mathematics", category: "数学", priority: "High", type: "schedule", date: localDate(), startTime: "09:00", endTime: "10:30", duration: 90, status: "pending", source: "local", resources: [] },
  { id: "event-rust", title: "Rust Learning", category: "Coding", priority: "High", type: "task", date: localDate(), startTime: "11:00", endTime: "12:30", duration: 90, status: "pending", source: "local", resources: [] },
  { id: "event-algebra", title: "Linear Algebra", category: "数学", priority: "Medium", type: "task", date: localDate(), startTime: "15:00", endTime: "16:00", duration: 60, status: "pending", source: "local", resources: [] },
  { id: "event-paper", title: "AI Paper Reading", category: "科研", priority: "Low", type: "task", date: localDate(), startTime: "21:00", endTime: "21:45", duration: 45, status: "pending", source: "local", resources: [] },
];
const searchEngines: SearchEngine[] = [
  { label: "Google", url: "https://www.google.com/search?q={query}" },
  { label: "百度", url: "https://www.baidu.com/s?wd={query}" },
  { label: "Bing", url: "https://www.bing.com/search?q={query}" },
  { label: "DuckDuckGo", url: "https://duckduckgo.com/?q={query}" },
];
const zoneOptions: ClockZone[] = [
  { label: "本地时间", zone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: "北京时间", zone: "Asia/Shanghai" }, { label: "东京时间", zone: "Asia/Tokyo" },
  { label: "新加坡时间", zone: "Asia/Singapore" }, { label: "伦敦时间", zone: "Europe/London" },
  { label: "巴黎时间", zone: "Europe/Paris" }, { label: "纽约时间", zone: "America/New_York" },
  { label: "旧金山时间", zone: "America/Los_Angeles" }, { label: "悉尼时间", zone: "Australia/Sydney" },
];
const providerDefaults: Record<string, { baseUrl: string; model: string }> = {
  OpenAI: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  Qwen: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  "智谱 AI": { baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.5-flash" },
  DeepSeek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  Claude: { baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5" },
  Gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
};
const defaultAiPlanner: AiPlannerConfig = { provider: "OpenAI", apiKey: "", model: providerDefaults.OpenAI.model, customProvider: { name: "", baseUrl: "", model: "" }, permissions: { calendar: true, category: false, planning: false } };
const rawLinks = [
  ["复旦邮箱", "收发校园邮件", "https://mail.m.fudan.edu.cn/", "复旦学习", "邮", "blue"],
  ["复旦 eLearning", "课程资料与在线学习", "https://elearning.fudan.edu.cn/", "复旦学习", "课", "indigo"],
  ["网上办事服务大厅", "校园事务一站办理", "https://ehall.fudan.edu.cn/", "复旦学习", "办", "violet"],
  ["复旦超星学习平台", "在线课程与教学资源", "https://fudan.mooc.chaoxing.com/portal", "复旦学习", "学", "cyan"],
  ["本科教务管理系统", "成绩、课表与教务信息", "https://fdjwgl.fudan.edu.cn/student/", "复旦学习", "教", "sky"],
  ["复旦选课系统", "本科生课程选退", "https://xk.fudan.edu.cn/", "复旦学习", "选", "teal"],
  ["ChatGPT", "OpenAI 智能助手", "https://www.chatgpt.com/", "AI 工具", "G", "emerald"],
  ["Claude", "Anthropic 智能助手", "https://claude.ai/", "AI 工具", "C", "amber"],
  ["DeepSeek", "深度求索智能助手", "https://chat.deepseek.com/", "AI 工具", "D", "blue"],
  ["Compiler Explorer", "在线编译器与汇编分析", "https://godbolt.org/", "编程开发", "CE", "orange"],
  ["C++ Reference", "C 与 C++ 标准库参考", "https://en.cppreference.com/", "编程开发", "C++", "indigo"],
  ["The Rust Book", "Rust 官方编程语言教程", "https://doc.rust-lang.org/book/?utm_source=chatgpt.com#the-rust-programming-language", "编程开发", "Rs", "rose"],
  ["GitHub", "代码托管与开源协作平台", "https://www.github.com/", "编程开发", "GH", "indigo"],
  ["Z-Library", "数字图书与文献资源", "https://zlib.bz/", "知识资源", "Z", "purple"],
  ["XMRth", "常用资源入口", "https://xmrth1.net/", "知识资源", "X", "pink"],
  ["Google", "搜索信息与探索互联网", "https://www.google.com/", "知识资源", "G", "blue"],
];
const DEFAULT_RESOURCE_TIMESTAMP = "2026-07-13T00:00:00.000Z";
const defaultResources: Resource[] = rawLinks.map((item, index) => ({ id: `default-${index}`, title: item[0], type: "website", description: item[1], url: item[2], appIdentifier: "", icon: "", category: item[3], order: index, createdAt: DEFAULT_RESOURCE_TIMESTAMP, updatedAt: DEFAULT_RESOURCE_TIMESTAMP, mark: item[4], color: item[5] }));

function domainOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }
function normalizeUrl(url: string) { return /^https?:\/\//i.test(url) ? url : `https://${url}`; }
function migrateResources(items: unknown[]): Resource[] {
  return items.map((raw, index) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Partial<Resource>;
    const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : `Resource ${index + 1}`;
    const type: ResourceType = item.type === "application" ? "application" : "website";
    const createdAt = typeof item.createdAt === "string" ? item.createdAt : DEFAULT_RESOURCE_TIMESTAMP;
    return {
      id: typeof item.id === "string" && item.id ? item.id : `migrated-${index}-${title}`,
      title,
      type,
      url: typeof item.url === "string" ? item.url : "",
      appIdentifier: typeof item.appIdentifier === "string" ? item.appIdentifier : "",
      icon: typeof item.icon === "string" ? item.icon : "",
      category: typeof item.category === "string" ? item.category : UNCLASSIFIED_CATEGORY,
      order: typeof item.order === "number" ? item.order : index,
      createdAt,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : createdAt,
      description: typeof item.description === "string" ? item.description : type === "application" ? "本地应用" : "快捷访问",
      mark: typeof item.mark === "string" && item.mark ? item.mark : title.slice(0, 2).toUpperCase(),
      color: typeof item.color === "string" && item.color ? item.color : palette[index % palette.length],
    };
  }).sort((a, b) => a.order - b.order);
}

function SiteIcon({ link, small = false }: { link: Resource; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const host = domainOf(link.url);
  const remoteIcon = link.icon.startsWith("http") ? link.icon : link.type === "website" && host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : "";
  return <span className={`${small ? "mini-mark" : "site-mark"} ${link.color} favicon-wrap`}>{!failed && remoteIcon && <img src={remoteIcon} alt="" onError={() => setFailed(true)} />}{(failed || !remoteIcon) && <span>{link.icon && !link.icon.startsWith("http") ? link.icon : link.mark}</span>}</span>;
}

function ResourceCard({ resource, onApplication }: { resource: Resource; onApplication: (resource: Resource) => void }) {
  const content = <><SiteIcon link={resource} /><span className="card-copy"><strong>{resource.title}</strong><small>{resource.description}</small><span className="domain">{resource.type === "website" ? `🌐 Website · ${domainOf(resource.url)}` : `💻 Application${resource.appIdentifier ? ` · ${resource.appIdentifier}` : ""}`}</span></span><span className="arrow">{resource.type === "website" ? "↗" : "i"}</span></>;
  return resource.type === "website"
    ? <a className="link-card" href={resource.url} target="_blank" rel="noreferrer" key={resource.id}>{content}</a>
    : <button type="button" className="link-card" onClick={() => onApplication(resource)} key={resource.id}>{content}</button>;
}

export default function Home() {
  const [links, setLinks] = useState<Resource[]>(defaultResources);
  const [categories, setCategories] = useState(defaultCategories);
  const [username, setUsername] = useState("");
  const [zones, setZones] = useState<ClockZone[]>(defaultZones);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchEngine, setSearchEngine] = useState<SearchEngine>(searchEngines[0]);
  const [events, setEvents] = useState<NexusEvent[]>(createDefaultEvents);
  const [focusComposerOpen, setFocusComposerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [focusForm, setFocusForm] = useState({ title: "", category: "", startTime: "19:00", endTime: "20:30", priority: "Medium" as NexusEvent["priority"], type: "task" as NexusEvent["type"], resources: [] as string[], repeatUnit: "none" as "none" | "week" | "month", repeatInterval: 1, repeatCount: 8 });
  const [customEngine, setCustomEngine] = useState<SearchEngine>({ label: "", url: "" });
  const [zoneToAdd, setZoneToAdd] = useState(zoneOptions[0].zone);
  const [query, setQuery] = useState("");
  const [googleQuery, setGoogleQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [temporaryOpen, setTemporaryOpen] = useState(false);
  const [unclassifiedOpen, setUnclassifiedOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({ title: "", type: "website" as ResourceType, description: "", url: "", appIdentifier: "", icon: "", category: defaultCategories[0] });
  const [applicationInfo, setApplicationInfo] = useState<Resource | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPlanner, setAiPlanner] = useState<AiPlannerConfig>(defaultAiPlanner);
  const [aiSaveMessage, setAiSaveMessage] = useState("");
  const [aiCategoryLoading, setAiCategoryLoading] = useState(false);
  const [aiCategorySuggestion, setAiCategorySuggestion] = useState("");
  const [aiCategoryMessage, setAiCategoryMessage] = useState("");
  const [captureNotice, setCaptureNotice] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nexus-data-v1");
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.resources)) setLinks(migrateResources(data.resources));
        else if (Array.isArray(data.links)) setLinks(migrateResources(data.links));
        if (Array.isArray(data.categories)) {
          setCategories(data.categories);
          setForm((current) => ({ ...current, category: data.categories[0] || "" }));
        }
        if (typeof data.username === "string") setUsername(data.username);
        if (Array.isArray(data.zones) && data.zones.length) setZones(data.zones);
        if (data.theme === "light" || data.theme === "dark") setTheme(data.theme);
        if (data.searchEngine?.label && data.searchEngine?.url) setSearchEngine(data.searchEngine);
        if (data.aiPlanner) setAiPlanner({
          ...defaultAiPlanner,
          ...data.aiPlanner,
          customProvider: { ...defaultAiPlanner.customProvider, ...(data.aiPlanner.customProvider || {}) },
          permissions: { calendar: data.aiPlanner.permissions?.calendar ?? true, category: data.aiPlanner.permissions?.category ?? false, planning: data.aiPlanner.permissions?.planning ?? false },
        });
        if (Array.isArray(data.events)) setEvents(data.events.map((item: NexusEvent) => ({ ...item, resources: Array.isArray(item.resources) ? item.resources : [], ...(item.date < localDate() && item.status === "pending" ? { status: "unfinished" as const } : {}) })));
        else if (Array.isArray(data.focusTasks)) setEvents(data.focusTasks.map((task: { id: string; title: string; category: string; minutes: number; priority: string; completed: boolean }, index: number) => ({ id: task.id, title: task.title, category: task.category, priority: task.priority === "高" ? "High" : task.priority === "低" ? "Low" : "Medium", type: "task", date: localDate(), startTime: `${String(9 + index * 2).padStart(2, "0")}:00`, endTime: "", duration: task.minutes, status: task.completed ? "completed" : "pending", source: "local", resources: [] })));
      }
    } catch { /* Keep defaults if saved data is unavailable. */ }
    setReady(true);
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (ready) {
      try {
        const existing = JSON.parse(localStorage.getItem("nexus-data-v1") || "{}");
        localStorage.setItem("nexus-data-v1", JSON.stringify({ ...existing, resources: links, links, categories, username, zones, theme, searchEngine, events }));
      } catch { localStorage.setItem("nexus-data-v1", JSON.stringify({ resources: links, links, categories, username, zones, theme, searchEngine, events })); }
    }
  }, [links, categories, username, zones, theme, searchEngine, events, ready]);

  useEffect(() => {
    if (!ready) return;
    const sendBridgeState = () => window.postMessage({ source: "nexus-web", type: "NEXUS_EXTENSION_STATE", payload: { categories, siteUrl: window.location.origin } }, window.location.origin);
    const receiveCapture = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== "nexus-edge-extension") return;
      const capture = (event.data.payload || {}) as ExtensionCapture;
      if (event.data.type === "NEXUS_EXTENSION_SAVE" && capture.url) {
        const normalized = normalizeUrl(capture.url);
        const requestedCategory = capture.category || UNCLASSIFIED_CATEGORY;
        const category = requestedCategory === TEMP_CATEGORY || requestedCategory === UNCLASSIFIED_CATEGORY || categories.includes(requestedCategory) ? requestedCategory : UNCLASSIFIED_CATEGORY;
        setLinks((items) => items.some((item) => item.type === "website" && item.url && normalizeUrl(item.url) === normalized) ? items : [...items, { id: crypto.randomUUID(), title: capture.title?.trim() || domainOf(normalized), type: "website", description: "从 Microsoft Edge 收藏", url: normalized, appIdentifier: "", icon: "", category, order: Math.max(-1, ...items.map((item) => item.order)) + 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), mark: (capture.title || domainOf(normalized)).slice(0, 2).toUpperCase(), color: palette[items.length % palette.length] }]);
        window.postMessage({ source: "nexus-web", type: "NEXUS_EXTENSION_SAVED", payload: { id: capture.id, url: normalized } }, window.location.origin);
      }
      if (event.data.type === "NEXUS_EXTENSION_AI_REQUEST" && capture.url) {
        void recommendCategory({ title: capture.title || "", url: capture.url, description: "" }, true).then((category) => window.postMessage({ source: "nexus-web", type: "NEXUS_EXTENSION_AI_RESULT", payload: { id: capture.id, category, error: category ? "" : "暂时无法生成推荐" } }, window.location.origin));
      }
    };
    window.addEventListener("message", receiveCapture);
    sendBridgeState();
    window.postMessage({ source: "nexus-web", type: "NEXUS_WEB_READY" }, window.location.origin);
    return () => window.removeEventListener("message", receiveCapture);
  }, [ready, categories, aiPlanner]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); document.getElementById("google-search")?.focus();
      }
      if (event.key === "Escape") { setSettingsOpen(false); setTemporaryOpen(false); setUnclassifiedOpen(false); setAiOpen(false); setApplicationInfo(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const homepageLinks = useMemo(() => links.filter((link) => link.category !== TEMP_CATEGORY && link.category !== UNCLASSIFIED_CATEGORY), [links]);
  const temporaryLinks = useMemo(() => links.filter((link) => link.category === TEMP_CATEGORY), [links]);
  const unclassifiedLinks = useMemo(() => links.filter((link) => link.category === UNCLASSIFIED_CATEGORY), [links]);
  const visibleLinks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return homepageLinks.filter((link) => (activeCategory === "全部" || link.category === activeCategory) && (!needle || `${link.title} ${link.description} ${link.url} ${link.appIdentifier} ${link.type}`.toLowerCase().includes(needle)));
  }, [homepageLinks, query, activeCategory]);
  const groupedLinks = categories.map((category) => ({ category, items: visibleLinks.filter((link) => link.category === category) })).filter((group) => group.items.length);
  const resourcesById = useMemo(() => new Map(links.map((resource) => [resource.id, resource])), [links]);
  const todayEvents = events.filter((event) => event.date === localDate()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const focusCompleted = todayEvents.filter((event) => event.status === "completed").length;
  const focusRemaining = todayEvents.length - focusCompleted;
  const focusProgress = todayEvents.length ? Math.round((focusCompleted / todayEvents.length) * 100) : 0;
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 7);
  const weeklyEvents = events.filter((event) => { const date = new Date(`${event.date}T00:00:00`); return date >= monday && date < sunday; });
  const weeklyCompleted = weeklyEvents.filter((event) => event.status === "completed").length;
  const weeklyProgress = weeklyEvents.length ? Math.round((weeklyCompleted / weeklyEvents.length) * 100) : 0;

  const primaryHour = now ? Number(new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", hour12: false, timeZone: zones[0]?.zone }).formatToParts(now).find((part) => part.type === "hour")?.value ?? now.getHours()) : 12;
  const greeting = !now ? "你好" : primaryHour < 11 ? "早上好" : primaryHour < 14 ? "中午好" : primaryHour < 18 ? "下午好" : "晚上好";
  const zoneTime = (zone: string) => now?.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: zone }) ?? "--:--:--";
  const zoneDate = (zone: string) => now?.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long", timeZone: zone }) ?? "";

  function saveAiSettings() {
    try {
      const data = JSON.parse(localStorage.getItem("nexus-data-v1") || "{}");
      localStorage.setItem("nexus-data-v1", JSON.stringify({ ...data, aiPlanner }));
      setAiSaveMessage("已保存到当前浏览器");
      window.setTimeout(() => setAiSaveMessage(""), 2400);
    } catch { setAiSaveMessage("保存失败，请检查浏览器设置"); }
  }
  function clearAiKey() {
    const next = { ...aiPlanner, apiKey: "" };
    setAiPlanner(next);
    try {
      const data = JSON.parse(localStorage.getItem("nexus-data-v1") || "{}");
      localStorage.setItem("nexus-data-v1", JSON.stringify({ ...data, aiPlanner: next }));
    } catch {}
    setAiSaveMessage("API Key 已删除");
  }
  async function recommendCategory(candidate: Partial<Pick<typeof form, "title" | "type" | "url" | "appIdentifier" | "description">> = form, silent = false): Promise<string | null> {
    if (!silent) { setAiCategorySuggestion(""); setAiCategoryMessage(""); setAiCategoryLoading(true); }
    if (!aiPlanner.permissions.category) { if (!silent) setAiCategoryMessage("请先在 AI Planner 中允许 Used in Category。"); if (!silent) setAiCategoryLoading(false); return null; }
    if (!aiPlanner.apiKey) { if (!silent) setAiCategoryMessage("请先在 AI Planner 中保存 API Key。"); if (!silent) setAiCategoryLoading(false); return null; }
    if (!categories.length) { if (!silent) setAiCategoryMessage("请先创建至少一个分类。"); if (!silent) setAiCategoryLoading(false); return null; }
    const instruction = `你是 Nexus 的资源分类助手。只能从以下分类中推荐一个：${JSON.stringify(categories)}。资源类型：${candidate.type === "application" ? "Application" : "Website"}。名称：${candidate.title || "未知"}。网址或 App Identifier：${candidate.url || candidate.appIdentifier || "未知"}。说明：${candidate.description || "无"}。只返回 JSON：{"category":"分类原文"}。不要创建新分类，不要替用户保存。`;
    try {
      let response: Response; let text = "";
      if (aiPlanner.provider === "Gemini") {
        response = await fetch(`${providerDefaults.Gemini.baseUrl}/models/${encodeURIComponent(aiPlanner.model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": aiPlanner.apiKey }, body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }], generationConfig: { responseMimeType: "application/json" } }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Gemini 请求失败"); text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else if (aiPlanner.provider === "Claude") {
        response = await fetch(`${providerDefaults.Claude.baseUrl}/messages`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": aiPlanner.apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: aiPlanner.model, max_tokens: 120, messages: [{ role: "user", content: instruction }] }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Claude 请求失败"); text = data.content?.[0]?.text || "";
      } else {
        const baseUrl = aiPlanner.provider === "Custom" ? aiPlanner.customProvider.baseUrl.replace(/\/$/, "") : providerDefaults[aiPlanner.provider]?.baseUrl;
        const model = aiPlanner.provider === "Custom" ? aiPlanner.customProvider.model : aiPlanner.model;
        if (!baseUrl?.startsWith("https://") || !model) throw new Error("请检查 Provider 的 HTTPS API 地址和模型名称");
        response = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiPlanner.apiKey}` }, body: JSON.stringify({ model, messages: [{ role: "user", content: instruction }], temperature: 0 }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "AI 请求失败"); text = data.choices?.[0]?.message?.content || "";
      }
      const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "").trim());
      const suggestion = categories.find((category) => category === parsed.category);
      if (!suggestion) throw new Error("AI 没有返回现有分类，请重试或手动选择");
      if (!silent) { setAiCategorySuggestion(suggestion); setAiCategoryMessage("这只是推荐；采用前不会更改你的分类选择。"); }
      return suggestion;
    } catch (error) { if (!silent) setAiCategoryMessage(error instanceof Error ? error.message : "暂时无法获取分类建议"); return null; }
    finally { if (!silent) setAiCategoryLoading(false); }
  }

  function submitLink(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.category || (form.type === "website" && !form.url.trim())) return;
    const nowIso = new Date().toISOString();
    const next = { ...form, title: form.title.trim(), description: form.description.trim() || (form.type === "application" ? "本地应用" : "快捷访问"), url: form.type === "website" ? normalizeUrl(form.url.trim()) : "", appIdentifier: form.type === "application" ? form.appIdentifier.trim() : "", updatedAt: nowIso };
    if (editingId) setLinks((items) => items.map((item) => item.id === editingId ? { ...item, ...next } : item));
    else setLinks((items) => [...items, { ...next, id: crypto.randomUUID(), order: Math.max(-1, ...items.map((item) => item.order)) + 1, createdAt: nowIso, mark: next.title.slice(0, 2).toUpperCase(), color: palette[items.length % palette.length] }]);
    setEditingId(null); setForm({ title: "", type: "website", description: "", url: "", appIdentifier: "", icon: "", category: categories[0] || "" }); setCaptureNotice(""); setAiCategorySuggestion(""); setAiCategoryMessage("");
  }
  function editLink(link: Resource) { setEditingId(link.id); setForm({ title: link.title, type: link.type, description: link.description, url: link.url, appIdentifier: link.appIdentifier, icon: link.icon, category: link.category }); }
  function organizeSavedLink(link: Resource) {
    setEditingId(link.id);
    setForm({ title: link.title, type: link.type, description: link.description, url: link.url, appIdentifier: link.appIdentifier, icon: link.icon, category: categories[0] || "" });
    setTemporaryOpen(false); setUnclassifiedOpen(false);
    setCaptureNotice("请选择一个正式分类并保存，这个 Resource 才会出现在主页。");
    setSettingsOpen(true);
  }
  function removeResourceIds(ids: string[]) {
    if (!ids.length) return;
    const removed = new Set(ids);
    setLinks((items) => items.filter((item) => !removed.has(item.id)));
    setEvents((items) => items.map((item) => ({ ...item, resources: (item.resources || []).filter((id) => !removed.has(id)) })));
  }
  function clearCategoryLinks(category: string) {
    const label = category === TEMP_CATEGORY ? "临时资源" : category;
    if (!confirm(`清空“${label}”中的所有 Resource？分类本身会保留。`)) return;
    removeResourceIds(links.filter((item) => item.category === category).map((item) => item.id));
  }
  function removeCategory(category: string) {
    if (!confirm(`删除“${category}”及其中的所有 Resource？`)) return;
    setCategories((items) => {
      const next = items.filter((item) => item !== category);
      setForm((current) => current.category === category ? { ...current, category: next[0] || "" } : current);
      return next;
    });
    removeResourceIds(links.filter((item) => item.category === category).map((item) => item.id));
    if (activeCategory === category) setActiveCategory("全部");
  }
  function addCategory(event: FormEvent) {
    event.preventDefault(); const value = newCategory.trim();
    if (!value || categories.includes(value)) return;
    setCategories((items) => [...items, value]); setNewCategory(""); setForm((current) => ({ ...current, category: value }));
  }
  function renameCategory(event: FormEvent, oldName: string) {
    event.preventDefault();
    const nextName = categoryDraft.trim();
    if (!nextName || (nextName !== oldName && categories.includes(nextName))) return;
    setCategories((items) => items.map((item) => item === oldName ? nextName : item));
    const updatedAt = new Date().toISOString();
    setLinks((items) => items.map((item) => item.category === oldName ? { ...item, category: nextName, updatedAt } : item));
    if (activeCategory === oldName) setActiveCategory(nextName);
    setForm((current) => current.category === oldName ? { ...current, category: nextName } : current);
    setEditingCategory(null);
    setCategoryDraft("");
  }
  function moveCategory(target: string) {
    if (!draggedCategory || draggedCategory === target) return;
    setCategories((items) => {
      const next = items.filter((item) => item !== draggedCategory);
      next.splice(next.indexOf(target), 0, draggedCategory);
      if (!editingId) setForm((current) => ({ ...current, category: next[0] || "" }));
      return next;
    });
    setDraggedCategory(null);
  }
  function searchGoogle(event: FormEvent) {
    event.preventDefault();
    const value = googleQuery.trim();
    if (value) window.open(searchEngine.url.replace("{query}", encodeURIComponent(value)), "_blank", "noopener,noreferrer");
  }
  function saveFocusEvent(event: FormEvent) {
    event.preventDefault();
    const title = focusForm.title.trim();
    if (!title || !focusForm.startTime || !focusForm.endTime) return;
    const [sh, sm] = focusForm.startTime.split(":").map(Number); const [eh, em] = focusForm.endTime.split(":").map(Number);
    const duration = Math.max(1, (eh * 60 + em) - (sh * 60 + sm));
    const next = { title, category: focusForm.category.trim() || "其他", startTime: focusForm.startTime, endTime: focusForm.endTime, duration, priority: focusForm.priority, type: focusForm.type, resources: focusForm.resources.filter((id) => resourcesById.has(id)) };
    if (editingEventId) setEvents((items) => items.map((item) => item.id === editingEventId ? { ...item, ...next } : item));
    else {
      const count = focusForm.repeatUnit === "none" ? 1 : Math.max(1, Math.min(52, Number(focusForm.repeatCount) || 1));
      const interval = Math.max(1, Math.min(52, Number(focusForm.repeatInterval) || 1));
      const seriesId = crypto.randomUUID();
      const additions: NexusEvent[] = Array.from({ length: count }, (_, index) => {
        const date = new Date(`${localDate()}T12:00:00`);
        if (focusForm.repeatUnit === "week") date.setDate(date.getDate() + index * interval * 7);
        if (focusForm.repeatUnit === "month") date.setMonth(date.getMonth() + index * interval);
        return { ...next, id: crypto.randomUUID(), date: localDate(date), status: "pending", source: "local", ...(focusForm.repeatUnit !== "none" ? { recurrence: { unit: focusForm.repeatUnit, interval, count, seriesId } } : {}) };
      });
      setEvents((items) => [...items, ...additions]);
    }
    setEditingEventId(null);
    setFocusForm({ title: "", category: "", startTime: "19:00", endTime: "20:30", priority: "Medium", type: "task", resources: [], repeatUnit: "none", repeatInterval: 1, repeatCount: 8 });
    setFocusComposerOpen(false);
  }
  function editFocusEvent(item: NexusEvent) { setEditingEventId(item.id); setFocusForm({ title: item.title, category: item.category, startTime: item.startTime, endTime: item.endTime || item.startTime, priority: item.priority, type: item.type, resources: item.resources || [], repeatUnit: "none", repeatInterval: 1, repeatCount: 1 }); setFocusComposerOpen(true); }
  function resetAll() {
    if (!confirm("恢复默认内容？你添加的分类、Resource、任务和用户名将被清除。")) return;
    setLinks(defaultResources); setCategories(defaultCategories); setForm({ title: "", type: "website", description: "", url: "", appIdentifier: "", icon: "", category: defaultCategories[0] }); setUsername(""); setZones(defaultZones); setEvents(createDefaultEvents()); setActiveCategory("全部");
  }

  return (
    <main className={`shell theme-${theme}`}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">N</span><span>Nexus</span></a>
        <div className="top-actions"><label className="mini-search"><span className="search-icon" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="筛选 Resource…" aria-label="筛选 Resource" />{query && <button onClick={() => setQuery("")}>×</button>}</label><button className="unclassified-button" onClick={() => setUnclassifiedOpen(true)} title="整理尚未决定分类的 Resource">未归类 <span>{unclassifiedLinks.length}</span></button><button className="temporary-button" onClick={() => setTemporaryOpen(true)} title="查看不会显示在主页的临时 Resource">临时资源 <span>{temporaryLinks.length}</span></button><button className="home-ai-button" onClick={() => setAiOpen(true)} title="设置 AI Provider 与使用权限"><span>✦</span> AI Planner</button><a className="github-link" href="https://github.com/LewisStarCo/nexus-navigation" target="_blank" rel="noreferrer" aria-label="在 GitHub 查看 Nexus 项目说明" title="查看功能说明与项目源码"><img src="https://github.com/favicon.ico" alt="" /></a><button className="theme-toggle" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} aria-label="切换亮色和暗色">{theme === "dark" ? "☀" : "☾"}</button><button className="manage-button" onClick={() => setSettingsOpen(true)}><span>＋</span> 管理资源</button></div>
      </header>

      <section className="hero" id="top">
        <div className="welcome-row">
          <div>
            <p className="eyebrow"><span /> YOUR PERSONAL START PAGE</p>
            <h1>{greeting}{username ? `，${username}` : "。"}<br /><em>今天想去哪里？</em></h1>
          </div>
          <div className="clock-stack">{zones.map((item, index) => <div className="clock-card" key={`${item.zone}-${index}`}><span>{item.label}{index === 0 && <b>主时区</b>}</span><strong>{zoneTime(item.zone)}</strong><small>{zoneDate(item.zone)}</small></div>)}</div>
        </div>
        {!username && <button className="name-prompt" onClick={() => setSettingsOpen(true)}>填写你的名字，让这里更像你的主页 →</button>}
        <p className="intro">学习、思考、创造。把完成工作需要的 Website 与 Application 收进一个安静、好用的空间。</p>
        <form className="search-box" onSubmit={searchGoogle}><span className="engine-badge">{searchEngine.label.slice(0, 2)}</span><input id="google-search" value={googleQuery} onChange={(e) => setGoogleQuery(e.target.value)} placeholder={`用 ${searchEngine.label} 搜索互联网…`} aria-label={`${searchEngine.label} 搜索`} /><button className="google-submit" type="submit" aria-label="搜索">↗</button><kbd>⌘ K</kbd></form>
      </section>

      <div className="workspace-layout">
        <section className="navigation-area" aria-live="polite">
          <div className="area-label"><span>NAVIGATION</span><p>Access your digital resources</p></div>
          <div className="filters">{["全部", ...categories].map((category) => <button type="button" key={category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)}>{category}<span>{category === "全部" ? homepageLinks.length : homepageLinks.filter((link) => link.category === category).length}</span></button>)}</div>
          <div className="directory">{groupedLinks.map((group) => <div className="category-section" key={group.category}><div className="section-heading"><h2>{group.category}</h2><span>{String(group.items.length).padStart(2, "0")}</span><div /></div><div className="card-grid">{group.items.map((resource) => <ResourceCard resource={resource} onApplication={setApplicationInfo} key={resource.id} />)}</div></div>)}{!groupedLinks.length && <div className="empty-state"><span>⌕</span><h2>没有找到相关资源</h2><p>换个关键词试试，或添加一个新入口。</p><button onClick={() => { setQuery(""); setActiveCategory("全部"); }}>查看全部资源</button></div>}</div>
        </section>
        <aside className="workspace-area">
          <div className="area-label"><span>WORKSPACE</span><p>Turn intention into action</p></div>
          <section className="focus-panel" aria-labelledby="focus-title">
            <div className="focus-head"><div><h2 id="focus-title">Today&apos;s Focus</h2><p>今天还有 <strong>{focusRemaining}</strong> 个安排</p></div><button type="button" className="focus-add" onClick={() => { setEditingEventId(null); setFocusComposerOpen((value) => !value); }}>{focusComposerOpen ? "收起" : "＋ Add"}</button></div>
            <div className="progress-pair"><div><span>Today&apos;s Progress</span><strong>{focusCompleted} / {todayEvents.length}</strong><i><b style={{ width: `${focusProgress}%` }} /></i><small>{focusProgress}%</small></div><div><span>Weekly Progress</span><strong>{weeklyCompleted} / {weeklyEvents.length}</strong><i><b style={{ width: `${weeklyProgress}%` }} /></i><small>{weeklyProgress}%</small></div></div>
            {focusComposerOpen && <form className="focus-form" onSubmit={saveFocusEvent}>
              <div className="focus-form-section focus-form-main"><span className="focus-form-caption">安排内容</span><input autoFocus value={focusForm.title} onChange={(e) => setFocusForm({ ...focusForm, title: e.target.value })} placeholder="任务标题" required /><input value={focusForm.category} onChange={(e) => setFocusForm({ ...focusForm, category: e.target.value })} placeholder="分类（可选）" /></div>
              <div className="focus-form-section focus-time-grid"><span className="focus-form-caption">时间</span><label>开始<input type="time" value={focusForm.startTime} onChange={(e) => setFocusForm({ ...focusForm, startTime: e.target.value })} required /></label><label>结束<input type="time" value={focusForm.endTime} onChange={(e) => setFocusForm({ ...focusForm, endTime: e.target.value })} required /></label></div>
              <div className="focus-form-section focus-meta-grid"><span className="focus-form-caption">属性</span><label>优先级<select value={focusForm.priority} onChange={(e) => setFocusForm({ ...focusForm, priority: e.target.value as NexusEvent["priority"] })}><option>High</option><option>Medium</option><option>Low</option></select></label><label>类型<select value={focusForm.type} onChange={(e) => setFocusForm({ ...focusForm, type: e.target.value as NexusEvent["type"] })}><option value="task">Task</option><option value="schedule">Schedule</option></select></label></div>
              <details className="focus-form-section focus-resource-picker"><summary>关联资源{focusForm.resources.length ? ` · ${focusForm.resources.length}` : "（可选）"}</summary><label>添加资源<select value="" onChange={(e) => { const id = e.target.value; if (id && !focusForm.resources.includes(id)) setFocusForm({ ...focusForm, resources: [...focusForm.resources, id] }); }}><option value="">选择 Website 或 Application…</option>{links.filter((resource) => !focusForm.resources.includes(resource.id)).map((resource) => <option value={resource.id} key={resource.id}>{resource.type === "website" ? "🌐" : "💻"} {resource.title}</option>)}</select></label>{focusForm.resources.length > 0 && <div className="event-resource-chips">{focusForm.resources.map((id) => resourcesById.get(id)).filter((resource): resource is Resource => Boolean(resource)).map((resource) => <button type="button" key={resource.id} onClick={() => setFocusForm({ ...focusForm, resources: focusForm.resources.filter((id) => id !== resource.id) })}>{resource.type === "website" ? "🌐" : "💻"} {resource.title} ×</button>)}</div>}</details>
              {!editingEventId && <div className="focus-form-section focus-repeat"><span className="focus-form-caption">重复</span><label className="repeat-choice">规则<select value={focusForm.repeatUnit} onChange={(e) => setFocusForm({ ...focusForm, repeatUnit: e.target.value as typeof focusForm.repeatUnit })}><option value="none">不重复</option><option value="week">每 X 周</option><option value="month">每 X 月</option></select></label>{focusForm.repeatUnit !== "none" && <div className="repeat-details"><label>每隔<input type="number" min="1" max="52" value={focusForm.repeatInterval} onChange={(e) => setFocusForm({ ...focusForm, repeatInterval: Number(e.target.value) })} /><small>{focusForm.repeatUnit === "week" ? "周" : "月"}</small></label><label>共计<input type="number" min="1" max="52" value={focusForm.repeatCount} onChange={(e) => setFocusForm({ ...focusForm, repeatCount: Number(e.target.value) })} /><small>次</small></label></div>}<p>{focusForm.repeatUnit === "none" ? "仅添加今天这一项" : `从今天开始，每 ${focusForm.repeatInterval} ${focusForm.repeatUnit === "week" ? "周" : "月"}一次，共 ${focusForm.repeatCount} 次`}</p></div>}
              <div className="focus-form-actions"><button type="button" className="focus-cancel" onClick={() => { setFocusComposerOpen(false); setEditingEventId(null); }}>取消</button><button className="focus-submit">{editingEventId ? "保存修改" : "添加安排"}</button></div>
            </form>}
            <div className="timeline"><p className="timeline-label">TIMELINE</p>{todayEvents.map((item) => <article className={`timeline-event ${item.status === "completed" ? "done" : ""}`} key={item.id}><time>{item.startTime}</time><div className="timeline-line"><i /></div><label><input type="checkbox" checked={item.status === "completed"} onChange={() => setEvents((items) => items.map((event) => event.id === item.id ? { ...event, status: event.status === "completed" ? "pending" : "completed" } : event))} /><span><strong>{item.type === "schedule" ? "▣" : "□"} {item.title}</strong><small>{item.startTime} - {item.endTime || `${item.duration} min`} · {item.category}</small></span></label>{item.resources?.length > 0 && <span className="event-resource-chips">{item.resources.map((id) => resourcesById.get(id)).filter((resource): resource is Resource => Boolean(resource)).map((resource) => resource.type === "website" ? <a href={resource.url} target="_blank" rel="noreferrer" key={resource.id}>🌐 {resource.title}</a> : <button type="button" onClick={() => setApplicationInfo(resource)} key={resource.id}>💻 {resource.title}</button>)}</span>}<span className={`event-priority ${item.priority.toLowerCase()}`}>{item.priority.slice(0, 1)}</span><div className="event-actions"><button onClick={() => editFocusEvent(item)}>Edit</button><button onClick={() => setEvents((items) => items.filter((event) => event.id !== item.id))}>×</button></div></article>)}{!todayEvents.length && <p className="focus-empty">今天还没有安排。给自己留一点专注时间。</p>}</div>
            <a className="open-calendar" href="/calendar">Open Calendar <span>→</span></a>
          </section>
        </aside>
      </div>
      <footer><span><b>N</b> Nexus</span><p>所有个性化内容仅保存在你的浏览器中 · {homepageLinks.length} 个主页 Resource · {unclassifiedLinks.length} 个未归类 · {temporaryLinks.length} 个临时资源</p></footer>

      {applicationInfo && <div className="calendar-modal" role="dialog" aria-modal="true" aria-label={`${applicationInfo.title} 应用信息`}><button className="modal-backdrop" onClick={() => setApplicationInfo(null)} aria-label="关闭" /><section className="ai-planner"><header><div><small>APPLICATION RESOURCE</small><h2>💻 {applicationInfo.title}</h2></div><button onClick={() => setApplicationInfo(null)}>×</button></header><p>{applicationInfo.description}</p>{applicationInfo.appIdentifier && <label>App Identifier<input value={applicationInfo.appIdentifier} readOnly /></label>}<p className="api-key-note">出于浏览器安全限制，Nexus 网页不会尝试启动本地应用。未来的 Nexus macOS App 才能在获得你的明确授权后打开 Application Resource。</p><div className="ai-save-row"><span /><button className="save-ai-settings" onClick={() => setApplicationInfo(null)}>知道了</button></div></section></div>}

      {unclassifiedOpen && <div className="saved-links-layer" role="dialog" aria-modal="true" aria-label="未归类资源"><button className="modal-backdrop" onClick={() => setUnclassifiedOpen(false)} aria-label="关闭" /><section className="saved-links-panel"><header><div><small>INBOX</small><h2>未归类</h2><p>还没想好放在哪里的资源。整理后才会进入正式导航分类。</p></div><button onClick={() => setUnclassifiedOpen(false)}>×</button></header><div className="saved-links-toolbar"><span>{unclassifiedLinks.length} 个资源</span><button disabled={!unclassifiedLinks.length} onClick={() => clearCategoryLinks(UNCLASSIFIED_CATEGORY)}>删除全部</button></div><div className="saved-links-list">{unclassifiedLinks.map((link) => <article key={link.id}><SiteIcon link={link} small /><p>{link.type === "website" ? <a href={link.url} target="_blank" rel="noreferrer">🌐 {link.title}</a> : <button onClick={() => setApplicationInfo(link)}>💻 {link.title}</button>}<small>{link.type === "website" ? domainOf(link.url) : link.appIdentifier || "Application"}</small></p><button onClick={() => organizeSavedLink(link)}>整理到主页</button><button className="danger" onClick={() => removeResourceIds([link.id])}>删除</button></article>)}{!unclassifiedLinks.length && <div className="saved-links-empty"><span>✓</span><strong>没有待整理资源</strong><p>Edge 扩展中选择“未归类”的网页会出现在这里。</p></div>}</div></section></div>}

      {temporaryOpen && <div className="saved-links-layer" role="dialog" aria-modal="true" aria-label="临时资源"><button className="modal-backdrop" onClick={() => setTemporaryOpen(false)} aria-label="关闭" /><section className="saved-links-panel"><header><div><small>TEMPORARY</small><h2>临时资源</h2><p>只在短期内需要的资源，不会显示在主页导航中。</p></div><button onClick={() => setTemporaryOpen(false)}>×</button></header><div className="saved-links-toolbar"><span>{temporaryLinks.length} 个资源</span><button disabled={!temporaryLinks.length} onClick={() => clearCategoryLinks(TEMP_CATEGORY)}>删除全部</button></div><div className="saved-links-list">{temporaryLinks.map((link) => <article key={link.id}><SiteIcon link={link} small /><p>{link.type === "website" ? <a href={link.url} target="_blank" rel="noreferrer">🌐 {link.title}</a> : <button onClick={() => setApplicationInfo(link)}>💻 {link.title}</button>}<small>{link.type === "website" ? domainOf(link.url) : link.appIdentifier || "Application"}</small></p><button onClick={() => organizeSavedLink(link)}>添加到主页</button><button className="danger" onClick={() => removeResourceIds([link.id])}>删除</button></article>)}{!temporaryLinks.length && <div className="saved-links-empty"><span>⌛</span><strong>没有临时资源</strong><p>Edge 扩展中选择“临时网页”后，会收纳在这里。</p></div>}</div></section></div>}

      {aiOpen && <div className="calendar-modal home-ai-modal" role="dialog" aria-modal="true" aria-label="AI Planner 设置"><button className="modal-backdrop" onClick={() => setAiOpen(false)} aria-label="关闭" /><section className="ai-planner"><header><div><small>OPTIONAL · BYOK</small><h2>✦ AI Planner Settings</h2></div><button onClick={() => setAiOpen(false)}>×</button></header><p>AI 只在你允许的功能中、并由你主动操作时提供建议。它不会自动整理资源或修改日程。</p><div className="ai-permissions"><span>AI 使用权限</span><div><button type="button" className={aiPlanner.permissions.calendar ? "active" : ""} onClick={() => setAiPlanner({ ...aiPlanner, permissions: { ...aiPlanner.permissions, calendar: !aiPlanner.permissions.calendar } })}><strong>Used in Calendar</strong><small>允许生成可编辑的日程建议</small></button><button type="button" className={aiPlanner.permissions.category ? "active" : ""} onClick={() => setAiPlanner({ ...aiPlanner, permissions: { ...aiPlanner.permissions, category: !aiPlanner.permissions.category } })}><strong>Used in Category</strong><small>允许为 Resource 推荐现有分类</small></button><button type="button" className={aiPlanner.permissions.planning ? "active" : ""} onClick={() => setAiPlanner({ ...aiPlanner, permissions: { ...aiPlanner.permissions, planning: !aiPlanner.permissions.planning } })}><strong>Used in Planning</strong><small>允许为 Event 推荐已有 Website 与 Application</small></button><button type="button" className={!aiPlanner.permissions.calendar && !aiPlanner.permissions.category && !aiPlanner.permissions.planning ? "active danger" : "danger"} onClick={() => setAiPlanner({ ...aiPlanner, permissions: { calendar: false, category: false, planning: false } })}><strong>Do not use AI in any situation</strong><small>关闭 Calendar、Category 与 Planning 的 AI 请求</small></button></div></div><label>Provider<select value={aiPlanner.provider} onChange={(e) => { const provider = e.target.value; setAiPlanner({ ...aiPlanner, provider, model: providerDefaults[provider]?.model || aiPlanner.model }); }}><option>OpenAI</option><option>Qwen</option><option>Claude</option><option>Gemini</option><option>DeepSeek</option><option>智谱 AI</option><option value="Custom">自定义 Provider</option></select></label>{aiPlanner.provider === "Custom" && <div className="custom-provider"><label>Provider 名称<input value={aiPlanner.customProvider.name} onChange={(e) => setAiPlanner({ ...aiPlanner, customProvider: { ...aiPlanner.customProvider, name: e.target.value } })} placeholder="例如：Moonshot" /></label><label>API Base URL<input value={aiPlanner.customProvider.baseUrl} onChange={(e) => setAiPlanner({ ...aiPlanner, customProvider: { ...aiPlanner.customProvider, baseUrl: e.target.value } })} placeholder="https://api.example.com/v1" /></label></div>}<label>模型名称<input value={aiPlanner.provider === "Custom" ? aiPlanner.customProvider.model : aiPlanner.model} onChange={(e) => aiPlanner.provider === "Custom" ? setAiPlanner({ ...aiPlanner, customProvider: { ...aiPlanner.customProvider, model: e.target.value } }) : setAiPlanner({ ...aiPlanner, model: e.target.value })} placeholder="模型 ID" /></label><label>API Key<input type="password" value={aiPlanner.apiKey} onChange={(e) => setAiPlanner({ ...aiPlanner, apiKey: e.target.value })} placeholder="使用你自己的 API Key" /></label><p className="api-key-note">设置只保存在当前浏览器。Edge 扩展不会读取或保存 API Key；AI 推荐通过 Nexus 页面完成。</p><div className="ai-save-row"><button className="clear-ai-key" onClick={clearAiKey} disabled={!aiPlanner.apiKey}>删除密钥</button><span>{aiSaveMessage}</span><button className="save-ai-settings" onClick={saveAiSettings}>保存到本地</button></div></section></div>}

      {settingsOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="管理资源">
        <button className="modal-backdrop" onClick={() => setSettingsOpen(false)} aria-label="关闭" />
        <aside className="manager">
          <div className="manager-head"><div><small>RESOURCE WORKSPACE</small><h2>管理资源</h2></div><button onClick={() => setSettingsOpen(false)}>×</button></div>
          <div className="manager-scroll">
            <section className="setting-section"><label className="field-label">你的名字</label><input className="field" value={username} onChange={(e) => setUsername(e.target.value.slice(0, 20))} placeholder="在这里填写用户名" /><p className="field-help">将显示在首页问候语中，随时可以修改。</p></section>
            <section className="setting-section"><div className="setting-title"><h3>默认搜索引擎</h3><span>{searchEngine.label}</span></div><div className="engine-options">{searchEngines.map((engine) => <button className={searchEngine.url === engine.url ? "selected" : ""} key={engine.url} onClick={() => setSearchEngine(engine)}>{engine.label}</button>)}</div><div className="custom-engine"><input value={customEngine.label} onChange={(e) => setCustomEngine({ ...customEngine, label: e.target.value })} placeholder="自定义名称" /><input value={customEngine.url} onChange={(e) => setCustomEngine({ ...customEngine, url: e.target.value })} placeholder="https://example.com/search?q={query}" /><button onClick={() => { if (customEngine.label.trim() && customEngine.url.includes("{query}")) setSearchEngine({ label: customEngine.label.trim(), url: customEngine.url.trim() }); }}>使用自定义</button></div><p className="field-help">自定义地址必须包含 <code>{"{query}"}</code>，它会被替换成搜索内容。</p></section>
            <section className="setting-section"><div className="setting-title"><h3>时区与时钟</h3><span>{zones.length}</span></div><p className="field-help timezone-help">第一个时区是主时区，用于判断早上、中午或晚上。</p><div className="timezone-list">{zones.map((item, index) => <div key={`${item.zone}-${index}`}><p><strong>{item.label}</strong><small>{item.zone}</small></p>{index > 0 && <button onClick={() => setZones((items) => [item, ...items.filter((_, i) => i !== index)])}>设为主时区</button>}{zones.length > 1 && <button className="danger" onClick={() => setZones((items) => items.filter((_, i) => i !== index))}>删除</button>}</div>)}</div><div className="timezone-add"><select value={zoneToAdd} onChange={(e) => setZoneToAdd(e.target.value)}>{zoneOptions.filter((option, index, all) => all.findIndex((item) => item.zone === option.zone) === index).map((item) => <option value={item.zone} key={item.zone}>{item.label} · {item.zone}</option>)}</select><button onClick={() => { const item = zoneOptions.find((option) => option.zone === zoneToAdd); if (item && !zones.some((zone) => zone.zone === item.zone)) setZones((current) => [...current, item]); }}>添加时区</button></div></section>
            <section className="setting-section"><div className="setting-title"><h3>分类 · 拖动调整顺序</h3><span>{categories.length}</span></div><div className="category-list">{categories.map((category) => editingCategory === category ? <form className="category-edit" key={category} onSubmit={(event) => renameCategory(event, category)}><input autoFocus value={categoryDraft} onChange={(e) => setCategoryDraft(e.target.value)} maxLength={24} /><button className="save-category">保存</button><button type="button" onClick={() => setEditingCategory(null)}>取消</button></form> : <div className={draggedCategory === category ? "dragging" : ""} draggable key={category} onDragStart={() => setDraggedCategory(category)} onDragOver={(e) => e.preventDefault()} onDrop={() => moveCategory(category)} onDragEnd={() => setDraggedCategory(null)}><b className="drag-handle">⠿</b><span>{category}</span><button className="rename-category" onClick={() => { setEditingCategory(category); setCategoryDraft(category); }}>重命名</button><button className="clear-category" onClick={() => clearCategoryLinks(category)}>清空资源</button><button onClick={() => removeCategory(category)}>删除分类</button></div>)}</div><form className="inline-form" onSubmit={addCategory}><input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="新分类名称" /><button>添加</button></form></section>
            <section className="setting-section"><div className="setting-title"><h3>{editingId ? "Edit Resource" : "Add Resource"}</h3><span>{links.length}</span></div>
              {categories.length ? <form className="link-form" onSubmit={submitLink}>{captureNotice && <div className="capture-notice">{captureNotice}</div>}<fieldset className="resource-type-picker"><legend>资源类型</legend><div>{(["website", "application"] as ResourceType[]).map((type) => <button type="button" className={form.type === type ? "active" : ""} onClick={() => setForm({ ...form, type, url: type === "application" ? "" : form.url, appIdentifier: type === "website" ? "" : form.appIdentifier })} key={type}><span>{type === "website" ? "🌐" : "💻"}</span><strong>{type === "website" ? "Website" : "Application"}</strong><i /></button>)}</div></fieldset><label>名称<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={form.type === "website" ? "例如：Wikipedia" : "例如：Visual Studio Code"} required /></label>{form.type === "website" ? <label>网址<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com" required /></label> : <><label>App Identifier（可选）<input value={form.appIdentifier} onChange={(e) => setForm({ ...form, appIdentifier: e.target.value })} placeholder="例如：com.microsoft.VSCode" /></label><p className="field-help">网页版本只记录应用信息，不会尝试启动应用。未来 Nexus macOS App 才能提供安全启动能力。</p></>}<label>说明<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="一句简短说明（可选）" /></label><label className="category-field">分类<div><select value={form.category} onChange={(e) => { setForm({ ...form, category: e.target.value }); setAiCategorySuggestion(""); }}>{categories.map((category) => <option key={category}>{category}</option>)}<option value={UNCLASSIFIED_CATEGORY}>未归类（稍后整理）</option><option value={TEMP_CATEGORY}>临时资源（不显示在主页）</option></select><button type="button" className="recommend-category" onClick={() => void recommendCategory()} disabled={aiCategoryLoading}>{aiCategoryLoading ? "推荐中…" : "✦ AI 推荐"}</button></div></label>{(aiCategorySuggestion || aiCategoryMessage) && <div className="category-suggestion">{aiCategorySuggestion && <><span>AI 建议分类</span><strong>{aiCategorySuggestion}</strong><button type="button" onClick={() => { setForm({ ...form, category: aiCategorySuggestion }); setAiCategorySuggestion(""); setAiCategoryMessage("已采用建议，保存前仍可修改。"); }}>采用建议</button></>}<p>{aiCategoryMessage}</p></div>}<div className="form-actions">{editingId && <button type="button" className="ghost" onClick={() => { setEditingId(null); setForm({ title: "", type: "website", description: "", url: "", appIdentifier: "", icon: "", category: categories[0] }); setCaptureNotice(""); }}>取消</button>}<button className="primary">{form.category === TEMP_CATEGORY ? "保存为临时资源" : form.category === UNCLASSIFIED_CATEGORY ? "保存到未归类" : editingId ? "保存修改" : "Add Resource"}</button></div></form> : <p className="field-help">请先添加一个分类。</p>}
            </section>
            <section className="setting-section"><div className="setting-title"><h3>已有资源</h3><span>{links.length}</span></div><div className="manage-links">{links.map((link) => <div key={link.id}><SiteIcon link={link} small /><p><strong>{link.type === "website" ? "🌐" : "💻"} {link.title}</strong><small>{link.category === TEMP_CATEGORY ? "临时资源" : link.category === UNCLASSIFIED_CATEGORY ? "未归类" : link.category}</small></p><button onClick={() => editLink(link)}>编辑</button><button className="danger" onClick={() => removeResourceIds([link.id])}>删除</button></div>)}</div></section>
            <button className="reset-button" onClick={resetAll}>恢复默认内容</button>
          </div>
        </aside>
      </div>}
    </main>
  );
}
