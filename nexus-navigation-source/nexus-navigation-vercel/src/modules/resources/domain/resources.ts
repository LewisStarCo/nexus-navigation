import type {
  ApplicationResource,
  NexusEvent,
  Resource,
  WebsiteResource,
} from "@/src/shared/types";

interface CommonResourceDraft {
  name: string;
  description?: string;
  categoryId?: string;
  icon?: string;
  mark?: string;
  color?: string;
}

export interface WebsiteResourceDraft extends CommonResourceDraft {
  type: "website";
  url: string;
  faviconUrl?: string;
}

export interface ApplicationResourceDraft extends CommonResourceDraft {
  type: "application";
  appIdentifier?: string;
}

export type ResourceDraft = WebsiteResourceDraft | ApplicationResourceDraft;

export interface ResourceFactoryOptions {
  id?: string;
  order?: number;
  now?: string;
  createId?: () => string;
}

export interface ResourceDeletionResult {
  resources: Resource[];
  events: NexusEvent[];
  removedIds: string[];
}

export interface ResourceValidationResult {
  valid: boolean;
  errors: string[];
}

function createResourceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `resource-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeWebsiteUrl(value: string): string {
  const candidate = /^https?:\/\//i.test(value.trim())
    ? value.trim()
    : `https://${value.trim()}`;
  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("Website Resource URL must use HTTP or HTTPS.");
  }
  return url.toString();
}

const LEGACY_EDGE_DESCRIPTION = "从 Microsoft Edge 收藏";
const KNOWN_WEBSITE_DESCRIPTIONS: Record<string, string> = {
  "mail.google.com": "Google 邮件收发与协作服务",
  "google.com": "搜索信息与探索互联网",
  "www.google.com": "搜索信息与探索互联网",
  "github.com": "代码托管与开源协作平台",
  "www.github.com": "代码托管与开源协作平台",
};

/** Keeps old Edge captures useful without silently rewriting stored user data. */
export function displayResourceDescription(resource: Resource): string {
  const description = resource.description?.trim();
  if (description && description !== LEGACY_EDGE_DESCRIPTION) return description;
  if (resource.type === "application") return description || "本地应用";
  try {
    const host = new URL(resource.url).hostname.toLowerCase();
    return KNOWN_WEBSITE_DESCRIPTIONS[host] || `快速访问 ${host}`;
  } catch {
    return "收藏的网页资源";
  }
}

export function validateResourceDraft(draft: ResourceDraft): ResourceValidationResult {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Resource name is required.");
  if (draft.type === "website") {
    try {
      normalizeWebsiteUrl(draft.url);
    } catch {
      errors.push("Website Resource URL is invalid.");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function createResource(
  draft: ResourceDraft,
  options: ResourceFactoryOptions = {},
): Resource {
  const validation = validateResourceDraft(draft);
  if (!validation.valid) throw new TypeError(validation.errors.join(" "));

  const now = options.now ?? new Date().toISOString();
  const base = {
    id: options.id ?? options.createId?.() ?? createResourceId(),
    name: draft.name.trim(),
    description: draft.description?.trim() || (draft.type === "website" ? "快捷访问" : "本地应用"),
    categoryId: draft.categoryId,
    order: options.order ?? 0,
    icon: draft.icon?.trim() || undefined,
    mark: draft.mark?.trim() || draft.name.trim().slice(0, 2).toUpperCase(),
    color: draft.color?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  if (draft.type === "website") {
    const resource: WebsiteResource = {
      ...base,
      type: "website",
      url: normalizeWebsiteUrl(draft.url),
      faviconUrl: draft.faviconUrl?.trim() || undefined,
    };
    return resource;
  }

  const resource: ApplicationResource = {
    ...base,
    type: "application",
    appIdentifier: draft.appIdentifier?.trim() || undefined,
  };
  return resource;
}

export function updateResource(
  existing: Resource,
  draft: ResourceDraft,
  now = new Date().toISOString(),
): Resource {
  return {
    ...createResource(draft, {
      id: existing.id,
      order: existing.order,
      now: existing.createdAt,
    }),
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}

export function nextResourceOrder(resources: readonly Resource[]): number {
  return resources.reduce((highest, item) => Math.max(highest, item.order), -1) + 1;
}

export function hasWebsiteUrl(
  resources: readonly Resource[],
  value: string,
  excludingId?: string,
): boolean {
  const normalized = normalizeWebsiteUrl(value);
  return resources.some((resource) =>
    resource.id !== excludingId
    && resource.type === "website"
    && normalizeWebsiteUrl(resource.url) === normalized,
  );
}

/** Deletes resources and removes only their ID references from Events. */
export function removeResourcesAndDetachEvents(
  resources: readonly Resource[],
  events: readonly NexusEvent[],
  ids: Iterable<string>,
): ResourceDeletionResult {
  const requested = new Set(ids);
  const removedIds = resources
    .filter((resource) => requested.has(resource.id))
    .map((resource) => resource.id);
  if (!removedIds.length) {
    return { resources: [...resources], events: [...events], removedIds: [] };
  }

  const removed = new Set(removedIds);
  return {
    resources: resources.filter((resource) => !removed.has(resource.id)),
    events: events.map((event) => ({
      ...event,
      resources: event.resources.filter((id) => !removed.has(id)),
    })),
    removedIds,
  };
}

export function isWebsiteResource(resource: Resource): resource is WebsiteResource {
  return resource.type === "website";
}

export function isApplicationResource(resource: Resource): resource is ApplicationResource {
  return resource.type === "application";
}
