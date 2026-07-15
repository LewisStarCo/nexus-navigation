import test from "node:test";
import assert from "node:assert/strict";

import {
  generateRecurringEvents,
  findEventConflicts,
  markPastPendingEventsUnfinished,
  moveEvent,
  toggleEventCompletion,
  updateCurrentEvent,
  validateEventDraft,
} from "../src/modules/calendar/domain/eventDomain.ts";
import {
  getTodayProgress,
  getWeeklyProgress,
  selectTodayEvents,
  selectWeekEvents,
} from "../src/modules/focus/domain/focusDomain.ts";

function idFactory(prefix = "id") {
  let next = 0;
  return () => `${prefix}-${++next}`;
}

function draft(overrides = {}) {
  return {
    title: "Learn Rust",
    category: "Coding",
    date: "2026-07-13",
    startTime: "19:00",
    endTime: "20:30",
    priority: "High",
    type: "task",
    resources: ["rust-book", "missing", "vscode"],
    repeatUnit: "none",
    repeatInterval: 1,
    repeatCount: 8,
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    id: "event-1",
    title: "Learn Rust",
    category: "Coding",
    priority: "High",
    type: "task",
    date: "2026-07-13",
    startTime: "19:00",
    endTime: "20:30",
    duration: 90,
    status: "pending",
    source: "local",
    resources: ["rust-book"],
    ...overrides,
  };
}

test("a non-recurring draft creates one event and stores Resource IDs only", () => {
  const result = generateRecurringEvents(draft(), "local", {
    createId: idFactory(),
    resourceIds: ["rust-book", "vscode"],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].duration, 90);
  assert.deepEqual(result[0].resources, ["rust-book", "vscode"]);
  assert.equal(result[0].recurrence, undefined);
  assert.equal(typeof result[0].resources[0], "string");
});

test("weekly recurrence keeps the interval and is capped at 52 occurrences", () => {
  const result = generateRecurringEvents(
    draft({ repeatUnit: "week", repeatInterval: 2, repeatCount: 100 }),
    "local",
    { createId: idFactory(), resourceIds: [] },
  );

  assert.equal(result.length, 52);
  assert.deepEqual(
    result.slice(0, 3).map((item) => item.date),
    ["2026-07-13", "2026-07-27", "2026-08-10"],
  );
  assert.equal(result[0].recurrence.interval, 2);
  assert.equal(result[0].recurrence.count, 52);
  assert.equal(result[0].recurrence.seriesId, result[51].recurrence.seriesId);
});

test("monthly recurrence retains v17 Date#setMonth end-of-month rollover", () => {
  const result = generateRecurringEvents(
    draft({
      date: "2026-01-31",
      repeatUnit: "month",
      repeatInterval: 1,
      repeatCount: 3,
    }),
    "local",
    { createId: idFactory(), resourceIds: [] },
  );

  assert.deepEqual(
    result.map((item) => item.date),
    ["2026-01-31", "2026-03-03", "2026-03-31"],
  );
});

test("editing a recurring occurrence updates only that occurrence", () => {
  const series = generateRecurringEvents(
    draft({ repeatUnit: "week", repeatCount: 2 }),
    "local",
    { createId: idFactory("series"), resourceIds: ["rust-book"] },
  );
  const originalSibling = series[1];
  const current = { ...series[0], status: "completed" };
  const updated = updateCurrentEvent(
    current,
    {
      title: "Adjusted Rust",
      category: "Coding",
      date: "2026-07-14",
      startTime: "20:00",
      endTime: "21:00",
      priority: "Medium",
      type: "task",
      resources: ["rust-book"],
    },
    { createId: idFactory("edit"), resourceIds: ["rust-book"] },
  );

  assert.equal(updated.id, current.id);
  assert.equal(updated.status, "completed");
  assert.equal(updated.source, current.source);
  assert.deepEqual(updated.recurrence, current.recurrence);
  assert.equal(updated.title, "Adjusted Rust");
  assert.equal(updated.duration, 60);
  assert.deepEqual(series[1], originalSibling);
});

