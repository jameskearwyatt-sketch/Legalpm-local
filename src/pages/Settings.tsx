import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Loader2, Bell, Save, Download, Upload, AlertTriangle, HardDrive, FileUp, ShieldCheck, RefreshCw, Power } from 'lucide-react';
import { useUserSettings } from '@/lib/hooks/useUserSettings';
import { useToast } from '@/hooks/use-toast';
import { downloadBackup, restoreFromBackup, clearAllData, getStorageEstimate, formatBytes } from '@/lib/db/backup';
import { importDataExport } from '@/lib/db/importData';
import { useAutoBackup } from '@/lib/db/autoBackup';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function AlertPreferencesCard() {
  const { settings, isLoading, updateSettings } = useUserSettings();
  const { toast } = useToast();
  const [nearBudget, setNearBudget] = useState(80);
  const [poorCollection, setPoorCollection] = useState(60);
  const [wipWarning, setWipWarning] = useState(50000);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setNearBudget(settings.near_budget_threshold);
      setPoorCollection(settings.poor_collection_threshold);
      setWipWarning(settings.wip_warning_threshold);
    }
  }, [settings]);

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      near_budget_threshold: nearBudget,
      poor_collection_threshold: poorCollection,
      wip_warning_threshold: wipWarning,
    });
    setDirty(false);
    toast({ title: 'Alert preferences saved' });
  };

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Bell className="h-5 w-5" />
          Alert Preferences
        </CardTitle>
        <CardDescription>
          Configure when Red Flag alerts are triggered for your matters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Near Budget Threshold</Label>
            <span className="text-sm font-medium">{nearBudget}%</span>
          </div>
          <Slider
            value={[nearBudget]}
            onValueChange={([v]) => { setNearBudget(v); setDirty(true); }}
            min={50}
            max={95}
            step={5}
          />
          <p className="text-xs text-muted-foreground">Alert when budget usage reaches this percentage</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Poor Collection Threshold</Label>
            <span className="text-sm font-medium">{poorCollection}%</span>
          </div>
          <Slider
            value={[poorCollection]}
            onValueChange={([v]) => { setPoorCollection(v); setDirty(true); }}
            min={30}
            max={80}
            step={5}
          />
          <p className="text-xs text-muted-foreground">Alert when collection rate falls below this percentage</p>
        </div>

        <div className="space-y-3">
          <Label>High WIP Warning ($)</Label>
          <Input
            type="number"
            value={wipWarning}
            onChange={e => { setWipWarning(Number(e.target.value)); setDirty(true); }}
            min={10000}
            max={500000}
            step={5000}
          />
          <p className="text-xs text-muted-foreground">Alert when WIP exceeds this amount (with low billing ratio)</p>
        </div>

        {dirty && (
          <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full sm:w-auto">
            {updateSettings.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Save Preferences</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your preferences and data</p>
        </div>

        <AlertPreferencesCard />
        <AutoBackupCard />
        <DataStorageCard />
      </div>
    </AppLayout>
  );
}

function AutoBackupCard() {
  const { toast } = useToast();
  const { status, fileName, lastSavedAt, error, isSupported, setup, reconnect, disable, saveNow } = useAutoBackup();

  const handleSetup = async () => {
    try {
      await setup();
      toast({ title: 'Auto-backup on', description: 'Your data will now be saved to that file automatically.' });
    } catch (e) {
      // The user cancelling the file picker throws AbortError — ignore that.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toast({ title: 'Could not set up auto-backup', description: String(e), variant: 'destructive' });
    }
  };

  const handleSaveNow = async () => {
    await saveNow();
    toast({ title: 'Saved to disk' });
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <ShieldCheck className="h-5 w-5" />
          Automatic local backup
        </CardTitle>
        <CardDescription>
          Keep a continuously updated copy of your data in a file on your computer, so you never lose work — even if the browser is cleared.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSupported && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Automatic backup isn’t supported in this browser. Use <strong>Chrome</strong> or <strong>Edge</strong> for hands-off backups,
            or use <strong>Export Backup</strong> below to save manually.
          </div>
        )}

        {isSupported && status === 'off' && (
          <>
            <p className="text-sm text-muted-foreground">
              Choose a file once (e.g. in a synced folder like OneDrive, Dropbox, or iCloud Drive). The app then saves to it automatically
              a few seconds after each change.
            </p>
            <Button onClick={handleSetup} className="w-full sm:w-auto">
              <ShieldCheck className="mr-2 h-4 w-4" /> Set up auto-backup
            </Button>
          </>
        )}

        {isSupported && status === 'needs-permission' && (
          <>
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Auto-backup is set up{fileName ? <> for <strong>{fileName}</strong></> : null}, but the browser needs your permission again
              to keep writing to it (this happens after restarting the browser). Click resume to continue.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void reconnect()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Resume auto-backup
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void disable()}>
                <Power className="mr-2 h-4 w-4" /> Turn off
              </Button>
            </div>
          </>
        )}

        {isSupported && (status === 'active' || status === 'saving' || status === 'error') && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${status === 'error' ? 'bg-destructive' : status === 'saving' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span className="font-medium">
                {status === 'saving' ? 'Saving…' : status === 'error' ? 'Auto-backup error' : 'Auto-backup on'}
              </span>
              {fileName && <span className="text-muted-foreground">· {fileName}</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              {status === 'error'
                ? error
                : lastSavedAt
                  ? `Last saved ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}.`
                  : 'Waiting for the first change to save.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveNow} disabled={status === 'saving'}>
                <Save className="mr-2 h-4 w-4" /> Save now
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void disable()}>
                <Power className="mr-2 h-4 w-4" /> Turn off
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DataStorageCard() {
  const { toast } = useToast();
  const [storageUsed, setStorageUsed] = useState<string>('');
  const [storageQuota, setStorageQuota] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingCloud, setImportingCloud] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStorageEstimate().then(est => {
      if (est) {
        setStorageUsed(formatBytes(est.used));
        setStorageQuota(formatBytes(est.quota));
      }
    });
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadBackup();
      toast({ title: 'Backup downloaded', description: 'Your database has been exported.' });
    } catch (e) {
      toast({ title: 'Export failed', description: String(e), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmRestore(true);
    e.target.value = '';
  };

  const handleRestore = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setConfirmRestore(false);
    try {
      await restoreFromBackup(pendingFile);
      toast({ title: 'Restore complete', description: 'Your data has been restored. Reloading...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      toast({ title: 'Restore failed', description: String(e), variant: 'destructive' });
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  const handleClear = async () => {
    setConfirmClear(false);
    try {
      await clearAllData();
    } catch (e) {
      toast({ title: 'Clear failed', description: String(e), variant: 'destructive' });
    }
  };

  const handleImportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImportFile(file);
    setConfirmImport(true);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!pendingImportFile) return;
    setImportingCloud(true);
    setConfirmImport(false);
    try {
      const result = await importDataExport(pendingImportFile);
      const summary = `Imported ${result.inserted} row(s) across ${result.tablesWithData} table(s).`;
      const description = result.warnings.length > 0
        ? `${summary} ${result.warnings.length} warning(s). Reloading...`
        : `${summary} Reloading...`;
      if (result.warnings.length > 0) {
        console.warn('[LegalPM] Cloud import warnings:\n' + result.warnings.join('\n'));
      }
      toast({ title: 'Import complete', description });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      toast({ title: 'Import failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setImportingCloud(false);
      setPendingImportFile(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Data Storage
          </CardTitle>
          <CardDescription>
            Your data is stored locally in your browser. Export regularly to avoid data loss.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storageUsed && (
            <div className="text-sm text-muted-foreground">
              Using {storageUsed} of {storageQuota} available
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Export Backup
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Restore from Backup
            </Button>
            <input ref={fileInputRef} type="file" accept=".legalpm" className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()} disabled={importingCloud}>
              {importingCloud ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
              Import data from cloud export
            </Button>
            <input ref={importInputRef} type="file" accept=".json,application/json,text/json" className="hidden" onChange={handleImportSelect} />
          </div>
          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmClear(true)}>
              <AlertTriangle className="h-4 w-4 mr-1" />
              Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all current data with the backup. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import data from cloud export?</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge the records from the selected <code>legalpm-data-export</code> JSON file into your
              local database. Existing rows are kept (matching records are skipped), so this is safe to re-run.
              The app will reload when the import finishes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all data from your browser. Export a backup first if you want to keep your data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
