"use client";

/* Remote favicons are user data, so they intentionally stay as plain images. */
/* eslint-disable @next/next/no-img-element */

import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNexusData } from "@/src/app/hooks/useNexusData";
import {
  DEFAULT_PROVIDER_CONFIGS,
  getDefaultCategories,
  getDefaultEvents,
  getDefaultResources,
  getDefaultSettings,
} from "@/src/core/config";
import {
  createCategory,
  deleteCategoryAndResources,
  reorderCategories,
  renameCategory as renameCategoryRecord,
} from "@/src/modules/navigation/domain/categories";
import {
  TEMPORARY_CATEGORY_ID,
  UNCLASSIFIED_CATEGORY_ID,
} from "@/src/modules/navigation/domain/constants";
import {
  filterResources,
  homepageResources,
  orderedCategories,
  temporaryResources,
  unclassifiedResources,
} from "@/src/modules/navigation/domain/selectors";
import {
  createResource,
  displayResourceDescription,
  nextResourceOrder,
  removeResourcesAndDetachEvents,
  updateResource,
  validateResourceDraft,
} from "@/src/modules/resources/domain/resources";
import {
  generateRecurringEvents,
  dateKey as localDate,
  findEventConflicts,
  markPastPendingEventsUnfinished,
  updateCurrentEvent,
  type EventConflict,
} from "@/src/modules/calendar/domain/eventDomain";
import {
  calculateProgress,
  selectTodayEvents,
  selectWeekEvents,
} from "@/src/modules/focus/domain/focusDomain";
import {
  parseAIJson,
  validateCategorySuggestion,
} from "@/src/modules/ai-planner/domain/suggestions";
import { requestAIText } from "@/src/modules/ai-planner/services/providerClient";
import {
  isValidSearchEngine,
  setSearchEngine as applySearchEngine,
  setTheme as applyTheme,
  updateSettings,
} from "@/src/modules/settings";
import {
  categoriesForEdgeExtension,
  categoryIdFromEdgeExtension,
  categoryNameForEdgeExtension,
  descriptionForEdgeExtension,
  EDGE_EXTENSION_MESSAGE,
  isEdgeExtensionBridgeMessage,
  NEXUS_WEB_MESSAGE_SOURCE,
  type EdgeExtensionCapture,
} from "@/src/platform/browser/edge-extension";
import {
  browserExtensionDownloads,
  detectBrowserExtensionTarget,
  EXTENSION_INSTALLATION_GUIDE,
  type BrowserExtensionTarget,
} from "@/src/platform/browser/extension-download";
import { platformAdapter } from "@/src/platform/current";
import type {
  AIPlannerSettings,
  Category,
  ClockZone,
  NexusEvent,
  Resource,
  ResourceType,
  SearchEngine,
} from "@/src/shared/types";

const TEMP_CATEGORY = TEMPORARY_CATEGORY_ID;
const UNCLASSIFIED_CATEGORY = UNCLASSIFIED_CATEGORY_ID;
const palette = ["blue", "indigo", "violet", "cyan", "sky", "teal", "emerald", "amber", "orange", "rose", "purple", "pink"];
const createDefaultEvents = () => getDefaultEvents();
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
function domainOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }
const providerDefaults = DEFAULT_PROVIDER_CONFIGS;
function resolveState<T>(action: SetStateAction<T>, current: T): T {
  return typeof action === "function"
    ? (action as (value: T) => T)(current)
    : action;
}

