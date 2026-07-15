import type {
  EventDraft,
  EventSource,
  NexusEvent,
} from "../../../shared/types";

export const MAX_RECURRENCE_COUNT = 52;

export type RepeatUnit = "none" | "week" | "month";

export interface RecurringEventDraft extends EventDraft {
  repeatUnit: RepeatUnit;
  repeatInterval: number;
  repeatCount: number;
}

export interface EventDomainContext {
  createId: () => string;
  resourceIds: Iterable<string>;
  defaultCategory?: string;
}

export interface EventValidationResult {
  valid: boolean;
  errors: string[];
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return Math.max(1, endHour * 60 + endMinute - startHour * 60 - startMinute);
}

/**
 * v17 only blocked an empty title. More validation can be added later without
 * coupling form rendering to event construction.
 */
export function validateEventDraft(draft: EventDraft): EventValidationResult {
  const errors = draft.title.trim() ? [] : ["Event title is required"];
  return { valid: errors.length === 0, errors };
}

function filterResourceIds(
  ids: string[],
  allowedIds: Iterable<string>,
): string[] {
  const allowed = new Set(allowedIds);
  return ids.filter((id) => allowed.has(id));
}

/**
 * Expands a draft exactly as v17 did. In particular, monthly recurrence uses
 * Date#setMonth so existing end-of-month rollover behaviour is retained.
 */
export function generateRecurringEvents(
  draft: RecurringEventDraft,
  source: EventSource,
  context: EventDomainContext,
): NexusEvent[] {
  const duration = calculateDuration(draft.startTime, draft.endTime);
  const seriesId = context.createId();
  const count =
    draft.repeatUnit === "none"
      ? 1
      : Math.max(
          1,
          Math.min(
            MAX_RECURRENCE_COUNT,
            Number(draft.repeatCount) || 1,
          ),
        );
  const interval = Math.max(1, Number(draft.repeatInterval));

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${draft.date}T12:00:00`);
    if (draft.repeatUnit === "week") {
      date.setDate(date.getDate() + index * interval * 7);
    }
    if (draft.repeatUnit === "month") {
      date.setMonth(date.getMonth() + index * interval);
    }

    const event: NexusEvent = {
      id: context.createId(),
      title: draft.title.trim(),
      category: draft.category.trim() || context.defaultCategory || "其他",
      date: dateKey(date),
      startTime: draft.startTime,
      endTime: draft.endTime,
      priority: draft.priority,
      type: draft.type,
      resources: filterResourceIds(draft.resources, context.resourceIds),
      duration,
      status: "pending",
      source,
    };

    if (draft.repeatUnit !== "none") {
      event.recurrence = {
        unit: draft.repeatUnit,
        interval,
        count,
        seriesId,
      };
    }
    return event;
  });
}

export function createEvent(
  draft: RecurringEventDraft,
  source: EventSource,
  context: EventDomainContext,
): NexusEvent {
  return generateRecurringEvents(draft, source, context)[0];
}

/**
 * Updates one materialised occurrence only. Siblings in the same recurrence
 * series are deliberately untouched, matching the v17 editor.
 */
export function updateCurrentEvent(
  current: NexusEvent,
  draft: EventDraft,
  context: EventDomainContext,
): NexusEvent {
  const replacement = createEvent(
    {
      ...draft,
      repeatUnit: "none",
      repeatInterval: 1,
      repeatCount: 1,
    },
    current.source,
    context,
  );

  return {
    ...current,
    ...replacement,
    id: current.id,
    status: current.status,
    source: current.source,
  };
}

export function updateEventInList(
  events: NexusEvent[],
  eventId: string,
  draft: EventDraft,
  context: EventDomainContext,
): NexusEvent[] {
  return events.map((event) =>
    event.id === eventId ? updateCurrentEvent(event, draft, context) : event,
  );
}

export function moveEvent(
  events: NexusEvent[],
  eventId: string,
  date: string,
  hour: number,
): NexusEvent[] {
  return events.map((event) => {
    if (event.id !== eventId || event.type === "schedule") return event;
    const start = hour * 60;
    return {
      ...event,
      date,
      startTime: minutesToTime(start),
      endTime: minutesToTime(
        Math.min(23 * 60 + 59, start + event.duration),
      ),
    };
  });
}

export function markPastPendingEventsUnfinished(
  events: NexusEvent[],
  today: string,
): NexusEvent[] {
  return events.map((event) =>
    event.date < today && event.status === "pending"
      ? { ...event, status: "unfinished" }
      : event,
  );
}

export function toggleEventCompletion(event: NexusEvent): NexusEvent {
  return {
    ...event,
    status: event.status === "completed" ? "pending" : "completed",
  };
}
