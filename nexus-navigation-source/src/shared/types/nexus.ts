export type Theme = "dark" | "light";

export interface ClockZone {
  label: string;
  zone: string;
}

export interface SearchEngine {
  label: string;
  url: string;
}

export interface NexusSettings {
  username: string;
  zones: ClockZone[];
  theme: Theme;
  searchEngine: SearchEngine;
  /** Whether the optional homepage extension download entry is hidden. */
  extensionEntryHidden: boolean;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ResourceType = "website" | "application";

/** Reserved for future native clients. v18 does not create these resources. */
export type FutureResourceType = "file" | "folder" | "shortcut";

export interface BaseResource {
  id: string;
  type: ResourceType;
  name: string;
  description?: string;
  categoryId?: string;
  order: number;
  icon?: string;
  mark?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebsiteResource extends BaseResource {
  type: "website";
  url: string;
  faviconUrl?: string;
}

export interface ApplicationResource extends BaseResource {
  type: "application";
  appIdentifier?: string;
}

export type Resource = WebsiteResource | ApplicationResource;

export type EventPriority = "High" | "Medium" | "Low";
export type EventType = "task" | "schedule";
export type EventStatus = "pending" | "completed" | "unfinished";
export type EventSource =
  | "local"
  | "calendar"
  | "google-calendar"
  | "outlook-calendar"
  | "apple-calendar"
  | "microsoft-todo"
  | "ai-suggestion";

export interface RecurrenceRule {
  unit: "week" | "month";
  interval: number;
  count: number;
  seriesId: string;
}

export interface NexusEvent {
  id: string;
  title: string;
  category: string;
  priority: EventPriority;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: EventStatus;
  source: EventSource;
  /** Resource references are IDs only. Resource content is never embedded. */
  resources: string[];
  recurrence?: RecurrenceRule;
  externalId?: string;
  importedAt?: string;
}

export interface EventDraft {
  title: string;
  category: string;
  priority: EventPriority;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  resources: string[];
}

export type KnownAIProvider =
  | "OpenAI"
  | "Qwen"
  | "智谱 AI"
  | "DeepSeek"
  | "Gemini"
  | "Claude"
  | "Custom";

/**
 * Provider remains string-compatible so a newer provider name is not erased
 * when an older Web client reads otherwise valid settings.
 */
export type AIProvider = KnownAIProvider | (string & {});

export interface CustomProviderConfig {
  name: string;
  baseUrl: string;
  model: string;
}

export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  modelId: string;
  name?: string;
  baseUrl?: string;
}

export interface AIUsagePermissions {
  calendar: boolean;
  category: boolean;
  planning: boolean;
}

export interface AIPlannerSettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  customProvider: CustomProviderConfig;
  permissions: AIUsagePermissions;
}

export interface NexusData {
  schemaVersion: number;
  settings: NexusSettings;
  categories: Category[];
  resources: Resource[];
  events: NexusEvent[];
  aiPlanner: AIPlannerSettings;
}
