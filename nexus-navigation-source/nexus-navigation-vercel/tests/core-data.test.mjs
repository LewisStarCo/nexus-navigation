import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// The application uses extensionless TypeScript imports for Next.js. This
// targeted Node test adds only the matching `.ts` resolution used by the
// built-in type stripper; production resolution is unchanged.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (/^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw error;
    }
  },
});

const config = await import("../src/core/config/index.ts");
const migrations = await import("../src/core/migrations/index.ts");
const storageModule = await import("../src/core/storage/index.ts");

const {
  CURRENT_SCHEMA_VERSION,
  NEXUS_STORAGE_KEY,
  getDefaultNexusData,
} = config;
const {
  migrateToCurrent,
  UnsupportedSchemaVersionError,
} = migrations;
const {
  InvalidNexusDataError,
  LocalStorageAdapter,
  NexusDataRepository,
} = storageModule;

class MemoryStorage {
  values = new Map();
  writes = [];

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, value);
    this.writes.push({ key, value });
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));

test("default data is a complete current NexusData value", () => {
  const data = getDefaultNexusData(new Date("2026-07-15T12:00:00+08:00"));
  assert.equal(data.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(data.settings.theme, "dark");
  assert.ok(data.categories.length > 0);
  assert.ok(data.resources.every((resource) => resource.type === "website"));
  assert.ok(data.events.every((event) => Array.isArray(event.resources)));
  assert.deepEqual(data.aiPlanner.permissions, {
    calendar: true,
    category: false,
    planning: false,
  });
});

test("unversioned v17 data migrates through resources, settings, events and AI", () => {
  const legacy = {
    username: "Lewis",
    zones: [{ label: "东京", zone: "Asia/Tokyo" }],
    theme: "light",
    searchEngine: {
      label: "Bing",
      url: "https://www.bing.com/search?q={query}",
    },
    categories: ["Coding", "Study"],
    resources: [
      {
        id: "web-1",
        title: "cppreference",
        url: "https://en.cppreference.com/",
        category: "Coding",
        order: 4,
      },
      {
        id: "app-1",
        title: "VS Code",
        type: "application",
        appIdentifier: "com.microsoft.VSCode",
        category: "Coding",
      },
    ],
    // `resources` must win over the duplicate compatibility alias.
    links: [{ id: "obsolete", title: "Do not merge", url: "https://invalid.test" }],
    events: [
      {
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
      },
    ],
    aiPlanner: {
      provider: "Qwen",
      apiKey: "local-key",
      model: "qwen-plus",
      permissions: { category: true },
    },
  };

  const data = migrateToCurrent(legacy);
  assert.equal(data.schemaVersion, 2);
  assert.equal(data.settings.username, "Lewis");
  assert.equal(data.settings.zones[0].zone, "Asia/Tokyo");
  assert.equal(data.settings.searchEngine.label, "Bing");
  assert.deepEqual(data.resources.map((resource) => resource.id), ["app-1", "web-1"]);
  assert.equal(data.resources.some((resource) => resource.id === "obsolete"), false);
  assert.equal(data.resources.find((resource) => resource.id === "web-1").name, "cppreference");
  assert.equal(data.resources.find((resource) => resource.id === "app-1").type, "application");
  assert.equal(data.events[0].resources.length, 0);
  assert.equal(data.aiPlanner.provider, "Qwen");
  assert.equal(data.aiPlanner.apiKey, "local-key");
  assert.deepEqual(data.aiPlanner.permissions, {
    calendar: true,
    category: true,
    planning: false,
  });
  const coding = data.categories.find((category) => category.name === "Coding");
  assert.ok(coding);
  assert.ok(data.resources.every((resource) => resource.categoryId === coding.id));
});

test("legacy links and focusTasks receive stable IDs and preserve content", () => {
  const legacy = {
    links: [
      { title: "A", url: "https://a.example", category: "Custom" },
      { title: "B", url: "https://b.example", category: "Custom" },
    ],
    focusTasks: [
      {
        id: "focus-1",
        title: "Read",
        category: "Study",
        minutes: 45,
        priority: "高",
        completed: true,
      },
    ],
  };
  const first = migrateToCurrent(legacy);
  const second = migrateToCurrent(legacy);
  assert.deepEqual(first, second);
  assert.equal(first.resources.length, 2);
  assert.ok(first.resources.every((resource) => resource.id.startsWith("resource-")));
  assert.equal(first.categories.some((category) => category.name === "Custom"), true);
  assert.equal(first.events[0].id, "focus-1");
  assert.equal(first.events[0].status, "completed");
  assert.equal(first.events[0].duration, 45);
});

test("legacy Events with an empty end time rebuild it from duration", () => {
  const data = migrateToCurrent({
    categories: [],
    resources: [],
    events: [{
      id: "legacy-focus-event",
      title: "Afternoon study",
      date: "2026-07-15",
      startTime: "15:00",
      endTime: "",
      duration: 60,
      status: "pending",
    }],
  });
  assert.equal(data.events[0].startTime, "15:00");
  assert.equal(data.events[0].endTime, "16:00");
  assert.equal(data.events[0].duration, 60);
});

test("explicitly empty legacy collections remain empty", () => {
  const data = migrateToCurrent({
    categories: [],
    resources: [],
    events: [],
  });
  assert.deepEqual(data.categories, []);
  assert.deepEqual(data.resources, []);
  assert.deepEqual(data.events, []);
});

test("current schema normalization is idempotent and retains dangling resource IDs", () => {
  const current = getDefaultNexusData(new Date("2026-07-15T12:00:00+08:00"));
  current.events[0].resources = [current.resources[0].id, "future-resource-id"];
  const once = migrateToCurrent(current);
  const twice = migrateToCurrent(once);
  assert.deepEqual(twice, once);
  assert.deepEqual(once.events[0].resources, [current.resources[0].id, "future-resource-id"]);
});

test("future schemas are rejected instead of downgraded", () => {
  assert.throws(
    () => migrateToCurrent({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    UnsupportedSchemaVersionError,
  );
});

test("LocalStorageAdapter uses the stable key and serializes saves", async () => {
  const memory = new MemoryStorage();
  const adapter = new LocalStorageAdapter(memory);
  const first = getDefaultNexusData();
  const second = clone(first);
  first.settings.username = "first";
  second.settings.username = "second";

  await Promise.all([adapter.save(first), adapter.save(second)]);
  const loaded = await adapter.load();
  assert.equal(loaded.settings.username, "second");
  assert.ok(memory.writes.every((write) => write.key === NEXUS_STORAGE_KEY));
});

test("invalid stored JSON is reported without overwriting the original", async () => {
  const memory = new MemoryStorage();
  memory.values.set(NEXUS_STORAGE_KEY, "{broken");
  const adapter = new LocalStorageAdapter(memory);
  await assert.rejects(() => adapter.load(), InvalidNexusDataError);
  assert.equal(memory.getItem(NEXUS_STORAGE_KEY), "{broken");
  assert.equal(memory.writes.length, 0);
});

test("unrelated JSON objects are not accepted as stored data or backups", async () => {
  const memory = new MemoryStorage();
  const unrelated = JSON.stringify({ foo: "bar" });
  memory.values.set(NEXUS_STORAGE_KEY, unrelated);
  const adapter = new LocalStorageAdapter(memory);

  await assert.rejects(() => adapter.load(), InvalidNexusDataError);
  assert.equal(memory.getItem(NEXUS_STORAGE_KEY), unrelated);
  assert.equal(memory.writes.length, 0);

  const existing = getDefaultNexusData();
  existing.settings.username = "keep me";
  memory.values.set(NEXUS_STORAGE_KEY, JSON.stringify(existing));
  const before = memory.getItem(NEXUS_STORAGE_KEY);
  await assert.rejects(() => adapter.importData(unrelated), InvalidNexusDataError);
  assert.equal(memory.getItem(NEXUS_STORAGE_KEY), before);
});

test("missing Provider model uses the selected Provider default", () => {
  const data = migrateToCurrent({
    categories: [],
    resources: [],
    events: [],
    aiPlanner: { provider: "Qwen", permissions: {} },
  });
  assert.equal(data.aiPlanner.provider, "Qwen");
  assert.equal(data.aiPlanner.model, "qwen-plus");
});

test("invalid and future imports leave existing data unchanged", async () => {
  const memory = new MemoryStorage();
  const adapter = new LocalStorageAdapter(memory);
  const data = getDefaultNexusData();
  data.settings.username = "keep me";
  await adapter.save(data);
  const before = memory.getItem(NEXUS_STORAGE_KEY);

  await assert.rejects(() => adapter.importData("not json"), InvalidNexusDataError);
  assert.equal(memory.getItem(NEXUS_STORAGE_KEY), before);
  await assert.rejects(
    () => adapter.importData(JSON.stringify({ schemaVersion: 999 })),
    UnsupportedSchemaVersionError,
  );
  assert.equal(memory.getItem(NEXUS_STORAGE_KEY), before);
});

test("export, clear and import round-trip canonical Nexus data", async () => {
  const memory = new MemoryStorage();
  const adapter = new LocalStorageAdapter(memory);
  const data = getDefaultNexusData();
  data.settings.username = "round trip";
  await adapter.save(data);
  const backup = await adapter.exportData();
  await adapter.clear();
  assert.equal(memory.getItem(NEXUS_STORAGE_KEY), null);
  const imported = await adapter.importData(backup);
  assert.equal(imported.settings.username, "round trip");
  assert.deepEqual(await adapter.load(), imported);
});

test("NexusDataRepository serializes asynchronous read-modify-write updates", async () => {
  const memory = new MemoryStorage();
  const adapter = new LocalStorageAdapter(memory);
  const repository = new NexusDataRepository(adapter);
  await repository.save(getDefaultNexusData());

  await Promise.all([
    repository.update(async (draft) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      draft.settings.username = "updated";
    }),
    repository.update((draft) => {
      draft.settings.theme = "light";
    }),
  ]);

  const loaded = await repository.load();
  assert.equal(loaded.settings.username, "updated");
  assert.equal(loaded.settings.theme, "light");
});
