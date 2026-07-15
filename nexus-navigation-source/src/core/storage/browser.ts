import { LocalStorageAdapter } from "./LocalStorageAdapter";
import { NexusDataRepository } from "./NexusDataRepository";

let browserStorage: LocalStorageAdapter | undefined;
let browserRepository: NexusDataRepository | undefined;

/** Lazily resolves localStorage, so importing core modules remains SSR-safe. */
export function getBrowserStorage(): LocalStorageAdapter {
  browserStorage ??= new LocalStorageAdapter();
  return browserStorage;
}

export function getNexusDataRepository(): NexusDataRepository {
  browserRepository ??= new NexusDataRepository(getBrowserStorage());
  return browserRepository;
}
