let pageReady = false;
let delivering = false;
const aiResponders = new Map();

function normalizeUrl(value) {
  try { return new URL(value).toString(); } catch { return String(value || ""); }
}

async function removeAcknowledgedCapture(id, url) {
  if (!id) return;
  const stored = await chrome.storage.local.get(["queuedCaptures", "nexusSavedUrls"]);
  const queuedCaptures = Array.isArray(stored.queuedCaptures) ? stored.queuedCaptures : [];
  const savedUrls = Array.isArray(stored.nexusSavedUrls) ? stored.nexusSavedUrls : [];
  const normalized = normalizeUrl(url);
  await chrome.storage.local.set({
    queuedCaptures: queuedCaptures.filter((item) => item.id !== id),
    nexusSavedUrls: normalized ? [...new Set([...savedUrls.map(normalizeUrl), normalized])] : savedUrls,
  });
}

async function deliverQueuedCaptures() {
  if (!pageReady || delivering) return;
  delivering = true;
  try {
    const stored = await chrome.storage.local.get("queuedCaptures");
    const queuedCaptures = Array.isArray(stored.queuedCaptures) ? stored.queuedCaptures : [];
    queuedCaptures.forEach((capture) => {
      window.postMessage({
        source: "nexus-edge-extension",
        type: "NEXUS_EXTENSION_SAVE",
        payload: capture
      }, window.location.origin);
    });
  } finally {
    delivering = false;
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== "nexus-web") return;
  const payload = event.data.payload || {};

  if (event.data.type === "NEXUS_EXTENSION_STATE") {
    const categories = Array.isArray(payload.categories)
      ? payload.categories.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [];
    const savedUrls = Array.isArray(payload.savedUrls)
      ? payload.savedUrls.filter((item) => typeof item === "string" && /^https?:\/\//i.test(item)).map(normalizeUrl)
      : [];
    chrome.storage.local.set({
      nexusCategories: categories,
      nexusSavedUrls: [...new Set(savedUrls)],
      nexusBaseUrl: payload.siteUrl || window.location.origin,
      nexusStateUpdatedAt: Date.now()
    });
  }

  if (event.data.type === "NEXUS_WEB_READY") {
    pageReady = true;
    void deliverQueuedCaptures();
  }

  if (event.data.type === "NEXUS_EXTENSION_SAVED") {
    void removeAcknowledgedCapture(payload.id, payload.url);
  }

  if (event.data.type === "NEXUS_EXTENSION_AI_RESULT" && payload.id) {
    const responder = aiResponders.get(payload.id);
    if (!responder) return;
    clearTimeout(responder.timer);
    aiResponders.delete(payload.id);
    responder.sendResponse(payload.category
      ? { ok: true, category: payload.category }
      : { ok: false, error: payload.error || "AI 没有返回推荐" });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "NEXUS_DELIVER_QUEUE") {
    void deliverQueuedCaptures().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "NEXUS_REQUEST_AI_CATEGORY") {
    if (!pageReady) {
      sendResponse({ ok: false, error: "Nexus 尚未准备好，请刷新页面后再试。" });
      return false;
    }
    const payload = message.payload || {};
    const timer = setTimeout(() => {
      const responder = aiResponders.get(payload.id);
      if (!responder) return;
      aiResponders.delete(payload.id);
      responder.sendResponse({ ok: false, error: "AI 推荐超时，请稍后再试。" });
    }, 30000);
    aiResponders.set(payload.id, { sendResponse, timer });
    window.postMessage({
      source: "nexus-edge-extension",
      type: "NEXUS_EXTENSION_AI_REQUEST",
      payload
    }, window.location.origin);
    return true;
  }

  return false;
});
