import type { NexusEvent } from "../../../shared/types";
import type {
  ExternalEventInput,
  ImportParseContext,
  ImportSource,
} from "../types";

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function parseCalendarDate(
  value: string,
  fallbackDate = new Date(),
): { date: string; time: string } {
  const clean = value.trim();
  if (/^\d{8}$/.test(clean)) {
    return {
      date: `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`,
      time: "09:00",
    };
  }
  if (/^\d{8}T\d{6}Z$/.test(clean)) {
    const date = new Date(
      `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}Z`,
    );
    return {
      date: dateKey(date),
      time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
    };
  }
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  return match
    ? {
        date: `${match[1]}-${match[2]}-${match[3]}`,
        time: `${match[4]}:${match[5]}`,
      }
    : { date: dateKey(fallbackDate), time: "09:00" };
}

export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

function importedAt(context: ImportParseContext): string {
  return context.now().toISOString();
}

export function parseIcs(
  text: string,
  source: ImportSource,
  context: ImportParseContext,
): NexusEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded
    .split("BEGIN:VEVENT")
    .slice(1)
    .map((part) => part.split("END:VEVENT")[0]);
  const events: NexusEvent[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const find = (name: string): string => {
      const line = lines.find(
        (candidate) => candidate.split(":")[0].split(";")[0] === name,
      );
      return line?.slice((line || "").indexOf(":") + 1) || "";
    };
    const start = parseCalendarDate(find("DTSTART"), context.now());
    const rawEnd = find("DTEND");
    const end = rawEnd
      ? parseCalendarDate(rawEnd, context.now())
      : {
          date: start.date,
          time: minutesToTime(
            Number(start.time.slice(0, 2)) * 60 +
              Number(start.time.slice(3)) +
              60,
          ),
        };
    const uid = find("UID") || `${find("SUMMARY")}-${start.date}-${start.time}`;
    const base: NexusEvent = {
      id: context.createId(),
      title:
        find("SUMMARY").replace(/\\,/g, ",").replace(/\\n/g, " ") ||
        "Imported Event",
      category: find("CATEGORIES").replace(/\\,/g, ",") || "Imported",
      priority: "Medium",
      type: "schedule",
      resources: [],
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      duration: Math.max(
        1,
        Number(end.time.slice(0, 2)) * 60 +
          Number(end.time.slice(3)) -
          Number(start.time.slice(0, 2)) * 60 -
          Number(start.time.slice(3)),
      ),
      status: "pending",
      source,
      externalId: `${source}:${uid}`,
      importedAt: importedAt(context),
    };

    const rule = find("RRULE");
    const frequency = rule.match(/FREQ=(WEEKLY|MONTHLY)/)?.[1];
    const interval = Number(rule.match(/INTERVAL=(\d+)/)?.[1] || 1);
    const count = Math.min(
      52,
      Number(rule.match(/COUNT=(\d+)/)?.[1] || 1),
    );

    if (frequency && count > 1) {
      const seriesId = context.createId();
      for (let index = 0; index < count; index += 1) {
        const date = new Date(`${start.date}T12:00:00`);
        if (frequency === "WEEKLY") {
          date.setDate(date.getDate() + index * interval * 7);
        } else {
          date.setMonth(date.getMonth() + index * interval);
        }
        events.push({
          ...base,
          id: context.createId(),
          date: dateKey(date),
          externalId: `${source}:${uid}:${index}`,
          recurrence: {
            unit: frequency === "WEEKLY" ? "week" : "month",
            interval,
            count,
            seriesId,
          },
        });
      }
    } else {
      events.push(base);
    }
  }
  return events;
}

