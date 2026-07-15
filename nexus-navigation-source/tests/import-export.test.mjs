import test from "node:test";
import assert from "node:assert/strict";

import {
  createExternalEvent,
  parseCsv,
  parseIcs,
  parseImportText,
  parseJson,
} from "../src/modules/import-export/parsers/calendarParsers.ts";
import {
  filterAlreadyImportedEvents,
  filterEventsByDateRange,
  prepareImportPreview,
} from "../src/modules/import-export/domain/importFilters.ts";
import {
  parseNexusBackup,
  restoreNexusData,
  serializeNexusData,
} from "../src/modules/import-export/services/backupService.ts";

function context(resourceIds = []) {
  let next = 0;
  return {
    createId: () => `import-${++next}`,
    now: () => new Date("2026-07-15T12:00:00.000Z"),
    resourceIds,
  };
}

function event(overrides = {}) {
  return {
    id: "event-1",
    title: "Imported",
    category: "Imported",
    priority: "Medium",
    type: "schedule",
    date: "2026-07-15",
    startTime: "09:00",
    endTime: "10:00",
    duration: 60,
    status: "pending",
    source: "apple-calendar",
    resources: [],
    ...overrides,
  };
}

test("ICS parsing keeps v17 weekly COUNT expansion and Resource IDs empty", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:rust-series",
    "SUMMARY:Rust Learning",
    "CATEGORIES:Coding",
    "DTSTART:20260715T190000",
    "DTEND:20260715T203000",
    "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=3",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const result = parseIcs(ics, "apple-calendar", context());
  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map((item) => item.date),
    ["2026-07-15", "2026-07-29", "2026-08-12"],
  );
  assert.equal(result[0].duration, 90);
  assert.deepEqual(result[0].resources, []);
  assert.equal(result[0].externalId, "apple-calendar:rust-series:0");
});

test("CSV parsing supports quoted values and completed Microsoft To Do rows", () => {
  const csv = [
    "Title,Due Date,Start Time,End Time,Status,List",
    '"Read, annotate paper",2026-07-16,09:00,10:30,completed,Research',
  ].join("\n");
  const result = parseCsv(csv, "microsoft-todo", context());

  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Read, annotate paper");
  assert.equal(result[0].status, "completed");
  assert.equal(result[0].category, "Research");
  assert.equal(result[0].duration, 90);
});

test("JSON parsing retains only IDs of Resources that already exist", () => {
  const result = parseJson(
    JSON.stringify({
      tasks: [
        {
          id: "todo-1",
          title: "Learn C++",
          date: "2026-07-17",
          resources: ["cppreference", "missing", "vscode"],
        },
      ],
    }),
    "microsoft-todo",
    context(["cppreference", "vscode"]),
  );

  assert.deepEqual(result[0].resources, ["cppreference", "vscode"]);
  assert.equal(typeof result[0].resources[0], "string");
});

test("extension routing stays local and rejects unsupported formats", () => {
  const csv = "Title,Date\nTask,2026-07-18";
  assert.equal(
    parseImportText(csv, "tasks.csv", "microsoft-todo", context()).length,
    1,
  );
  assert.deepEqual(
    parseImportText(csv, "tasks.txt", "microsoft-todo", context()),
    [],
  );
});

test("date range and existing-event duplicate filtering match v17", () => {
  const candidates = [
    event({ id: "a", date: "2026-07-10", externalId: "source:a" }),
    event({ id: "b", date: "2026-07-15", externalId: "source:b" }),
    event({ id: "c", date: "2026-07-20", externalId: "source:c" }),
  ];
  const existing = [event({ id: "old", externalId: "source:b" })];

  assert.deepEqual(
    filterEventsByDateRange(candidates, "2026-07-12", "2026-07-20").map(
      (item) => item.id,
    ),
    ["b", "c"],
  );
  assert.deepEqual(
    filterAlreadyImportedEvents(candidates, existing).map((item) => item.id),
    ["a", "c"],
  );
  const preview = prepareImportPreview(
    candidates,
    existing,
    "2026-07-12",
    "2026-07-20",
  );
  assert.deepEqual(preview.unique.map((item) => item.id), ["c"]);
  assert.equal(preview.duplicateCount, 1);
});

test("account events are converted without embedding Resource content", () => {
  const result = createExternalEvent(
    {
      id: "google-1",
      title: "Engineering Mathematics",
      start: new Date("2026-07-18T09:00:00"),
      end: new Date("2026-07-18T10:30:00"),
    },
    "google-calendar",
    context(),
  );

  assert.equal(result.duration, 90);
  assert.deepEqual(result.resources, []);
  assert.equal(result.externalId, "google-calendar:google-1");
});

test("backup helpers serialize data and delegate migration during restore", () => {
  const data = {
    schemaVersion: 1,
    settings: {
      username: "Nexus User",
      zones: [],
      theme: "dark",
      searchEngine: { label: "Google", url: "https://google.com?q={query}" },
    },
    categories: [],
    resources: [],
    events: [],
    aiPlanner: {
      provider: "OpenAI",
      apiKey: "",
      model: "gpt-4.1-mini",
      customProvider: { name: "", baseUrl: "", model: "" },
      permissions: { calendar: true, category: false, planning: false },
    },
  };

  const raw = serializeNexusData(data);
  assert.equal(parseNexusBackup(raw).schemaVersion, 1);
  const restored = restoreNexusData(raw, (value) => ({
    ...value,
    schemaVersion: 2,
  }));
  assert.equal(restored.schemaVersion, 2);
  assert.throws(() => parseNexusBackup("[]"), /JSON object/);
});
