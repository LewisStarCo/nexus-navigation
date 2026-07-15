import type {
  Category,
  NexusData,
  Resource,
} from "../../shared/types";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_TIMESTAMP,
  getDefaultCategories,
  getDefaultEvents,
  TEMPORARY_CATEGORY_ID,
  UNCLASSIFIED_CATEGORY_ID,
} from "../config";
import {
  finiteNumber,
  isRecord,
  normalizeAIPlanner,
  normalizeEvents,
  normalizeSearchEngine,
  normalizeTheme,
  normalizeZones,
  stableHash,
  stringValue,
  timestampValue,
  trimmedString,
  uniqueId,
} from "./normalizers";

const SPECIAL_CATEGORY_IDS = new Set([
  TEMPORARY_CATEGORY_ID,
  UNCLASSIFIED_CATEGORY_ID,
]);

function normalizeCategories(value: unknown): Category[] {
  const source = Array.isArray(value) ? value : getDefaultCategories();
  const defaultsByName = new Map(
    getDefaultCategories().map((category) => [category.name, category.id]),
  );
  const usedIds = new Set<string>();
  const seenNames = new Set<string>();
  return source.flatMap((entry, index) => {
    const record = isRecord(entry) ? entry : undefined;
    const name = trimmedString(record ? record.name ?? record.title : entry);
    if (!name || seenNames.has(name)) return [];
    seenNames.add(name);
    const preferredId = record?.id ?? defaultsByName.get(name);
    const id = uniqueId(
      preferredId,
      `category|${name}`,
      usedIds,
      "category",
    );
    const createdAt = timestampValue(record?.createdAt, DEFAULT_TIMESTAMP);
    return [{
      id,
      name,
      order: finiteNumber(record?.order, index),
      createdAt,
      updatedAt: timestampValue(record?.updatedAt, createdAt),
    }];
  }).sort((left, right) => left.order - right.order)
    .map((category, order) => ({ ...category, order }));
}

function ensureCategory(
  rawCategoryId: string,
  rawCategoryName: string,
  categories: Category[],
): string | undefined {
  const value = rawCategoryId || rawCategoryName;
  if (!value) return undefined;
  if (SPECIAL_CATEGORY_IDS.has(value)) return value;
  const byId = categories.find((category) => category.id === value);
  if (byId) return byId.id;
  const byName = categories.find((category) => category.name === value);
  if (byName) return byName.id;
  const name = rawCategoryName || value;
  let id = rawCategoryId || `category-${stableHash(name)}`;
  let suffix = 2;
  const base = id;
  while (categories.some((category) => category.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  categories.push({
    id,
    name,
    order: categories.length,
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  });
  return id;
}

function normalizeResources(value: unknown, categories: Category[]): Resource[] {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set<string>();
  return value.flatMap<Resource>((entry, index): Resource[] => {
    if (!isRecord(entry)) return [];
    const name = trimmedString(entry.name ?? entry.title, `Resource ${index + 1}`);
    const type =
      entry.type === "application" || (!entry.url && Boolean(entry.appIdentifier))
        ? "application"
        : "website";
    const categoryId = ensureCategory(
      trimmedString(entry.categoryId),
      trimmedString(entry.category),
      categories,
    );
    const createdAt = timestampValue(entry.createdAt, DEFAULT_TIMESTAMP);
    const base = {
      id: uniqueId(
        entry.id,
        `${type}|${name}|${stringValue(entry.url)}|${stringValue(entry.appIdentifier)}|${categoryId ?? ""}|${index}`,
        usedIds,
        "resource",
      ),
      name,
      type,
      description: stringValue(
        entry.description,
        type === "application" ? "本地应用" : "快捷访问",
      ),
      ...(categoryId ? { categoryId } : {}),
      order: finiteNumber(entry.order, index),
      icon: stringValue(entry.icon, ""),
      mark: trimmedString(entry.mark, name.slice(0, 2).toUpperCase()),
      color: trimmedString(entry.color, "blue"),
      createdAt,
      updatedAt: timestampValue(entry.updatedAt, createdAt),
    };
    if (type === "application") {
      return [{
        ...base,
        type: "application" as const,
        appIdentifier: stringValue(entry.appIdentifier, ""),
      }];
    }
    const faviconUrl = stringValue(
      entry.faviconUrl,
      base.icon.startsWith("http") ? base.icon : "",
    );
    return [{
      ...base,
      type: "website" as const,
      url: stringValue(entry.url ?? entry.href, ""),
      ...(faviconUrl ? { faviconUrl } : {}),
    }];
  }).sort((left, right) => left.order - right.order);
}

export function migrateV1ToV2(raw: unknown): NexusData {
  const input = isRecord(raw) ? raw : {};
  const settings = isRecord(input.settings) ? input.settings : input;
  const categories = normalizeCategories(input.categories);
  const resources = normalizeResources(input.resources, categories);
  const events = normalizeEvents(input.events, getDefaultEvents());
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: {
      username: stringValue(settings.username, ""),
      zones: normalizeZones(settings.zones),
      theme: normalizeTheme(settings.theme),
      searchEngine: normalizeSearchEngine(settings.searchEngine),
    },
    categories: categories.sort((left, right) => left.order - right.order)
      .map((category, order) => ({ ...category, order })),
    resources,
    events,
    aiPlanner: normalizeAIPlanner(input.aiPlanner),
  };
}

export const normalizeV2Data = migrateV1ToV2;
