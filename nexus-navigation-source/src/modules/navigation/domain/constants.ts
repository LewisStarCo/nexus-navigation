/** Stable IDs retained for v17 data and the installed Edge extension. */
export const UNCLASSIFIED_CATEGORY_ID = "__nexus_unclassified__";
export const TEMPORARY_CATEGORY_ID = "__nexus_temporary__";

export function isSpecialCategoryId(categoryId?: string): boolean {
  return categoryId === UNCLASSIFIED_CATEGORY_ID || categoryId === TEMPORARY_CATEGORY_ID;
}
