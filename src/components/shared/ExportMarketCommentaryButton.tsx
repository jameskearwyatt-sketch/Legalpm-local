import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { FileDown, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface WhatsMarketResult {
  category: string;
  dealCount: number;
  balanced: { title: string; summary: string; points: string[] };
  buyerFriendly: { title: string; summary: string; points: string[] };
  sellerFriendly: { title: string; summary: string; points: string[] };
  keyInsights: string[];
  confidenceNote: string;
}

interface Precedent {
  project_name: string;
  jurisdiction?: string | null;
  perspective: string;
  position_summary: string;
  [key: string]: any;
}

interface ExportMarketCommentaryButtonProps {
  selectedCategories: string[];
  groupedPrecedents: Record<string, Precedent[]>;
  context: string; // e.g. 'ppa', 'tolling', 'carbon', 'it_supply', 'cloud_compute'
  analystTitle: string;
  onClearSelection?: () => void;
}

function generateWordHtml(results: WhatsMarketResult[], analystTitle: string): string {
  const now = format(new Date(), 'dd MMMM yyyy');
  const totalDeals = results.reduce((sum, r) => sum + r.dealCount, 0);
  const totalPositions = results.reduce((sum, r) => sum + r.dealCount, 0);

  const sectionHtml = results.map((r, idx) => {
    const renderPosition = (data: { title: string; summary: string; points: string[] }, color: string) => `
      <div style="margin-bottom: 18px;">
        <h4 style="font-family: 'Georgia', serif; font-size: 13pt; color: ${color}; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">${data.title}</h4>
        <p style="font-family: 'Georgia', serif; font-size: 11pt; color: #374151; font-style: italic; margin: 0 0 8px 0;">${data.summary}</p>
        <ul style="margin: 0; padding-left: 20px;">
          ${data.points.map(pt => `<li style="font-family: 'Georgia', serif; font-size: 10.5pt; color: #1f2937; margin-bottom: 5px; line-height: 1.5;">${pt}</li>`).join('')}
        </ul>
      </div>
    `;

    const insightsHtml = r.keyInsights?.length ? `
      <div style="background-color: #f0f9ff; border-left: 3px solid #3b82f6; padding: 12px 16px; margin: 16px 0;">
        <p style="font-family: 'Georgia', serif; font-size: 10pt; font-weight: bold; color: #1e40af; margin: 0 0 6px 0;">KEY INSIGHTS</p>
        ${r.keyInsights.map(ins => `<p style="font-family: 'Georgia', serif; font-size: 10pt; color: #1e3a5f; margin: 3px 0;">💡 ${ins}</p>`).join('')}
      </div>
    ` : '';

    const confidenceHtml = r.confidenceNote ? `
      <p style="font-family: 'Georgia', serif; font-size: 9pt; color: #6b7280; font-style: italic; margin-top: 12px;">📊 ${r.confidenceNote}</p>
    ` : '';

    return `
      <div style="page-break-inside: avoid; margin-bottom: 36px;">
        <h2 style="font-family: 'Georgia', serif; font-size: 16pt; color: #111827; border-bottom: 2px solid #1e40af; padding-bottom: 6px; margin: 0 0 4px 0;">
          ${idx + 1}. ${r.category}
        </h2>
        <p style="font-family: 'Georgia', serif; font-size: 10pt; color: #6b7280; margin: 0 0 18px 0;">Based on ${r.dealCount} banked precedent${r.dealCount !== 1 ? 's' : ''}</p>
        ${renderPosition(r.balanced, '#1e40af')}
        ${renderPosition(r.buyerFriendly, '#047857')}
        ${renderPosition(r.sellerFriendly, '#b45309')}
        ${insightsHtml}
        ${confidenceHtml}
      </div>
    `;
  }).join('');

  return `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 2.5cm 2cm; }
    body { font-family: 'Georgia', serif; }
    @page Section1 { mso-header-margin: 0.5in; mso-footer-margin: 0.5in; }
    div.Section1 { page: Section1; }
  </style>
</head>
<body>
<div class="Section1">
  <!-- Title page -->
  <div style="text-align: center; padding-top: 120px; padding-bottom: 80px;">
    <h1 style="font-family: 'Georgia', serif; font-size: 28pt; color: #111827; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.5px;">MARKET COMMENTARY</h1>
    <div style="width: 80px; height: 3px; background-color: #1e40af; margin: 0 auto 20px auto;"></div>
    <p style="font-family: 'Georgia', serif; font-size: 14pt; color: #4b5563; margin: 0 0 8px 0;">${analystTitle}</p>
    <p style="font-family: 'Georgia', serif; font-size: 11pt; color: #9ca3af; margin: 0 0 4px 0;">${now}</p>
    <p style="font-family: 'Georgia', serif; font-size: 10pt; color: #9ca3af; margin: 0;">
      ${results.length} categor${results.length !== 1 ? 'ies' : 'y'} analysed
    </p>
  </div>

  <br clear="all" style="page-break-before:always" />

  <!-- Table of Contents -->
  <h2 style="font-family: 'Georgia', serif; font-size: 16pt; color: #111827; border-bottom: 2px solid #1e40af; padding-bottom: 6px; margin-bottom: 16px;">Contents</h2>
  <ol style="padding-left: 20px;">
    ${results.map((r, i) => `<li style="font-family: 'Georgia', serif; font-size: 11pt; color: #374151; margin-bottom: 6px;">${r.category} <span style="color: #9ca3af;">(${r.dealCount} precedent${r.dealCount !== 1 ? 's' : ''})</span></li>`).join('')}
  </ol>

  <br clear="all" style="page-break-before:always" />

  ${sectionHtml}

  <!-- Footer -->
  <div style="border-top: 1px solid #d1d5db; padding-top: 12px; margin-top: 40px;">
    <p style="font-family: 'Georgia', serif; font-size: 8pt; color: #9ca3af; text-align: center;">
      This market commentary has been generated from the firm's internal precedent bank and is intended for internal use only.
      It does not constitute legal advice and should not be shared with clients without review.
    </p>
  </div>
</div>
</body>
</html>`;
}

export function ExportMarketCommentaryButton({
  selectedCategories,
  groupedPrecedents,
  context,
  analystTitle,
  onClearSelection,
}: ExportMarketCommentaryButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentCategory: '' });
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (selectedCategories.length === 0) return;

    setIsExporting(true);
    setError(null);
    const total = selectedCategories.length;
    setProgress({ current: 0, total, currentCategory: '' });

    const results: WhatsMarketResult[] = [];

    try {
      for (let i = 0; i < selectedCategories.length; i++) {
        const category = selectedCategories[i];
        const precedents = groupedPrecedents[category] || [];

        if (precedents.length === 0) continue;

        setProgress({ current: i, total, currentCategory: category });

        const { data, error: fnError } = await supabase.functions.invoke('whats-market', {
          body: {
            category,
            context: context === 'carbon' ? 'carbon' : undefined,
            precedents: precedents.map(p => ({
              project_name: p.project_name,
              jurisdiction: p.jurisdiction,
              perspective: p.perspective,
              position_summary: p.position_summary,
              ppa_type: p.ppa_type || null,
              carbon_type: p.carbon_type || null,
              market_position: p.market_position || null,
              party_favorability: p.party_favorability || null,
              buyer_name: p.buyer_name || null,
              seller_name: p.seller_name || null,
              offtaker_name: p.offtaker_name || null,
              generator_name: p.generator_name || null,
              supplier_name: p.supplier_name || null,
              tenant_name: p.tenant_name || null,
              provider_name: p.provider_name || null,
            })),
          },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        results.push(data);
      }

      setProgress({ current: total, total, currentCategory: 'Generating document...' });

      // Generate Word document
      const html = generateWordHtml(results, analystTitle);
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Market Commentary - ${analystTitle} - ${format(new Date(), 'yyyy-MM-dd')}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Market commentary exported (${results.length} categories)`);
      onClearSelection?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  if (selectedCategories.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3 bg-primary text-primary-foreground px-5 py-3 rounded-full shadow-lg">
          <span className="text-sm font-medium">
            {selectedCategories.length} categor{selectedCategories.length !== 1 ? 'ies' : 'y'} selected
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="gap-2 rounded-full"
            onClick={handleExport}
          >
            <FileDown className="h-4 w-4" />
            Export Market Commentary
          </Button>
          {onClearSelection && (
            <Button
              size="sm"
              variant="ghost"
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 rounded-full h-7 px-2 text-xs"
              onClick={onClearSelection}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isExporting} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {error ? (
                <><AlertCircle className="h-5 w-5 text-destructive" /> Export Failed</>
              ) : progress.current === progress.total && progress.total > 0 ? (
                <><CheckCircle2 className="h-5 w-5 text-primary" /> Export Complete</>
              ) : (
                <><Loader2 className="h-5 w-5 animate-spin text-primary" /> Generating Market Commentary</>
              )}
            </DialogTitle>
            <DialogDescription>
              {error
                ? error
                : progress.current === progress.total && progress.total > 0
                  ? 'Your document is downloading...'
                  : `Analysing category ${progress.current + 1} of ${progress.total}`}
            </DialogDescription>
          </DialogHeader>
          {!error && (
            <div className="space-y-3 py-2">
              <Progress value={(progress.current / Math.max(progress.total, 1)) * 100} className="h-2" />
              <p className="text-sm text-muted-foreground truncate">
                {progress.currentCategory}
              </p>
            </div>
          )}
          {error && (
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setIsExporting(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
