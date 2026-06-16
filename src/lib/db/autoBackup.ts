import { useSyncExternalStore } from 'react';
import { exportDatabase } from './pglite';

/**
 * Continuous local-disk auto-backup using the File System Access API.
 *
 * The user picks a `.legalpm` file once; the file handle is persisted in
 * IndexedDB so it survives reloads. After that the app writes the whole
 * database to that file automatically:
 *   - debounced a few seconds after any data change,
 *   - on a 5-minute safety interval (only if something changed),
 *   - when the tab is hidden/closed (best effort).
 *
 * Only Chromium browsers (Chrome/Edge desktop) support this API. Elsewhere the
 * manager reports `unsupported` and the app falls back to manual export.
 */

// ---- Minimal File System Access API types (not in the default TS DOM lib) ----
interface FsWritable {
  write: (data: BlobPart) => Promise<void>;
  close: () => Promise<void>;
}
interface FsFileHandle {
  name: string;
  createWritable: (opts?: { keepExistingData?: boolean }) => Promise<FsWritable>;
  queryPermission: (d: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission: (d: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}
type WindowWithPicker = Window &
  typeof globalThis & {
    showSaveFilePicker?: (opts?: SaveFilePickerOptions) => Promise<FsFileHandle>;
  };

export function isAutoBackupSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

// ---- Tiny IndexedDB key/value store for the persisted file handle ----
const IDB_NAME = 'legalpm-autobackup';
const STORE = 'kv';
const HANDLE_KEY = 'fileHandle';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDel(key: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type AutoBackupStatus =
  | 'unsupported' // browser can't do File System Access
  | 'off' // no file chosen yet
  | 'active' // file chosen, permission granted, watching
  | 'needs-permission' // file remembered but permission must be re-granted (one click)
  | 'saving'
  | 'error';

export interface AutoBackupState {
  status: AutoBackupStatus;
  fileName: string | null;
  lastSavedAt: number | null;
  error: string | null;
}

const DEBOUNCE_MS = 8_000;
const INTERVAL_MS = 5 * 60_000;

class AutoBackupManager {
  private handle: FsFileHandle | null = null;
  private dirty = false;
  private saving = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityBound = false;
  private listeners = new Set<() => void>();

  private snapshot: AutoBackupState = {
    status: isAutoBackupSupported() ? 'off' : 'unsupported',
    fileName: null,
    lastSavedAt: null,
    error: null,
  };

  // ---- external store wiring (for useSyncExternalStore) ----
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = (): AutoBackupState => this.snapshot;

  private setState(patch: Partial<AutoBackupState>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Mark that data changed; schedule a debounced save if active. */
  markDirty = (): void => {
    if (!this.handle) return;
    this.dirty = true;
    if (this.snapshot.status === 'active' || this.snapshot.status === 'saving') {
      this.scheduleDebounced();
    }
  };

  private scheduleDebounced() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.save(false), DEBOUNCE_MS);
  }

  /** Re-attach a remembered handle on app load (no permission prompt). */
  resume = async (): Promise<void> => {
    if (!isAutoBackupSupported()) return;
    try {
      const handle = await idbGet<FsFileHandle>(HANDLE_KEY);
      if (!handle) return;
      this.handle = handle;
      const granted = (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
      this.setState({ fileName: handle.name, status: granted ? 'active' : 'needs-permission' });
      if (granted) this.startTimers();
    } catch {
      // ignore — leave status as 'off'
    }
  };

  /** First-time setup: prompt for a file (requires a user gesture). */
  setup = async (): Promise<void> => {
    const w = window as WindowWithPicker;
    if (!w.showSaveFilePicker) {
      this.setState({ status: 'unsupported' });
      return;
    }
    const handle = await w.showSaveFilePicker({
      suggestedName: 'LegalPM-autosave.legalpm',
      types: [{ description: 'LegalPM backup', accept: { 'application/octet-stream': ['.legalpm'] } }],
    });
    this.handle = handle;
    await idbSet(HANDLE_KEY, handle);
    this.setState({ fileName: handle.name, error: null });
    this.startTimers();
    await this.save(true);
  };

  /** Re-grant permission after a reload (requires a user gesture). */
  reconnect = async (): Promise<void> => {
    if (!this.handle) return;
    const granted = (await this.handle.requestPermission({ mode: 'readwrite' })) === 'granted';
    if (granted) {
      this.setState({ status: 'active', error: null });
      this.startTimers();
      await this.save(true);
    } else {
      this.setState({ status: 'needs-permission' });
    }
  };

  /** Stop auto-backup and forget the file. */
  disable = async (): Promise<void> => {
    this.stopTimers();
    this.handle = null;
    this.dirty = false;
    try {
      await idbDel(HANDLE_KEY);
    } catch {
      /* ignore */
    }
    this.setState({ status: 'off', fileName: null, lastSavedAt: null, error: null });
  };

  /** Force a save now (e.g. a "Save now" button). */
  saveNow = (): Promise<void> => this.save(true);

  private async save(force: boolean): Promise<void> {
    if (!this.handle) return;
    if (this.saving) return; // a save is in flight; dirty stays set for the next pass
    if (!force && !this.dirty) return;

    try {
      const perm = await this.handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        this.setState({ status: 'needs-permission' });
        return;
      }
      this.saving = true;
      this.setState({ status: 'saving' });
      const blob = await exportDatabase();
      const writable = await this.handle.createWritable();
      await writable.write(blob);
      await writable.close();
      this.dirty = false;
      this.setState({ status: 'active', lastSavedAt: Date.now(), error: null });
    } catch (e) {
      this.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      this.saving = false;
    }
  }

  private startTimers() {
    if (!this.intervalTimer) {
      this.intervalTimer = setInterval(() => {
        if (this.dirty) void this.save(false);
      }, INTERVAL_MS);
    }
    if (!this.visibilityBound && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.visibilityBound = true;
    }
  }

  private stopTimers() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.visibilityBound && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.visibilityBound = false;
    }
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && this.dirty) {
      void this.save(false);
    }
  };
}

export const autoBackup = new AutoBackupManager();

/** React hook exposing live auto-backup state + actions. */
export function useAutoBackup() {
  const state = useSyncExternalStore(autoBackup.subscribe, autoBackup.getSnapshot, autoBackup.getSnapshot);
  return {
    ...state,
    isSupported: isAutoBackupSupported(),
    setup: autoBackup.setup,
    reconnect: autoBackup.reconnect,
    disable: autoBackup.disable,
    saveNow: autoBackup.saveNow,
  };
}
