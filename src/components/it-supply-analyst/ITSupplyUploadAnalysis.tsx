import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, FileText, ArrowRight, AlertCircle, Cpu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useITSupplyAnalyses, useITSupplyPositions, useITSupplyPrecedentBank, ITSupplyAnalysisType, ITSupplyPerspective } from '@/lib/hooks/useITSupplyAnalyses';
import { useITSupplyLearnings } from '@/lib/hooks/useITSupplyLearnings';
import { ITSupplyAnalysisReport } from './ITSupplyAnalysisReport';
import { IT_SUPPLY_TYPES, IT_SUPPLY_CONTRACT_STAGES, type ITSupplyContractStage } from '@/lib/itSupplyCategories';
import { logLlmCall, classifyLlmError } from '@/lib/analyst/llmCallLog';
import { redactPII, summarizeRedaction } from '@/lib/analyst/piiRedaction';
import { PIIRedactionToggle } from '@/components/shared/PIIRedactionToggle';
import { AnalystAnalysisProgress, useAnalystProgress } from '@/components/shared/AnalystAnalysisProgress';

const JURISDICTIONS = ['United States', 'United Kingdom', 'EU', 'Taiwan', 'South Korea', 'Japan', 'China', 'Singapore', 'Other'];

interface ITSupplyUploadAnalysisProps {
  onAnalysisComplete?: () => void;
}

