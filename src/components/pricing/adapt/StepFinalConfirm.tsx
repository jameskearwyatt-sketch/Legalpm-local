import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Layers, FileText, Loader2 } from "lucide-react";
import { DraftProposalItem, ProposalPhase } from "@/lib/hooks/usePricingProposals";
import { getCurrencySymbol } from "@/lib/currencyUtils";

interface StepFinalConfirmProps {
  proposalName: string;
  clientName: string;
  currency: string;
  phases: ProposalPhase[];
  items: DraftProposalItem[];
  isCreating: boolean;
  onCreate: () => void;
}

export function StepFinalConfirm({
  proposalName,
  clientName,
  currency,
  phases,
  items,
  isCreating,
  onCreate,
}: StepFinalConfirmProps) {
  const sym = getCurrencySymbol(currency);
  const bmItems = items.filter(i => i.provider === "Baker McKenzie");
  const lcItems = items.filter(i => i.provider === "Local Counsel");
  const bmTotal = bmItems.reduce((s, i) => s + (i.fee_upper || i.fee_amount), 0);
  const lcTotal = lcItems.reduce((s, i) => s + (i.fee_upper || i.fee_amount), 0);
  const total = bmTotal + lcTotal;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
        <h2 className="text-xl font-semibold">Ready to Create Proposal</h2>
        <p className="text-muted-foreground">Review the summary below and click Create to generate your new pricing proposal.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Proposal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{proposalName}</p>
            <p className="text-sm text-muted-foreground">{clientName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Work Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-2xl">{items.length}</p>
            <p className="text-xs text-muted-foreground">
              {bmItems.length} BM · {lcItems.length} LC
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Estimated Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-2xl">{sym}{total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              BM: {sym}{bmTotal.toLocaleString()} · LC: {sym}{lcTotal.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {phases.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Layers className="h-4 w-4" /> Phases
          </h3>
          <div className="flex flex-wrap gap-1">
            {phases.map(p => (
              <Badge key={p.id} variant="secondary">{p.name}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-4">
        <Button size="lg" onClick={onCreate} disabled={isCreating}>
          {isCreating ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</>
          ) : (
            <><FileText className="h-4 w-4 mr-2" /> Create Proposal</>
          )}
        </Button>
      </div>
    </div>
  );
}
