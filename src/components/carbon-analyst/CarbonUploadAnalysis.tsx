import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, FileText, Scale, ArrowRight, Loader2, AlertCircle, Leaf, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCarbonAnalyses, useCarbonPositions, useCarbonPrecedentBank, CarbonAnalysisType, CarbonPerspective } from '@/lib/hooks/useCarbonAnalyses';
import { useCarbonLearnings } from '@/lib/hooks/useCarbonLearnings';
import { CarbonAnalysisReport } from './CarbonAnalysisReport';
import { CARBON_PROJECT_TYPES, CARBON_PROJECT_STAGES, CARBON_CREDIT_CLASSES, getCreditClassForType, type CarbonProjectStage, type CarbonCreditClass } from '@/lib/carbonCategories';
import { logLlmCall, classifyLlmError } from '@/lib/analyst/llmCallLog';
import { redactPII, summarizeRedaction } from '@/lib/analyst/piiRedaction';
import { PIIRedactionToggle } from '@/components/shared/PIIRedactionToggle';
import { AnalystAnalysisProgress, useAnalystProgress } from '@/components/shared/AnalystAnalysisProgress';

const JURISDICTIONS = [
  'United Kingdom', 'United States', 'European Union', 'Switzerland',
  'Australia', 'Canada', 'Japan', 'Singapore', 'Middle East', 'Africa', 'Latin America', 'Other',
];

interface CarbonUploadAnalysisProps {
  onAnalysisComplete?: () => void;
}

