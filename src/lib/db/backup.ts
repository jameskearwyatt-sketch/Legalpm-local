import { exportDatabase, importDatabase, resetDb } from './pglite';
import { format } from 'date-fns';

export async function downloadBackup(): Promise<void> {
  const blob = await exportDatabase();
  const filename = `LegalPM-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.legalpm`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreFromBackup(file: File | Blob): Promise<void> {
  await importDatabase(file);
}

export async function clearAllData(): Promise<void> {
  await resetDb();
  window.location.reload();
}

export async function getStorageEstimate(): Promise<{ used: number; quota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { used: est.usage ?? 0, quota: est.quota ?? 0 };
    }
  } catch {
    // Not available
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
