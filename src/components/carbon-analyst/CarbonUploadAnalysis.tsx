import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileText, Scale, ArrowRight, Loader2, AlertCircle, Leaf } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCarbonAnalyses, useCarbonPositions, useCarbonPrecedentBank, CarbonAnalysisType, CarbonPerspective } from '@/lib/hooks/useCarbonAnalyses';
import { useCarbonLearnings } from '@/lib/hooks/useCarbonLearnings';
import { CarbonAnalysisReport } from './CarbonAnalysisReport';
import { CARBON_PROJECT_TYPES, CARBON_PROJECT_STAGES, CARBON_CREDIT_CLASSES, getCreditClassForType, type CarbonProjectStage, type CarbonCreditClass } from '@/lib/carbonCategories';

const JURISDICTIONS = [
  'United Kingdom', 'United States', 'European Union', 'Switzerland',
  'Australia', 'Canada', 'Japan', 'Singapore', 'Middle East', 'Africa', 'Latin America', 'Other',
];

interface CarbonUploadAnalysisProps {
  onAnalysisComplete?: () => void;
}

export function CarbonUploadAnalysis({ onAnalysisComplete }: CarbonUploadAnalysisProps) {
  const { createAnalysis } = useCarbonAnalyses();
  const { createPositions } = useCarbonPositions(null);
  const { precedents } = useCarbonPrecedentBank();
  const { formatLearningsForPrompt, activeLearnings } = useCarbonLearnings();

  const [step, setStep] = useState<'upload' | 'configure' | 'analyzing' | 'results'>('upload');
  const [analysisType, setAnalysisType] = useState<CarbonAnalysisType>('carbon_vs_bible');
  const [perspective, setPerspective] = useState<CarbonPerspective>('buyer');
  const [carbonType, setCarbonType] = useState('dac');
  const [projectStage, setProjectStage] = useState<CarbonProjectStage>('operational');
  const [jurisdiction, setJurisdiction] = useState('');
  const [projectName, setProjectName] = useState('');
  const [counterpartyType, setCounterpartyType] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [carbonFile, setCarbonFile] = useState<File | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [createdAnalysisId, setCreatedAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!validTypes.includes(file.type)) { toast.error('Please upload a PDF or Word document'); return; }
    setCarbonFile(file);
    if (!projectName) setProjectName(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
  }, [projectName]);

  const handleStartAnalysis = async () => {
    if (!carbonFile) { toast.error('Please upload a carbon credit offtake agreement'); return; }
    if (!projectName.trim()) { toast.error('Please enter a project name'); return; }

    setStep('analyzing');
    setAnalysisProgress(0);
    setError(null);

    try {
      setAnalysisStatus('Extracting text from document...');
      setAnalysisProgress(10);

      const formData = new FormData();
      formData.append('file', carbonFile);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const parseResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!parseResponse.ok) { const errorData = await parseResponse.json(); throw new Error(errorData.error || 'Failed to parse document'); }
      const { text: documentText } = await parseResponse.json();
      setAnalysisProgress(40);

      setAnalysisStatus('Building precedent intelligence...');
      const relevantPrecedents = precedents.filter(p => !p.is_gold_standard).map(p => ({
        category: p.category, position_summary: p.position_summary, project_name: p.project_name,
        jurisdiction: p.jurisdiction, perspective: p.perspective,
      }));

      const userLearningsPrompt = formatLearningsForPrompt();
      if (activeLearnings.length > 0) console.log(`Including ${activeLearnings.length} carbon learnings`);

      setAnalysisStatus('Running AI analysis...');
      setAnalysisProgress(50);

      const callAnalyzeApi = async (retryCount = 0): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);
        const { data: sd2 } = await supabase.auth.getSession();
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-carbon-credit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd2?.session?.access_token}` },
            body: JSON.stringify({
              documentText, analysisType, perspective, jurisdiction, projectName,
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
            setAnalysisStatus(`Retrying (attempt ${retryCount + 2}/4)...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return callAnalyzeApi(retryCount + 1);
          }
          throw fetchError;
        }
      };

      const analyzeRes = await callAnalyzeApi();
      if (!analyzeRes.ok) {
        let errorMessage = 'Failed to analyze carbon credit offtake agreement';
        try { const errorData = await analyzeRes.json(); errorMessage = errorData.error || errorMessage; } catch { errorMessage = `Analysis failed with status ${analyzeRes.status}`; }
        throw new Error(errorMessage);
      }

      const analyzeResponse = await analyzeRes.json();
      setAnalysisProgress(80);
      setAnalysisStatus('Saving analysis results...');

      const { positions: extractedPositions } = analyzeResponse;

      const analysisResult = await createAnalysis.mutateAsync({
        analysis_type: analysisType, perspective, project_name: projectName.trim(),
        jurisdiction: jurisdiction || null, document_file_name: carbonFile.name,
        document_file_url: null, comparison_file_name: null, comparison_file_url: null,
        notes: null, parent_analysis_id: null, version_number: 1, is_comparison: false,
        carbon_type: carbonType, project_stage: projectStage, complexity_score: null,
        key_risk_areas: [], counterparty_type: counterpartyType || null,
        buyer_name: buyerName || null, seller_name: sellerName || null,
        buyer_normalized: buyerName || null, seller_normalized: sellerName || null,
      });

      if (extractedPositions && extractedPositions.length > 0) {
        await createPositions.mutateAsync(extractedPositions.map((pos: any) => ({
          analysis_id: analysisResult.id, user_id: analysisResult.user_id,
          category: pos.category, position_summary: pos.position_summary,
          source_text: pos.clause_references || pos.source_text || null,
          confidence: pos.confidence || 'medium', bible_reference: pos.bible_reference || null,
          comparison_position: pos.market_comparison || pos.comparison_position || null,
          variance_notes: pos.market_position
            ? `[${pos.market_position.toUpperCase().replace('_', ' ')}] ${pos.variance_notes || ''}`.trim()
            : pos.variance_notes || null,
          market_benchmark: pos.market_benchmark || null,
        })));
      }

      setAnalysisProgress(100);
      setCreatedAnalysisId(analysisResult.id);
      setStep('results');
      toast.success('Analysis complete!');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStep('configure');
      toast.error('Analysis failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleReset = () => {
    setStep('upload'); setCarbonFile(null); setProjectName(''); setJurisdiction('');
    setAnalysisType('carbon_vs_bible'); setPerspective('buyer'); setCreatedAnalysisId(null); setError(null);
  };

  if (step === 'results' && createdAnalysisId) {
    return <CarbonAnalysisReport analysisId={createdAnalysisId} onNewAnalysis={handleReset} onViewHistory={onAnalysisComplete} />;
  }

  if (step === 'analyzing') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Analyzing {analysisType === 'termsheet_vs_bible' ? 'Term Sheet' : 'Carbon Credit Offtake Agreement'}</CardTitle>
          <CardDescription>{analysisStatus}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={analysisProgress} className="h-2" />
          <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          <p className="text-center text-sm text-muted-foreground">This may take a minute or two for large documents...</p>
        </CardContent>
      </Card>
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
            <Button onClick={handleStartAnalysis} className="w-full gap-2" disabled={!carbonFile || !projectName.trim()}>
              <Scale className="h-4 w-4" />Start Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
