import {
  AnalystWhatsMarketDialog,
  type WhatsMarketPrecedentPayload,
} from '@/components/shared/AnalystWhatsMarketDialog';
import type { TollingPrecedent } from '@/lib/hooks/useTollingAnalyses';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  precedents: TollingPrecedent[];
}

export function TollingWhatsMarketDialog({ open, onOpenChange, category, precedents }: Props) {
  const payload: WhatsMarketPrecedentPayload[] = precedents.map(p => ({
    project_name: p.project_name,
    jurisdiction: p.jurisdiction,
    perspective: p.perspective,
    position_summary: p.position_summary,
    ppa_type: p.tolling_type || null,
    market_position: p.market_position || null,
    party_favorability: p.party_favorability || null,
    buyer_name: p.offtaker_name || null,
    seller_name: p.generator_name || null,
  }));

  return (
    <AnalystWhatsMarketDialog
      open={open}
      onOpenChange={onOpenChange}
      category={category}
      precedents={payload}
      buyerLabel="Offtaker"
      sellerLabel="Generator"
    />
  );
}