export function ITSupplyUploadAnalysis({ onAnalysisComplete }: ITSupplyUploadAnalysisProps) {
  const { createAnalysisWithPositions } = useITSupplyAnalyses();
  const { getRelevantPrecedents } = useITSupplyPrecedentBank();
  const { formatLearningsForPrompt, activeLearnings, getRelevantLearnings } = useITSupplyLearnings();

  const [step, setStep] = useState<'upload' | 'configure' | 'analyzing' | 'results'>('upload');
  const [analysisType, setAnalysisType] = useState<ITSupplyAnalysisType>('contract_vs_bible');
  const [perspective, setPerspective] = useState<ITSupplyPerspective>('buyer');
  const [supplyType, setSupplyType] = useState('semiconductor');
  const [contractStage, setContractStage] = useState<ITSupplyContractStage>('framework');
  const [jurisdiction, setJurisdiction] = useState('');
  const [projectName, setProjectName] = useState('');
  const [counterpartyType, setCounterpartyType] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [createdAnalysisId, setCreatedAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redactPIIEnabled, setRedactPIIEnabled] = useState(false);
  const progress = useAnalystProgress();
  const cancelledRef = useRef(false);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    progress.reset();
    setStep('configure');
    toast.info('Analysis cancelled. Server-side processing may continue briefly.');
  }, [progress]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF or Word document');
      return;
    }
    setContractFile(file);
    if (!projectName) {
      setProjectName(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
    }
  }, [projectName]);

  const handleStartAnalysis = async () => {
    if (!contractFile) { toast.error('Please upload a contract'); return; }
    if (!projectName.trim()) { toast.error('Please enter a project name'); return; }

    setStep('analyzing');
    setError(null);
    cancelledRef.current = false;
    progress.reset();
    progress.setPhase('extract');

    // Hoisted so catch block can report PII stats even if analysis fails after redaction ran.
    const piiCounts = { email: 0, phone: 0, ssn: 0, ein: 0, iban: 0, card: 0 };
    let piiTotalRedactions = 0;

    try {
      const formData = new FormData();
      formData.append('file', contractFile);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const parseResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || 'Failed to parse document');
      }

      const { text: contractText } = await parseResponse.json();
      progress.setPhase('retrieve');

      // Optional PII redaction before any text leaves the browser.
      let contractTextForLLM = contractText;
      if (redactPIIEnabled) {
        const r1 = redactPII(contractText || '');
        contractTextForLLM = r1.redacted;
        (Object.keys(piiCounts) as (keyof typeof piiCounts)[]).forEach(k => { piiCounts[k] += r1.counts[k]; });
        piiTotalRedactions += r1.totalRedactions;
        if (piiTotalRedactions > 0) {
          toast.success(`PII redaction: ${summarizeRedaction(piiCounts)}`);
        }
      }

      // Semantic top-K retrieval with graceful fallback to all-active.
      const retrievalQuery = (contractTextForLLM || '').slice(0, 15_000);
      const [relevantLearningsRes, relevantRegularRes, relevantGoldRes] = await Promise.all([
        getRelevantLearnings(retrievalQuery, 15),
        getRelevantPrecedents(retrievalQuery, 20, false),
        getRelevantPrecedents(retrievalQuery, 10, true),
      ]);
      const appliedRegularPrecedents = relevantRegularRes.precedents.filter(p => !p.is_gold_standard);
      const appliedGoldStandardPrecedents = relevantGoldRes.precedents;
      const relevantPrecedents = appliedRegularPrecedents.map(p => ({
        category: p.category, position_summary: p.position_summary, project_name: p.project_name,
        jurisdiction: p.jurisdiction, perspective: p.perspective,
      }));

      const selectedLearnings = relevantLearningsRes.learnings;

      // Capture IDs for applied-context audit trail
      const appliedLearningIds = selectedLearnings.map(l => l.id);
      const appliedPrecedentIds = appliedRegularPrecedents.map(p => p.id);
      const appliedGoldStandardIds = appliedGoldStandardPrecedents.map(p => p.id);

      const userLearningsPrompt = formatLearningsForPrompt(selectedLearnings);
      if (selectedLearnings.length > 0) console.log(`Including ${selectedLearnings.length} IT supply learnings (semantic=${relevantLearningsRes.usedSemanticRetrieval}, pool=${activeLearnings.length})`);

      progress.setPhase('analyze');

      const callAnalyzeApi = async (retryCount = 0): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);
        const { data: sd2 } = await supabase.auth.getSession();
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-it-supply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd2?.session?.access_token}` },
            body: JSON.stringify({
              contractText: contractTextForLLM, analysisType, perspective, jurisdiction, projectName,
              supplyType, contractStage, counterpartyType: counterpartyType || null,
              precedents: relevantPrecedents, userLearnings: userLearningsPrompt,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return res;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (retryCount < 3 && fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('fetch'))) {
            progress.setStatusOverride(`Retrying (attempt ${retryCount + 2}/4)…`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return callAnalyzeApi(retryCount + 1);
          }
          throw fetchError;
        }
      };

      const analysisStartTs = Date.now();
      const analyzeRes = await callAnalyzeApi();
      const analysisDurationMs = Date.now() - analysisStartTs;
      if (!analyzeRes.ok) {
        let errorMessage = 'Failed to analyze contract';
        try { const ed = await analyzeRes.json(); errorMessage = ed.error || errorMessage; } catch {}
        throw new Error(errorMessage);
      }

      const analyzeResponse = await analyzeRes.json();
      progress.setPhase('save');

      void logLlmCall({
        analystType: 'it_supply',
        functionName: 'analyze-it-supply',
        status: 'success',
        inputChars: contractTextForLLM?.length ?? 0,
        inputTokenCount: analyzeResponse?.input_token_count ?? null,
        outputTokenCount: analyzeResponse?.output_token_count ?? null,
        modelUsed: analyzeResponse?.model_used ?? null,
        durationMs: analysisDurationMs,
        metadata: {
          analysisType,
          perspective,
          supplyType,
          pii_redacted: redactPIIEnabled,
          pii_redaction_counts: redactPIIEnabled ? piiCounts : undefined,
          pii_total_redactions: redactPIIEnabled ? piiTotalRedactions : 0,
        },
      });

      const { positions: extractedPositions } = analyzeResponse;

      const positionsPayload = (extractedPositions ?? []).map((pos: any) => ({
        category: pos.category, position_summary: pos.position_summary,
        source_text: pos.clause_references || pos.source_text || null,
        confidence: pos.confidence || 'medium', bible_reference: pos.bible_reference || null,
        comparison_position: pos.market_comparison || pos.comparison_position || null,
        variance_notes: pos.market_position ? `[${pos.market_position.toUpperCase().replace('_', ' ')}] ${pos.variance_notes || ''}`.trim() : pos.variance_notes || null,
        previous_position: null,
        change_summary: null,
        change_type: null,
        market_benchmark: pos.market_benchmark || null,
      }));

      if (cancelledRef.current) return;
      const analysisResult = await createAnalysisWithPositions.mutateAsync({
        analysis: {
          analysis_type: analysisType, perspective, project_name: projectName.trim(),
          jurisdiction: jurisdiction || null, document_file_name: contractFile.name,
          document_file_url: null, comparison_file_name: null, comparison_file_url: null,
          notes: null, parent_analysis_id: null, version_number: 1, is_comparison: false,
          supply_type: supplyType, contract_stage: contractStage, complexity_score: null,
          key_risk_areas: [], counterparty_type: counterpartyType || null,
          buyer_name: buyerName || null, supplier_name: supplierName || null,
          buyer_normalized: buyerName || null, supplier_normalized: supplierName || null,
          // Applied-context trace
          applied_learning_ids: appliedLearningIds,
          applied_precedent_ids: appliedPrecedentIds,
          applied_gold_standard_ids: appliedGoldStandardIds,
          // Telemetry
          model_used: analyzeResponse?.model_used ?? null,
          analysis_duration_ms: analysisDurationMs,
          input_token_count: analyzeResponse?.input_token_count ?? null,
          output_token_count: analyzeResponse?.output_token_count ?? null,
        },
        positions: positionsPayload,
      });

      if (cancelledRef.current) return;
      progress.setPhase('complete');
      setCreatedAnalysisId(analysisResult.id);
      setStep('results');
      toast.success('Analysis complete!');
    } catch (err) {
      if (cancelledRef.current) return;
      console.error('Analysis error:', err);
      void logLlmCall({
        analystType: 'it_supply',
        functionName: 'analyze-it-supply',
        status: 'failure',
        errorType: classifyLlmError(err),
        errorMessage: err instanceof Error ? err.message : String(err),
        metadata: {
          analysisType,
          perspective,
          supplyType,
          pii_redacted: redactPIIEnabled,
          pii_redaction_counts: redactPIIEnabled ? piiCounts : undefined,
          pii_total_redactions: redactPIIEnabled ? piiTotalRedactions : 0,
        },
      });
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStep('configure');
      progress.reset();
      toast.error('Analysis failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleReset = () => {
    setStep('upload'); setContractFile(null); setProjectName(''); setJurisdiction('');
    setAnalysisType('contract_vs_bible'); setPerspective('buyer');
    setCreatedAnalysisId(null); setError(null);
    progress.reset();
  };

  if (step === 'results' && createdAnalysisId) {
    return <ITSupplyAnalysisReport analysisId={createdAnalysisId} onNewAnalysis={handleReset} onViewHistory={onAnalysisComplete} />;
  }

  if (step === 'analyzing') {
    return (
      <AnalystAnalysisProgress
        title={`Analyzing ${analysisType === 'termsheet_vs_bible' ? 'Term Sheet' : 'Supply Contract'}`}
        phase={progress.phase}
        progress={progress.progress}
        narrative={progress.narrative}
        elapsedMs={progress.elapsedMs}
        statusOverride={progress.statusOverride ?? undefined}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className={step === 'upload' ? '' : 'opacity-60'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Supply Contract</CardTitle>
          <CardDescription>Upload a chip/server supply agreement or term sheet (PDF or Word)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input type="file" accept=".pdf,.docx,.doc" onChange={handleFileUpload} className="hidden" id="it-supply-upload" disabled={step !== 'upload'} />
            <label htmlFor="it-supply-upload" className="cursor-pointer">
              {contractFile ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileText className="h-8 w-8" />
                  <div className="text-left">
                    <p className="font-medium">{contractFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(contractFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">PDF or Word document (max 15MB)</p>
                </div>
              )}
            </label>
          </div>
          {contractFile && step === 'upload' && (
            <Button onClick={() => setStep('configure')} className="w-full gap-2">Continue <ArrowRight className="h-4 w-4" /></Button>
          )}
        </CardContent>
      </Card>

      {(step === 'configure' || step === 'upload') && (
        <Card className={step === 'configure' ? '' : 'opacity-40 pointer-events-none'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5" /> Analysis Configuration</CardTitle>
            <CardDescription>Choose your analysis type and perspective</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="h-5 w-5 flex-shrink-0" /><p className="text-sm">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g., NVIDIA H100 Supply Agreement" />
            </div>
            <div className="space-y-3">
              <Label>Analysis Type</Label>
              <RadioGroup value={analysisType} onValueChange={(v) => setAnalysisType(v as ITSupplyAnalysisType)}>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="contract_vs_bible" id="contract_vs_bible_it" className="mt-1" />
                  <label htmlFor="contract_vs_bible_it" className="flex-1 cursor-pointer">
                    <p className="font-medium">Supply Contract vs Knowledge & Precedent Bank</p>
                    <p className="text-sm text-muted-foreground">Analyze a full supply agreement against the knowledge base and your banked precedents</p>
                  </label>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="termsheet_vs_bible" id="termsheet_vs_bible_it" className="mt-1" />
                  <label htmlFor="termsheet_vs_bible_it" className="flex-1 cursor-pointer">
                    <p className="font-medium">Term Sheet vs Knowledge & Precedent Bank</p>
                    <p className="text-sm text-muted-foreground">Analyze a term sheet or LOI against market standard supply positions</p>
                  </label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supply Type</Label>
                <Select value={supplyType} onValueChange={setSupplyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IT_SUPPLY_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contract Stage</Label>
                <Select value={contractStage} onValueChange={(v) => setContractStage(v as ITSupplyContractStage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IT_SUPPLY_CONTRACT_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Perspective</Label>
              <RadioGroup value={perspective} onValueChange={(v) => setPerspective(v as ITSupplyPerspective)} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="buyer" id="buyer_it" /><label htmlFor="buyer_it">Buyer</label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="supplier" id="supplier_it" /><label htmlFor="supplier_it">Supplier</label></div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jurisdiction</Label>
                <Select value={jurisdiction} onValueChange={setJurisdiction}>
                  <SelectTrigger><SelectValue placeholder="Select jurisdiction" /></SelectTrigger>
                  <SelectContent>{JURISDICTIONS.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Counterparty Type (optional)</Label>
                <Input value={counterpartyType} onChange={(e) => setCounterpartyType(e.target.value)} placeholder="e.g., Foundry, OEM, Hyperscaler" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Buyer Name (optional)</Label>
                <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="e.g., Microsoft" />
              </div>
              <div className="space-y-2">
                <Label>Supplier Name (optional)</Label>
                <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="e.g., TSMC" />
              </div>
            </div>
            {step === 'configure' && (
              <>
                <PIIRedactionToggle checked={redactPIIEnabled} onCheckedChange={setRedactPIIEnabled} />
                <Button onClick={handleStartAnalysis} className="w-full" disabled={!contractFile || !projectName.trim()}>
                  <Cpu className="h-4 w-4 mr-2" /> Start Analysis
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
