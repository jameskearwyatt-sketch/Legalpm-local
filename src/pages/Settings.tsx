import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Fingerprint, Loader2, Trash2, Smartphone, Bell, Save } from 'lucide-react';
import { useWebAuthn } from '@/lib/hooks/useWebAuthn';
import { useUserSettings } from '@/lib/hooks/useUserSettings';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Passkey {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
}

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
  const [hasPlatformAuth, setHasPlatformAuth] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    isSupported: webAuthnSupported, 
    isLoading: webAuthnLoading,
    checkPlatformAuthenticator,
    registerPasskey,
  } = useWebAuthn();

  // Check if platform authenticator is available
  useEffect(() => {
    const checkAuth = async () => {
      if (webAuthnSupported) {
        const available = await checkPlatformAuthenticator();
        setHasPlatformAuth(available);
      }
    };
    checkAuth();
  }, [webAuthnSupported, checkPlatformAuthenticator]);

  // Load user's passkeys
  useEffect(() => {
    const loadPasskeys = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('passkeys')
        .select('id, device_name, created_at, last_used_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPasskeys(data);
      }
      setLoadingPasskeys(false);
    };

    loadPasskeys();
  }, [user]);

  const handleRegisterPasskey = async () => {
    if (!user?.id) return;

    const deviceName = navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
      ? 'iPhone/iPad Face ID'
      : navigator.userAgent.includes('Mac')
        ? 'Mac Touch ID'
        : 'Device Biometric';

    const result = await registerPasskey(deviceName);

    if (result.success) {
      toast({
        title: 'Face ID registered',
        description: 'You can now sign in with Face ID on this device.',
      });
      // Reload passkeys
      const { data } = await supabase
        .from('passkeys')
        .select('id, device_name, created_at, last_used_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setPasskeys(data);
    } else {
      toast({
        title: 'Registration failed',
        description: result.error || 'Could not register Face ID.',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePasskey = async (id: string) => {
    setDeletingId(id);
    
    const { error } = await supabase
      .from('passkeys')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Could not remove passkey.',
        variant: 'destructive',
      });
    } else {
      setPasskeys(passkeys.filter(p => p.id !== id));
      toast({
        title: 'Passkey removed',
        description: 'The passkey has been removed from your account.',
      });
    }
    
    setDeletingId(null);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your preferences and security settings</p>
        </div>

        <AlertPreferencesCard />

        {/* Face ID / Biometric Settings */}
        {!hasPlatformAuth && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Fingerprint className="h-5 w-5" />
                Face ID / Touch ID
              </CardTitle>
              <CardDescription>
                This device does not support biometric sign-in. Open Legal PM on an iPhone, iPad,
                or a Mac with Touch ID to register a biometric passkey.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        {hasPlatformAuth && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Fingerprint className="h-5 w-5" />
                Face ID / Touch ID
              </CardTitle>
              <CardDescription>
                Use biometric authentication to sign in quickly on your devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleRegisterPasskey} 
                disabled={webAuthnLoading}
                className="w-full sm:w-auto"
              >
                {webAuthnLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <Fingerprint className="mr-2 h-4 w-4" />
                    Register Face ID / Touch ID
                  </>
                )}
              </Button>

              {loadingPasskeys ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading registered devices...
                </div>
              ) : passkeys.length > 0 ? (
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-sm font-medium">Registered Devices</Label>
                  {passkeys.map((passkey) => (
                    <div 
                      key={passkey.id} 
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{passkey.device_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Added {new Date(passkey.created_at).toLocaleDateString()}
                            {passkey.last_used_at && (
                              <> • Last used {new Date(passkey.last_used_at).toLocaleDateString()}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePasskey(passkey.id)}
                        disabled={deletingId === passkey.id}
                      >
                        {deletingId === passkey.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground pt-2">
                  No devices registered. Register Face ID or Touch ID to sign in faster.
                </p>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </AppLayout>
  );
}
