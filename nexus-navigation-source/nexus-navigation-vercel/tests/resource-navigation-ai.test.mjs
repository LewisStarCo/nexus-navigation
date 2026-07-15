import assert from "node:assert/strict";
import test from "node:test";

import {
  createResource,
  removeResourcesAndDetachEvents,
  updateResource,
} from "../src/modules/resources/index.ts";
import {
  TEMPORARY_CATEGORY_ID,
  UNCLASSIFIED_CATEGORY_ID,
  createCategory,
  deleteCategoryAndResources,
  filterResources,
  renameCategory,
  reorderCategories,
} from "../src/modules/navigation/index.ts";
import {
  AIPermissionError,
  applyConfirmedResourceSuggestion,
  canUseAI,
  disableAIInAllSituations,
  requestAIText,
  resolveProviderConfig,
  validateCategorySuggestion,
  validateResourceSuggestion,
} from "../src/modules/ai-planner/index.ts";
import {
  categoriesForEdgeExtension,
  categoryIdFromEdgeExtension,
} from "../src/platform/browser/edge-extension/index.ts";
import {
  BrowserPlatformAdapter,
  DesktopPlatformAdapter,
} from "../src/platform/index.ts";
import {
  addClockZone,
  removeClockZone,
  setPrimaryClockZone,
  setSearchEngine,
} from "../src/modules/settings/index.ts";

const now = "2026-07-15T00:00:00.000Z";
const categories = [
  { id: "coding", name: "Coding", order: 0 },
  { id: "study", name: "Study", order: 1 },
];

function eventWithResources(resources) {
  return {
    id: "event-1",
    title: "Learn C++",
    category: "Coding",
    priority: "High",
    type: "task",
    date: "2026-07-15",
    startTime: "19:00",
    endTime: "20:00",
    duration: 60,
    status: "pending",
    source: "local",
    resources,
  };
}

function aiSettings(overrides = {}) {
  return {
    provider: "OpenAI",
    apiKey: "local-test-key",
    model: "gpt-test",
    customProvider: { name: "", baseUrl: "", model: "" },
    permissions: { calendar: true, category: false, planning: false },
    ...overrides,
  };
}

test("Resource factory creates discriminated Website and Application records", () => {
  const website = createResource(
    { type: "website", name: "Example", url: "example.com", categoryId: "coding" },
    { id: "web-1", order: 3, now },
  );
  const application = createResource(
    { type: "application", name: "VS Code", appIdentifier: "com.microsoft.VSCode", categoryId: "coding" },
    { id: "app-1", order: 4, now },
  );

  assert.equal(website.type, "website");
  assert.equal(website.url, "https://example.com/");
  assert.equal(application.type, "application");
  assert.equal(application.appIdentifier, "com.microsoft.VSCode");
  assert.equal("url" in application, false);
});

test("Resource update keeps identity and removes fields from the previous type", () => {
  const website = createResource(
    { type: "website", name: "Example", url: "https://example.com" },
    { id: "resource-1", order: 7, now },
  );
  const application = updateResource(
    website,
    { type: "application", name: "Example App", appIdentifier: "com.example.app" },
    "2026-07-16T00:00:00.000Z",
  );

  assert.equal(application.id, website.id);
  assert.equal(application.createdAt, website.createdAt);
  assert.equal(application.order, 7);
  assert.equal(application.updatedAt, "2026-07-16T00:00:00.000Z");
  assert.equal("url" in application, false);
});

test("Deleting Resources removes only their Event ID references", () => {
  const web = createResource(
    { type: "website", name: "Docs", url: "https://example.com/docs", categoryId: "coding" },
    { id: "web-1", now },
  );
  const app = createResource(
    { type: "application", name: "Editor", categoryId: "coding" },
    { id: "app-1", now },
  );
  const result = removeResourcesAndDetachEvents(
    [web, app],
    [eventWithResources([web.id, app.id, "future-resource"])],
    [web.id],
  );

  assert.deepEqual(result.removedIds, [web.id]);
  assert.deepEqual(result.resources.map((item) => item.id), [app.id]);
  assert.deepEqual(result.events[0].resources, [app.id, "future-resource"]);
});

test("Category rename and reorder use stable IDs", () => {
  const renamed = renameCategory(categories, "coding", "Development", now);
  const reordered = reorderCategories(renamed, ["study", "coding"]);

  assert.equal(renamed[0].id, "coding");
  assert.equal(renamed[0].name, "Development");
  assert.deepEqual(reordered.map((item) => item.id), ["study", "coding"]);
  assert.throws(() => createCategory(categories, " coding "), /already exists/i);
});

test("Deleting a Category preserves v17 behavior and detaches its Resources", () => {
  const web = createResource(
    { type: "website", name: "Docs", url: "https://example.com", categoryId: "coding" },
    { id: "web-1", now },
  );
  const result = deleteCategoryAndResources(
    categories,
    [web],
    [eventWithResources([web.id])],
    "coding",
  );

  assert.deepEqual(result.categories.map((item) => item.id), ["study"]);
  assert.deepEqual(result.resources, []);
  assert.deepEqual(result.events[0].resources, []);
  assert.throws(
    () => deleteCategoryAndResources(categories, [], [], TEMPORARY_CATEGORY_ID),
    /reserved/i,
  );
});

