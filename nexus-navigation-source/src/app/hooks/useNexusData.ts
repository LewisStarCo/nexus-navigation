"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { NEXUS_STORAGE_KEY, getDefaultNexusData } from "../../core/config";
import { getNexusDataRepository } from "../../core/storage";
import type { NexusData } from "../../shared/types";

export interface NexusDataState {
  data: NexusData;
  ready: boolean;
  storageError: Error | null;
  setData: Dispatch<SetStateAction<NexusData>>;
  saveNow: (nextData?: NexusData) => Promise<void>;
  updateAndSave: (
    updater: (current: NexusData) => NexusData,
  ) => Promise<NexusData>;
}

/**
 * React-facing boundary for the asynchronous Nexus repository.
 *
 * UI components receive one canonical NexusData object and never touch the
 * browser storage API. A failed load is intentionally read-only so malformed
 * or future-version data cannot be overwritten by a default render.
 */
export function useNexusData(): NexusDataState {
  const repository = getNexusDataRepository();
  const [data, setReactData] = useState<NexusData>(() => getDefaultNexusData());
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<Error | null>(null);
  const dataRef = useRef(data);
  const writableRef = useRef(false);
  const skipNextAutomaticSave = useRef(false);

  const setData = useCallback<Dispatch<SetStateAction<NexusData>>>((action) => {
    setReactData((current) => {
      const next = typeof action === "function"
        ? (action as (value: NexusData) => NexusData)(current)
        : action;
      dataRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    void repository.load()
      .then((loaded) => {
        if (!active) return;
        dataRef.current = loaded;
        skipNextAutomaticSave.current = true;
        setReactData(loaded);
        writableRef.current = true;
        setStorageError(null);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        writableRef.current = false;
        setStorageError(error instanceof Error ? error : new Error("Nexus data could not be loaded."));
        setReady(true);
      });
    return () => { active = false; };
  }, [repository]);

  useEffect(() => {
    if (!ready || !writableRef.current) return;
    if (skipNextAutomaticSave.current) {
      skipNextAutomaticSave.current = false;
      return;
    }
    // Enqueue immediately once React commits the change. A delayed timer can
    // be cancelled by a fast Home → Calendar navigation or page refresh.
    void repository.save(dataRef.current).catch((error: unknown) => {
      setStorageError(error instanceof Error ? error : new Error("Nexus data could not be saved."));
    });
  }, [data, ready, repository]);

  useEffect(() => {
    const receiveExternalSave = (event: StorageEvent) => {
      if (event.key !== NEXUS_STORAGE_KEY) return;
      void repository.load()
        .then((loaded) => {
          dataRef.current = loaded;
          skipNextAutomaticSave.current = true;
          writableRef.current = true;
          setReactData(loaded);
          setStorageError(null);
        })
        .catch((error: unknown) => {
          setStorageError(error instanceof Error ? error : new Error("Nexus data could not be synchronized."));
        });
    };
    window.addEventListener("storage", receiveExternalSave);
    return () => window.removeEventListener("storage", receiveExternalSave);
  }, [repository]);

  const saveNow = useCallback(async (nextData?: NexusData) => {
    if (!writableRef.current) {
      throw storageError ?? new Error("Nexus storage is not writable.");
    }
    const value = nextData ?? dataRef.current;
    await repository.save(value);
    setStorageError(null);
  }, [repository, storageError]);

  const updateAndSave = useCallback(async (
    updater: (current: NexusData) => NexusData,
  ) => {
    if (!writableRef.current) {
      throw storageError ?? new Error("Nexus storage is not writable.");
    }
    const next = updater(dataRef.current);
    dataRef.current = next;
    skipNextAutomaticSave.current = true;
    setReactData(next);
    await repository.save(next);
    setStorageError(null);
    return next;
  }, [repository, storageError]);

  return {
    data,
    ready,
    storageError,
    setData,
    saveNow,
    updateAndSave,
  };
}
