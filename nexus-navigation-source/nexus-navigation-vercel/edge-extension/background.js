const DEFAULT_NEXUS_URL = "https://nexus-navigation.vercel.app/";

function normalizeNexusUrl(value) {
  try {
    const url = new URL(value || DEFAULT_NEXUS_URL);
    if (url.protocol !== "https:") return DEFAULT_NEXUS_URL;
    return `${url.origin}/`;
  } catch {
    return DEFAULT_NEXUS_URL;
  }
}

async function nexusContext() {
  const stored = await chrome.storage.local.get("nexusBaseUrl");
  const nexusUrl = normalizeNexusUrl(stored.nexusBaseUrl);
  const origin = new URL(nexusUrl).origin;
  const tabs = await chrome.tabs.query({ url: `${origin}/*` });
  return { nexusUrl, tabs };
}

function workspaceTab(tabs) {
  return tabs.find((tab) => {
    try { return new URL(tab.url || "").pathname === "/"; } catch { return false; }
  }) || tabs[0];
}

async function openOrFocusNexus() {
  const { nexusUrl, tabs } = await nexusContext();
  if (!tabs.length) return chrome.tabs.create({ url: nexusUrl, active: true });

  const tab = tabs[0];
  if (typeof tab.id === "number") await chrome.tabs.update(tab.id, { active: true });
  if (typeof tab.windowId === "number") await chrome.windows.update(tab.windowId, { focused: true });
  return tab;
}

async function notifyOpenNexusTabs() {
  const { tabs } = await nexusContext();
  const tab = workspaceTab(tabs);
  if (typeof tab?.id !== "number") return 0;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "NEXUS_DELIVER_QUEUE" });
  } catch {
    // A tab opened before the extension was installed needs one refresh to receive the bridge.
    await chrome.tabs.reload(tab.id);
  }
  return 1;
}

async function queueCapture(payload) {
  if (!/^https?:\/\//i.test(payload.url || "")) throw new Error("当前页面无法收藏到 Nexus");
  const stored = await chrome.storage.local.get("queuedCaptures");
  const queuedCaptures = Array.isArray(stored.queuedCaptures) ? stored.queuedCaptures : [];
  const capture = {
    id: crypto.randomUUID(),
    title: String(payload.title || "").trim(),
    url: String(payload.url),
    category: String(payload.category || "__nexus_unclassified__"),
    createdAt: Date.now()
  };
  queuedCaptures.push(capture);
  await chrome.storage.local.set({ queuedCaptures });
  const notified = await notifyOpenNexusTabs();
  return { capture, notified };
}

async function requestAiCategory(payload) {
  const { tabs } = await nexusContext();
  const tab = workspaceTab(tabs);
  if (!tab?.id) throw new Error("请先打开 Nexus，再使用 AI 推荐分类。");

  try {
    return await chrome.tabs.sendMessage(tab.id, {
      type: "NEXUS_REQUEST_AI_CATEGORY",
      payload: {
        id: crypto.randomUUID(),
        title: String(payload.title || "").trim(),
        url: String(payload.url || "")
      }
    });
  } catch {
    throw new Error("Nexus 尚未准备好。请刷新 Nexus 后再试。");
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "NEXUS_QUEUE_SAVE") {
    queueCapture(message.payload || {})
      .then(({ capture, notified }) => sendResponse({ ok: true, id: capture.id, syncedNow: notified > 0 }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "无法保存到同步队列" }));
    return true;
  }

  if (message?.type === "NEXUS_REQUEST_AI_CATEGORY") {
    requestAiCategory(message.payload || {})
      .then((result) => sendResponse(result || { ok: false, error: "AI 没有返回推荐" }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "无法获取 AI 推荐" }));
    return true;
  }

  if (message?.type === "NEXUS_OPEN") {
    openOrFocusNexus()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "无法打开 Nexus" }));
    return true;
  }

  return false;
});
