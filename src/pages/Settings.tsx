import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings as SettingsIcon, Fingerprint, Loader2, Trash2, Smartphone } from 'lucide-react';
import { useWebAuthn } from '@/lib/hooks/useWebAuthn';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Passkey {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
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
          <p className="text-muted-foreground mt-1">Manage your preferences and thresholds</p>
        </div>

        {/* Face ID / Biometric Settings */}
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

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-lg">
              <SettingsIcon className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              Configure default values and alert thresholds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Select defaultValue="GBP">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                  <SelectItem value="AUD">AUD (A$)</SelectItem>
                  <SelectItem value="CAD">CAD (C$)</SelectItem>
                  <SelectItem value="SGD">SGD (S$)</SelectItem>
                  <SelectItem value="SEK">SEK (kr)</SelectItem>
                  <SelectItem value="Ringgit">Ringgit (RM)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Default currency for new matters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="near_budget">Near Budget Warning (%)</Label>
              <Input
                id="near_budget"
                type="number"
                min="50"
                max="99"
                defaultValue="80"
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                Alert when budget usage exceeds this percentage
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poor_collection">Poor Collection Warning (%)</Label>
              <Input
                id="poor_collection"
                type="number"
                min="10"
                max="90"
                defaultValue="60"
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                Alert when collection rate falls below this percentage
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wip_threshold">High WIP Threshold (£)</Label>
              <Input
                id="wip_threshold"
                type="number"
                min="0"
                step="1000"
                defaultValue="50000"
                className="w-40"
              />
              <p className="text-sm text-muted-foreground">
                Alert when unbilled WIP exceeds this amount with low billing
              </p>
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label htmlFor="billed_only">Use Billed Only for Budget Burn</Label>
                <p className="text-sm text-muted-foreground">
                  Calculate budget usage based on billed amounts only (excludes WIP)
                </p>
              </div>
              <Switch id="billed_only" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Account management features coming soon. For now, you can sign out from the sidebar menu.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
