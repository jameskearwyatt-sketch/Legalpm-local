import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Star, Users, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Client } from '@/lib/hooks/useClients';
import { ClientForm } from '@/components/forms/ClientForm';

export interface ClientAllocation {
  client_id: string;
  cm_number: string;
  is_master: boolean;
  fee_percentage: number;
}

interface MultiClientSectionProps {
  isMultiClient: boolean;
  onMultiClientChange: (value: boolean) => void;
  clientAllocations: ClientAllocation[];
  onAllocationsChange: (allocations: ClientAllocation[]) => void;
  clients: Client[];
  clientsLoading: boolean;
  // For single-client fallback
  singleClientId: string;
  onSingleClientChange: (clientId: string) => void;
  singleClientError?: string;
  onClientCreated?: () => void;
}

export function MultiClientSection({
  isMultiClient,
  onMultiClientChange,
  clientAllocations,
  onAllocationsChange,
  clients,
  clientsLoading,
  singleClientId,
  onSingleClientChange,
  singleClientError,
  onClientCreated,
}: MultiClientSectionProps) {
  const [totalPercentage, setTotalPercentage] = useState(0);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);

  // Calculate total percentage whenever allocations change
  useEffect(() => {
    const total = clientAllocations.reduce((sum, a) => sum + (a.fee_percentage || 0), 0);
    setTotalPercentage(total);
  }, [clientAllocations]);

  const addClient = () => {
    onAllocationsChange([
      ...clientAllocations,
      {
        client_id: '',
        cm_number: '',
        is_master: clientAllocations.length === 0, // First client is master by default
        fee_percentage: 0,
      },
    ]);
  };

  const removeClient = (index: number) => {
    const updated = clientAllocations.filter((_, i) => i !== index);
    // If we removed the master, make the first remaining one the master
    if (updated.length > 0 && !updated.some(a => a.is_master)) {
      updated[0].is_master = true;
    }
    onAllocationsChange(updated);
  };

  const updateAllocation = (index: number, field: keyof ClientAllocation, value: any) => {
    const updated = [...clientAllocations];
    
    // If setting a new master, unset the previous one
    if (field === 'is_master' && value === true) {
      updated.forEach((a, i) => {
        if (i !== index) a.is_master = false;
      });
    }
    
    (updated[index] as any)[field] = value;
    onAllocationsChange(updated);
  };

  const getAvailableClients = (currentClientId: string) => {
    const usedClientIds = clientAllocations.map(a => a.client_id).filter(id => id !== currentClientId);
    return clients.filter(c => !usedClientIds.includes(c.id));
  };

  const isValidTotal = totalPercentage === 100;
  const hasDuplicateClients = new Set(clientAllocations.map(a => a.client_id).filter(Boolean)).size !== 
    clientAllocations.filter(a => a.client_id).length;

  // If not multi-client, show standard single client selector
  if (!isMultiClient) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Users className="h-5 w-5" />
            Client
          </CardTitle>
          <CardDescription>Select the client for this matter</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_multi_client"
              checked={isMultiClient}
              onCheckedChange={(checked) => onMultiClientChange(checked === true)}
            />
            <Label htmlFor="is_multi_client" className="font-normal cursor-pointer">
              This is a multi-client matter
            </Label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="client_id">Client *</Label>
            <Select
              value={singleClientId}
              onValueChange={(value) => {
                if (value === '__add_new__') {
                  setShowNewClientDialog(true);
                } else {
                  onSingleClientChange(value);
                }
              }}
              disabled={clientsLoading}
            >
              <SelectTrigger className={singleClientError ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__add_new__" className="text-primary font-medium">
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add New Client
                  </span>
                </SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {singleClientError && (
              <p className="text-sm text-destructive">{singleClientError}</p>
            )}
          </div>
          
          {/* New Client Dialog */}
          <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <ClientForm 
                onSuccess={() => {
                  setShowNewClientDialog(false);
                  onClientCreated?.();
                }} 
              />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  // Multi-client UI
  return (
    <Card className="shadow-card border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Multi-Client Matter
        </CardTitle>
        <CardDescription>
          Add multiple clients with their fee allocations. One client must be designated as the master (where time is recorded).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_multi_client"
            checked={isMultiClient}
            onCheckedChange={(checked) => onMultiClientChange(checked === true)}
          />
          <Label htmlFor="is_multi_client" className="font-normal cursor-pointer">
            This is a multi-client matter
          </Label>
        </div>

        {/* Client allocations */}
        <div className="space-y-3">
          {clientAllocations.map((allocation, index) => (
            <div
              key={index}
              className={cn(
                "p-4 rounded-lg border space-y-3",
                allocation.is_master ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {allocation.is_master && (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary">
                      <Star className="h-3 w-3 fill-primary" />
                      Master Matter
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeClient(index)}
                  disabled={clientAllocations.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label className="text-xs">Client *</Label>
                  <Select
                    value={allocation.client_id}
                    onValueChange={(v) => {
                      if (v === '__add_new__') {
                        setShowNewClientDialog(true);
                      } else {
                        updateAllocation(index, 'client_id', v);
                      }
                    }}
                    disabled={clientsLoading}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__add_new__" className="text-primary font-medium">
                        <span className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4" />
                          Add New Client
                        </span>
                      </SelectItem>
                      {getAvailableClients(allocation.client_id).map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">C/M Number {allocation.is_master && '*'}</Label>
                  <Input
                    value={allocation.cm_number}
                    onChange={(e) => updateAllocation(index, 'cm_number', e.target.value)}
                    placeholder="e.g., 51339685"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Fee % *</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={allocation.fee_percentage || ''}
                    onChange={(e) => updateAllocation(index, 'fee_percentage', parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 33.33"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5 flex items-end">
                  <div className="flex items-center space-x-2 pb-2">
                    <Checkbox
                      id={`is_master_${index}`}
                      checked={allocation.is_master}
                      onCheckedChange={(checked) => updateAllocation(index, 'is_master', checked === true)}
                    />
                    <Label htmlFor={`is_master_${index}`} className="text-xs font-normal cursor-pointer">
                      Master Matter
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add client button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addClient}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>

        {/* Total percentage indicator */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg",
          isValidTotal ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}>
          <span className="text-sm font-medium">Total Fee Allocation</span>
          <span className="text-lg font-bold">
            {totalPercentage.toFixed(1)}%
            {!isValidTotal && " (must equal 100%)"}
          </span>
        </div>

        {hasDuplicateClients && (
          <p className="text-sm text-destructive">Each client can only be added once.</p>
        )}
        
        {/* New Client Dialog */}
        <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <ClientForm 
              onSuccess={() => {
                setShowNewClientDialog(false);
                onClientCreated?.();
              }} 
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