test("Navigation search keeps Resource type matching", () => {
  const website = createResource(
    { type: "website", name: "Docs", url: "https://example.com", categoryId: "coding" },
    { id: "web-1", now },
  );
  const application = createResource(
    { type: "application", name: "Editor", categoryId: "coding" },
    { id: "app-1", now },
  );
  assert.deepEqual(filterResources([website, application], "website").map((item) => item.id), ["web-1"]);
  assert.deepEqual(filterResources([website, application], "application").map((item) => item.id), ["app-1"]);
});

test("Edge category mapper keeps the v1.x name protocol and reserved IDs", () => {
  assert.deepEqual(categoriesForEdgeExtension(categories), ["Coding", "Study"]);
  assert.equal(categoryIdFromEdgeExtension("Study", categories), "study");
  assert.equal(categoryIdFromEdgeExtension("Missing", categories), UNCLASSIFIED_CATEGORY_ID);
  assert.equal(categoryIdFromEdgeExtension(TEMPORARY_CATEGORY_ID, categories), TEMPORARY_CATEGORY_ID);
});

test("AI permissions are explicit and can be disabled as one user action", () => {
  const disabled = disableAIInAllSituations();
  assert.equal(canUseAI(disabled, "calendar"), false);
  assert.equal(canUseAI(disabled, "category"), false);
  assert.equal(canUseAI(disabled, "planning"), false);
});

test("AI validators reject invented Categories and Resource IDs", () => {
  const web = createResource(
    { type: "website", name: "Docs", url: "https://example.com" },
    { id: "web-1", now },
  );
  assert.deepEqual(validateCategorySuggestion({ category: "Coding" }, categories), { categoryId: "coding" });
  assert.equal(validateCategorySuggestion({ category: "Invented" }, categories), null);
  assert.deepEqual(
    validateResourceSuggestion({ resourceIds: [web.id, "invented", web.id], reason: "Useful" }, [web]),
    { resourceIds: [web.id], reason: "Useful" },
  );
});

test("Confirmed Resource suggestion changes only the editable draft", () => {
  const original = {
    title: "Learn",
    category: "Coding",
    priority: "Medium",
    type: "task",
    date: "2026-07-15",
    startTime: "19:00",
    endTime: "20:00",
    resources: ["existing"],
  };
  const next = applyConfirmedResourceSuggestion(
    original,
    { resourceIds: ["suggested"], reason: "Useful" },
    "merge",
  );

  assert.deepEqual(original.resources, ["existing"]);
  assert.deepEqual(next.resources, ["existing", "suggested"]);
});

test("AI client checks permission before issuing a network request", async () => {
  let requested = false;
  await assert.rejects(
    requestAIText(aiSettings(), {
      purpose: "category",
      prompt: "Suggest a category",
      fetchImplementation: async () => {
        requested = true;
        return new Response();
      },
    }),
    AIPermissionError,
  );
  assert.equal(requested, false);
});

test("Custom Provider requires HTTPS and AI request remains read-only", async () => {
  const insecure = aiSettings({
    provider: "Custom",
    customProvider: { name: "Local", baseUrl: "http://localhost:1234/v1", model: "model" },
  });
  assert.throws(() => resolveProviderConfig(insecure), /HTTPS/);

  const settings = aiSettings();
  const snapshot = structuredClone(settings);
  const text = await requestAIText(settings, {
    purpose: "calendar",
    prompt: "Draft an Event",
    fetchImplementation: async () => new Response(
      JSON.stringify({ choices: [{ message: { content: "{\"event\":{}}" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  });
  assert.equal(text, "{\"event\":{}}");
  assert.deepEqual(settings, snapshot);
});

test("Settings operations keep a primary timezone and validate search URLs", () => {
  const settings = {
    username: "Nexus",
    zones: [{ label: "北京时间", zone: "Asia/Shanghai" }],
    theme: "dark",
    searchEngine: { label: "Google", url: "https://www.google.com/search?q={query}" },
  };
  const withZone = addClockZone(settings, { label: "旧金山时间", zone: "America/Los_Angeles" });
  const primaryChanged = setPrimaryClockZone(withZone, "America/Los_Angeles");
  assert.equal(primaryChanged.zones[0].zone, "America/Los_Angeles");
  assert.equal(removeClockZone({ ...settings, zones: [settings.zones[0]] }, "Asia/Shanghai").zones.length, 1);
  assert.equal(setSearchEngine(settings, { label: "Bing", url: "https://bing.com/search?q={query}" }).searchEngine.label, "Bing");
  assert.throws(() => setSearchEngine(settings, { label: "Unsafe", url: "javascript:{query}" }), /HTTP/i);
});

test("Platform adapters centralize Web/Desktop capabilities without Tauri", async () => {
  let opened = "";
  const browser = new BrowserPlatformAdapter((url) => { opened = url; });
  await browser.openExternalUrl("https://example.com/path");
  assert.equal(opened, "https://example.com/path");
  assert.equal(browser.supportsApplicationLaunch(), false);
  assert.equal(browser.supportsFileResources(), false);

  const desktop = new DesktopPlatformAdapter();
  assert.equal(desktop.supportsApplicationLaunch(), false);
  await assert.rejects(desktop.openExternalUrl("https://example.com"), /not been configured/i);
});
