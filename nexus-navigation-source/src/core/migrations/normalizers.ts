import type {
  AIPlannerSettings,
  AIUsagePermissions,
  ClockZone,
  EventPriority,
  EventSource,
  EventStatus,
  EventType,
  NexusEvent,
  RecurrenceRule,
  SearchEngine,
  Theme,
} from "../../shared/types";
import {
  DEFAULT_PROVIDER_CONFIGS,
  DEFAULT_TIMESTAMP,
  getDefaultAIPlanner,
  getDefaultSettings,
} from "../config";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function trimmedString(value: unknown, fallback = ""): string {
  const text = stringValue(value).trim();
  return text || fallback;
}

export function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function positiveInteger(
  value: unknown,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(maximum, Math.trunc(number)));
}

export function timestampValue(value: unknown, fallback = DEFAULT_TIMESTAMP): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return Number.isNaN(Date.parse(value)) ? fallback : value;
}

export function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function uniqueId(
  preferred: unknown,
  fallbackSeed: string,
  used: Set<string>,
  prefix: string,
): string {
  const base = trimmedString(preferred, `${prefix}-${stableHash(fallbackSeed)}`);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function validDate(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

function validTime(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return fallback;
  return value;
}

function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function minutesBetween(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return Math.max(1, endHour * 60 + endMinute - startHour * 60 - startMinute);
}

function timeAfter(startTime: string, duration: number): string {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, startHour * 60 + startMinute + duration);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function normalizePriority(value: unknown): EventPriority {
  if (value === "High" || value === "高") return "High";
  if (value === "Low" || value === "低") return "Low";
  return "Medium";
}

function normalizeEventType(value: unknown): EventType {
  return value === "schedule" ? "schedule" : "task";
}

function normalizeStatus(value: unknown, completed: unknown): EventStatus {
  if (value === "completed" || completed === true) return "completed";
  if (value === "unfinished") return "unfinished";
  return "pending";
}

const EVENT_SOURCES = new Set<EventSource>([
  "local",
  "calendar",
  "google-calendar",
  "outlook-calendar",
  "apple-calendar",
  "microsoft-todo",
  "ai-suggestion",
]);

function normalizeSource(value: unknown): EventSource {
  return EVENT_SOURCES.has(value as EventSource) ? (value as EventSource) : "local";
}

function normalizeRecurrence(value: unknown): RecurrenceRule | undefined {
  if (!isRecord(value) || (value.unit !== "week" && value.unit !== "month")) return undefined;
  return {
    unit: value.unit,
    interval: positiveInteger(value.interval, 1, 52),
    count: positiveInteger(value.count, 1, 52),
    seriesId: trimmedString(
      value.seriesId,
      `series-${stableHash(JSON.stringify(value))}`,
    ),
  };
}

export function normalizeEvents(value: unknown, fallback: NexusEvent[]): NexusEvent[] {
  if (!Array.isArray(value)) return fallback.map((event) => ({ ...event, resources: [...event.resources] }));
  const usedIds = new Set<string>();
  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const title = trimmedString(entry.title ?? entry.name, `Event ${index + 1}`);
    const date = validDate(entry.date, localDate());
    const startTime = validTime(entry.startTime, "09:00");
    const storedDuration = positiveInteger(entry.duration, 60);
    const endTime = validTime(entry.endTime, timeAfter(startTime, storedDuration));
    const id = uniqueId(
      entry.id,
      `${title}|${date}|${startTime}|${index}`,
      usedIds,
      "event",
    );
    const resources = Array.isArray(entry.resources)
      ? [...new Set(entry.resources.filter((resource): resource is string => typeof resource === "string" && Boolean(resource)))]
      : [];
    const recurrence = normalizeRecurrence(entry.recurrence);
    const event: NexusEvent = {
      id,
      title,
      category: trimmedString(entry.category, "其他"),
      priority: normalizePriority(entry.priority),
      type: normalizeEventType(entry.type),
      date,
      startTime,
      endTime,
      duration: positiveInteger(entry.duration, minutesBetween(startTime, endTime)),
      status: normalizeStatus(entry.status, entry.completed),
      source: normalizeSource(entry.source),
      resources,
      ...(recurrence ? { recurrence } : {}),
      ...(typeof entry.externalId === "string" ? { externalId: entry.externalId } : {}),
      ...(typeof entry.importedAt === "string" ? { importedAt: entry.importedAt } : {}),
    };
    return [event];
  });
}

export function focusTasksToEvents(value: unknown): NexusEvent[] {
  if (!Array.isArray(value)) return [];
  const date = localDate();
  return normalizeEvents(
    value.map((entry, index) => {
      const task = isRecord(entry) ? entry : {};
      const startHour = Math.min(23, 9 + index * 2);
      const minutes = positiveInteger(task.minutes, 60);
      const startTime = `${String(startHour).padStart(2, "0")}:00`;
      const endMinutes = Math.min(23 * 60 + 59, startHour * 60 + minutes);
      return {
        id: task.id,
        title: task.title,
        category: task.category,
        priority: task.priority,
        type: "task",
        date,
        startTime,
        endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`,
        duration: minutes,
        status: task.completed === true ? "completed" : "pending",
        source: "local",
        resources: [],
      };
    }),
    [],
  );
}

export function normalizeZones(value: unknown): ClockZone[] {
  const fallback = getDefaultSettings().zones;
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const zones = value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const zone = trimmedString(entry.zone);
    if (!zone || seen.has(zone)) return [];
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
    } catch {
      return [];
    }
    seen.add(zone);
    return [{ label: trimmedString(entry.label, zone), zone }];
  });
  return zones.length ? zones : fallback;
}

export function normalizeTheme(value: unknown): Theme {
  return value === "light" ? "light" : "dark";
}

export function normalizeSearchEngine(value: unknown): SearchEngine {
  const fallback = getDefaultSettings().searchEngine;
  if (!isRecord(value)) return fallback;
  const label = trimmedString(value.label);
  const url = trimmedString(value.url);
  return label && url.includes("{query}") ? { label, url } : fallback;
}

export function normalizePermissions(value: unknown): AIUsagePermissions {
  const permissions = isRecord(value) ? value : {};
  return {
    calendar: typeof permissions.calendar === "boolean" ? permissions.calendar : true,
    category: typeof permissions.category === "boolean" ? permissions.category : false,
    planning: typeof permissions.planning === "boolean" ? permissions.planning : false,
  };
}

export function normalizeAIPlanner(value: unknown): AIPlannerSettings {
  const fallback = getDefaultAIPlanner();
  if (!isRecord(value)) return fallback;
  const custom = isRecord(value.customProvider) ? value.customProvider : {};
  const provider = trimmedString(value.provider, fallback.provider);
  const providerModel = DEFAULT_PROVIDER_CONFIGS[provider]?.model ?? fallback.model;
  return {
    provider,
    apiKey: stringValue(value.apiKey, ""),
    model: trimmedString(value.model ?? value.modelId, providerModel),
    customProvider: {
      name: stringValue(custom.name, ""),
      baseUrl: stringValue(custom.baseUrl, ""),
      model: stringValue(custom.model ?? custom.modelId, ""),
    },
    permissions: normalizePermissions(value.permissions),
  };
}
