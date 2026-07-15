import type { NexusData } from "../../../shared/types";

export type NexusDataNormalizer = (rawData: unknown) => NexusData;

export function serializeNexusData(data: NexusData): string {
  return JSON.stringify(data, null, 2);
}

export function parseNexusBackup(rawData: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(rawData);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Nexus backup must contain a JSON object");
  }
  return parsed as Record<string, unknown>;
}

/** Delegates schema validation and migration to the canonical normalizer. */
export function restoreNexusData(
  rawData: string,
  normalize: NexusDataNormalizer,
): NexusData {
  return normalize(parseNexusBackup(rawData));
}
