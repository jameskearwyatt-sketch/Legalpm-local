import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Building, Layers, DollarSign, ArrowRight } from "lucide-react";
import { PricingProposal } from "@/lib/hooks/usePricingProposals";
import { Client } from "@/lib/hooks/useClients";
import { getClientDisplayName } from "@/lib/clientUtils";
import { getCurrencySymbol } from "@/lib/currencyUtils";

interface StepSelectBaseProps {
  proposals: PricingProposal[];
  clients: Client[];
  selectedBaseId: string;
  selectedClientId: string;
  newName: string;
  onBaseChange: (id: string) => void;
  onClientChange: (id: string) => void;
  onNameChange: (name: string) => void;
  onNext: () => void;
}

export function StepSelectBase({
  proposals,
  clients,
  selectedBaseId,
  selectedClientId,
  newName,
  onBaseChange,
  onClientChange,
  onNameChange,
  onNext,
}: StepSelectBaseProps) {
  const base = proposals.find(p => p.id === selectedBaseId);

  // Count items from latest version (we pass this info as part of the proposal data)
  const canProceed = !!selectedBaseId && !!selectedClientId && !!newName.trim();

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Inputs */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Base Proposal (Precedent) *</Label>
            <Select value={selectedBaseId} onValueChange={onBaseChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a precedent proposal" />
              </SelectTrigger>
              <SelectContent>
                {proposals.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.client?.name || "Unknown client"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Client for New Deal *</Label>
            <Select value={selectedClientId} onValueChange={onClientChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {getClientDisplayName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>New Proposal Name *</Label>
            <Input
              value={newName}
              onChange={e => onNameChange(e.target.value)}
              placeholder="e.g., GOSIII Wind Saudi Arabia"
            />
          </div>
        </div>

        {/* Right: Summary card */}
        <Card className={base ? "border-primary/30 bg-primary/5" : "border-dashed"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Base Proposal Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {base ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-medium">{base.client?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Currency:</span>
                  <span className="font-medium">{base.currency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Version:</span>
                  <Badge variant="outline">V{base.current_version}</Badge>
                </div>
                {base.work_phases && (
                  <div>
                    <span className="text-muted-foreground">Phases:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {base.work_phases.map((p: any) => (
                        <Badge key={p.id} variant="secondary" className="text-xs">
                          {p.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Select a base proposal to see its summary
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          Next: Structured Questions
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
