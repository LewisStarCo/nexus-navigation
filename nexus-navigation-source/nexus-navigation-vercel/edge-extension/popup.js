const UNCLASSIFIED_CATEGORY = "__nexus_unclassified__";
const TEMPORARY_CATEGORY = "__nexus_temporary__";
const FALLBACK_CATEGORIES = ["复旦学习", "AI 工具", "编程开发", "知识资源"];

const titleInput = document.getElementById("page-title");
const categorySelect = document.getElementById("page-category");
const urlText = document.getElementById("page-url");
const statusText = document.getElementById("status");
const syncNote = document.getElementById("sync-note");
const submitButton = document.getElementById("submit-button");
const recommendButton = document.getElementById("recommend-category");
let currentUrl = "";

function setStatus(message, kind = "") {
  statusText.textContent = message;
  statusText.className = `status ${kind}`.trim();
}

function appendCategory(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  categorySelect.append(option);
}

function fillCategories(categories, synced) {
  const unique = [...new Set(categories.filter((item) => typeof item === "string" && item.trim()))];
  categorySelect.replaceChildren();
  appendCategory(UNCLASSIFIED_CATEGORY, "未归类");
  appendCategory(TEMPORARY_CATEGORY, "临时网页");
  unique.forEach((category) => appendCategory(category, category));
  categorySelect.value = UNCLASSIFIED_CATEGORY;

  if (!synced) {
    syncNote.hidden = false;
    syncNote.textContent = "下面显示默认分类。打开一次 Nexus 后，扩展会自动同步你当前的分类。";
  }
}

async function initialize() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = activeTab?.url || "";
  titleInput.value = activeTab?.title || "未命名网页";
  urlText.textContent = currentUrl || "当前页面无法读取";
  urlText.title = currentUrl;

  const stored = await chrome.storage.local.get(["nexusCategories", "nexusStateUpdatedAt"]);
  const synced = Array.isArray(stored.nexusCategories) && stored.nexusCategories.length > 0;
  fillCategories(synced ? stored.nexusCategories : FALLBACK_CATEGORIES, synced);

  if (!/^https?:\/\//i.test(currentUrl)) {
    submitButton.disabled = true;
    recommendButton.disabled = true;
    setStatus("Edge 内部页面不能加入 Nexus。请先打开普通网页。", "error");
  }
}

recommendButton.addEventListener("click", async () => {
  recommendButton.disabled = true;
  recommendButton.textContent = "推荐中…";
  setStatus("");
  try {
    const response = await chrome.runtime.sendMessage({
      type: "NEXUS_REQUEST_AI_CATEGORY",
      payload: { title: titleInput.value.trim(), url: currentUrl }
    });
    if (!response?.ok || !response.category) throw new Error(response?.error || "AI 没有返回推荐");
    const exists = [...categorySelect.options].some((option) => option.value === response.category);
    if (!exists) throw new Error("AI 推荐的分类已不存在，请先打开 Nexus 同步分类。");
    categorySelect.value = response.category;
    setStatus(`AI 建议：${response.category}。你仍可修改。`, "success");
  } catch (error) {
    setStatus(error?.message || "暂时无法获取 AI 推荐。", "error");
  } finally {
    recommendButton.disabled = false;
    recommendButton.textContent = "✦ AI 推荐";
  }
});

document.getElementById("capture-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");
  submitButton.disabled = true;
  submitButton.textContent = "正在保存…";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "NEXUS_QUEUE_SAVE",
      payload: {
        title: titleInput.value.trim(),
        url: currentUrl,
        category: categorySelect.value
      }
    });
    if (!response?.ok) throw new Error(response?.error || "无法保存到 Nexus");
    setStatus(response.syncedNow ? "已保存，并同步到 Nexus。" : "已保存；下次打开 Nexus 时会自动同步。", "success");
    window.setTimeout(() => window.close(), 800);
  } catch (error) {
    setStatus(error?.message || "保存失败，请重试。", "error");
    submitButton.disabled = false;
    submitButton.textContent = "完成";
  }
});

document.getElementById("open-nexus").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "NEXUS_OPEN" });
  if (!response?.ok) setStatus(response?.error || "无法打开 Nexus", "error");
  else window.close();
});

initialize().catch(() => {
  submitButton.disabled = true;
  recommendButton.disabled = true;
  setStatus("扩展无法读取当前网页，请重新打开扩展。", "error");
});
