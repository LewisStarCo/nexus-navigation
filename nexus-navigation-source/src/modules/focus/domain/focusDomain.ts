import type { NexusEvent } from "../../../shared/types";

export interface ProgressSummary {
  completed: number;
  remaining: number;
  total: number;
  percent: number;
}

export interface WeekWindow {
  start: Date;
  end: Date;
}

export function selectTodayEvents(
  events: NexusEvent[],
  today: string,
): NexusEvent[] {
  return events
    .filter((event) => event.date === today)
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

export function calculateProgress(events: NexusEvent[]): ProgressSummary {
  const completed = events.filter(
    (event) => event.status === "completed",
  ).length;
  const total = events.length;
  return {
    completed,
    remaining: total - completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

/** Monday-inclusive, following-Monday-exclusive, matching v17. */
export function getWeekWindow(anchor: Date): WeekWindow {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function selectWeekEvents(
  events: NexusEvent[],
  anchor: Date,
): NexusEvent[] {
  const { start, end } = getWeekWindow(anchor);
  return events.filter((event) => {
    const date = new Date(`${event.date}T00:00:00`);
    return date >= start && date < end;
  });
}

export function getTodayProgress(
  events: NexusEvent[],
  today: string,
): ProgressSummary {
  return calculateProgress(selectTodayEvents(events, today));
}

export function getWeeklyProgress(
  events: NexusEvent[],
  anchor: Date,
): ProgressSummary {
  return calculateProgress(selectWeekEvents(events, anchor));
}
