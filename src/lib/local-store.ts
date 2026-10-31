import { invoke, isTauri } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";

type RecordEntry = { key: string; value: string | null };
const managed = (key: string) =>
  /^(genie\.(workspace\.|chat\.|conversation\.|revisions\.|marketing\.composer\.)|genie\.(canvas|presets|content\.v1|marketing\.posts|standard-branding\.v1|removed-presets\.v1)$)/.test(
    key,
  );
const cache = new Map<string, string>();
const pending = new Map<string, string | null>();
const listeners = new Set<() => void>();
let ready = false,
  db: IDBDatabase | undefined,
  writing: Promise<void> | undefined;
let saveTimer: number | undefined;
let status = { saving: false, error: "" };
function publish(error = "") {
  status = { saving: pending.size > 0 || !!writing, error };
  listeners.forEach((fn) => fn());
}
export function useLocalStorageStatus() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => status,
  );
}
function transaction(records: RecordEntry[]) {
  return new Promise<void>((resolve, reject) => {
    const tx = db!.transaction("documents", "readwrite"),
      store = tx.objectStore("documents");
    for (const record of records)
      record.value === null
        ? store.delete(record.key)
        : store.put(record.value, record.key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Local save was interrupted."));
  });
}
async function read(): Promise<RecordEntry[]> {
  if (isTauri()) return invoke("disk_load");
  return new Promise((resolve, reject) => {
    const result: RecordEntry[] = [],
      request = db!
        .transaction("documents")
        .objectStore("documents")
        .openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(result);
        return;
      }
      result.push({ key: String(cursor.key), value: cursor.value });
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}
function equivalent(a: string, b: string) {
  const normalize = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(normalize)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, normalize(value)]),
          )
        : value;
  try {
    return (
      JSON.stringify(normalize(JSON.parse(a))) ===
      JSON.stringify(normalize(JSON.parse(b)))
    );
  } catch {
    return a === b;
  }
}
export async function initializeLocalStore() {
  if (ready) return;
  if (!isTauri())
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("genie-library", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("documents");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(
          new Error("Close other Genie tabs and retry opening your library."),
        );
    });
  const existing = await read(),
    keys = new Set(existing.map((record) => record.key));
  const legacy: RecordEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (managed(key)) legacy.push({ key, value: localStorage.getItem(key) });
  }
  const missing = legacy.filter((record) => !keys.has(record.key));
  if (missing.length) {
    if (isTauri())
      await invoke("disk_write", { records: missing, migration: true });
    else await transaction(missing);
  }
  const verified = await read();
  cache.clear();
  for (const record of verified)
    if (record.value !== null) cache.set(record.key, record.value);
  for (const record of missing)
    if (
      !cache.has(record.key) ||
      !equivalent(cache.get(record.key)!, record.value!)
    )
      throw new Error(
        "Library migration could not be verified. Your original data has been kept.",
      );
  for (const record of legacy)
    if (
      cache.has(record.key) &&
      equivalent(cache.get(record.key)!, record.value!)
    )
      localStorage.removeItem(record.key);
  ready = true;
  if (!isTauri()) void navigator.storage?.persist?.().catch(() => {});
}
export async function flushLocalStore(): Promise<void> {
  if (writing) await writing;
  if (!pending.size) return;
  const batch = [...pending].map(([key, value]) => ({ key, value }));
  pending.clear();
  writing = (async () => {
    try {
      if (isTauri()) await invoke("disk_write", { records: batch });
      else await transaction(batch);
    } catch (error) {
      for (const record of batch)
        if (!pending.has(record.key)) pending.set(record.key, record.value);
      throw error;
    }
  })();
  publish();
  try {
    await writing;
    writing = undefined;
    publish();
  } catch (error) {
    writing = undefined;
    publish(String(error));
    throw error;
  }
  if (pending.size) await flushLocalStore();
}
function queue(key: string, value: string | null) {
  if ((cache.get(key) ?? null) === value) return;
  if (value === null) cache.delete(key);
  else cache.set(key, value);
  pending.set(key, value);
  publish();
  if (saveTimer === undefined)
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      void flushLocalStore().catch(() => {});
    }, 150);
}
function keys() {
  const result = new Set(cache.keys());
  for (let i = 0; i < localStorage.length; i++)
    result.add(localStorage.key(i)!);
  return [...result];
}
export const localStore = {
  getItem(key: string) {
    return ready && managed(key)
      ? (cache.get(key) ?? null)
      : localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (ready && managed(key)) queue(key, value);
    else localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (ready && managed(key)) queue(key, null);
    else localStorage.removeItem(key);
  },
  get length() {
    return ready ? keys().length : localStorage.length;
  },
  key(index: number) {
    return ready ? (keys()[index] ?? null) : localStorage.key(index);
  },
};
export async function prepareLocalSave() {
  const detail = { errors: [] as string[] };
  window.dispatchEvent(new CustomEvent("genie:prepare-update", { detail }));
  if (detail.errors.length) throw new Error(detail.errors.join(" "));
  await flushLocalStore();
}
