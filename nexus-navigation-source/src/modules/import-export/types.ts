import type { EventSource, NexusEvent } from "../../shared/types";

export type ImportSource = Extract<
  EventSource,
  | "apple-calendar"
  | "google-calendar"
  | "outlook-calendar"
  | "microsoft-todo"
>;

export interface ImportParseContext {
  createId: () => string;
  now: () => Date;
  resourceIds: Iterable<string>;
}

export interface ExternalEventInput {
  id: string;
  title: string;
  category?: string;
  start: Date;
  end?: Date;
  completed?: boolean;
  type?: NexusEvent["type"];
}

export interface ImportPreviewResult {
  parsed: NexusEvent[];
  inRange: NexusEvent[];
  unique: NexusEvent[];
  duplicateCount: number;
}
