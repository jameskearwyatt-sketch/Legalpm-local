import { useState } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAutoBackup } from '@/lib/db/autoBackup';

/**
 * Slim, app-wide nudge for the local auto-backup feature:
 *  - prompts first-time setup (dismissible, remembered)
 *  - asks to re-grant file permission after a browser restart
 *  - surfaces a save error
 * Stays out of the way once auto-backup is running.
 */
const DISMISS_KEY = 'autobackup-nudge-dismissed';

export default function AutoBackupBanner() {
  const { status, error, isSupported, setup, reconnect, saveNow } = useAutoBackup();
  const [dismissedOff, setDismissedOff] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1'
  );
  const [dismissedSession, setDismissedSession] = useState(false);

  // Only Chromium browsers support the API; don't nag elsewhere.
  if (!isSupported) return null;

  if (status === 'off') {
    if (dismissedOff) return null;
    return (
      <Banner tone="info" icon={<ShieldCheck className="h-4 w-4" />}>
        <span className="flex-1">
          <strong>Protect your work.</strong> Set up automatic local backup so your data is saved to a file on your computer and never lost.
        </span>
        <Button
          size="sm"
          className="h-7"
          onClick={async () => {
            try {
              await setup();
            } catch (e) {
              if (e instanceof DOMException && e.name === 'AbortError') return;
            }
          }}
        >
          Set up
        </Button>
        <DismissButton
          onClick={() => {
            try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
            setDismissedOff(true);
          }}
        />
      </Banner>
    );
  }

  if (status === 'needs-permission' && !dismissedSession) {
    return (
      <Banner tone="warn" icon={<RefreshCw className="h-4 w-4" />}>
        <span className="flex-1">
          <strong>Resume auto-backup.</strong> The browser needs permission again to keep saving your data to disk.
        </span>
        <Button size="sm" className="h-7" onClick={() => void reconnect()}>
          Resume
        </Button>
        <DismissButton onClick={() => setDismissedSession(true)} />
      </Banner>
    );
  }

  if (status === 'error' && !dismissedSession) {
    return (
      <Banner tone="error" icon={<AlertTriangle className="h-4 w-4" />}>
        <span className="flex-1">
          <strong>Auto-backup failed.</strong> {error || 'The last save did not complete.'}
        </span>
        <Button size="sm" variant="outline" className="h-7" onClick={() => void saveNow()}>
          Retry
        </Button>
        <DismissButton onClick={() => setDismissedSession(true)} />
      </Banner>
    );
  }

  return null;
}

function Banner({ tone, icon, children }: { tone: 'info' | 'warn' | 'error'; icon: React.ReactNode; children: React.ReactNode }) {
  const tones = {
    info: 'border-primary/30 bg-primary/5 text-foreground',
    warn: 'border-amber-300 bg-amber-50 text-amber-900',
    error: 'border-destructive/40 bg-destructive/10 text-foreground',
  };
  return (
    <div className={`flex items-center gap-2 border-b px-3 py-2 text-sm sm:px-6 ${tones[tone]}`}>
      <span className="shrink-0">{icon}</span>
      {children}
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Dismiss" className="shrink-0 rounded p-1 hover:bg-black/5">
      <X className="h-4 w-4" />
    </button>
  );
}
