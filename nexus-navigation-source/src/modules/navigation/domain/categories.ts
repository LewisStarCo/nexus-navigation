import type { Category, NexusEvent, Resource } from "@/src/shared/types";
import { removeResourcesAndDetachEvents } from "../../resources";
import {
  TEMPORARY_CATEGORY_ID,
  UNCLASSIFIED_CATEGORY_ID,
  isSpecialCategoryId,
} from "./constants";

export interface CategoryMutationOptions {
  id?: string;
  now?: string;
  createId?: () => string;
}

export interface CategoryDeletionResult {
  categories: Category[];
  resources: Resource[];
  events: NexusEvent[];
  removedResourceIds: string[];
}

function createCategoryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `category-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizedCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function categoryNameExists(
  categories: readonly Category[],
  value: string,
  excludingId?: string,
): boolean {
  const normalized = normalizedCategoryName(value).toLocaleLowerCase();
  return categories.some((category) =>
    category.id !== excludingId
    && normalizedCategoryName(category.name).toLocaleLowerCase() === normalized,
  );
}

export function createCategory(
  categories: readonly Category[],
  name: string,
  options: CategoryMutationOptions = {},
): Category {
  const normalized = normalizedCategoryName(name);
  if (!normalized) throw new TypeError("Category name is required.");
  if (categoryNameExists(categories, normalized)) {
    throw new TypeError("Category name already exists.");
  }

  const now = options.now ?? new Date().toISOString();
  return {
    id: options.id ?? options.createId?.() ?? createCategoryId(),
    name: normalized,
    order: categories.reduce((highest, category) => Math.max(highest, category.order), -1) + 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function renameCategory(
  categories: readonly Category[],
  categoryId: string,
  name: string,
  now = new Date().toISOString(),
): Category[] {
  const normalized = normalizedCategoryName(name);
  if (!normalized) throw new TypeError("Category name is required.");
  if (categoryNameExists(categories, normalized, categoryId)) {
    throw new TypeError("Category name already exists.");
  }
  return categories.map((category) => category.id === categoryId
    ? { ...category, name: normalized, updatedAt: now }
    : category);
}

export function reorderCategories(
  categories: readonly Category[],
  orderedIds: readonly string[],
): Category[] {
  const existingIds = new Set(categories.map((category) => category.id));
  const seen = new Set<string>();
  const validOrder = orderedIds.filter((id) => {
    if (!existingIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const completeOrder = [
    ...validOrder,
    ...categories
      .filter((category) => !seen.has(category.id))
      .sort((a, b) => a.order - b.order)
      .map((category) => category.id),
  ];
  const positions = new Map(completeOrder.map((id, index) => [id, index]));
  return categories
    .map((category) => ({ ...category, order: positions.get(category.id) ?? category.order }))
    .sort((a, b) => a.order - b.order);
}

/** v17 behavior: deleting a normal category also deletes its resources. */
export function deleteCategoryAndResources(
  categories: readonly Category[],
  resources: readonly Resource[],
  events: readonly NexusEvent[],
  categoryId: string,
): CategoryDeletionResult {
  if (isSpecialCategoryId(categoryId)) {
    throw new TypeError("Reserved Navigation collections cannot be deleted.");
  }
  const resourceIds = resources
    .filter((resource) => resource.categoryId === categoryId)
    .map((resource) => resource.id);
  const deletion = removeResourcesAndDetachEvents(resources, events, resourceIds);
  return {
    categories: reorderCategories(
      categories.filter((category) => category.id !== categoryId),
      categories.filter((category) => category.id !== categoryId).map((category) => category.id),
    ),
    resources: deletion.resources,
    events: deletion.events,
    removedResourceIds: deletion.removedIds,
  };
}

export function clearCategoryResources(
  resources: readonly Resource[],
  events: readonly NexusEvent[],
  categoryId: string,
) {
  return removeResourcesAndDetachEvents(
    resources,
    events,
    resources.filter((resource) => resource.categoryId === categoryId).map((resource) => resource.id),
  );
}

export function categoryIdForNewResource(categories: readonly Category[]): string {
  return categories.slice().sort((a, b) => a.order - b.order)[0]?.id
    ?? UNCLASSIFIED_CATEGORY_ID;
}

export function categoryLabel(categoryId: string | undefined, categories: readonly Category[]): string {
  if (categoryId === UNCLASSIFIED_CATEGORY_ID) return "未归类";
  if (categoryId === TEMPORARY_CATEGORY_ID) return "临时资源";
  return categories.find((category) => category.id === categoryId)?.name ?? "未归类";
}
