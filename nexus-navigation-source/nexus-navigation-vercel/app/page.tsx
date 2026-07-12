"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type NavLink = { id: string; title: string; description: string; url: string; category: string; mark: string; color: string };
type ClockZone = { label: string; zone: string };

const defaultCategories = ["复旦学习", "AI 工具", "编程开发", "知识资源"];
const palette = ["blue", "indigo", "violet", "cyan", "sky", "teal", "emerald", "amber", "orange", "rose", "purple", "pink"];
const defaultZones: ClockZone[] = [{ label: "北京时间", zone: "Asia/Shanghai" }, { label: "旧金山时间", zone: "America/Los_Angeles" }];
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
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (typeof data.username === "string") setUsername(data.username);
        if (Array.isArray(data.zones) && data.zones.length) setZones(data.zones);
        if (data.theme === "light" || data.theme === "dark") setTheme(data.theme);
      }
    } catch { /* Keep defaults if saved data is unavailable. */ }
    setReady(true);
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("nexus-data-v1", JSON.stringify({ links, categories, username, zones, theme }));
  }, [links, categories, username, zones, theme, ready]);

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
    setCategories((items) => items.filter((item) => item !== category));
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
      return next;
    });
    setDraggedCategory(null);
  }
  function searchGoogle(event: FormEvent) {
    event.preventDefault();
    const value = googleQuery.trim();
    if (value) window.open(`https://www.google.com/search?q=${encodeURIComponent(value)}`, "_blank", "noopener,noreferrer");
  }
  function resetAll() {
    if (!confirm("恢复默认内容？你添加的分类、网址和用户名将被清除。")) return;
    setLinks(defaultLinks); setCategories(defaultCategories); setUsername(""); setZones(defaultZones); setActiveCategory("全部");
  }

  return (
    <main className={`shell theme-${theme}`}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">N</span><span>Nexus</span></a>
        <div className="top-actions"><label className="mini-search"><span className="search-icon" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="筛选导航…" aria-label="筛选导航" />{query && <button onClick={() => setQuery("")}>×</button>}</label><button className="theme-toggle" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} aria-label="切换亮色和暗色">{theme === "dark" ? "☀" : "☾"}</button><button className="manage-button" onClick={() => setSettingsOpen(true)}><span>＋</span> 管理导航</button></div>
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
        <form className="search-box" onSubmit={searchGoogle}><span className="google-g">G</span><input id="google-search" value={googleQuery} onChange={(e) => setGoogleQuery(e.target.value)} placeholder="用 Google 搜索互联网…" aria-label="Google 搜索" /><button className="google-submit" type="submit" aria-label="搜索">↗</button><kbd>⌘ K</kbd></form>
        <div className="filters">
          {["全部", ...categories].map((category) => <button type="button" key={category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)}>{category}<span>{category === "全部" ? links.length : links.filter((link) => link.category === category).length}</span></button>)}
        </div>
      </section>

      <section className="directory" aria-live="polite">
        {groupedLinks.map((group) => <div className="category-section" key={group.category}>
          <div className="section-heading"><h2>{group.category}</h2><span>{String(group.items.length).padStart(2, "0")}</span><div /></div>
          <div className="card-grid">{group.items.map((link) => <a className="link-card" href={link.url} target="_blank" rel="noreferrer" key={link.id}><SiteIcon link={link} /><span className="card-copy"><strong>{link.title}</strong><small>{link.description}</small><span className="domain">{domainOf(link.url)}</span></span><span className="arrow">↗</span></a>)}</div>
        </div>)}
        {!groupedLinks.length && <div className="empty-state"><span>⌕</span><h2>没有找到相关网站</h2><p>换个关键词试试，或添加一个新入口。</p><button onClick={() => { setQuery(""); setActiveCategory("全部"); }}>查看全部网站</button></div>}
      </section>
      <footer><span><b>N</b> Nexus</span><p>所有个性化内容仅保存在你的浏览器中 · {links.length} 个快捷入口</p></footer>

      {settingsOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="管理导航">
        <button className="modal-backdrop" onClick={() => setSettingsOpen(false)} aria-label="关闭" />
        <aside className="manager">
          <div className="manager-head"><div><small>PERSONALIZE</small><h2>管理导航</h2></div><button onClick={() => setSettingsOpen(false)}>×</button></div>
          <div className="manager-scroll">
            <section className="setting-section"><label className="field-label">你的名字</label><input className="field" value={username} onChange={(e) => setUsername(e.target.value.slice(0, 20))} placeholder="在这里填写用户名" /><p className="field-help">将显示在首页问候语中，随时可以修改。</p></section>
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
