import type { NexusData } from "../../shared/types";
import { NEXUS_STORAGE_KEY, getDefaultNexusData } from "../config";
import {
  migrateToCurrent,
  UnsupportedSchemaVersionError,
} from "../migrations";
import type { NexusStorage } from "./NexusStorage";

export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class InvalidNexusDataError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "InvalidNexusDataError";
    this.cause = cause;
  }
}

function isImportableObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const NEXUS_DATA_FIELDS = new Set([
  "schemaVersion",
  "settings",
  "username",
  "zones",
  "theme",
  "searchEngine",
  "categories",
  "resources",
  "links",
  "events",
  "focusTasks",
  "aiPlanner",
]);

function isNexusDataCandidate(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => NEXUS_DATA_FIELDS.has(key));
}

export class LocalStorageAdapter implements NexusStorage {
  private readonly injectedStorage?: LocalStorageLike;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(storage?: LocalStorageLike) {
    this.injectedStorage = storage;
  }

  private get storage(): LocalStorageLike {
    if (this.injectedStorage) return this.injectedStorage;
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      return globalThis.localStorage as LocalStorageLike;
    }
    throw new Error("Browser localStorage is not available in this environment.");
  }

  private enqueueWrite(operation: () => void | Promise<void>): Promise<void> {
    const result = this.writeQueue.then(operation, operation);
    this.writeQueue = result.catch(() => undefined);
    return result;
  }

  private async waitForWrites(): Promise<void> {
    await this.writeQueue;
  }

  async load(): Promise<NexusData> {
    await this.waitForWrites();
    const raw = this.storage.getItem(NEXUS_STORAGE_KEY);
    if (raw === null) return getDefaultNexusData();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new InvalidNexusDataError(
        "Stored Nexus data is not valid JSON. The original data was left unchanged.",
        error,
      );
    }

    if (!isImportableObject(parsed)) {
      throw new InvalidNexusDataError(
        "Stored Nexus data must be a JSON object. The original data was left unchanged.",
      );
    }
    if (!isNexusDataCandidate(parsed)) {
      throw new InvalidNexusDataError(
        "Stored data is not recognized as Nexus data. The original data was left unchanged.",
      );
    }
    return migrateToCurrent(parsed);
  }

  async save(data: NexusData): Promise<void> {
    // Validation and migration happen before joining the write queue. A future
    // schema therefore cannot be written back by this older client.
    const normalized = migrateToCurrent(data);
    const serialized = JSON.stringify(normalized);
    await this.enqueueWrite(() => {
      this.storage.setItem(NEXUS_STORAGE_KEY, serialized);
    });
  }

  async clear(): Promise<void> {
    await this.enqueueWrite(() => {
      this.storage.removeItem(NEXUS_STORAGE_KEY);
    });
  }

  async exportData(): Promise<string> {
    const data = await this.load();
    return JSON.stringify(data, null, 2);
  }

  async importData(rawData: string): Promise<NexusData> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch (error) {
      throw new InvalidNexusDataError(
        "The selected Nexus backup is not valid JSON. Existing data was not changed.",
        error,
      );
    }
    if (!isImportableObject(parsed)) {
      throw new InvalidNexusDataError(
        "The selected Nexus backup must contain a JSON object. Existing data was not changed.",
      );
    }
    if (!isNexusDataCandidate(parsed)) {
      throw new InvalidNexusDataError(
        "The selected file is not recognized as a Nexus backup. Existing data was not changed.",
      );
    }

    let migrated: NexusData;
    try {
      migrated = migrateToCurrent(parsed);
    } catch (error) {
      if (error instanceof UnsupportedSchemaVersionError) throw error;
      throw new InvalidNexusDataError(
        "The selected Nexus backup could not be migrated. Existing data was not changed.",
        error,
      );
    }

    // No storage mutation occurs before parsing and migration both succeed.
    await this.save(migrated);
    return migrated;
  }
}

export function createLocalStorageAdapter(
  storage?: LocalStorageLike,
): LocalStorageAdapter {
  return new LocalStorageAdapter(storage);
}
