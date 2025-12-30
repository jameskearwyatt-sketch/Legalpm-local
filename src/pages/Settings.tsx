import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your preferences and thresholds</p>
        </div>

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
