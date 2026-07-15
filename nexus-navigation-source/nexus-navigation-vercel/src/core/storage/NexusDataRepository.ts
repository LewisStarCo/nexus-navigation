import type { NexusData } from "../../shared/types";
import type { NexusStorage } from "./NexusStorage";

export type NexusDataMutator = (
  draft: NexusData,
) => NexusData | void | Promise<NexusData | void>;

function cloneData(data: NexusData): NexusData {
  if (typeof structuredClone === "function") return structuredClone(data);
  return JSON.parse(JSON.stringify(data)) as NexusData;
}

/**
 * Serializes read-modify-write operations inside the Web application. Domain
 * modules depend on this repository rather than coordinating localStorage
 * snapshots themselves.
 */
export class NexusDataRepository {
  private operationQueue: Promise<void> = Promise.resolve();
  private readonly storage: NexusStorage;

  constructor(storage: NexusStorage) {
    this.storage = storage;
  }

  async load(): Promise<NexusData> {
    await this.operationQueue;
    return this.storage.load();
  }

  save(data: NexusData): Promise<void> {
    return this.enqueue(async () => {
      await this.storage.save(data);
    });
  }

  update(mutator: NexusDataMutator): Promise<NexusData> {
    let output: NexusData | undefined;
    return this.enqueue(async () => {
      const current = await this.storage.load();
      const draft = cloneData(current);
      const result = await mutator(draft);
      output = result ?? draft;
      await this.storage.save(output);
    }).then(() => output as NexusData);
  }

  clear(): Promise<void> {
    return this.enqueue(() => this.storage.clear());
  }

  async exportData(): Promise<string> {
    await this.operationQueue;
    return this.storage.exportData();
  }

  importData(rawData: string): Promise<NexusData> {
    let output: NexusData | undefined;
    return this.enqueue(async () => {
      output = await this.storage.importData(rawData);
    }).then(() => output as NexusData);
  }

  private enqueue(operation: () => void | Promise<void>): Promise<void> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.catch(() => undefined);
    return result;
  }
}
