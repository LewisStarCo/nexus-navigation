import type { NexusData } from "../../shared/types";
import { CURRENT_SCHEMA_VERSION } from "../config";
import { isRecord } from "./normalizers";
import { migrateV0ToV1 } from "./migrateV0ToV1";
import { migrateV1ToV2, normalizeV2Data } from "./migrateV1ToV2";

export class UnsupportedSchemaVersionError extends Error {
  readonly schemaVersion: number;

  constructor(schemaVersion: number) {
    super(
      `This Nexus data uses schema version ${schemaVersion}, but this app supports up to version ${CURRENT_SCHEMA_VERSION}.`,
    );
    this.name = "UnsupportedSchemaVersionError";
    this.schemaVersion = schemaVersion;
  }
}

export function detectSchemaVersion(raw: unknown): number {
  if (!isRecord(raw)) return 0;
  const version = raw.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) return 0;
  return version;
}

export function migrateToCurrent(raw: unknown): NexusData {
  let version = detectSchemaVersion(raw);
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(version);
  }

  let data: unknown = raw;
  while (version < CURRENT_SCHEMA_VERSION) {
    if (version === 0) {
      data = migrateV0ToV1(data);
      version = 1;
      continue;
    }
    if (version === 1) {
      data = migrateV1ToV2(data);
      version = 2;
      continue;
    }
    throw new UnsupportedSchemaVersionError(version);
  }

  // Current-version data is normalized as well, so missing optional sections
  // receive safe defaults without creating an extra migration version.
  return normalizeV2Data(data);
}

export { CURRENT_SCHEMA_VERSION } from "../config";
export { migrateV0ToV1 } from "./migrateV0ToV1";
export type { NexusDataV1, V1Resource } from "./migrateV0ToV1";
export { migrateV1ToV2, normalizeV2Data } from "./migrateV1ToV2";
