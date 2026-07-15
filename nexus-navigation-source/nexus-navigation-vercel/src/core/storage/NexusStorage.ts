import type { NexusData } from "../../shared/types";

export interface NexusStorage {
  load(): Promise<NexusData>;
  save(data: NexusData): Promise<void>;
  clear(): Promise<void>;
  exportData(): Promise<string>;
  importData(rawData: string): Promise<NexusData>;
}
