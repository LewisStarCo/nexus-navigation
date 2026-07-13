"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type NavLink = { id: string; title: string; description: string; url: string; category: string; mark: string; color: string };
type ClockZone = { label: string; zone: string };
type SearchEngine = { label: string; url: string };
type NexusEvent = { id: string; title: string; category: string; priority: "High" | "Medium" | "Low"; type: "task" | "schedule"; date: string; startTime: string; endTime: string; duration: number; status: "pending" | "completed" | "unfinished"; source: "local" | "calendar" | "google-calendar" | "outlook-calendar" | "apple-calendar" | "microsoft-todo" | "ai-suggestion"; recurrence?: { unit: "week" | "month"; interval: number; count: number; seriesId: string } };

const defaultCategories = ["复旦学习", "AI 工具", "编程开发", "知识资源"];
const palette = ["blue", "indigo", "violet", "cyan", "sky", "teal", "emerald", "amber", "orange", "rose", "purple", "pink"];
const defaultZones: ClockZone[] = [{ label: "北京时间", zone: "Asia/Shanghai" }, { label: "旧金山时间", zone: "America/Los_Angeles" }];
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const createDefaultEvents = (): NexusEvent[] => [
  { id: "event-math", title: "Engineering Mathematics", category: "数学", priority: "High", type: "schedule", date: localDate(), startTime: "09:00", endTime: "10:30", duration: 90, status: "pending", source: "local" },
  { id: "event-rust", title: "Rust Learning", category: "Coding", priority: "High", type: "task", date: localDate(), startTime: "11:00", endTime: "12:30", duration: 90, status: "pending", source: "local" },
  { id: "event-algebra", title: "Linear Algebra", category: "数学", priority: "Medium", type: "task", date: localDate(), startTime: "15:00", endTime: "16:00", duration: 60, status: "pending", source: "local" },
  { id: "event-paper", title: "AI Paper Reading", category: "科研", priority: "Low", type: "task", date: localDate(), startTime: "21:00", endTime: "21:45", duration: 45, status: "pending", source: "local" },
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
const defaultLinks: NavLink[] = rawLinks.map((item, index) => ({ id: `default-${index}`, title: item[0], description: item[1], url: item[2], category: item[3], mark: item[4], color: item[5] }));

function domainOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }
function normalizeUrl(url: string) { return /^https?:\/\//i.test(url) ? url : `https://${url}`; }

function SiteIcon({ link, small = false }: { link: NavLink; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const host = domainOf(link.url);
  return <span className={`${small ? "mini-mark" : "site-mark"} ${link.color} favicon-wrap`}>{!failed && <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`} alt="" onError={() => setFailed(true)} />}{failed && <span>{link.mark}</span>}</span>;
}

export default function Home() {
  const [links, setLinks] = useState<NavLink[]>(defaultLinks);
  const [categories, setCategories] = useState(defaultCategories);
  const [username, setUsername] = useState("");
  const [zones, setZones] = useState<ClockZone[]>(defaultZones);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchEngine, setSearchEngine] = useState<SearchEngine>(searchEngines[0]);
  const [events, setEvents] = useState<NexusEvent[]>(createDefaultEvents);
  const [focusComposerOpen, setFocusComposerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [focusForm, setFocusForm] = useState({ title: "", category: "", startTime: "19:00", endTime: "20:30", priority: "Medium" as NexusEvent["priority"], type: "task" as NexusEvent["type"], repeatUnit: "none" as "none" | "week" | "month", repeatInterval: 1, repeatCount: 8 });
  const [customEngine, setCustomEngine] = useState<SearchEngine>({ label: "", url: "" });
  const [zoneToAdd, setZoneToAdd] = useState(zoneOptions[0].zone);
  const [query, setQuery] = useState("");
  const [googleQuery, setGoogleQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", url: "", category: defaultCategories[0] });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nexus-data-v1");
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.links)) setLinks(data.links);
        if (Array.isArray(data.categories)) {
          setCategories(data.categories);
          setForm((current) => ({ ...current, category: data.categories[0] || "" }));
        }
        if (typeof data.username === "string") setUsername(data.username);
        if (Array.isArray(data.zones) && data.zones.length) setZones(data.zones);
        if (data.theme === "light" || data.theme === "dark") setTheme(data.theme);
        if (data.searchEngine?.label && data.searchEngine?.url) setSearchEngine(data.searchEngine);
        if (Array.isArray(data.events)) setEvents(data.events.map((item: NexusEvent) => item.date < localDate() && item.status === "pending" ? { ...item, status: "unfinished" } : item));
        else if (Array.isArray(data.focusTasks)) setEvents(data.focusTasks.map((task: { id: string; title: string; category: string; minutes: number; priority: string; completed: boolean }, index: number) => ({ id: task.id, title: task.title, category: task.category, priority: task.priority === "高" ? "High" : task.priority === "低" ? "Low" : "Medium", type: "task", date: localDate(), startTime: `${String(9 + index * 2).padStart(2, "0")}:00`, endTime: "", duration: task.minutes, status: task.completed ? "completed" : "pending", source: "local" })));
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
        localStorage.setItem("nexus-data-v1", JSON.stringify({ ...existing, links, categories, username, zones, theme, searchEngine, events }));
      } catch { localStorage.setItem("nexus-data-v1", JSON.stringify({ links, categories, username, zones, theme, searchEngine, events })); }
    }
  }, [links, categories, username, zones, theme, searchEngine, events, ready]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); document.getElementById("google-search")?.focus();
      }
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleLinks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return links.filter((link) => (activeCategory === "全部" || link.category === activeCategory) && (!needle || `${link.title} ${link.description} ${link.url}`.toLowerCase().includes(needle)));
  }, [links, query, activeCategory]);
  const groupedLinks = categories.map((category) => ({ category, items: visibleLinks.filter((link) => link.category === category) })).filter((group) => group.items.length);
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

  function submitLink(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.url.trim() || !form.category) return;
    const next = { ...form, title: form.title.trim(), description: form.description.trim() || "快捷访问", url: normalizeUrl(form.url.trim()) };
    if (editingId) setLinks((items) => items.map((item) => item.id === editingId ? { ...item, ...next } : item));
    else setLinks((items) => [...items, { ...next, id: crypto.randomUUID(), mark: next.title.slice(0, 2).toUpperCase(), color: palette[items.length % palette.length] }]);
    setEditingId(null); setForm({ title: "", description: "", url: "", category: categories[0] || "" });
  }
  function editLink(link: NavLink) { setEditingId(link.id); setForm({ title: link.title, description: link.description, url: link.url, category: link.category }); }
  function removeCategory(category: string) {
    if (!confirm(`删除“${category}”及其中的所有网址？`)) return;
    setCategories((items) => {
      const next = items.filter((item) => item !== category);
      setForm((current) => current.category === category ? { ...current, category: next[0] || "" } : current);
      return next;
    });
    setLinks((items) => items.filter((item) => item.category !== category));
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
    setLinks((items) => items.map((item) => item.category === oldName ? { ...item, category: nextName } : item));
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
    const next = { title, category: focusForm.category.trim() || "其他", startTime: focusForm.startTime, endTime: focusForm.endTime, duration, priority: focusForm.priority, type: focusForm.type };
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
    setFocusForm({ title: "", category: "", startTime: "19:00", endTime: "20:30", priority: "Medium", type: "task", repeatUnit: "none", repeatInterval: 1, repeatCount: 8 });
    setFocusComposerOpen(false);
  }
  function editFocusEvent(item: NexusEvent) { setEditingEventId(item.id); setFocusForm({ title: item.title, category: item.category, startTime: item.startTime, endTime: item.endTime || item.startTime, priority: item.priority, type: item.type, repeatUnit: "none", repeatInterval: 1, repeatCount: 1 }); setFocusComposerOpen(true); }
  function resetAll() {
    if (!confirm("恢复默认内容？你添加的分类、网址、任务和用户名将被清除。")) return;
    setLinks(defaultLinks); setCategories(defaultCategories); setForm({ title: "", description: "", url: "", category: defaultCategories[0] }); setUsername(""); setZones(defaultZones); setEvents(createDefaultEvents()); setActiveCategory("全部");
  }

  return (
    <main className={`shell theme-${theme}`}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">N</span><span>Nexus</span></a>
        <div className="top-actions"><label className="mini-search"><span className="search-icon" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="筛选导航…" aria-label="筛选导航" />{query && <button onClick={() => setQuery("")}>×</button>}</label><a className="github-link" href="https://github.com/LewisStarCo/nexus-navigation" target="_blank" rel="noreferrer" aria-label="在 GitHub 查看 Nexus 项目说明" title="查看功能说明与项目源码"><img src="https://github.com/favicon.ico" alt="" /></a><button className="theme-toggle" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} aria-label="切换亮色和暗色">{theme === "dark" ? "☀" : "☾"}</button><button className="manage-button" onClick={() => setSettingsOpen(true)}><span>＋</span> 管理导航</button></div>
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
        <p className="intro">学习、思考、创造。把每天常用的网站收进一个安静、好用的入口。</p>
        <form className="search-box" onSubmit={searchGoogle}><span className="engine-badge">{searchEngine.label.slice(0, 2)}</span><input id="google-search" value={googleQuery} onChange={(e) => setGoogleQuery(e.target.value)} placeholder={`用 ${searchEngine.label} 搜索互联网…`} aria-label={`${searchEngine.label} 搜索`} /><button className="google-submit" type="submit" aria-label="搜索">↗</button><kbd>⌘ K</kbd></form>
      </section>

      <div className="workspace-layout">
        <section className="navigation-area" aria-live="polite">
          <div className="area-label"><span>NAVIGATION</span><p>Access your digital resources</p></div>
          <div className="filters">{["全部", ...categories].map((category) => <button type="button" key={category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)}>{category}<span>{category === "全部" ? links.length : links.filter((link) => link.category === category).length}</span></button>)}</div>
          <div className="directory">{groupedLinks.map((group) => <div className="category-section" key={group.category}><div className="section-heading"><h2>{group.category}</h2><span>{String(group.items.length).padStart(2, "0")}</span><div /></div><div className="card-grid">{group.items.map((link) => <a className="link-card" href={link.url} target="_blank" rel="noreferrer" key={link.id}><SiteIcon link={link} /><span className="card-copy"><strong>{link.title}</strong><small>{link.description}</small><span className="domain">{domainOf(link.url)}</span></span><span className="arrow">↗</span></a>)}</div></div>)}{!groupedLinks.length && <div className="empty-state"><span>⌕</span><h2>没有找到相关网站</h2><p>换个关键词试试，或添加一个新入口。</p><button onClick={() => { setQuery(""); setActiveCategory("全部"); }}>查看全部网站</button></div>}</div>
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
              {!editingEventId && <div className="focus-form-section focus-repeat"><span className="focus-form-caption">重复</span><label className="repeat-choice">规则<select value={focusForm.repeatUnit} onChange={(e) => setFocusForm({ ...focusForm, repeatUnit: e.target.value as typeof focusForm.repeatUnit })}><option value="none">不重复</option><option value="week">每 X 周</option><option value="month">每 X 月</option></select></label>{focusForm.repeatUnit !== "none" && <div className="repeat-details"><label>每隔<input type="number" min="1" max="52" value={focusForm.repeatInterval} onChange={(e) => setFocusForm({ ...focusForm, repeatInterval: Number(e.target.value) })} /><small>{focusForm.repeatUnit === "week" ? "周" : "月"}</small></label><label>共计<input type="number" min="1" max="52" value={focusForm.repeatCount} onChange={(e) => setFocusForm({ ...focusForm, repeatCount: Number(e.target.value) })} /><small>次</small></label></div>}<p>{focusForm.repeatUnit === "none" ? "仅添加今天这一项" : `从今天开始，每 ${focusForm.repeatInterval} ${focusForm.repeatUnit === "week" ? "周" : "月"}一次，共 ${focusForm.repeatCount} 次`}</p></div>}
              <div className="focus-form-actions"><button type="button" className="focus-cancel" onClick={() => { setFocusComposerOpen(false); setEditingEventId(null); }}>取消</button><button className="focus-submit">{editingEventId ? "保存修改" : "添加安排"}</button></div>
            </form>}
            <div className="timeline"><p className="timeline-label">TIMELINE</p>{todayEvents.map((item) => <article className={`timeline-event ${item.status === "completed" ? "done" : ""}`} key={item.id}><time>{item.startTime}</time><div className="timeline-line"><i /></div><label><input type="checkbox" checked={item.status === "completed"} onChange={() => setEvents((items) => items.map((event) => event.id === item.id ? { ...event, status: event.status === "completed" ? "pending" : "completed" } : event))} /><span><strong>{item.type === "schedule" ? "▣" : "□"} {item.title}</strong><small>{item.startTime} - {item.endTime || `${item.duration} min`} · {item.category}</small></span></label><span className={`event-priority ${item.priority.toLowerCase()}`}>{item.priority.slice(0, 1)}</span><div className="event-actions"><button onClick={() => editFocusEvent(item)}>Edit</button><button onClick={() => setEvents((items) => items.filter((event) => event.id !== item.id))}>×</button></div></article>)}{!todayEvents.length && <p className="focus-empty">今天还没有安排。给自己留一点专注时间。</p>}</div>
            <a className="open-calendar" href="/calendar">Open Calendar <span>→</span></a>
          </section>
        </aside>
      </div>
      <footer><span><b>N</b> Nexus</span><p>所有个性化内容仅保存在你的浏览器中 · {links.length} 个快捷入口</p></footer>

      {settingsOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="管理导航">
        <button className="modal-backdrop" onClick={() => setSettingsOpen(false)} aria-label="关闭" />
        <aside className="manager">
          <div className="manager-head"><div><small>PERSONALIZE</small><h2>管理导航</h2></div><button onClick={() => setSettingsOpen(false)}>×</button></div>
          <div className="manager-scroll">
            <section className="setting-section"><label className="field-label">你的名字</label><input className="field" value={username} onChange={(e) => setUsername(e.target.value.slice(0, 20))} placeholder="在这里填写用户名" /><p className="field-help">将显示在首页问候语中，随时可以修改。</p></section>
            <section className="setting-section"><div className="setting-title"><h3>默认搜索引擎</h3><span>{searchEngine.label}</span></div><div className="engine-options">{searchEngines.map((engine) => <button className={searchEngine.url === engine.url ? "selected" : ""} key={engine.url} onClick={() => setSearchEngine(engine)}>{engine.label}</button>)}</div><div className="custom-engine"><input value={customEngine.label} onChange={(e) => setCustomEngine({ ...customEngine, label: e.target.value })} placeholder="自定义名称" /><input value={customEngine.url} onChange={(e) => setCustomEngine({ ...customEngine, url: e.target.value })} placeholder="https://example.com/search?q={query}" /><button onClick={() => { if (customEngine.label.trim() && customEngine.url.includes("{query}")) setSearchEngine({ label: customEngine.label.trim(), url: customEngine.url.trim() }); }}>使用自定义</button></div><p className="field-help">自定义地址必须包含 <code>{"{query}"}</code>，它会被替换成搜索内容。</p></section>
            <section className="setting-section"><div className="setting-title"><h3>时区与时钟</h3><span>{zones.length}</span></div><p className="field-help timezone-help">第一个时区是主时区，用于判断早上、中午或晚上。</p><div className="timezone-list">{zones.map((item, index) => <div key={`${item.zone}-${index}`}><p><strong>{item.label}</strong><small>{item.zone}</small></p>{index > 0 && <button onClick={() => setZones((items) => [item, ...items.filter((_, i) => i !== index)])}>设为主时区</button>}{zones.length > 1 && <button className="danger" onClick={() => setZones((items) => items.filter((_, i) => i !== index))}>删除</button>}</div>)}</div><div className="timezone-add"><select value={zoneToAdd} onChange={(e) => setZoneToAdd(e.target.value)}>{zoneOptions.filter((option, index, all) => all.findIndex((item) => item.zone === option.zone) === index).map((item) => <option value={item.zone} key={item.zone}>{item.label} · {item.zone}</option>)}</select><button onClick={() => { const item = zoneOptions.find((option) => option.zone === zoneToAdd); if (item && !zones.some((zone) => zone.zone === item.zone)) setZones((current) => [...current, item]); }}>添加时区</button></div></section>
            <section className="setting-section"><div className="setting-title"><h3>分类 · 拖动调整顺序</h3><span>{categories.length}</span></div><div className="category-list">{categories.map((category) => editingCategory === category ? <form className="category-edit" key={category} onSubmit={(event) => renameCategory(event, category)}><input autoFocus value={categoryDraft} onChange={(e) => setCategoryDraft(e.target.value)} maxLength={24} /><button className="save-category">保存</button><button type="button" onClick={() => setEditingCategory(null)}>取消</button></form> : <div className={draggedCategory === category ? "dragging" : ""} draggable key={category} onDragStart={() => setDraggedCategory(category)} onDragOver={(e) => e.preventDefault()} onDrop={() => moveCategory(category)} onDragEnd={() => setDraggedCategory(null)}><b className="drag-handle">⠿</b><span>{category}</span><button className="rename-category" onClick={() => { setEditingCategory(category); setCategoryDraft(category); }}>重命名</button><button onClick={() => removeCategory(category)}>删除</button></div>)}</div><form className="inline-form" onSubmit={addCategory}><input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="新分类名称" /><button>添加</button></form></section>
            <section className="setting-section"><div className="setting-title"><h3>{editingId ? "编辑网址" : "添加网址"}</h3><span>{links.length}</span></div>
              {categories.length ? <form className="link-form" onSubmit={submitLink}><label>名称<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：Wikipedia" required /></label><label>网址<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com" required /></label><label>说明<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="一句简短说明（可选）" /></label><label>分类<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><div className="form-actions">{editingId && <button type="button" className="ghost" onClick={() => { setEditingId(null); setForm({ title: "", description: "", url: "", category: categories[0] }); }}>取消</button>}<button className="primary">{editingId ? "保存修改" : "添加到导航"}</button></div></form> : <p className="field-help">请先添加一个分类。</p>}
            </section>
            <section className="setting-section"><div className="setting-title"><h3>已有网址</h3><span>{links.length}</span></div><div className="manage-links">{links.map((link) => <div key={link.id}><SiteIcon link={link} small /><p><strong>{link.title}</strong><small>{link.category}</small></p><button onClick={() => editLink(link)}>编辑</button><button className="danger" onClick={() => setLinks((items) => items.filter((item) => item.id !== link.id))}>删除</button></div>)}</div></section>
            <button className="reset-button" onClick={resetAll}>恢复默认内容</button>
          </div>
        </aside>
      </div>}
    </main>
  );
}
