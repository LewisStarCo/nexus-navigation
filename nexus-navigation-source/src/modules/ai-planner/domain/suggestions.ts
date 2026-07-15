import type { Category, EventDraft, NexusEvent, Resource } from "@/src/shared/types";

export interface CategorySuggestion {
  categoryId: string;
}

export interface ResourceSuggestion {
  resourceIds: string[];
  reason: string;
}

export interface CalendarDraftSuggestion {
  summary: string;
  reason: string;
  event: EventDraft & {
    repeatUnit: "none" | "week" | "month";
    repeatInterval: number;
    repeatCount: number;
  };
}

export interface CalendarEventAdjustment {
  eventId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

export interface CalendarPlanningSuggestion extends CalendarDraftSuggestion {
  adjustments: CalendarEventAdjustment[];
}

export function parseAIJson(raw: string): unknown {
  const clean = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(clean);
}

export function validateCategorySuggestion(
  value: unknown,
  categories: readonly Category[],
): CategorySuggestion | null {
  if (!value || typeof value !== "object") return null;
  const requested = String((value as Record<string, unknown>).category ?? "").trim();
  const category = categories.find((item) => item.id === requested || item.name === requested);
  return category ? { categoryId: category.id } : null;
}

export function validateResourceSuggestion(
  value: unknown,
  resources: readonly Resource[],
): ResourceSuggestion {
  const input = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const rawIds = Array.isArray(input.resourceIds)
    ? input.resourceIds
    : Array.isArray(input.resources) ? input.resources : [];
  const available = new Set(resources.map((resource) => resource.id));
  const resourceIds = [...new Set(rawIds.filter(
    (id): id is string => typeof id === "string" && available.has(id),
  ))];
  return {
    resourceIds,
    reason: typeof input.reason === "string" && input.reason.trim()
      ? input.reason.trim()
      : resourceIds.length
        ? "根据 Event 内容与现有 Resource 匹配"
        : "当前 Event 不需要关联已有 Resource",
  };
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateCalendarDraftSuggestion(
  value: unknown,
  resources: readonly Resource[],
  fallback: EventDraft,
  allowResourcePlanning: boolean,
): CalendarDraftSuggestion | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const event = input.event && typeof input.event === "object"
    ? input.event as Record<string, unknown>
    : null;
  if (!event) return null;

  const title = typeof event.title === "string" ? event.title.trim() : "";
  if (!title) return null;
  const priority = event.priority === "High" || event.priority === "Low" ? event.priority : "Medium";
  const type = event.type === "schedule" ? "schedule" : "task";
  const resourceIds = allowResourcePlanning
    ? validateResourceSuggestion({ resources: event.resources }, resources).resourceIds
    : [];
  const repeatUnit = event.repeatUnit === "week" || event.repeatUnit === "month"
    ? event.repeatUnit
    : "none";

  return {
    summary: typeof input.summary === "string" && input.summary.trim()
      ? input.summary.trim()
      : "AI 已生成一个日程建议",
    reason: typeof input.reason === "string" && input.reason.trim()
      ? input.reason.trim()
      : "根据你的需求和现有安排生成",
    event: {
      title,
      category: typeof event.category === "string" && event.category.trim()
        ? event.category.trim()
        : fallback.category,
      date: isDate(event.date) ? event.date : fallback.date,
      startTime: isTime(event.startTime) ? event.startTime : fallback.startTime,
      endTime: isTime(event.endTime) ? event.endTime : fallback.endTime,
      priority,
      type,
      resources: resourceIds,
      repeatUnit,
      repeatInterval: Math.max(1, Math.min(52, Number(event.repeatInterval) || 1)),
      repeatCount: Math.max(1, Math.min(52, Number(event.repeatCount) || 1)),
    },
  };
}

/**
 * Validates a staged planning proposal. Adjustments may only point at Events
 * that already exist, and may only change date/time. This deliberately keeps
 * AI output advisory: persistence is still a separate user-confirmed action.
 */
export function validateCalendarPlanningSuggestion(
  value: unknown,
  existingEvents: readonly NexusEvent[],
  resources: readonly Resource[],
  fallback: EventDraft,
  allowResourcePlanning: boolean,
): CalendarPlanningSuggestion | null {
  const draft = validateCalendarDraftSuggestion(
    value,
    resources,
    fallback,
    allowResourcePlanning,
  );
  if (!draft) return null;

  const input = value as Record<string, unknown>;
  const knownIds = new Set(existingEvents.map((event) => event.id));
  const seen = new Set<string>();
  const rawAdjustments = Array.isArray(input.adjustments) ? input.adjustments : [];
  const adjustments: CalendarEventAdjustment[] = [];

  for (const raw of rawAdjustments) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const eventId = typeof item.eventId === "string" ? item.eventId : "";
    if (!knownIds.has(eventId) || seen.has(eventId)) continue;
    if (!isDate(item.date) || !isTime(item.startTime) || !isTime(item.endTime)) continue;
    if (item.startTime >= item.endTime) continue;
    seen.add(eventId);
    adjustments.push({
      eventId,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      reason: typeof item.reason === "string" && item.reason.trim()
        ? item.reason.trim()
        : "为新的安排腾出时间",
    });
  }

  return { ...draft, adjustments };
}

/**
 * Applies a confirmed suggestion to an editable draft only. It never persists
 * an Event or changes Navigation, keeping AI in an advisory role.
 */
export function applyConfirmedResourceSuggestion(
  draft: EventDraft,
  suggestion: ResourceSuggestion,
  mode: "replace" | "merge",
): EventDraft {
  return {
    ...draft,
    resources: mode === "replace"
      ? [...suggestion.resourceIds]
      : [...new Set([...draft.resources, ...suggestion.resourceIds])],
  };
}
