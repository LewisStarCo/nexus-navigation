import type { Category, Resource } from "@/src/shared/types";
import {
  TEMPORARY_CATEGORY_ID,
  UNCLASSIFIED_CATEGORY_ID,
} from "./constants";

export function homepageResources(resources: readonly Resource[]): Resource[] {
  return resources
    .filter((resource) =>
      resource.categoryId !== TEMPORARY_CATEGORY_ID
      && resource.categoryId !== UNCLASSIFIED_CATEGORY_ID)
    .sort((a, b) => a.order - b.order);
}

export function temporaryResources(resources: readonly Resource[]): Resource[] {
  return resources
    .filter((resource) => resource.categoryId === TEMPORARY_CATEGORY_ID)
    .sort((a, b) => a.order - b.order);
}

export function unclassifiedResources(resources: readonly Resource[]): Resource[] {
  return resources
    .filter((resource) => !resource.categoryId || resource.categoryId === UNCLASSIFIED_CATEGORY_ID)
    .sort((a, b) => a.order - b.order);
}

export function resourcesForCategory(
  resources: readonly Resource[],
  categoryId: string,
): Resource[] {
  return resources
    .filter((resource) => resource.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);
}

export function orderedCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort((a, b) => a.order - b.order);
}

export function filterResources(
  resources: readonly Resource[],
  query: string,
  categoryId?: string,
): Resource[] {
  const needle = query.trim().toLocaleLowerCase();
  return homepageResources(resources).filter((resource) => {
    if (categoryId && resource.categoryId !== categoryId) return false;
    if (!needle) return true;
    const searchable = resource.type === "website"
      ? `${resource.type} ${resource.name} ${resource.description ?? ""} ${resource.url}`
      : `${resource.type} ${resource.name} ${resource.description ?? ""} ${resource.appIdentifier ?? ""}`;
    return searchable.toLocaleLowerCase().includes(needle);
  });
}
