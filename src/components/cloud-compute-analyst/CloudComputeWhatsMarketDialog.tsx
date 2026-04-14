import {
  AnalystWhatsMarketDialog,
  type WhatsMarketPrecedentPayload,
} from '@/components/shared/AnalystWhatsMarketDialog';
import type { CloudComputePrecedent } from '@/lib/hooks/useCloudComputeAnalyses';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  precedents: CloudComputePrecedent[];
}

export function CloudComputeWhatsMarketDialog({ open, onOpenChange, category, precedents }: Props) {
  const payload: WhatsMarketPrecedentPayload[] = precedents.map(p => ({
    project_name: p.project_name,
    jurisdiction: p.jurisdiction,
    perspective: p.perspective,
    position_summary: p.position_summary,
    ppa_type: p.service_type || null,
    market_position: p.market_position || null,
    party_favorability: p.party_favorability || null,
    buyer_name: p.tenant_name || null,
    seller_name: p.provider_name || null,
  }));

  return (
    <AnalystWhatsMarketDialog
      open={open}
      onOpenChange={onOpenChange}
      category={category}
      precedents={payload}
      buyerLabel="Tenant"
      sellerLabel="Provider"
    />
  );
}
