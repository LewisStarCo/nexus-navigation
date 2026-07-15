import type { Category } from "@/src/shared/types";
import {
  TEMPORARY_CATEGORY_ID,
  UNCLASSIFIED_CATEGORY_ID,
} from "@/src/modules/navigation";

/** Preserve the v1.x extension payload, which uses display names rather than IDs. */
export function categoriesForEdgeExtension(categories: readonly Category[]): string[] {
  return [...categories]
    .sort((a, b) => a.order - b.order)
    .map((category) => category.name);
}

export function categoryIdFromEdgeExtension(
  value: string | undefined,
  categories: readonly Category[],
): string {
  if (value === TEMPORARY_CATEGORY_ID || value === UNCLASSIFIED_CATEGORY_ID) return value;
  const normalized = value?.trim();
  if (!normalized) return UNCLASSIFIED_CATEGORY_ID;
  return categories.find((category) => category.name === normalized)?.id
    ?? UNCLASSIFIED_CATEGORY_ID;
}

export function categoryNameForEdgeExtension(
  categoryId: string | undefined,
  categories: readonly Category[],
): string {
  if (categoryId === TEMPORARY_CATEGORY_ID || categoryId === UNCLASSIFIED_CATEGORY_ID) {
    return categoryId;
  }
  return categories.find((category) => category.id === categoryId)?.name
    ?? UNCLASSIFIED_CATEGORY_ID;
}