export function CarbonUploadAnalysis({ onAnalysisComplete }: CarbonUploadAnalysisProps) {
  const { createAnalysisWithPositions } = useCarbonAnalyses();
  const { getRelevantPrecedents } = useCarbonPrecedentBank();
  const { formatLearningsForPrompt, activeLearnings, getRelevantLearnings } = useCarbonLearnings();

  const [step, setStep] = useState<'upload' | 'configure' | 'confirming' | 'analyzing' | 'results'>('upload');
  const [analysisType, setAnalysisType] = useState<CarbonAnalysisType>('carbon_vs_bible');
  const [perspective, setPerspective] = useState<CarbonPerspective>('buyer');
  const [carbonType, setCarbonType] = useState('');
  const [projectStage, setProjectStage] = useState<CarbonProjectStage | ''>('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [projectName, setProjectName] = useState('');
  const [counterpartyType, setCounterpartyType] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [buyerNormalized, setBuyerNormalized] = useState('');
  const [sellerNormalized, setSellerNormalized] = useState('');
  const [carbonFile, setCarbonFile] = useState<File | null>(null);
  const [createdAnalysisId, setCreatedAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDetectingMetadata, setIsDetectingMetadata] = useState(false);
  const [detectionNotes, setDetectionNotes] = useState<string | null>(null);
  const [detectedFramework, setDetectedFramework] = useState<string | null>(null);
  const [redactPIIEnabled, setRedactPIIEnabled] = useState(false);
  const progress = useAnalystProgress();
  const cancelledRef = useRef(false);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    progress.reset();
    setStep('configure');
    toast.info('Analysis cancelled. Server-side processing may continue briefly.');
  }, [progress]);

  // Auto-detect carbon metadata after clicking Start Analysis
  const detectCarbonMetadata = useCallback(async (file: File) => {
    setIsDetectingMetadata(true);
    setDetectionNotes(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const parseResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      );

      if (!parseResponse.ok) {
        console.error('Failed to parse document for metadata detection');
        toast.error('Failed to parse document - please fill in fields manually');
        return;
      }

      const { text: documentText } = await parseResponse.json();

      const detectResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-carbon-metadata`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ documentText }),
        }
      );

      if (!detectResponse.ok) {
        console.error('Failed to detect carbon metadata');
        toast.error('Failed to detect metadata - please fill in fields manually');
        return;
      }

      const metadata = await detectResponse.json();
      console.log('Auto-detected carbon metadata:', metadata);

      // Auto-fill fields
      if (metadata.project_name && metadata.project_name_confidence !== 'low') {
        setProjectName(metadata.project_name);
      }

      if (metadata.carbon_type && metadata.carbon_type_confidence !== 'low') {
        const validTypes = CARBON_PROJECT_TYPES.map(t => t.id);
        if (validTypes.includes(metadata.carbon_type)) {
          setCarbonType(metadata.carbon_type);
        }
      }

      if (metadata.project_stage && metadata.project_stage_confidence !== 'low') {
        const validStages = CARBON_PROJECT_STAGES.map(s => s.id);
        if (validStages.includes(metadata.project_stage)) {
          setProjectStage(metadata.project_stage as CarbonProjectStage);
        }
      }

      if (metadata.jurisdiction && metadata.jurisdiction_confidence !== 'low') {
        const matchedJurisdiction = JURISDICTIONS.find(
          j => j.toLowerCase() === metadata.jurisdiction.toLowerCase() ||
               metadata.jurisdiction.toLowerCase().includes(j.toLowerCase())
        );
        if (matchedJurisdiction) setJurisdiction(matchedJurisdiction);
      }

      if (metadata.buyer_name && metadata.buyer_name_confidence !== 'low') {
        setBuyerName(metadata.buyer_name);
        if (metadata.buyer_normalized) setBuyerNormalized(metadata.buyer_normalized);
      }

      if (metadata.seller_name && metadata.seller_name_confidence !== 'low') {
        setSellerName(metadata.seller_name);
        if (metadata.seller_normalized) setSellerNormalized(metadata.seller_normalized);
      }

      if (metadata.counterparty_type && metadata.counterparty_type_confidence !== 'low') {
        setCounterpartyType(metadata.counterparty_type);
      }

      if (metadata.framework) {
        setDetectedFramework(metadata.framework);
      }

      if (metadata.detection_notes) {
        setDetectionNotes(metadata.detection_notes);
      }

      toast.success('Document metadata auto-detected', {
        description: 'Review the pre-filled fields and adjust if needed.',
      });
    } catch (err) {
      console.warn('Error detecting carbon metadata:', err);
    } finally {
      setIsDetectingMetadata(false);
    }
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!validTypes.includes(file.type)) { toast.error('Please upload a PDF or Word document'); return; }
    setCarbonFile(file);
    if (!projectName) setProjectName(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
  }, [projectName]);

  // Handler for "Start Analysis" button - detects metadata first, then shows confirmation
  const handleDetectAndConfirm = async () => {
    if (!carbonFile) { toast.error('Please upload a carbon credit offtake agreement'); return; }
    if (!projectName.trim()) { toast.error('Please enter a project name'); return; }

    setStep('confirming');
    setError(null);

    // Auto-detect metadata from the document
    await detectCarbonMetadata(carbonFile);
  };

  // Handler for "Confirm & Start Full Analysis" button
  const handleConfirmAndAnalyze = () => {
    handleStartAnalysis();
  };

  const handleStartAnalysis = async () => {
    if (!carbonFile) { toast.error('Please upload a carbon credit offtake agreement'); return; }
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
      formData.append('file', carbonFile);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const parseResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!parseResponse.ok) { const errorData = await parseResponse.json(); throw new Error(errorData.error || 'Failed to parse document'); }
      const { text: documentText } = await parseResponse.json();
      progress.setPhase('retrieve');

      // Optional PII redaction before any text leaves the browser.
      let documentTextForLLM = documentText;
      if (redactPIIEnabled) {
        const r1 = redactPII(documentText || '');
        documentTextForLLM = r1.redacted;
        (Object.keys(piiCounts) as (keyof typeof piiCounts)[]).forEach(k => { piiCounts[k] += r1.counts[k]; });
        piiTotalRedactions += r1.totalRedactions;
        if (piiTotalRedactions > 0) {
          toast.success(`PII redaction: ${summarizeRedaction(piiCounts)}`);
        }
      }

      // Semantic top-K retrieval with graceful fallback to all-active.
      const retrievalQuery = (documentTextForLLM || '').slice(0, 15_000);
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
      if (selectedLearnings.length > 0) console.log(`Including ${selectedLearnings.length} carbon learnings (semantic=${relevantLearningsRes.usedSemanticRetrieval}, pool=${activeLearnings.length})`);

      progress.setPhase('analyze');

      const callAnalyzeApi = async (retryCount = 0): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);
        const { data: sd2 } = await supabase.auth.getSession();
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-carbon-credit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd2?.session?.access_token}` },
            body: JSON.stringify({
              documentText: documentTextForLLM, analysisType, perspective, jurisdiction, projectName,
              carbonType, projectStage, counterpartyType: counterpartyType || null,
              creditClass: getCreditClassForType(carbonType),
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
        let errorMessage = 'Failed to analyze carbon credit offtake agreement';
        try { const errorData = await analyzeRes.json(); errorMessage = errorData.error || errorMessage; } catch { errorMessage = `Analysis failed with status ${analyzeRes.status}`; }
        throw new Error(errorMessage);
      }

      const analyzeResponse = await analyzeRes.json();
      progress.setPhase('save');

      void logLlmCall({
        analystType: 'carbon',
        functionName: 'analyze-carbon-credit',
        status: 'success',
        inputChars: documentTextForLLM?.length ?? 0,
        inputTokenCount: analyzeResponse?.input_token_count ?? null,
        outputTokenCount: analyzeResponse?.output_token_count ?? null,
        modelUsed: analyzeResponse?.model_used ?? null,
        durationMs: analysisDurationMs,
        metadata: {
          analysisType,
          perspective,
          carbonType,
          pii_redacted: redactPIIEnabled,
          pii_redaction_counts: redactPIIEnabled ? piiCounts : undefined,
          pii_total_redactions: redactPIIEnabled ? piiTotalRedactions : 0,
          // Edge function now uses JSON response_format; parse errors
          // should be rare. See #6 structured output.
          structured_output: true,
        },
      });

      const { positions: extractedPositions } = analyzeResponse;

      // Atomically insert analysis + positions in one transaction.
      const positionsPayload = (extractedPositions || []).map((pos: any) => ({
        category: pos.category, position_summary: pos.position_summary,
        source_text: pos.clause_references || pos.source_text || null,
        confidence: pos.confidence || 'medium', bible_reference: pos.bible_reference || null,
        comparison_position: pos.market_comparison || pos.comparison_position || null,
        variance_notes: pos.market_position
          ? `[${pos.market_position.toUpperCase().replace('_', ' ')}] ${pos.variance_notes || ''}`.trim()
          : pos.variance_notes || null,
        market_benchmark: pos.market_benchmark || null,
      }));

      if (cancelledRef.current) return;
      const analysisResult = await createAnalysisWithPositions.mutateAsync({
        analysis: {
          analysis_type: analysisType, perspective, project_name: projectName.trim(),
          jurisdiction: jurisdiction || null, document_file_name: carbonFile.name,
          document_file_url: null, comparison_file_name: null, comparison_file_url: null,
          notes: null, parent_analysis_id: null, version_number: 1, is_comparison: false,
          carbon_type: carbonType, project_stage: projectStage, complexity_score: null,
          key_risk_areas: [], counterparty_type: counterpartyType || null,
          buyer_name: buyerName || null, seller_name: sellerName || null,
          buyer_normalized: buyerNormalized || buyerName || null, seller_normalized: sellerNormalized || sellerName || null,
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
        analystType: 'carbon',
        functionName: 'analyze-carbon-credit',
        status: 'failure',
        errorType: classifyLlmError(err),
        errorMessage: err instanceof Error ? err.message : String(err),
        metadata: {
          analysisType,
          perspective,
          carbonType,
          pii_redacted: redactPIIEnabled,
          pii_redaction_counts: redactPIIEnabled ? piiCounts : undefined,
          pii_total_redactions: redactPIIEnabled ? piiTotalRedactions : 0,
          // Edge function now uses JSON response_format; parse errors
          // should be rare. See #6 structured output.
          structured_output: true,
        },
      });
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStep('configure');
      progress.reset();
      toast.error('Analysis failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleReset = () => {
    setStep('upload'); setCarbonFile(null); setProjectName(''); setJurisdiction('');
    setAnalysisType('carbon_vs_bible'); setPerspective('buyer'); setCreatedAnalysisId(null); setError(null);
    setCarbonType(''); setProjectStage('' as any); setCounterpartyType('');
    setBuyerName(''); setSellerName(''); setBuyerNormalized(''); setSellerNormalized('');
    setDetectionNotes(null); setDetectedFramework(null);
    progress.reset();
  };

  if (step === 'results' && createdAnalysisId) {
    return <CarbonAnalysisReport analysisId={createdAnalysisId} onNewAnalysis={handleReset} onViewHistory={onAnalysisComplete} />;
  }

  if (step === 'analyzing') {
    return (
      <AnalystAnalysisProgress
        title={`Analyzing ${analysisType === 'termsheet_vs_bible' ? 'Term Sheet' : 'Carbon Credit Offtake Agreement'}`}
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
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload Carbon Credit Offtake Agreement</CardTitle>
          <CardDescription>Upload a carbon credit offtake agreement or term sheet (PDF or Word) for analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input type="file" accept=".pdf,.docx,.doc" onChange={handleFileUpload} className="hidden" id="carbon-upload" disabled={step !== 'upload'} />
            <label htmlFor="carbon-upload" className="cursor-pointer">
              {carbonFile ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileText className="h-8 w-8" />
                  <div className="text-left">
                    <p className="font-medium">{carbonFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(carbonFile.size / 1024 / 1024).toFixed(2)} MB</p>
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
          {carbonFile && step === 'upload' && (
            <Button onClick={() => setStep('configure')} className="w-full gap-2">Continue<ArrowRight className="h-4 w-4" /></Button>
          )}
        </CardContent>
      </Card>

      {(step === 'configure' || step === 'upload') && (
        <Card className={step === 'configure' ? '' : 'opacity-40 pointer-events-none'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Leaf className="h-5 w-5" />Analysis Configuration</CardTitle>
            <CardDescription>Choose your analysis type and perspective</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="h-5 w-5 flex-shrink-0" /><p className="text-sm">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input id="project-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g., Climeworks DAC Credits 2026" />
            </div>
            <div className="space-y-3">
              <Label>Analysis Type</Label>
              <RadioGroup value={analysisType} onValueChange={(v) => setAnalysisType(v as CarbonAnalysisType)}>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="carbon_vs_bible" id="carbon_vs_bible" className="mt-1" />
                  <label htmlFor="carbon_vs_bible" className="flex-1 cursor-pointer">
                    <p className="font-medium">Carbon Credit Offtake vs Knowledge & Precedent Bank</p>
                    <p className="text-sm text-muted-foreground">Analyze a full offtake agreement against the knowledge base and your banked precedents</p>
                  </label>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="termsheet_vs_bible" id="termsheet_vs_bible_carbon" className="mt-1" />
                  <label htmlFor="termsheet_vs_bible_carbon" className="flex-1 cursor-pointer">
                    <p className="font-medium">Term Sheet vs Knowledge & Precedent Bank</p>
                    <p className="text-sm text-muted-foreground">Analyze a term sheet against market standard carbon credit offtake positions</p>
                  </label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-3">
              <Label>Your Perspective</Label>
              <RadioGroup value={perspective} onValueChange={(v) => setPerspective(v as CarbonPerspective)} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="buyer" id="buyer" /><label htmlFor="buyer" className="cursor-pointer">Buyer (Offtaker)</label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="seller" id="seller" /><label htmlFor="seller" className="cursor-pointer">Seller (Project Developer)</label></div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Jurisdiction</Label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger><SelectValue placeholder="Select jurisdiction (optional)" /></SelectTrigger>
                <SelectContent>{JURISDICTIONS.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Carbon Removal / Credit Type</Label>
              <Select value={carbonType} onValueChange={setCarbonType}>
                <SelectTrigger><SelectValue placeholder="Select credit type" /></SelectTrigger>
                <SelectContent>
                  {CARBON_CREDIT_CLASSES.map(cls => (
                    <div key={cls.id}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cls.label}</div>
                      {CARBON_PROJECT_TYPES.filter(t => t.creditClass === cls.id).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              {carbonType && (
                <p className="text-xs text-muted-foreground">
                  Classification: <span className="font-medium">{getCreditClassForType(carbonType) === 'industrial' ? 'Industrial / Engineered' : 'Nature-Based'}</span> — analysis will be contextually adapted.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Project Stage</Label>
              <Select value={projectStage} onValueChange={(v) => setProjectStage(v as CarbonProjectStage)}>
                <SelectTrigger><SelectValue placeholder="Select project stage" /></SelectTrigger>
                <SelectContent>{CARBON_PROJECT_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Counterparty Type (optional)</Label>
              <Input value={counterpartyType} onChange={(e) => setCounterpartyType(e.target.value)} placeholder="e.g., Corporate Buyer, Compliance Entity, Trading House" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Buyer (Offtaker)</Label>
                <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="e.g., Microsoft, Stripe, Swiss Re" />
              </div>
              <div className="space-y-2">
                <Label>Seller (Project Developer)</Label>
                <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="e.g., Climeworks, CarbonCure, Running Tide" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">Party names help search precedents by counterparty later</p>
            <PIIRedactionToggle checked={redactPIIEnabled} onCheckedChange={setRedactPIIEnabled} />
            <Button onClick={handleDetectAndConfirm} className="w-full gap-2" disabled={!carbonFile || !projectName.trim() || isDetectingMetadata}>
              {isDetectingMetadata ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Scale className="h-4 w-4" />
              )}
              {isDetectingMetadata ? 'Detecting metadata...' : 'Start Analysis'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm Detected Metadata */}
      {step === 'confirming' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Confirm Document Details
            </CardTitle>
            <CardDescription>
              Review the auto-detected information and adjust if needed before starting analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Loading state while detecting */}
            {isDetectingMetadata && (
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium">Scanning document...</p>
                  <p className="text-sm text-muted-foreground">Detecting project type, parties, jurisdiction, and framework</p>
                </div>
              </div>
            )}

            {/* Detection notes */}
            {detectionNotes && !isDetectingMetadata && (
              <div className="flex items-start gap-2 p-3 bg-primary/10 text-primary rounded-lg">
                <Brain className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Auto-detected from document</p>
                  <p className="text-xs opacity-80">{detectionNotes}</p>
                  {detectedFramework && detectedFramework !== 'Custom' && (
                    <p className="text-xs font-medium mt-1">Framework: {detectedFramework}</p>
                  )}
                </div>
              </div>
            )}

            {!isDetectingMetadata && (
              <>
                {/* Project Name */}
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g., Climeworks DAC Credits 2026" />
                </div>

                {/* Carbon Type */}
                <div className="space-y-2">
                  <Label>Carbon Removal / Credit Type</Label>
                  <Select value={carbonType} onValueChange={setCarbonType}>
                    <SelectTrigger><SelectValue placeholder="Select credit type" /></SelectTrigger>
                    <SelectContent>
                      {CARBON_CREDIT_CLASSES.map(cls => (
                        <div key={cls.id}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cls.label}</div>
                          {CARBON_PROJECT_TYPES.filter(t => t.creditClass === cls.id).map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  {carbonType && (
                    <p className="text-xs text-muted-foreground">
                      Classification: <span className="font-medium">{getCreditClassForType(carbonType) === 'industrial' ? 'Industrial / Engineered' : 'Nature-Based'}</span>
                    </p>
                  )}
                </div>

                {/* Project Stage */}
                <div className="space-y-2">
                  <Label>Project Stage</Label>
                  <Select value={projectStage} onValueChange={(v) => setProjectStage(v as CarbonProjectStage)}>
                    <SelectTrigger><SelectValue placeholder="Select project stage" /></SelectTrigger>
                    <SelectContent>{CARBON_PROJECT_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* Jurisdiction */}
                <div className="space-y-2">
                  <Label>Jurisdiction</Label>
                  <Select value={jurisdiction} onValueChange={setJurisdiction}>
                    <SelectTrigger><SelectValue placeholder="Select jurisdiction" /></SelectTrigger>
                    <SelectContent>{JURISDICTIONS.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* Counterparty Type */}
                <div className="space-y-2">
                  <Label>Counterparty Type</Label>
                  <Input value={counterpartyType} onChange={(e) => setCounterpartyType(e.target.value)} placeholder="e.g., Corporate Buyer, Compliance Entity, Trading House" />
                </div>

                {/* Party Names */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Buyer (Offtaker)</Label>
                    <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="e.g., Microsoft, Stripe" />
                    {buyerNormalized && buyerNormalized !== buyerName && (
                      <p className="text-xs text-muted-foreground">
                        Will be grouped as: <span className="font-medium">{buyerNormalized}</span>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Seller (Project Developer)</Label>
                    <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="e.g., Climeworks, CarbonCure" />
                    {sellerNormalized && sellerNormalized !== sellerName && (
                      <p className="text-xs text-muted-foreground">
                        Will be grouped as: <span className="font-medium">{sellerNormalized}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep('configure')} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleConfirmAndAnalyze} className="flex-1 gap-2" disabled={createAnalysisWithPositions.isPending}>
                    {createAnalysisWithPositions.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Scale className="h-4 w-4" />
                    )}
                    Confirm & Analyze
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
