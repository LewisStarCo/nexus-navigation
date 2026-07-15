import type {
  AIPlannerSettings,
  ClockZone,
  NexusEvent,
  SearchEngine,
} from "../../shared/types";
import {
  DEFAULT_TIMESTAMP,
  getDefaultEvents,
  getDefaultNexusData,
} from "../config";
import {
  finiteNumber,
  focusTasksToEvents,
  isRecord,
  normalizeAIPlanner,
  normalizeEvents,
  normalizeSearchEngine,
  normalizeTheme,
  normalizeZones,
  stringValue,
  timestampValue,
  trimmedString,
  uniqueId,
} from "./normalizers";

export interface V1Resource {
  id: string;
  title: string;
  type: "website" | "application";
  url: string;
  appIdentifier: string;
  icon: string;
  category: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  description: string;
  mark: string;
  color: string;
  faviconUrl?: string;
}

export interface NexusDataV1 {
  schemaVersion: 1;
  username: string;
  zones: ClockZone[];
  theme: "dark" | "light";
  searchEngine: SearchEngine;
  categories: string[];
  resources: V1Resource[];
  events: NexusEvent[];
  aiPlanner: AIPlannerSettings;
}

function defaultV1(): NexusDataV1 {
  const defaults = getDefaultNexusData();
  const categoryNames = new Map(defaults.categories.map((category) => [category.id, category.name]));
  return {
    schemaVersion: 1,
    username: defaults.settings.username,
    zones: defaults.settings.zones,
    theme: defaults.settings.theme,
    searchEngine: defaults.settings.searchEngine,
    categories: defaults.categories.map((category) => category.name),
    resources: defaults.resources.map((resource) => ({
      id: resource.id,
      title: resource.name,
      type: resource.type,
      url: resource.type === "website" ? resource.url : "",
      appIdentifier: resource.type === "application" ? resource.appIdentifier ?? "" : "",
      icon: resource.icon ?? "",
      category: resource.categoryId ? categoryNames.get(resource.categoryId) ?? resource.categoryId : "",
      order: resource.order,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      description: resource.description ?? "",
      mark: resource.mark ?? "",
      color: resource.color ?? "blue",
      ...(resource.type === "website" && resource.faviconUrl ? { faviconUrl: resource.faviconUrl } : {}),
    })),
    events: defaults.events,
    aiPlanner: defaults.aiPlanner,
  };
}

function categoryNames(value: unknown): { names: string[]; ids: Map<string, string> } {
  if (!Array.isArray(value)) return { names: [], ids: new Map() };
  const names: string[] = [];
  const ids = new Map<string, string>();
  for (const entry of value) {
    const record = isRecord(entry) ? entry : undefined;
    const name = trimmedString(record ? record.name ?? record.title : entry);
    if (!name || names.includes(name)) continue;
    names.push(name);
    if (record) ids.set(trimmedString(record.id, name), name);
  }
  return { names, ids };
}

function normalizeV1Resources(
  value: unknown,
  categoryIds: Map<string, string>,
): V1Resource[] {
  if (!Array.isArray(value)) return defaultV1().resources;
  const usedIds = new Set<string>();
  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const title = trimmedString(entry.title ?? entry.name, `Resource ${index + 1}`);
    const rawType = entry.type ?? entry.kind;
    const type: V1Resource["type"] =
      rawType === "application" || (!entry.url && Boolean(entry.appIdentifier))
        ? "application"
        : "website";
    const categoryId = trimmedString(entry.categoryId);
    const category = trimmedString(
      entry.category,
      categoryIds.get(categoryId) ?? categoryId,
    );
    const createdAt = timestampValue(entry.createdAt, DEFAULT_TIMESTAMP);
    const icon = stringValue(entry.icon, "");
    return [
      {
        id: uniqueId(
          entry.id,
          `${type}|${title}|${stringValue(entry.url)}|${stringValue(entry.appIdentifier)}|${category}|${index}`,
          usedIds,
          "resource",
        ),
        title,
        type,
        url: type === "website" ? stringValue(entry.url ?? entry.href, "") : "",
        appIdentifier:
          type === "application" ? stringValue(entry.appIdentifier, "") : "",
        icon,
        category,
        order: finiteNumber(entry.order, index),
        createdAt,
        updatedAt: timestampValue(entry.updatedAt, createdAt),
        description: stringValue(
          entry.description,
          type === "application" ? "本地应用" : "快捷访问",
        ),
        mark: trimmedString(entry.mark, title.slice(0, 2).toUpperCase()),
        color: trimmedString(entry.color, "blue"),
        ...((typeof entry.faviconUrl === "string" && entry.faviconUrl) ||
        (type === "website" && icon.startsWith("http"))
          ? { faviconUrl: stringValue(entry.faviconUrl, icon) }
          : {}),
      },
    ];
  }).sort((left, right) => left.order - right.order);
}

export function migrateV0ToV1(raw: unknown): NexusDataV1 {
  if (!isRecord(raw) || Object.keys(raw).length === 0) return defaultV1();
  const settings = isRecord(raw.settings) ? raw.settings : raw;
  const parsedCategories = categoryNames(raw.categories);
  const resourceInput = Array.isArray(raw.resources)
    ? raw.resources
    : Array.isArray(raw.links)
      ? raw.links
      : undefined;
  const resources = normalizeV1Resources(resourceInput, parsedCategories.ids);
  const categories = [...parsedCategories.names];
  for (const resource of resources) {
    if (
      resource.category &&
      resource.category !== "__nexus_unclassified__" &&
      resource.category !== "__nexus_temporary__" &&
      !categories.includes(resource.category)
    ) {
      categories.push(resource.category);
    }
  }
  if (!categories.length && !Array.isArray(raw.categories)) {
    categories.push(...defaultV1().categories);
  }

  const hasEvents = Array.isArray(raw.events);
  const events = hasEvents
    ? normalizeEvents(raw.events, [])
    : Array.isArray(raw.focusTasks)
      ? focusTasksToEvents(raw.focusTasks)
      : getDefaultEvents();

  return {
    schemaVersion: 1,
    username: stringValue(settings.username, ""),
    zones: normalizeZones(settings.zones),
    theme: normalizeTheme(settings.theme),
    searchEngine: normalizeSearchEngine(settings.searchEngine),
    categories,
    resources,
    events,
    aiPlanner: normalizeAIPlanner(raw.aiPlanner),
  };
}
