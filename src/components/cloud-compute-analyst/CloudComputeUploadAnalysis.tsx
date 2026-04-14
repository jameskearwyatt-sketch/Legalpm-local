import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileText, ArrowRight, Loader2, AlertCircle, Cloud } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCloudComputeAnalyses, useCloudComputePrecedentBank, CloudComputeAnalysisType, CloudComputePerspective } from '@/lib/hooks/useCloudComputeAnalyses';
import { useCloudComputeLearnings } from '@/lib/hooks/useCloudComputeLearnings';
import { CloudComputeAnalysisReport } from './CloudComputeAnalysisReport';
import { CLOUD_SERVICE_TYPES, CLOUD_DEPLOYMENT_MODELS, type CloudDeploymentModel } from '@/lib/cloudComputeCategories';
import { logLlmCall, classifyLlmError } from '@/lib/analyst/llmCallLog';

const JURISDICTIONS = ['United States', 'United Kingdom', 'EU', 'Germany', 'Ireland', 'Singapore', 'Japan', 'Australia', 'Other'];

interface Props { onAnalysisComplete?: () => void; }

export function CloudComputeUploadAnalysis({ onAnalysisComplete }: Props) {
  const { createAnalysisWithPositions } = useCloudComputeAnalyses();
  const { getRelevantPrecedents } = useCloudComputePrecedentBank();
  const { formatLearningsForPrompt, activeLearnings, getRelevantLearnings } = useCloudComputeLearnings();

  const [step, setStep] = useState<'upload' | 'configure' | 'analyzing' | 'results'>('upload');
  const [analysisType, setAnalysisType] = useState<CloudComputeAnalysisType>('agreement_vs_bible');
  const [perspective, setPerspective] = useState<CloudComputePerspective>('tenant');
  const [serviceType, setServiceType] = useState('iaas');
  const [deploymentModel, setDeploymentModel] = useState<CloudDeploymentModel>('public_cloud');
  const [jurisdiction, setJurisdiction] = useState('');
  const [projectName, setProjectName] = useState('');
  const [counterpartyType, setCounterpartyType] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [providerName, setProviderName] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [createdAnalysisId, setCreatedAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!validTypes.includes(file.type)) { toast.error('Please upload a PDF or Word document'); return; }
    setContractFile(file);
    if (!projectName) setProjectName(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
  }, [projectName]);

  const handleStartAnalysis = async () => {
    if (!contractFile) { toast.error('Please upload a contract'); return; }
    if (!projectName.trim()) { toast.error('Please enter a project name'); return; }
    setStep('analyzing'); setAnalysisProgress(0); setError(null);

    try {
      setAnalysisStatus('Extracting text from document...'); setAnalysisProgress(10);
      const formData = new FormData(); formData.append('file', contractFile);
      const { data: sd } = await supabase.auth.getSession();
      const token = sd?.session?.access_token;
      const parseResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      if (!parseResponse.ok) { const ed = await parseResponse.json(); throw new Error(ed.error || 'Failed to parse document'); }
      const { text: contractText } = await parseResponse.json();
      setAnalysisProgress(30);

      setAnalysisStatus('Building precedent intelligence...');
      // Semantic top-K retrieval with graceful fallback to all-active.
      const retrievalQuery = (contractText || '').slice(0, 15_000);
      const [relevantLearningsRes, relevantRegularRes, relevantGoldRes] = await Promise.all([
        getRelevantLearnings(retrievalQuery, 15),
        getRelevantPrecedents(retrievalQuery, 20, false),
        getRelevantPrecedents(retrievalQuery, 10, true),
      ]);
      const appliedRegularPrecedents = relevantRegularRes.precedents.filter(p => !p.is_gold_standard);
      const appliedGoldStandardPrecedents = relevantGoldRes.precedents;
      const relevantPrecedents = appliedRegularPrecedents.map(p => ({ category: p.category, position_summary: p.position_summary, project_name: p.project_name, jurisdiction: p.jurisdiction, perspective: p.perspective }));
      const selectedLearnings = relevantLearningsRes.learnings;
      const appliedLearningIds = selectedLearnings.map(l => l.id);
      const appliedPrecedentIds = appliedRegularPrecedents.map(p => p.id);
      const appliedGoldStandardIds = appliedGoldStandardPrecedents.map(p => p.id);
      const userLearningsPrompt = formatLearningsForPrompt(selectedLearnings);
      if (selectedLearnings.length > 0) console.log(`Including ${selectedLearnings.length} cloud compute learnings (semantic=${relevantLearningsRes.usedSemanticRetrieval}, pool=${activeLearnings.length})`);
      setAnalysisProgress(50); setAnalysisStatus('Running AI analysis...');

      const callAnalyzeApi = async (retryCount = 0): Promise<Response> => {
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 300000);
        const { data: sd2 } = await supabase.auth.getSession();
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-cloud-compute`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd2?.session?.access_token}` },
            body: JSON.stringify({ contractText, analysisType, perspective, jurisdiction, projectName, serviceType, deploymentModel, counterpartyType: counterpartyType || null, precedents: relevantPrecedents, userLearnings: userLearningsPrompt }),
            signal: controller.signal,
          }); clearTimeout(timeoutId); return res;
        } catch (fe) { clearTimeout(timeoutId); if (retryCount < 3 && fe instanceof Error && (fe.name === 'AbortError' || fe.message.includes('fetch'))) { setAnalysisStatus(`Retrying (attempt ${retryCount + 2}/4)...`); await new Promise(r => setTimeout(r, 3000)); return callAnalyzeApi(retryCount + 1); } throw fe; }
      };

      const analysisStartTs = Date.now();
      const analyzeRes = await callAnalyzeApi();
      const analysisDurationMs = Date.now() - analysisStartTs;
      if (!analyzeRes.ok) { let em = 'Failed to analyze contract'; try { const ed = await analyzeRes.json(); em = ed.error || em; } catch {} throw new Error(em); }
      const analyzeResponse = await analyzeRes.json();
      setAnalysisProgress(80); setAnalysisStatus('Saving analysis results...');
      void logLlmCall({
        analystType: 'cloud_compute',
        functionName: 'analyze-cloud-compute',
        status: 'success',
        inputChars: contractText?.length ?? 0,
        inputTokenCount: analyzeResponse?.input_token_count ?? null,
        outputTokenCount: analyzeResponse?.output_token_count ?? null,
        modelUsed: analyzeResponse?.model_used ?? null,
        durationMs: analysisDurationMs,
        metadata: { analysisType, perspective, serviceType, deploymentModel },
      });
      const { positions: extractedPositions } = analyzeResponse;

      const positionsPayload = (extractedPositions ?? []).map((pos: any) => ({
        category: pos.category,
        position_summary: pos.position_summary,
        source_text: pos.clause_references || pos.source_text || null,
        confidence: pos.confidence || 'medium',
        bible_reference: pos.bible_reference || null,
        comparison_position: pos.market_comparison || pos.comparison_position || null,
        variance_notes: pos.market_position ? `[${pos.market_position.toUpperCase().replace('_', ' ')}] ${pos.variance_notes || ''}`.trim() : pos.variance_notes || null,
        previous_position: null,
        change_summary: null,
        change_type: null,
        market_benchmark: pos.market_benchmark || null,
      }));

      const analysisResult = await createAnalysisWithPositions.mutateAsync({
        analysis: {
          analysis_type: analysisType, perspective, project_name: projectName.trim(), jurisdiction: jurisdiction || null,
          document_file_name: contractFile.name, document_file_url: null, comparison_file_name: null, comparison_file_url: null,
          notes: null, parent_analysis_id: null, version_number: 1, is_comparison: false, service_type: serviceType,
          deployment_model: deploymentModel, complexity_score: null, key_risk_areas: [], counterparty_type: counterpartyType || null,
          tenant_name: tenantName || null, provider_name: providerName || null, tenant_normalized: tenantName || null, provider_normalized: providerName || null,
          applied_learning_ids: appliedLearningIds,
          applied_precedent_ids: appliedPrecedentIds,
          applied_gold_standard_ids: appliedGoldStandardIds,
          model_used: analyzeResponse?.model_used ?? null,
          analysis_duration_ms: analysisDurationMs,
          input_token_count: analyzeResponse?.input_token_count ?? null,
          output_token_count: analyzeResponse?.output_token_count ?? null,
        },
        positions: positionsPayload,
      });

      setAnalysisProgress(100); setCreatedAnalysisId(analysisResult.id); setStep('results'); toast.success('Analysis complete!');
    } catch (err) {
      console.error('Analysis error:', err);
      void logLlmCall({
        analystType: 'cloud_compute',
        functionName: 'analyze-cloud-compute',
        status: 'failure',
        errorType: classifyLlmError(err),
        errorMessage: err instanceof Error ? err.message : String(err),
        metadata: { analysisType, perspective, serviceType, deploymentModel },
      });
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStep('configure');
      toast.error('Analysis failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleReset = () => { setStep('upload'); setContractFile(null); setProjectName(''); setJurisdiction(''); setAnalysisType('agreement_vs_bible'); setPerspective('tenant'); setCreatedAnalysisId(null); setError(null); };

  if (step === 'results' && createdAnalysisId) return <CloudComputeAnalysisReport analysisId={createdAnalysisId} onNewAnalysis={handleReset} onViewHistory={onAnalysisComplete} />;
  if (step === 'analyzing') return <Card className="max-w-2xl mx-auto"><CardHeader className="text-center"><CardTitle>Analyzing {analysisType === 'termsheet_vs_bible' ? 'Term Sheet' : 'Cloud Compute Agreement'}</CardTitle><CardDescription>{analysisStatus}</CardDescription></CardHeader><CardContent className="space-y-6"><Progress value={analysisProgress} className="h-2" /><div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><p className="text-center text-sm text-muted-foreground">This may take a minute or two for large documents...</p></CardContent></Card>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className={step === 'upload' ? '' : 'opacity-60'}>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Cloud Compute Agreement</CardTitle><CardDescription>Upload a cloud services agreement or term sheet (PDF or Word)</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input type="file" accept=".pdf,.docx,.doc" onChange={handleFileUpload} className="hidden" id="cloud-compute-upload" disabled={step !== 'upload'} />
            <label htmlFor="cloud-compute-upload" className="cursor-pointer">
              {contractFile ? <div className="flex items-center justify-center gap-2 text-primary"><FileText className="h-8 w-8" /><div className="text-left"><p className="font-medium">{contractFile.name}</p><p className="text-sm text-muted-foreground">{(contractFile.size / 1024 / 1024).toFixed(2)} MB</p></div></div> : <div className="space-y-2"><Upload className="h-12 w-12 mx-auto text-muted-foreground" /><p className="text-muted-foreground">Click to upload or drag and drop</p><p className="text-sm text-muted-foreground">PDF or Word document (max 15MB)</p></div>}
            </label>
          </div>
          {contractFile && step === 'upload' && <Button onClick={() => setStep('configure')} className="w-full gap-2">Continue <ArrowRight className="h-4 w-4" /></Button>}
        </CardContent>
      </Card>

      {(step === 'configure' || step === 'upload') && (
        <Card className={step === 'configure' ? '' : 'opacity-40 pointer-events-none'}>
          <CardHeader><CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" /> Analysis Configuration</CardTitle><CardDescription>Choose your analysis type and perspective</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            {error && <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg"><AlertCircle className="h-5 w-5 flex-shrink-0" /><p className="text-sm">{error}</p></div>}
            <div className="space-y-2"><Label>Project Name</Label><Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g., AWS Enterprise Compute Agreement" /></div>
            <div className="space-y-3"><Label>Analysis Type</Label>
              <RadioGroup value={analysisType} onValueChange={(v) => setAnalysisType(v as CloudComputeAnalysisType)}>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"><RadioGroupItem value="agreement_vs_bible" id="agreement_vs_bible_cc" className="mt-1" /><label htmlFor="agreement_vs_bible_cc" className="flex-1 cursor-pointer"><p className="font-medium">Cloud Agreement vs Knowledge & Precedent Bank</p><p className="text-sm text-muted-foreground">Analyze a full cloud compute agreement against the knowledge base</p></label></div>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"><RadioGroupItem value="termsheet_vs_bible" id="termsheet_vs_bible_cc" className="mt-1" /><label htmlFor="termsheet_vs_bible_cc" className="flex-1 cursor-pointer"><p className="font-medium">Term Sheet vs Knowledge & Precedent Bank</p><p className="text-sm text-muted-foreground">Analyze a term sheet or LOI against market standard positions</p></label></div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Service Type</Label><Select value={serviceType} onValueChange={setServiceType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CLOUD_SERVICE_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Deployment Model</Label><Select value={deploymentModel} onValueChange={(v) => setDeploymentModel(v as CloudDeploymentModel)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CLOUD_DEPLOYMENT_MODELS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-3"><Label>Perspective</Label><RadioGroup value={perspective} onValueChange={(v) => setPerspective(v as CloudComputePerspective)} className="flex gap-4"><div className="flex items-center gap-2"><RadioGroupItem value="tenant" id="tenant_cc" /><label htmlFor="tenant_cc">Tenant (Buyer)</label></div><div className="flex items-center gap-2"><RadioGroupItem value="provider" id="provider_cc" /><label htmlFor="provider_cc">Provider</label></div></RadioGroup></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Jurisdiction</Label><Select value={jurisdiction} onValueChange={setJurisdiction}><SelectTrigger><SelectValue placeholder="Select jurisdiction" /></SelectTrigger><SelectContent>{JURISDICTIONS.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Counterparty Type (optional)</Label><Input value={counterpartyType} onChange={(e) => setCounterpartyType(e.target.value)} placeholder="e.g., Hyperscaler, Colo Provider" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tenant Name (optional)</Label><Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="e.g., Amazon" /></div>
              <div className="space-y-2"><Label>Provider Name (optional)</Label><Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="e.g., Equinix" /></div>
            </div>
            {step === 'configure' && <Button onClick={handleStartAnalysis} className="w-full" disabled={!contractFile || !projectName.trim()}><Cloud className="h-4 w-4 mr-2" /> Start Analysis</Button>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