export function parseCsv(
  text: string,
  source: ImportSource,
  context: ImportParseContext,
): NexusEvent[] {
  const rows = csvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((item) =>
    item.trim().toLowerCase().replace(/[ _-]/g, ""),
  );
  const get = (row: string[], names: string[]): string => {
    const index = headers.findIndex((header) => names.includes(header));
    return index >= 0 ? (row[index] || "").trim() : "";
  };

  return rows.slice(1).map((row, index) => {
    const title =
      get(row, ["subject", "title", "taskname", "name", "任务", "标题"]) ||
      `Imported Task ${index + 1}`;
    const rawDate = get(row, [
      "duedate",
      "date",
      "startdate",
      "到期日期",
      "日期",
    ]);
    const date = rawDate
      ? dateKey(new Date(`${rawDate} 12:00`))
      : dateKey(context.now());
    const startTime =
      get(row, ["starttime", "time", "开始时间"]) || "09:00";
    const endTime =
      get(row, ["endtime", "duetime", "结束时间"]) ||
      minutesToTime(
        Number(startTime.slice(0, 2)) * 60 +
          Number(startTime.slice(3)) +
          60,
      );
    const statusText = get(row, [
      "status",
      "completed",
      "完成状态",
    ]).toLowerCase();

    return {
      id: context.createId(),
      title,
      category:
        get(row, ["categories", "category", "list", "分类", "列表"]) ||
        "Microsoft To Do",
      priority: "Medium",
      type: "task",
      resources: [],
      date,
      startTime,
      endTime,
      duration: Math.max(
        1,
        Number(endTime.slice(0, 2)) * 60 +
          Number(endTime.slice(3)) -
          Number(startTime.slice(0, 2)) * 60 -
          Number(startTime.slice(3)),
      ),
      status: ["completed", "complete", "true", "yes", "已完成"].includes(
        statusText,
      )
        ? "completed"
        : "pending",
      source,
      externalId: `${source}:${title}:${date}:${index}`,
      importedAt: importedAt(context),
    } satisfies NexusEvent;
  });
}

export function parseJson(
  text: string,
  source: ImportSource,
  context: ImportParseContext,
): NexusEvent[] {
  const data: unknown = JSON.parse(text);
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const list = Array.isArray(data)
    ? data
    : Array.isArray(record.events)
      ? record.events
      : Array.isArray(record.tasks)
        ? record.tasks
        : [];
  const allowedResources = new Set(context.resourceIds);

  return list.map((rawItem, index) => {
    const item =
      rawItem && typeof rawItem === "object"
        ? (rawItem as Record<string, unknown>)
        : {};
    const title = String(
      item.title || item.subject || item.name || `Imported Task ${index + 1}`,
    );
    const date = String(
      item.date || item.dueDate || item.due || dateKey(context.now()),
    ).slice(0, 10);
    const startTime = String(item.startTime || "09:00").slice(0, 5);
    const endTime = String(item.endTime || "10:00").slice(0, 5);
    const linkedResources = Array.isArray(item.resources)
      ? item.resources.filter(
          (id): id is string =>
            typeof id === "string" &&
            allowedResources.has(id),
        )
      : [];

    return {
      id: context.createId(),
      title,
      category: String(item.category || item.list || "Imported"),
      priority: ["High", "Medium", "Low"].includes(String(item.priority))
        ? (item.priority as NexusEvent["priority"])
        : "Medium",
      type: item.type === "schedule" ? "schedule" : "task",
      resources: linkedResources,
      date,
      startTime,
      endTime,
      duration: Math.max(
        1,
        Number(endTime.slice(0, 2)) * 60 +
          Number(endTime.slice(3)) -
          Number(startTime.slice(0, 2)) * 60 -
          Number(startTime.slice(3)),
      ),
      status:
        item.status === "completed" || item.completed === true
          ? "completed"
          : "pending",
      source,
      externalId: `${source}:${String(item.id || title)}:${date}`,
      importedAt: importedAt(context),
    } satisfies NexusEvent;
  });
}

export function parseImportText(
  text: string,
  fileName: string,
  source: ImportSource,
  context: ImportParseContext,
): NexusEvent[] {
  const normalizedName = fileName.toLowerCase();
  if (normalizedName.endsWith(".ics")) return parseIcs(text, source, context);
  if (normalizedName.endsWith(".csv")) return parseCsv(text, source, context);
  if (normalizedName.endsWith(".json")) return parseJson(text, source, context);
  return [];
}

export function createExternalEvent(
  input: ExternalEventInput,
  source: ImportSource,
  context: ImportParseContext,
): NexusEvent {
  const end = input.end || new Date(input.start.getTime() + 60 * 60 * 1000);
  return {
    id: context.createId(),
    title: input.title || "Imported Event",
    category:
      input.category ||
      (source === "microsoft-todo"
        ? "Microsoft To Do"
        : "Imported Calendar"),
    priority: "Medium",
    type:
      input.type || (source === "microsoft-todo" ? "task" : "schedule"),
    resources: [],
    date: dateKey(input.start),
    startTime: `${String(input.start.getHours()).padStart(2, "0")}:${String(input.start.getMinutes()).padStart(2, "0")}`,
    endTime: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
    duration: Math.max(
      1,
      Math.round((end.getTime() - input.start.getTime()) / 60000),
    ),
    status: input.completed ? "completed" : "pending",
    source,
    externalId: `${source}:${input.id}`,
    importedAt: importedAt(context),
  };
}