function SiteIcon({ link, small = false }: { link: Resource; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const host = link.type === "website" ? domainOf(link.url) : "";
  const icon = link.icon ?? "";
  const remoteIcon = link.type === "website" && link.faviconUrl
    ? link.faviconUrl
    : icon.startsWith("http") ? icon : link.type === "website" && host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : "";
  return <span className={`${small ? "mini-mark" : "site-mark"} ${link.color ?? "blue"} favicon-wrap`}>{!failed && remoteIcon && <img src={remoteIcon} alt="" onError={() => setFailed(true)} />}{(failed || !remoteIcon) && <span>{icon && !icon.startsWith("http") ? icon : link.mark ?? link.name.slice(0, 2).toUpperCase()}</span>}</span>;
}

function ResourceCard({ resource, onApplication }: { resource: Resource; onApplication: (resource: Resource) => void }) {
  const content = <><SiteIcon link={resource} /><span className="card-copy"><strong>{resource.name}</strong><small>{displayResourceDescription(resource)}</small><span className="domain">{resource.type === "website" ? `🌐 Website · ${domainOf(resource.url)}` : `💻 Application${resource.appIdentifier ? ` · ${resource.appIdentifier}` : ""}`}</span></span><span className="arrow">{resource.type === "website" ? "↗" : "i"}</span></>;
  return resource.type === "website"
    ? <button type="button" className="link-card" onClick={() => void platformAdapter.openExternalUrl(resource.url)} key={resource.id}>{content}</button>
    : <button type="button" className="link-card" onClick={() => onApplication(resource)} key={resource.id}>{content}</button>;
}

export default function Home() {
  const { data, ready, storageError, setData, saveNow, updateAndSave } = useNexusData();
  const links = data.resources;
  const categories = useMemo(() => orderedCategories(data.categories), [data.categories]);
  const username = data.settings.username;
  const zones = data.settings.zones;
  const theme = data.settings.theme;
  const searchEngine = data.settings.searchEngine;
  const extensionEntryHidden = data.settings.extensionEntryHidden;
  const events = data.events;
  const aiPlanner = data.aiPlanner;
  const setLinks = useCallback<Dispatch<SetStateAction<Resource[]>>>((action) => setData((current) => ({ ...current, resources: resolveState(action, current.resources) })), [setData]);
  const setCategories = useCallback<Dispatch<SetStateAction<Category[]>>>((action) => setData((current) => ({ ...current, categories: resolveState(action, current.categories) })), [setData]);
  const setUsername = useCallback<Dispatch<SetStateAction<string>>>((action) => setData((current) => ({ ...current, settings: updateSettings(current.settings, { username: resolveState(action, current.settings.username) }) })), [setData]);
  const setZones = useCallback<Dispatch<SetStateAction<ClockZone[]>>>((action) => setData((current) => ({ ...current, settings: updateSettings(current.settings, { zones: resolveState(action, current.settings.zones) }) })), [setData]);
  const setTheme = useCallback<Dispatch<SetStateAction<"dark" | "light">>>((action) => setData((current) => ({ ...current, settings: applyTheme(current.settings, resolveState(action, current.settings.theme)) })), [setData]);
  const setSearchEngine = useCallback<Dispatch<SetStateAction<SearchEngine>>>((action) => setData((current) => ({ ...current, settings: applySearchEngine(current.settings, resolveState(action, current.settings.searchEngine)) })), [setData]);
  const setExtensionEntryHidden = useCallback((hidden: boolean) => setData((current) => ({ ...current, settings: updateSettings(current.settings, { extensionEntryHidden: hidden }) })), [setData]);
  const setEvents = useCallback<Dispatch<SetStateAction<NexusEvent[]>>>((action) => setData((current) => {
    const next = resolveState(action, current.events);
    return next === current.events ? current : { ...current, events: next };
  }), [setData]);
  const setAiPlanner = useCallback<Dispatch<SetStateAction<AIPlannerSettings>>>((action) => setData((current) => ({ ...current, aiPlanner: resolveState(action, current.aiPlanner) })), [setData]);
  const [focusComposerOpen, setFocusComposerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [focusConflict, setFocusConflict] = useState<{ additions: NexusEvent[]; replacements: NexusEvent[]; ignoreIds: string[]; proposed: NexusEvent[]; conflicts: EventConflict[] } | null>(null);
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
  const [form, setForm] = useState({ name: "", type: "website" as ResourceType, description: "", url: "", appIdentifier: "", icon: "", categoryId: getDefaultCategories()[0].id });
  const [applicationInfo, setApplicationInfo] = useState<Resource | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSaveMessage, setAiSaveMessage] = useState("");
  const [aiCategoryLoading, setAiCategoryLoading] = useState(false);
  const [aiCategorySuggestion, setAiCategorySuggestion] = useState("");
  const [aiCategoryMessage, setAiCategoryMessage] = useState("");
  const [captureNotice, setCaptureNotice] = useState("");
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [extensionTarget] = useState<BrowserExtensionTarget>(() => typeof navigator === "undefined"
    ? "chrome"
    : detectBrowserExtensionTarget(navigator.userAgent));

  const recommendCategory = useCallback(async (candidate: Partial<Pick<typeof form, "name" | "type" | "url" | "appIdentifier" | "description">> = form, silent = false): Promise<string | null> => {
    if (!silent) { setAiCategorySuggestion(""); setAiCategoryMessage(""); setAiCategoryLoading(true); }
    if (!aiPlanner.permissions.category) { if (!silent) setAiCategoryMessage("请先在 AI Planner 中允许 Used in Category。"); if (!silent) setAiCategoryLoading(false); return null; }
    if (!aiPlanner.apiKey) { if (!silent) setAiCategoryMessage("请先在 AI Planner 中保存 API Key。"); if (!silent) setAiCategoryLoading(false); return null; }
    if (!categories.length) { if (!silent) setAiCategoryMessage("请先创建至少一个分类。"); if (!silent) setAiCategoryLoading(false); return null; }
    const instruction = `你是 Nexus 的资源分类助手。只能从以下分类中推荐一个：${JSON.stringify(categories.map((category) => category.name))}。资源类型：${candidate.type === "application" ? "Application" : "Website"}。名称：${candidate.name || "未知"}。网址或 App Identifier：${candidate.url || candidate.appIdentifier || "未知"}。说明：${candidate.description || "无"}。只返回 JSON：{"category":"分类原文"}。不要创建新分类，不要替用户保存。`;
    try {
      const text = await requestAIText(aiPlanner, { purpose: "category", prompt: instruction, temperature: 0, maxTokens: 120 });
      const suggestion = validateCategorySuggestion(parseAIJson(text), categories);
      if (!suggestion) throw new Error("AI 没有返回现有分类，请重试或手动选择");
      if (!silent) { setAiCategorySuggestion(suggestion.categoryId); setAiCategoryMessage("这只是推荐；采用前不会更改你的分类选择。"); }
      return suggestion.categoryId;
    } catch (error) { if (!silent) setAiCategoryMessage(error instanceof Error ? error.message : "暂时无法获取分类建议"); return null; }
    finally { if (!silent) setAiCategoryLoading(false); }
  }, [aiPlanner, categories, form]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      const firstCategoryId = categories[0]?.id ?? UNCLASSIFIED_CATEGORY;
      setForm((current) => categories.some((category) => category.id === current.categoryId) || current.categoryId === TEMP_CATEGORY || current.categoryId === UNCLASSIFIED_CATEGORY
        ? current
        : { ...current, categoryId: firstCategoryId });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ready, categories]);

  useEffect(() => {
    if (!ready) return;
    const sendBridgeState = () => window.postMessage({ source: NEXUS_WEB_MESSAGE_SOURCE, type: EDGE_EXTENSION_MESSAGE.state, payload: { categories: categoriesForEdgeExtension(categories), savedUrls: links.filter((resource) => resource.type === "website").map((resource) => resource.url), siteUrl: window.location.origin } }, window.location.origin);
    const receiveCapture = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || !isEdgeExtensionBridgeMessage(event.data)) return;
      const capture = (event.data.payload || {}) as EdgeExtensionCapture;
      if (event.data.type === EDGE_EXTENSION_MESSAGE.save && capture.url) {
        void updateAndSave((current) => {
          const categoryId = categoryIdFromEdgeExtension(capture.category, current.categories);
          const candidate = createResource({
            type: "website",
            name: capture.title?.trim() || domainOf(capture.url || ""),
            description: descriptionForEdgeExtension(capture),
            url: capture.url || "",
            categoryId,
            color: palette[current.resources.length % palette.length],
          }, { order: nextResourceOrder(current.resources) });
          if (candidate.type !== "website") return current;
          const duplicateIndex = current.resources.findIndex((item) => item.type === "website" && item.url === candidate.url);
          if (duplicateIndex < 0) return { ...current, resources: [...current.resources, candidate] };
          const existing = current.resources[duplicateIndex];
          const resources = current.resources.map((item, index) => index === duplicateIndex ? {
            ...item,
            name: candidate.name,
            description: candidate.description,
            categoryId: candidate.categoryId,
            updatedAt: new Date().toISOString(),
          } : item);
          return existing.name === candidate.name && existing.description === candidate.description && existing.categoryId === candidate.categoryId
            ? current
            : { ...current, resources };
        }).then((saved) => {
          const stored = saved.resources.find((resource) => resource.type === "website" && resource.name === (capture.title?.trim() || domainOf(capture.url || "")));
          const normalized = stored?.type === "website" ? stored.url : capture.url;
          window.postMessage({ source: NEXUS_WEB_MESSAGE_SOURCE, type: EDGE_EXTENSION_MESSAGE.saved, payload: { id: capture.id, url: normalized } }, window.location.origin);
        }).catch(() => setCaptureNotice("Edge 收藏暂时无法保存，请先检查浏览器本地数据。"));
      }
      if (event.data.type === EDGE_EXTENSION_MESSAGE.aiRequest && capture.url) {
        void recommendCategory({ name: capture.title || "", url: capture.url, description: capture.description || "" }, true).then((categoryId) => {
          const category = categoryId ? categoryNameForEdgeExtension(categoryId, categories) : "";
          window.postMessage({ source: NEXUS_WEB_MESSAGE_SOURCE, type: EDGE_EXTENSION_MESSAGE.aiResult, payload: { id: capture.id, category, error: category ? "" : "暂时无法生成推荐" } }, window.location.origin);
        });
      }
    };
    window.addEventListener("message", receiveCapture);
    sendBridgeState();
    window.postMessage({ source: NEXUS_WEB_MESSAGE_SOURCE, type: EDGE_EXTENSION_MESSAGE.webReady }, window.location.origin);
    return () => window.removeEventListener("message", receiveCapture);
  }, [ready, categories, links, aiPlanner, updateAndSave, recommendCategory]);

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

  const homepageLinks = useMemo(() => homepageResources(links), [links]);
  const temporaryLinks = useMemo(() => temporaryResources(links), [links]);
  const unclassifiedLinks = useMemo(() => unclassifiedResources(links), [links]);
  const visibleLinks = useMemo(() => filterResources(links, query, activeCategory === "全部" ? undefined : activeCategory), [links, query, activeCategory]);
  const groupedLinks = categories.map((category) => ({ category, items: visibleLinks.filter((link) => link.categoryId === category.id) })).filter((group) => group.items.length);
  const resourcesById = useMemo(() => new Map(links.map((resource) => [resource.id, resource])), [links]);
  const currentDateKey = localDate(now ?? new Date());
  const displayEvents = useMemo(
    () => markPastPendingEventsUnfinished(events, currentDateKey),
    [events, currentDateKey],
  );
  const todayEvents = selectTodayEvents(displayEvents, currentDateKey);
  const todayProgress = calculateProgress(todayEvents);
  const focusCompleted = todayProgress.completed;
  const focusRemaining = todayProgress.remaining;
  const focusProgress = todayProgress.percent;
  const weeklyEvents = selectWeekEvents(displayEvents, now ?? new Date());
  const weeklySummary = calculateProgress(weeklyEvents);
  const weeklyCompleted = weeklySummary.completed;
  const weeklyProgress = weeklySummary.percent;

  const primaryHour = now ? Number(new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", hour12: false, timeZone: zones[0]?.zone }).formatToParts(now).find((part) => part.type === "hour")?.value ?? now.getHours()) : 12;
  const greeting = !now ? "你好" : primaryHour < 11 ? "早上好" : primaryHour < 14 ? "中午好" : primaryHour < 18 ? "下午好" : "晚上好";
  const zoneTime = (zone: string) => now?.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: zone }) ?? "--:--:--";
  const zoneDate = (zone: string) => now?.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long", timeZone: zone }) ?? "";

  async function saveAiSettings() {
    try {
      await saveNow();
      setAiSaveMessage("已保存到当前浏览器");
      window.setTimeout(() => setAiSaveMessage(""), 2400);
    } catch { setAiSaveMessage("保存失败，请检查浏览器设置"); }
  }
  async function clearAiKey() {
    try {
      await updateAndSave((current) => ({ ...current, aiPlanner: { ...current.aiPlanner, apiKey: "" } }));
      setAiSaveMessage("API Key 已删除");
    } catch { setAiSaveMessage("删除失败，请检查浏览器设置"); }
  }
  function submitLink(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.categoryId || (form.type === "website" && !form.url.trim())) return;
    const draft = form.type === "website"
      ? { type: "website" as const, name: form.name, description: form.description, url: form.url, icon: form.icon, categoryId: form.categoryId }
      : { type: "application" as const, name: form.name, description: form.description, appIdentifier: form.appIdentifier, icon: form.icon, categoryId: form.categoryId };
    const validation = validateResourceDraft(draft);
    if (!validation.valid) {
      setCaptureNotice(validation.errors.join(" "));
      return;
    }
    setLinks((items) => {
      const existing = editingId ? items.find((item) => item.id === editingId) : undefined;
      if (existing) return items.map((item) => item.id === existing.id ? updateResource(existing, draft) : item);
      return [...items, createResource({ ...draft, color: palette[items.length % palette.length] }, { order: nextResourceOrder(items) })];
    });
    setEditingId(null); setForm({ name: "", type: "website", description: "", url: "", appIdentifier: "", icon: "", categoryId: categories[0]?.id || UNCLASSIFIED_CATEGORY }); setCaptureNotice(""); setAiCategorySuggestion(""); setAiCategoryMessage("");
  }
  function editLink(link: Resource) { setEditingId(link.id); setForm({ name: link.name, type: link.type, description: displayResourceDescription(link), url: link.type === "website" ? link.url : "", appIdentifier: link.type === "application" ? link.appIdentifier ?? "" : "", icon: link.icon ?? "", categoryId: link.categoryId ?? UNCLASSIFIED_CATEGORY }); }
  function organizeSavedLink(link: Resource) {
    setEditingId(link.id);
    setForm({ name: link.name, type: link.type, description: displayResourceDescription(link), url: link.type === "website" ? link.url : "", appIdentifier: link.type === "application" ? link.appIdentifier ?? "" : "", icon: link.icon ?? "", categoryId: categories[0]?.id || UNCLASSIFIED_CATEGORY });
    setTemporaryOpen(false); setUnclassifiedOpen(false);
    setCaptureNotice("请选择一个正式分类并保存，这个 Resource 才会出现在主页。");
    setSettingsOpen(true);
  }
  function removeResourceIds(ids: string[]) {
    if (!ids.length) return;
    setData((current) => {
      const result = removeResourcesAndDetachEvents(current.resources, current.events, ids);
      return { ...current, resources: result.resources, events: result.events };
    });
  }
  function clearCategoryLinks(categoryId: string) {
    const label = categoryId === TEMP_CATEGORY ? "临时资源" : categoryId === UNCLASSIFIED_CATEGORY ? "未归类" : categories.find((category) => category.id === categoryId)?.name ?? "分类";
    if (!confirm(`清空“${label}”中的所有 Resource？分类本身会保留。`)) return;
    removeResourceIds(links.filter((item) => item.categoryId === categoryId).map((item) => item.id));
  }
  function removeCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    if (!category || !confirm(`删除“${category.name}”及其中的所有 Resource？`)) return;
    setData((current) => {
      const result = deleteCategoryAndResources(current.categories, current.resources, current.events, categoryId);
      setForm((formValue) => formValue.categoryId === categoryId ? { ...formValue, categoryId: result.categories[0]?.id || UNCLASSIFIED_CATEGORY } : formValue);
      return { ...current, categories: result.categories, resources: result.resources, events: result.events };
    });
    if (activeCategory === categoryId) setActiveCategory("全部");
  }
  function addCategory(event: FormEvent) {
    event.preventDefault(); const value = newCategory.trim();
    if (!value) return;
    try {
      const category = createCategory(categories, value);
      setCategories((items) => [...items, category]); setNewCategory(""); setForm((current) => ({ ...current, categoryId: category.id }));
    } catch { /* Duplicate names keep the form unchanged. */ }
  }
  function renameCategory(event: FormEvent, categoryId: string) {
    event.preventDefault();
    const nextName = categoryDraft.trim();
    if (!nextName) return;
    try {
      setCategories((items) => renameCategoryRecord(items, categoryId, nextName));
      setEditingCategory(null);
      setCategoryDraft("");
    } catch { /* Duplicate names keep the editor open. */ }
  }
  function moveCategory(target: string) {
    if (!draggedCategory || draggedCategory === target) return;
    setCategories((items) => {
      const orderedIds = orderedCategories(items).map((item) => item.id).filter((id) => id !== draggedCategory);
      orderedIds.splice(Math.max(0, orderedIds.indexOf(target)), 0, draggedCategory);
      const next = reorderCategories(items, orderedIds);
      if (!editingId) setForm((current) => ({ ...current, categoryId: next[0]?.id || UNCLASSIFIED_CATEGORY }));
      return next;
    });
    setDraggedCategory(null);
  }
  function searchGoogle(event: FormEvent) {
    event.preventDefault();
    const value = googleQuery.trim();
    if (value) void platformAdapter.openExternalUrl(searchEngine.url.replace("{query}", encodeURIComponent(value)));
  }
  function saveFocusEvent(event: FormEvent) {
    event.preventDefault();
    const title = focusForm.title.trim();
    if (!title || !focusForm.startTime || !focusForm.endTime) return;
    const next = { title, category: focusForm.category.trim() || "其他", date: localDate(new Date()), startTime: focusForm.startTime, endTime: focusForm.endTime, priority: focusForm.priority, type: focusForm.type, resources: focusForm.resources.filter((id) => resourcesById.has(id)) };
    let additions: NexusEvent[] = [];
    let replacements: NexusEvent[] = [];
    const ignoreIds = editingEventId ? [editingEventId] : [];
    if (editingEventId) {
      const current = events.find((item) => item.id === editingEventId); if (!current) return;
      replacements = [updateCurrentEvent(current, next, { createId: () => crypto.randomUUID(), resourceIds: links.map((resource) => resource.id) })];
    } else additions = generateRecurringEvents({ ...next, repeatUnit: focusForm.repeatUnit, repeatInterval: focusForm.repeatInterval, repeatCount: focusForm.repeatCount }, "local", { createId: () => crypto.randomUUID(), resourceIds: links.map((resource) => resource.id) });
    const proposed = [...replacements, ...additions];
    const conflicts = findEventConflicts(proposed, events, { ignoreEventIds: ignoreIds });
    if (conflicts.length) { setFocusConflict({ additions, replacements, ignoreIds, proposed, conflicts }); return; }
    applyFocusChange(additions, replacements);
  }
  function applyFocusChange(additions: NexusEvent[], replacements: NexusEvent[]) {
    const replacementMap = new Map(replacements.map((item) => [item.id, item]));
    setEvents((items) => [...items.map((item) => replacementMap.get(item.id) ?? item), ...additions]);
    setFocusConflict(null);
    setEditingEventId(null);
    setFocusForm({ title: "", category: "", startTime: "19:00", endTime: "20:30", priority: "Medium", type: "task", resources: [], repeatUnit: "none", repeatInterval: 1, repeatCount: 8 });
    setFocusComposerOpen(false);
  }
  function editFocusEvent(item: NexusEvent) { setEditingEventId(item.id); setFocusForm({ title: item.title, category: item.category, startTime: item.startTime, endTime: item.endTime || item.startTime, priority: item.priority, type: item.type, resources: item.resources || [], repeatUnit: "none", repeatInterval: 1, repeatCount: 1 }); setFocusComposerOpen(true); }
  function resetAll() {
    if (!confirm("恢复默认内容？你添加的分类、Resource、任务和用户名将被清除。")) return;
    const defaults = getDefaultSettings();
    const defaultCategories = getDefaultCategories();
    setData((current) => ({ ...current, categories: defaultCategories, resources: getDefaultResources(), events: createDefaultEvents(), settings: { ...current.settings, username: "", zones: defaults.zones } }));
    setForm({ name: "", type: "website", description: "", url: "", appIdentifier: "", icon: "", categoryId: defaultCategories[0]?.id || UNCLASSIFIED_CATEGORY }); setActiveCategory("全部");
  }

  return (
    <main className={`shell theme-${theme}`}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      {storageError && <div className="capture-notice" role="alert">本地数据暂时无法读取。为保护原始内容，本页不会覆盖现有存储：{storageError.message}</div>}
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">N</span><span>Nexus</span></a>
        <div className="top-actions"><label className="mini-search"><span className="search-icon" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="筛选 Resource…" aria-label="筛选 Resource" />{query && <button onClick={() => setQuery("")}>×</button>}</label><button className="unclassified-button" onClick={() => setUnclassifiedOpen(true)} title="整理尚未决定分类的 Resource">未归类 <span>{unclassifiedLinks.length}</span></button><button className="temporary-button" onClick={() => setTemporaryOpen(true)} title="查看不会显示在主页的临时 Resource">临时资源 <span>{temporaryLinks.length}</span></button><button className="home-ai-button" onClick={() => setAiOpen(true)} title="设置 AI Provider 与使用权限"><span>✦</span> AI Planner</button>{!extensionEntryHidden && <button className="extension-entry" onClick={() => setExtensionOpen(true)} title="下载 Nexus Save 浏览器扩展"><span>◇</span> 获取扩展</button>}<a className="github-link" href="https://github.com/LewisStarCo/nexus-navigation" target="_blank" rel="noreferrer" aria-label="在 GitHub 查看 Nexus 项目说明" title="查看功能说明与项目源码"><img src="https://github.com/favicon.ico" alt="" /></a><button className="theme-toggle" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} aria-label="切换亮色和暗色">{theme === "dark" ? "☀" : "☾"}</button><button className="manage-button" onClick={() => setSettingsOpen(true)}><span>＋</span> 管理资源</button></div>
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
          <div className="filters">{[{ id: "全部", name: "全部" }, ...categories].map((category) => <button type="button" key={category.id} className={activeCategory === category.id ? "active" : ""} onClick={() => setActiveCategory(category.id)}>{category.name}<span>{category.id === "全部" ? homepageLinks.length : homepageLinks.filter((link) => link.categoryId === category.id).length}</span></button>)}</div>
          <div className="directory">{groupedLinks.map((group) => <div className="category-section" key={group.category.id}><div className="section-heading"><h2>{group.category.name}</h2><span>{String(group.items.length).padStart(2, "0")}</span><div /></div><div className="card-grid">{group.items.map((resource) => <ResourceCard resource={resource} onApplication={setApplicationInfo} key={resource.id} />)}</div></div>)}{!groupedLinks.length && <div className="empty-state"><span>⌕</span><h2>没有找到相关资源</h2><p>换个关键词试试，或添加一个新入口。</p><button onClick={() => { setQuery(""); setActiveCategory("全部"); }}>查看全部资源</button></div>}</div>
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
              <details className="focus-form-section focus-resource-picker"><summary>关联资源{focusForm.resources.length ? ` · ${focusForm.resources.length}` : "（可选）"}</summary><label>添加资源<select value="" onChange={(e) => { const id = e.target.value; if (id && !focusForm.resources.includes(id)) setFocusForm({ ...focusForm, resources: [...focusForm.resources, id] }); }}><option value="">选择 Website 或 Application…</option>{links.filter((resource) => !focusForm.resources.includes(resource.id)).map((resource) => <option value={resource.id} key={resource.id}>{resource.type === "website" ? "🌐" : "💻"} {resource.name}</option>)}</select></label>{focusForm.resources.length > 0 && <div className="event-resource-chips">{focusForm.resources.map((id) => resourcesById.get(id)).filter((resource): resource is Resource => Boolean(resource)).map((resource) => <button type="button" key={resource.id} onClick={() => setFocusForm({ ...focusForm, resources: focusForm.resources.filter((id) => id !== resource.id) })}>{resource.type === "website" ? "🌐" : "💻"} {resource.name} ×</button>)}</div>}</details>
              {!editingEventId && <div className="focus-form-section focus-repeat"><span className="focus-form-caption">重复</span><label className="repeat-choice">规则<select value={focusForm.repeatUnit} onChange={(e) => setFocusForm({ ...focusForm, repeatUnit: e.target.value as typeof focusForm.repeatUnit })}><option value="none">不重复</option><option value="week">每 X 周</option><option value="month">每 X 月</option></select></label>{focusForm.repeatUnit !== "none" && <div className="repeat-details"><label>每隔<input type="number" min="1" max="52" value={focusForm.repeatInterval} onChange={(e) => setFocusForm({ ...focusForm, repeatInterval: Number(e.target.value) })} /><small>{focusForm.repeatUnit === "week" ? "周" : "月"}</small></label><label>共计<input type="number" min="1" max="52" value={focusForm.repeatCount} onChange={(e) => setFocusForm({ ...focusForm, repeatCount: Number(e.target.value) })} /><small>次</small></label></div>}<p>{focusForm.repeatUnit === "none" ? "仅添加今天这一项" : `从今天开始，每 ${focusForm.repeatInterval} ${focusForm.repeatUnit === "week" ? "周" : "月"}一次，共 ${focusForm.repeatCount} 次`}</p></div>}
              <div className="focus-form-actions"><button type="button" className="focus-cancel" onClick={() => { setFocusComposerOpen(false); setEditingEventId(null); }}>取消</button><button className="focus-submit">{editingEventId ? "保存修改" : "添加安排"}</button></div>
            </form>}
            <div className="timeline"><p className="timeline-label">TIMELINE</p>{todayEvents.map((item) => <article className={`timeline-event ${item.status === "completed" ? "done" : ""}`} key={item.id}><time>{item.startTime}</time><div className="timeline-line"><i /></div><label><input type="checkbox" checked={item.status === "completed"} onChange={() => setEvents((items) => items.map((event) => event.id === item.id ? { ...event, status: event.status === "completed" ? "pending" : "completed" } : event))} /><span><strong>{item.type === "schedule" ? "▣" : "□"} {item.title}</strong><small>{item.startTime} - {item.endTime || `${item.duration} min`} · {item.category}</small></span></label>{item.resources?.length > 0 && <span className="event-resource-chips">{item.resources.map((id) => resourcesById.get(id)).filter((resource): resource is Resource => Boolean(resource)).map((resource) => resource.type === "website" ? <button type="button" onClick={() => void platformAdapter.openExternalUrl(resource.url)} key={resource.id}>🌐 {resource.name}</button> : <button type="button" onClick={() => setApplicationInfo(resource)} key={resource.id}>💻 {resource.name}</button>)}</span>}<span className={`event-priority ${item.priority.toLowerCase()}`}>{item.priority.slice(0, 1)}</span><div className="event-actions"><button onClick={() => editFocusEvent(item)}>Edit</button><button onClick={() => setEvents((items) => items.filter((event) => event.id !== item.id))}>×</button></div></article>)}{!todayEvents.length && <p className="focus-empty">今天还没有安排。给自己留一点专注时间。</p>}</div>
            <a className="open-calendar" href="/calendar">Open Calendar <span>→</span></a>
          </section>
        </aside>
      </div>
      <footer><span><b>N</b> Nexus</span><p>所有个性化内容仅保存在你的浏览器中 · {homepageLinks.length} 个主页 Resource · {unclassifiedLinks.length} 个未归类 · {temporaryLinks.length} 个临时资源</p></footer>

      {extensionOpen && <div className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="extension-download-title"><button className="modal-backdrop" onClick={() => setExtensionOpen(false)} aria-label="关闭" /><section className="extension-download-panel"><header><div><small>BROWSER EXTENSION</small><h2 id="extension-download-title">获取 Nexus Save</h2></div><button onClick={() => setExtensionOpen(false)} aria-label="关闭">×</button></header><p>已在本地识别为 <strong>{browserExtensionDownloads[extensionTarget].label}</strong>。点击即可下载对应扩展包，网页不会读取你的浏览记录。</p><a className="extension-primary-download" href={browserExtensionDownloads[extensionTarget].downloadPath} download={browserExtensionDownloads[extensionTarget].fileName}>↓ 下载 {browserExtensionDownloads[extensionTarget].label} 扩展包</a><div className="extension-variants"><span>其他浏览器版本</span>{(Object.keys(browserExtensionDownloads) as BrowserExtensionTarget[]).filter((target) => target !== extensionTarget).map((target) => <a href={browserExtensionDownloads[target].downloadPath} download={browserExtensionDownloads[target].fileName} key={target}>{browserExtensionDownloads[target].label}</a>)}</div><div className="extension-guide"><div><strong>下载后如何安装？</strong><p>扩展包不会自动安装。请按照浏览器对应步骤加载，Safari 版本还需要在 Mac 上完成转换与签名。</p></div><a href={EXTENSION_INSTALLATION_GUIDE} target="_blank" rel="noreferrer">查看安装说明 .md →</a></div><footer><button onClick={() => { setExtensionEntryHidden(true); setExtensionOpen(false); }}>隐藏首页入口</button><button className="extension-close" onClick={() => setExtensionOpen(false)}>完成</button></footer></section></div>}

      {applicationInfo?.type === "application" && <div className="calendar-modal" role="dialog" aria-modal="true" aria-label={`${applicationInfo.name} 应用信息`}><button className="modal-backdrop" onClick={() => setApplicationInfo(null)} aria-label="关闭" /><section className="ai-planner"><header><div><small>APPLICATION RESOURCE</small><h2>💻 {applicationInfo.name}</h2></div><button onClick={() => setApplicationInfo(null)}>×</button></header><p>{applicationInfo.description}</p>{applicationInfo.appIdentifier && <label>App Identifier<input value={applicationInfo.appIdentifier} readOnly /></label>}<p className="api-key-note">出于浏览器安全限制，Nexus 网页不会尝试启动本地应用。未来的 Nexus macOS App 才能在获得你的明确授权后打开 Application Resource。</p><div className="ai-save-row"><span /><button className="save-ai-settings" onClick={() => setApplicationInfo(null)}>知道了</button></div></section></div>}

      {focusConflict && <div className="calendar-modal" role="alertdialog" aria-modal="true" aria-labelledby="focus-conflict-title"><button className="modal-backdrop" onClick={() => setFocusConflict(null)} aria-label="返回调整" /><section className="conflict-dialog"><header><div><small>SCHEDULE CONFLICT</small><h2 id="focus-conflict-title">这个时间已有安排</h2></div><button onClick={() => setFocusConflict(null)}>×</button></header><p>发现 {focusConflict.conflicts.length} 处时间重叠。这只是提醒，不会禁止你同时安排两件事。</p><div className="conflict-list">{focusConflict.conflicts.slice(0, 5).map((conflict, index) => { const proposed = focusConflict.proposed.find((item) => item.id === conflict.proposedId); const existing = events.find((item) => item.id === conflict.existingId) ?? focusConflict.proposed.find((item) => item.id === conflict.existingId); return <article key={`${conflict.proposedId}-${conflict.existingId}-${index}`}><time>{conflict.date}<br />{conflict.overlapStart}–{conflict.overlapEnd}</time><p><strong>{proposed?.title || "新日程"}</strong><span>与 {existing?.title || "已有日程"} 重叠</span></p></article>; })}</div><footer><button onClick={() => setFocusConflict(null)}>返回调整</button><button className="continue-conflict" onClick={() => applyFocusChange(focusConflict.additions, focusConflict.replacements)}>仍然保存</button></footer></section></div>}

      {unclassifiedOpen && <div className="saved-links-layer" role="dialog" aria-modal="true" aria-label="未归类资源"><button className="modal-backdrop" onClick={() => setUnclassifiedOpen(false)} aria-label="关闭" /><section className="saved-links-panel"><header><div><small>INBOX</small><h2>未归类</h2><p>还没想好放在哪里的资源。整理后才会进入正式导航分类。</p></div><button onClick={() => setUnclassifiedOpen(false)}>×</button></header><div className="saved-links-toolbar"><span>{unclassifiedLinks.length} 个资源</span><button disabled={!unclassifiedLinks.length} onClick={() => clearCategoryLinks(UNCLASSIFIED_CATEGORY)}>删除全部</button></div><div className="saved-links-list">{unclassifiedLinks.map((link) => <article key={link.id}><SiteIcon link={link} small /><p>{link.type === "website" ? <button type="button" onClick={() => void platformAdapter.openExternalUrl(link.url)}>🌐 {link.name}</button> : <button onClick={() => setApplicationInfo(link)}>💻 {link.name}</button>}<small>{link.type === "website" ? domainOf(link.url) : link.appIdentifier || "Application"}</small></p><button onClick={() => organizeSavedLink(link)}>整理到主页</button><button className="danger" onClick={() => removeResourceIds([link.id])}>删除</button></article>)}{!unclassifiedLinks.length && <div className="saved-links-empty"><span>✓</span><strong>没有待整理资源</strong><p>Edge 扩展中选择“未归类”的网页会出现在这里。</p></div>}</div></section></div>}

      {temporaryOpen && <div className="saved-links-layer" role="dialog" aria-modal="true" aria-label="临时资源"><button className="modal-backdrop" onClick={() => setTemporaryOpen(false)} aria-label="关闭" /><section className="saved-links-panel"><header><div><small>TEMPORARY</small><h2>临时资源</h2><p>只在短期内需要的资源，不会显示在主页导航中。</p></div><button onClick={() => setTemporaryOpen(false)}>×</button></header><div className="saved-links-toolbar"><span>{temporaryLinks.length} 个资源</span><button disabled={!temporaryLinks.length} onClick={() => clearCategoryLinks(TEMP_CATEGORY)}>删除全部</button></div><div className="saved-links-list">{temporaryLinks.map((link) => <article key={link.id}><SiteIcon link={link} small /><p>{link.type === "website" ? <button type="button" onClick={() => void platformAdapter.openExternalUrl(link.url)}>🌐 {link.name}</button> : <button onClick={() => setApplicationInfo(link)}>💻 {link.name}</button>}<small>{link.type === "website" ? domainOf(link.url) : link.appIdentifier || "Application"}</small></p><button onClick={() => organizeSavedLink(link)}>添加到主页</button><button className="danger" onClick={() => removeResourceIds([link.id])}>删除</button></article>)}{!temporaryLinks.length && <div className="saved-links-empty"><span>⌛</span><strong>没有临时资源</strong><p>Edge 扩展中选择“临时网页”后，会收纳在这里。</p></div>}</div></section></div>}

      {aiOpen && <div className="calendar-modal home-ai-modal" role="dialog" aria-modal="true" aria-label="AI Planner 设置"><button className="modal-backdrop" onClick={() => setAiOpen(false)} aria-label="关闭" /><section className="ai-planner"><header><div><small>OPTIONAL · BYOK</small><h2>✦ AI Planner Settings</h2></div><button onClick={() => setAiOpen(false)}>×</button></header><p>AI 只在你允许的功能中、并由你主动操作时提供建议。它不会自动整理资源或修改日程。</p><div className="ai-permissions"><span>AI 使用权限</span><div><button type="button" className={aiPlanner.permissions.calendar ? "active" : ""} onClick={() => setAiPlanner({ ...aiPlanner, permissions: { ...aiPlanner.permissions, calendar: !aiPlanner.permissions.calendar } })}><strong>Used in Calendar</strong><small>允许生成可编辑的日程建议</small></button><button type="button" className={aiPlanner.permissions.category ? "active" : ""} onClick={() => setAiPlanner({ ...aiPlanner, permissions: { ...aiPlanner.permissions, category: !aiPlanner.permissions.category } })}><strong>Used in Category</strong><small>允许为 Resource 推荐现有分类</small></button><button type="button" className={aiPlanner.permissions.planning ? "active" : ""} onClick={() => setAiPlanner({ ...aiPlanner, permissions: { ...aiPlanner.permissions, planning: !aiPlanner.permissions.planning } })}><strong>Used in Planning</strong><small>允许为 Event 推荐已有 Website 与 Application</small></button><button type="button" className={!aiPlanner.permissions.calendar && !aiPlanner.permissions.category && !aiPlanner.permissions.planning ? "active danger" : "danger"} onClick={() => setAiPlanner({ ...aiPlanner, permissions: { calendar: false, category: false, planning: false } })}><strong>Do not use AI in any situation</strong><small>关闭 Calendar、Category 与 Planning 的 AI 请求</small></button></div></div><label>Provider<select value={aiPlanner.provider} onChange={(e) => { const provider = e.target.value; setAiPlanner({ ...aiPlanner, provider, model: providerDefaults[provider]?.model || aiPlanner.model }); }}><option>OpenAI</option><option>Qwen</option><option>Claude</option><option>Gemini</option><option>DeepSeek</option><option>智谱 AI</option><option value="Custom">自定义 Provider</option></select></label>{aiPlanner.provider === "Custom" && <div className="custom-provider"><label>Provider 名称<input value={aiPlanner.customProvider.name} onChange={(e) => setAiPlanner({ ...aiPlanner, customProvider: { ...aiPlanner.customProvider, name: e.target.value } })} placeholder="例如：Moonshot" /></label><label>API Base URL<input value={aiPlanner.customProvider.baseUrl} onChange={(e) => setAiPlanner({ ...aiPlanner, customProvider: { ...aiPlanner.customProvider, baseUrl: e.target.value } })} placeholder="https://api.example.com/v1" /></label></div>}<label>模型名称<input value={aiPlanner.provider === "Custom" ? aiPlanner.customProvider.model : aiPlanner.model} onChange={(e) => aiPlanner.provider === "Custom" ? setAiPlanner({ ...aiPlanner, customProvider: { ...aiPlanner.customProvider, model: e.target.value } }) : setAiPlanner({ ...aiPlanner, model: e.target.value })} placeholder="模型 ID" /></label><label>API Key<input type="password" value={aiPlanner.apiKey} onChange={(e) => setAiPlanner({ ...aiPlanner, apiKey: e.target.value })} placeholder="使用你自己的 API Key" /></label><p className="api-key-note">设置只保存在当前浏览器。Edge 扩展不会读取或保存 API Key；AI 推荐通过 Nexus 页面完成。</p><div className="ai-save-row"><button className="clear-ai-key" onClick={clearAiKey} disabled={!aiPlanner.apiKey}>删除密钥</button><span>{aiSaveMessage}</span><button className="save-ai-settings" onClick={saveAiSettings}>保存到本地</button></div></section></div>}

      {settingsOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="管理资源">
        <button className="modal-backdrop" onClick={() => setSettingsOpen(false)} aria-label="关闭" />
        <aside className="manager">
          <div className="manager-head"><div><small>RESOURCE WORKSPACE</small><h2>管理资源</h2></div><button onClick={() => setSettingsOpen(false)}>×</button></div>
          <div className="manager-scroll">
            <section className="setting-section"><label className="field-label">你的名字</label><input className="field" value={username} onChange={(e) => setUsername(e.target.value.slice(0, 20))} placeholder="在这里填写用户名" /><p className="field-help">将显示在首页问候语中，随时可以修改。</p></section>
            <section className="setting-section"><div className="setting-title"><h3>默认搜索引擎</h3><span>{searchEngine.label}</span></div><div className="engine-options">{searchEngines.map((engine) => <button className={searchEngine.url === engine.url ? "selected" : ""} key={engine.url} onClick={() => setSearchEngine(engine)}>{engine.label}</button>)}</div><div className="custom-engine"><input value={customEngine.label} onChange={(e) => setCustomEngine({ ...customEngine, label: e.target.value })} placeholder="自定义名称" /><input value={customEngine.url} onChange={(e) => setCustomEngine({ ...customEngine, url: e.target.value })} placeholder="https://example.com/search?q={query}" /><button onClick={() => { if (isValidSearchEngine(customEngine)) setSearchEngine({ label: customEngine.label.trim(), url: customEngine.url.trim() }); }}>使用自定义</button></div><p className="field-help">自定义地址必须使用 HTTP(S)，并包含 <code>{"{query}"}</code>，它会被替换成搜索内容。</p></section>
            <section className="setting-section"><div className="setting-title"><h3>时区与时钟</h3><span>{zones.length}</span></div><p className="field-help timezone-help">第一个时区是主时区，用于判断早上、中午或晚上。</p><div className="timezone-list">{zones.map((item, index) => <div key={`${item.zone}-${index}`}><p><strong>{item.label}</strong><small>{item.zone}</small></p>{index > 0 && <button onClick={() => setZones((items) => [item, ...items.filter((_, i) => i !== index)])}>设为主时区</button>}{zones.length > 1 && <button className="danger" onClick={() => setZones((items) => items.filter((_, i) => i !== index))}>删除</button>}</div>)}</div><div className="timezone-add"><select value={zoneToAdd} onChange={(e) => setZoneToAdd(e.target.value)}>{zoneOptions.filter((option, index, all) => all.findIndex((item) => item.zone === option.zone) === index).map((item) => <option value={item.zone} key={item.zone}>{item.label} · {item.zone}</option>)}</select><button onClick={() => { const item = zoneOptions.find((option) => option.zone === zoneToAdd); if (item && !zones.some((zone) => zone.zone === item.zone)) setZones((current) => [...current, item]); }}>添加时区</button></div></section>
            <section className="setting-section"><div className="setting-title"><h3>浏览器扩展入口</h3><span>{extensionEntryHidden ? "已隐藏" : "显示中"}</span></div><p className="field-help">这是一个可选的首页小入口，用于下载 Nexus Save。它不会自动安装扩展。</p><div className="extension-setting-row"><button onClick={() => { setExtensionEntryHidden(false); setExtensionOpen(true); }}>{extensionEntryHidden ? "重新显示并查看下载" : "查看扩展下载"}</button>{!extensionEntryHidden && <button className="danger" onClick={() => setExtensionEntryHidden(true)}>隐藏首页入口</button>}<a href={EXTENSION_INSTALLATION_GUIDE} target="_blank" rel="noreferrer">安装说明 ↗</a></div></section>
            <section className="setting-section"><div className="setting-title"><h3>分类 · 拖动调整顺序</h3><span>{categories.length}</span></div><div className="category-list">{categories.map((category) => editingCategory === category.id ? <form className="category-edit" key={category.id} onSubmit={(event) => renameCategory(event, category.id)}><input autoFocus value={categoryDraft} onChange={(e) => setCategoryDraft(e.target.value)} maxLength={24} /><button className="save-category">保存</button><button type="button" onClick={() => setEditingCategory(null)}>取消</button></form> : <div className={draggedCategory === category.id ? "dragging" : ""} draggable key={category.id} onDragStart={() => setDraggedCategory(category.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => moveCategory(category.id)} onDragEnd={() => setDraggedCategory(null)}><b className="drag-handle">⠿</b><span>{category.name}</span><button className="rename-category" onClick={() => { setEditingCategory(category.id); setCategoryDraft(category.name); }}>重命名</button><button className="clear-category" onClick={() => clearCategoryLinks(category.id)}>清空资源</button><button onClick={() => removeCategory(category.id)}>删除分类</button></div>)}</div><form className="inline-form" onSubmit={addCategory}><input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="新分类名称" /><button>添加</button></form></section>
            <section className="setting-section"><div className="setting-title"><h3>{editingId ? "Edit Resource" : "Add Resource"}</h3><span>{links.length}</span></div>
              {categories.length ? <form className="link-form" onSubmit={submitLink}>{captureNotice && <div className="capture-notice">{captureNotice}</div>}<fieldset className="resource-type-picker"><legend>资源类型</legend><div>{(["website", "application"] as ResourceType[]).map((type) => <button type="button" className={form.type === type ? "active" : ""} onClick={() => setForm({ ...form, type, url: type === "application" ? "" : form.url, appIdentifier: type === "website" ? "" : form.appIdentifier })} key={type}><span>{type === "website" ? "🌐" : "💻"}</span><strong>{type === "website" ? "Website" : "Application"}</strong><i /></button>)}</div></fieldset><label>名称<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.type === "website" ? "例如：Wikipedia" : "例如：Visual Studio Code"} required /></label>{form.type === "website" ? <label>网址<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com" required /></label> : <><label>App Identifier（可选）<input value={form.appIdentifier} onChange={(e) => setForm({ ...form, appIdentifier: e.target.value })} placeholder="例如：com.microsoft.VSCode" /></label><p className="field-help">网页版本只记录应用信息，不会尝试启动应用。未来 Nexus macOS App 才能提供安全启动能力。</p></>}<label>说明<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="一句简短说明（可选）" /></label><label className="category-field">分类<div><select value={form.categoryId} onChange={(e) => { setForm({ ...form, categoryId: e.target.value }); setAiCategorySuggestion(""); }}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}<option value={UNCLASSIFIED_CATEGORY}>未归类（稍后整理）</option><option value={TEMP_CATEGORY}>临时资源（不显示在主页）</option></select><button type="button" className="recommend-category" onClick={() => void recommendCategory()} disabled={aiCategoryLoading}>{aiCategoryLoading ? "推荐中…" : "✦ AI 推荐"}</button></div></label>{(aiCategorySuggestion || aiCategoryMessage) && <div className="category-suggestion">{aiCategorySuggestion && <><span>AI 建议分类</span><strong>{categories.find((category) => category.id === aiCategorySuggestion)?.name ?? "现有分类"}</strong><button type="button" onClick={() => { setForm({ ...form, categoryId: aiCategorySuggestion }); setAiCategorySuggestion(""); setAiCategoryMessage("已采用建议，保存前仍可修改。"); }}>采用建议</button></>}<p>{aiCategoryMessage}</p></div>}<div className="form-actions">{editingId && <button type="button" className="ghost" onClick={() => { setEditingId(null); setForm({ name: "", type: "website", description: "", url: "", appIdentifier: "", icon: "", categoryId: categories[0]?.id || UNCLASSIFIED_CATEGORY }); setCaptureNotice(""); }}>取消</button>}<button className="primary">{form.categoryId === TEMP_CATEGORY ? "保存为临时资源" : form.categoryId === UNCLASSIFIED_CATEGORY ? "保存到未归类" : editingId ? "保存修改" : "Add Resource"}</button></div></form> : <p className="field-help">请先添加一个分类。</p>}
            </section>
            <section className="setting-section"><div className="setting-title"><h3>已有资源</h3><span>{links.length}</span></div><div className="manage-links">{links.map((link) => <div key={link.id}><SiteIcon link={link} small /><p><strong>{link.type === "website" ? "🌐" : "💻"} {link.name}</strong><small>{link.categoryId === TEMP_CATEGORY ? "临时资源" : link.categoryId === UNCLASSIFIED_CATEGORY ? "未归类" : categories.find((category) => category.id === link.categoryId)?.name ?? "未归类"}</small></p><button onClick={() => editLink(link)}>编辑</button><button className="danger" onClick={() => removeResourceIds([link.id])}>删除</button></div>)}</div></section>
            <button className="reset-button" onClick={resetAll}>恢复默认内容</button>
          </div>
        </aside>
      </div>}
    </main>
  );
}