test("dragging moves tasks but leaves fixed schedules unchanged", () => {
  const task = event({ id: "task", duration: 90 });
  const schedule = event({ id: "schedule", type: "schedule" });

  const movedTask = moveEvent([task, schedule], "task", "2026-07-16", 22);
  assert.equal(movedTask[0].date, "2026-07-16");
  assert.equal(movedTask[0].startTime, "22:00");
  assert.equal(movedTask[0].endTime, "23:30");

  const movedSchedule = moveEvent(
    [task, schedule],
    "schedule",
    "2026-07-16",
    10,
  );
  assert.strictEqual(movedSchedule[1], schedule);
});

test("legacy unfinished and completion rules remain stable", () => {
  const pendingPast = event({ id: "past", date: "2026-07-12" });
  const pendingToday = event({ id: "today", date: "2026-07-13" });
  const result = markPastPendingEventsUnfinished(
    [pendingPast, pendingToday],
    "2026-07-13",
  );

  assert.equal(result[0].status, "unfinished");
  assert.equal(result[1].status, "pending");
  assert.equal(toggleEventCompletion(result[0]).status, "completed");
  assert.equal(
    toggleEventCompletion({ ...result[0], status: "completed" }).status,
    "pending",
  );
});

test("event validation preserves the v17 title requirement", () => {
  assert.equal(validateEventDraft(draft()).valid, true);
  assert.equal(validateEventDraft(draft({ title: "   " })).valid, false);
});

test("conflict detection warns on overlap but allows touching boundaries", () => {
  const existing = event({ id: "existing", startTime: "15:00", endTime: "16:00" });
  const overlapping = event({ id: "new", startTime: "15:30", endTime: "16:30" });
  const adjacent = event({ id: "next", startTime: "16:00", endTime: "17:00" });

  assert.deepEqual(findEventConflicts([overlapping], [existing]), [{
    proposedId: "new",
    existingId: "existing",
    date: "2026-07-13",
    overlapStart: "15:30",
    overlapEnd: "16:00",
  }]);
  assert.deepEqual(findEventConflicts([adjacent], [existing]), []);
});

test("conflict detection ignores the edited occurrence but still finds other events", () => {
  const edited = event({ id: "edited", startTime: "15:00", endTime: "16:00" });
  const another = event({ id: "another", startTime: "15:45", endTime: "17:00" });

  assert.equal(findEventConflicts([edited], [edited, another], { ignoreEventIds: ["edited"] }).length, 1);
  assert.equal(findEventConflicts([edited], [edited], { ignoreEventIds: ["edited"] }).length, 0);
});

test("Today's Focus selectors and progress use local date and Monday week", () => {
  const events = [
    event({ id: "late", date: "2026-07-15", startTime: "20:00" }),
    event({
      id: "early",
      date: "2026-07-15",
      startTime: "09:00",
      status: "completed",
    }),
    event({ id: "monday", date: "2026-07-13", status: "completed" }),
    event({ id: "sunday", date: "2026-07-19" }),
    event({ id: "next-monday", date: "2026-07-20" }),
  ];

  assert.deepEqual(
    selectTodayEvents(events, "2026-07-15").map((item) => item.id),
    ["early", "late"],
  );
  assert.deepEqual(getTodayProgress(events, "2026-07-15"), {
    completed: 1,
    remaining: 1,
    total: 2,
    percent: 50,
  });
  assert.deepEqual(
    selectWeekEvents(events, new Date("2026-07-15T12:00:00")).map(
      (item) => item.id,
    ),
    ["late", "early", "monday", "sunday"],
  );
  assert.deepEqual(
    getWeeklyProgress(events, new Date("2026-07-15T12:00:00")),
    { completed: 2, remaining: 2, total: 4, percent: 50 },
  );
});
