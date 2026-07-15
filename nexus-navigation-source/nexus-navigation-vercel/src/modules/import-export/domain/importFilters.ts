import type { NexusEvent } from "../../../shared/types";
import type { ImportPreviewResult } from "../types";

export function filterEventsByDateRange(
  events: NexusEvent[],
  startDate: string,
  endDate: string,
): NexusEvent[] {
  return events.filter(
    (event) => event.date >= startDate && event.date <= endDate,
  );
}

export function eventDuplicateKey(event: NexusEvent): string {
  return event.externalId || `${event.title}|${event.date}|${event.startTime}`;
}

/**
 * Filters against already-saved events. It intentionally retains v17's
 * behaviour and does not collapse duplicate rows inside the same preview.
 */
export function filterAlreadyImportedEvents(
  candidates: NexusEvent[],
  existingEvents: NexusEvent[],
): NexusEvent[] {
  const existingKeys = new Set(existingEvents.map(eventDuplicateKey));
  return candidates.filter(
    (candidate) => !existingKeys.has(eventDuplicateKey(candidate)),
  );
}

export function prepareImportPreview(
  parsed: NexusEvent[],
  existingEvents: NexusEvent[],
  startDate: string,
  endDate: string,
): ImportPreviewResult {
  const inRange = filterEventsByDateRange(parsed, startDate, endDate);
  const unique = filterAlreadyImportedEvents(inRange, existingEvents);
  return {
    parsed,
    inRange,
    unique,
    duplicateCount: inRange.length - unique.length,
  };
}
