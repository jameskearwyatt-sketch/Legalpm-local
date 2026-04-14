import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileText, Scale, ArrowRight, Loader2, AlertCircle, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTollingAnalyses, useTollingPositions, useTollingPrecedentBank, TollingAnalysisType, TollingPerspective } from '@/lib/hooks/useTollingAnalyses';
import { useTollingLearnings } from '@/lib/hooks/useTollingLearnings';
import { TollingAnalysisReport } from './TollingAnalysisReport';

const JURISDICTIONS = [
  'United Kingdom',
  'United States',
  'Germany',
  'Spain',
  'Italy',
  'Netherlands',
  'Australia',
  'Japan',
  'Singapore',
  'Middle East',
  'Other',
];

import { TOLLING_TECHNOLOGY_TYPES, TOLLING_FACILITY_STAGES, type TollingFacilityStage } from '@/lib/tollingCategories';
import { logLlmCall, classifyLlmError } from '@/lib/analyst/llmCallLog';
import { redactPII, summarizeRedaction } from '@/lib/analyst/piiRedaction';
import { PIIRedactionToggle } from '@/components/shared/PIIRedactionToggle';

interface TollingUploadAnalysisProps {
  onAnalysisComplete?: () => void;
}

export function TollingUploadAnalysis({ onAnalysisComplete }: TollingUploadAnalysisProps) {
  const { createAnalysisWithPositions } = useTollingAnalyses();
  const { getRelevantPrecedents } = useTollingPrecedentBank();
  const { formatLearningsForPrompt, activeLearnings, getRelevantLearnings } = useTollingLearnings();

  const [step, setStep] = useState<'upload' | 'configure' | 'analyzing' | 'results'>('upload');
  const [analysisType, setAnalysisType] = useState<TollingAnalysisType>('tolling_vs_bible');
  const [perspective, setPerspective] = useState<TollingPerspective>('offtaker');
  const [tollingType, setTollingType] = useState('gas_ccgt');
  const [facilityStage, setFacilityStage] = useState<TollingFacilityStage>('operating');
  const [jurisdiction, setJurisdiction] = useState('');
  const [projectName, setProjectName] = useState('');
  const [counterpartyType, setCounterpartyType] = useState('');
  const [offtakerName, setOfftakerName] = useState('');
  const [generatorName, setGeneratorName] = useState('');
  const [tollingFile, setTollingFile] = useState<File | null>(null);
  const [comparisonFile, setComparisonFile] = useState<File | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [createdAnalysisId, setCreatedAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redactPIIEnabled, setRedactPIIEnabled] = useState(false);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'tolling' | 'comparison') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF or Word document (.doc/.docx)');
      return;
    }

    if (type === 'tolling') {
      setTollingFile(file);
      if (!projectName) {
        const nameMatch = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        setProjectName(nameMatch);
      }
    } else {
      setComparisonFile(file);
    }
  }, [projectName]);

  const handleStartAnalysis = async () => {
    if (!tollingFile) {
      toast.error('Please upload a tolling agreement');
      return;
    }

    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setStep('analyzing');
    setAnalysisProgress(0);
    setError(null);

    // Hoisted so catch block can report PII stats even if analysis fails after redaction ran.
    const piiCounts = { email: 0, phone: 0, ssn: 0, ein: 0, iban: 0, card: 0 };
    let piiTotalRedactions = 0;

    try {
      // Step 1: Parse the document
      setAnalysisStatus('Extracting text from document...');
      setAnalysisProgress(10);

      const formData = new FormData();
      formData.append('file', tollingFile);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const parseResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || 'Failed to parse document');
      }

      const { text: tollingText } = await parseResponse.json();
      setAnalysisProgress(30);

      // Step 2: Parse comparison document if provided
      let comparisonText = null;
      if (comparisonFile && analysisType === 'tolling_vs_termsheet') {
        setAnalysisStatus('Extracting text from comparison document...');
        const compFormData = new FormData();
        compFormData.append('file', comparisonFile);
        const compParseResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: compFormData,
          }
        );
        if (compParseResponse.ok) {
          const { text } = await compParseResponse.json();
          comparisonText = text;
        }
        setAnalysisProgress(50);
      } else {
        setAnalysisProgress(50);
      }

      // Optional PII redaction before any text leaves the browser.
      let tollingTextForLLM = tollingText;
      let comparisonTextForLLM = comparisonText;
      if (redactPIIEnabled) {
        const r1 = redactPII(tollingText || '');
        tollingTextForLLM = r1.redacted;
        (Object.keys(piiCounts) as (keyof typeof piiCounts)[]).forEach(k => { piiCounts[k] += r1.counts[k]; });
        piiTotalRedactions += r1.totalRedactions;
        if (comparisonText) {
          const r2 = redactPII(comparisonText);
          comparisonTextForLLM = r2.redacted;
          (Object.keys(piiCounts) as (keyof typeof piiCounts)[]).forEach(k => { piiCounts[k] += r2.counts[k]; });
          piiTotalRedactions += r2.totalRedactions;
        }
        if (piiTotalRedactions > 0) {
          toast.success(`PII redaction: ${summarizeRedaction(piiCounts)}`);
        }
      }

      // Step 3: Build precedent context (semantic top-K retrieval with
      // graceful fallback to all-active when embeddings aren't available).
      setAnalysisStatus('Building precedent intelligence...');
      const retrievalQuery = (tollingTextForLLM || '').slice(0, 15_000);
      const [relevantLearningsRes, relevantRegularRes, relevantGoldRes] = await Promise.all([
        getRelevantLearnings(retrievalQuery, 15),
        getRelevantPrecedents(retrievalQuery, 20, false),
        getRelevantPrecedents(retrievalQuery, 10, true),
      ]);
      const appliedRegularPrecedents = relevantRegularRes.precedents.filter(p => !p.is_gold_standard);
      const appliedGoldStandardPrecedents = relevantGoldRes.precedents;
      const relevantPrecedents = appliedRegularPrecedents.map(p => ({
        category: p.category,
        position_summary: p.position_summary,
        project_name: p.project_name,
        jurisdiction: p.jurisdiction,
        perspective: p.perspective,
      }));

      const selectedLearnings = relevantLearningsRes.learnings;

      // Capture IDs for audit trail
      const appliedLearningIds = selectedLearnings.map(l => l.id);
      const appliedPrecedentIds = appliedRegularPrecedents.map(p => p.id);
      const appliedGoldStandardIds = appliedGoldStandardPrecedents.map(p => p.id);

      const userLearningsPrompt = formatLearningsForPrompt(selectedLearnings);
      if (selectedLearnings.length > 0) {
        console.log(`Including ${selectedLearnings.length} tolling learnings (semantic=${relevantLearningsRes.usedSemanticRetrieval}, pool=${activeLearnings.length})`);
      }

      setAnalysisStatus('Running AI analysis...');

      // Step 4: Call analyze-tolling edge function
      const callAnalyzeApi = async (retryCount = 0): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);
        const { data: sessionData2 } = await supabase.auth.getSession();
        const authToken = sessionData2?.session?.access_token;

        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-tolling`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                tollingText: tollingTextForLLM,
                comparisonText: comparisonTextForLLM,
                analysisType,
                perspective,
                jurisdiction,
                projectName,
                tollingType,
                facilityStage,
                counterpartyType: counterpartyType || null,
                precedents: relevantPrecedents,
                userLearnings: userLearningsPrompt,
              }),
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);
          return res;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (retryCount < 3 && fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('fetch'))) {
            setAnalysisStatus(`Retrying (attempt ${retryCount + 2}/4)...`);
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
        let errorMessage = 'Failed to analyze tolling agreement';
        try {
          const errorData = await analyzeRes.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Analysis failed with status ${analyzeRes.status}`;
        }
        throw new Error(errorMessage);
      }

      const analyzeResponse = await analyzeRes.json();
      setAnalysisProgress(80);
      setAnalysisStatus('Saving analysis results...');

      void logLlmCall({
        analystType: 'tolling',
        functionName: 'analyze-tolling',
        status: 'success',
        inputChars: (tollingTextForLLM?.length ?? 0) + (comparisonTextForLLM?.length ?? 0),
        inputTokenCount: analyzeResponse?.input_token_count ?? null,
        outputTokenCount: analyzeResponse?.output_token_count ?? null,
        modelUsed: analyzeResponse?.model_used ?? null,
        durationMs: analysisDurationMs,
        metadata: {
          analysisType,
          perspective,
          tollingType,
          pii_redacted: redactPIIEnabled,
          pii_redaction_counts: redactPIIEnabled ? piiCounts : undefined,
          pii_total_redactions: redactPIIEnabled ? piiTotalRedactions : 0,
          // Edge function now uses JSON response_format; parse errors
          // should be rare. See #6 structured output.
          structured_output: true,
        },
      });

      const { positions: extractedPositions } = analyzeResponse;

      // Step 5: Atomically insert the analysis record + its positions
      // in a single Postgres transaction (no orphan rows on network drop).
      const positionsPayload = (extractedPositions || []).map((pos: any) => ({
        category: pos.category,
        position_summary: pos.position_summary,
        source_text: pos.clause_references || pos.source_text || null,
        confidence: pos.confidence || 'medium',
        bible_reference: pos.bible_reference || null,
        comparison_position: pos.market_comparison || pos.comparison_position || null,
        variance_notes: pos.market_position
          ? `[${pos.market_position.toUpperCase().replace('_', ' ')}] ${pos.variance_notes || ''}`.trim()
          : pos.variance_notes || null,
        market_benchmark: pos.market_benchmark || null,
      }));

      const analysisResult = await createAnalysisWithPositions.mutateAsync({
        analysis: {
          analysis_type: analysisType,
          perspective,
          project_name: projectName.trim(),
          jurisdiction: jurisdiction || null,
          document_file_name: tollingFile.name,
          document_file_url: null,
          comparison_file_name: comparisonFile?.name || null,
          comparison_file_url: null,
          notes: null,
          parent_analysis_id: null,
          version_number: 1,
          is_comparison: false,
          tolling_type: tollingType,
          facility_stage: facilityStage,
          complexity_score: null,
          key_risk_areas: [],
          counterparty_type: counterpartyType || null,
          offtaker_name: offtakerName || null,
          generator_name: generatorName || null,
          offtaker_normalized: offtakerName || null,
          generator_normalized: generatorName || null,
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

      setAnalysisProgress(100);
      setCreatedAnalysisId(analysisResult.id);
      setStep('results');
      toast.success('Analysis complete!');
    } catch (err) {
      console.error('Analysis error:', err);
      void logLlmCall({
        analystType: 'tolling',
        functionName: 'analyze-tolling',
        status: 'failure',
        errorType: classifyLlmError(err),
        errorMessage: err instanceof Error ? err.message : String(err),
        metadata: {
          analysisType,
          perspective,
          tollingType,
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
      toast.error('Analysis failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleReset = () => {
    setStep('upload');
    setTollingFile(null);
    setComparisonFile(null);
    setProjectName('');
    setJurisdiction('');
    setAnalysisType('tolling_vs_bible');
    setPerspective('offtaker');
    setCreatedAnalysisId(null);
    setError(null);
  };

  if (step === 'results' && createdAnalysisId) {
    return (
      <TollingAnalysisReport
        analysisId={createdAnalysisId}
        onNewAnalysis={handleReset}
        onViewHistory={onAnalysisComplete}
      />
    );
  }

  if (step === 'analyzing') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Analyzing {analysisType === 'termsheet_vs_bible' ? 'Term Sheet' : 'Tolling Agreement'}</CardTitle>
          <CardDescription>{analysisStatus}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={analysisProgress} className="h-2" />
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            This may take a minute or two for large documents...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Step 1: Upload */}
      <Card className={step === 'upload' ? '' : 'opacity-60'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {analysisType === 'termsheet_vs_bible' ? 'Upload Term Sheet' : 'Upload Tolling Agreement'}
          </CardTitle>
          <CardDescription>
            {analysisType === 'termsheet_vs_bible'
              ? 'Upload a term sheet or heads of terms (PDF or Word) for analysis against market standard tolling positions'
              : 'Upload a tolling agreement or term sheet (PDF or Word) for analysis'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={(e) => handleFileUpload(e, 'tolling')}
              className="hidden"
              id="tolling-upload"
              disabled={step !== 'upload'}
            />
            <label htmlFor="tolling-upload" className="cursor-pointer">
              {tollingFile ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileText className="h-8 w-8" />
                  <div className="text-left">
                    <p className="font-medium">{tollingFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(tollingFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
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

          {tollingFile && step === 'upload' && (
            <Button onClick={() => setStep('configure')} className="w-full gap-2">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Configure */}
      {(step === 'configure' || step === 'upload') && (
        <Card className={step === 'configure' ? '' : 'opacity-40 pointer-events-none'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Analysis Configuration
            </CardTitle>
            <CardDescription>Choose your analysis type and perspective</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Keadby CCGT Tolling"
              />
            </div>

            {/* Analysis Type */}
            <div className="space-y-3">
              <Label>Analysis Type</Label>
              <RadioGroup value={analysisType} onValueChange={(v) => setAnalysisType(v as TollingAnalysisType)}>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="tolling_vs_bible" id="tolling_vs_bible" className="mt-1" />
                  <label htmlFor="tolling_vs_bible" className="flex-1 cursor-pointer">
                    <p className="font-medium">Tolling Agreement vs Knowledge & Precedent Bank</p>
                    <p className="text-sm text-muted-foreground">
                      Analyze a full tolling agreement against the knowledge base and your banked precedents
                    </p>
                  </label>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="termsheet_vs_bible" id="termsheet_vs_bible_tolling" className="mt-1" />
                  <label htmlFor="termsheet_vs_bible_tolling" className="flex-1 cursor-pointer">
                    <p className="font-medium">Term Sheet vs Knowledge & Precedent Bank</p>
                    <p className="text-sm text-muted-foreground">
                      Analyze a term sheet or heads of terms against market standard tolling positions — identifies gaps and flags where the term sheet is on/off market
                    </p>
                  </label>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="tolling_vs_termsheet" id="tolling_vs_termsheet" className="mt-1" />
                  <label htmlFor="tolling_vs_termsheet" className="flex-1 cursor-pointer">
                    <p className="font-medium">Tolling Agreement vs Term Sheet</p>
                    <p className="text-sm text-muted-foreground">
                      Compare a tolling agreement against a term sheet to check alignment
                    </p>
                  </label>
                </div>
              </RadioGroup>
            </div>

            {/* Comparison Document */}
            {analysisType === 'tolling_vs_termsheet' && (
              <div className="space-y-2">
                <Label>Term Sheet / Comparison Document</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => handleFileUpload(e, 'comparison')}
                    className="hidden"
                    id="comparison-upload"
                  />
                  <label htmlFor="comparison-upload" className="cursor-pointer">
                    {comparisonFile ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <FileText className="h-5 w-5" />
                        <span className="font-medium">{comparisonFile.name}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Upload term sheet (optional)</p>
                    )}
                  </label>
                </div>
              </div>
            )}

            {/* Perspective */}
            <div className="space-y-3">
              <Label>Your Perspective</Label>
              <RadioGroup
                value={perspective}
                onValueChange={(v) => setPerspective(v as TollingPerspective)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="offtaker" id="offtaker" />
                  <label htmlFor="offtaker" className="cursor-pointer">Offtaker (Toller)</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="generator" id="generator" />
                  <label htmlFor="generator" className="cursor-pointer">Generator (Facility Owner)</label>
                </div>
              </RadioGroup>
            </div>

            {/* Jurisdiction */}
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Jurisdiction</Label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select jurisdiction (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {JURISDICTIONS.map((j) => (
                    <SelectItem key={j} value={j}>{j}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Technology Type */}
            <div className="space-y-2">
              <Label htmlFor="tolling-type">Technology Type</Label>
              <Select value={tollingType} onValueChange={setTollingType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select technology type" />
                </SelectTrigger>
                <SelectContent>
                  {TOLLING_TECHNOLOGY_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Technology type determines which analysis categories are used. Gas CCGT and BESS agreements look very different.
              </p>
            </div>

            {/* Facility Stage */}
            <div className="space-y-2">
              <Label htmlFor="facility-stage">Facility Stage</Label>
              <Select value={facilityStage} onValueChange={(v) => setFacilityStage(v as TollingFacilityStage)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select facility stage" />
                </SelectTrigger>
                <SelectContent>
                  {TOLLING_FACILITY_STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex flex-col">
                        <span>{s.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {facilityStage === 'development' ? 'Tolling agreement entered into to support project bankability. Construction & development categories will be analysed.' :
                 facilityStage === 'construction' ? 'Facility under construction. Construction milestones and COD provisions will be analysed.' :
                 'Facility already operational. Analysis focuses on operational commercial terms.'}
              </p>
            </div>

            {/* Counterparty Type */}
            <div className="space-y-2">
              <Label htmlFor="counterparty">Counterparty Type (optional)</Label>
              <Input
                id="counterparty"
                value={counterpartyType}
                onChange={(e) => setCounterpartyType(e.target.value)}
                placeholder="e.g., Utility, IPP, Trading House"
              />
            </div>

            {/* Party Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="offtaker-name">Offtaker (Toller)</Label>
                <Input
                  id="offtaker-name"
                  value={offtakerName}
                  onChange={(e) => setOfftakerName(e.target.value)}
                  placeholder="e.g., Shell, EDF, Statkraft"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="generator-name">Generator (Facility Owner)</Label>
                <Input
                  id="generator-name"
                  value={generatorName}
                  onChange={(e) => setGeneratorName(e.target.value)}
                  placeholder="e.g., SSE, Drax, Uniper"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">
              Party names help search precedents by counterparty later
            </p>

            <PIIRedactionToggle checked={redactPIIEnabled} onCheckedChange={setRedactPIIEnabled} />

            {/* Start Analysis */}
            <Button
              onClick={handleStartAnalysis}
              className="w-full gap-2"
              disabled={!tollingFile || !projectName.trim()}
            >
              <Scale className="h-4 w-4" />
              Start Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
