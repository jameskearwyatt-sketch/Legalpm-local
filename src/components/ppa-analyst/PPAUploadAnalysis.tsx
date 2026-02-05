import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileText, Scale, ArrowRight, Loader2, AlertCircle, Settings2, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePPAAnalyses, usePPAPositions, usePPAPrecedentBank, PPAAnalysisType, PPAPerspective, PPAStructureType, PPA_STRUCTURE_LABELS } from '@/lib/hooks/usePPAAnalyses';
import { useUserSettings } from '@/lib/hooks/useUserSettings';
import { PPAAnalysisReport } from './PPAAnalysisReport';
import { generateMarketIntelligence, formatIntelligenceForPrompt } from '@/lib/ppaPrecedentIntelligence';

// Pre-fill data for re-analysis
interface PreFillData {
  projectName: string;
  jurisdiction: string;
  perspective: PPAPerspective;
  analysisType: PPAAnalysisType;
  ppaType: PPAStructureType;
  counterpartyType: string;
  originalFileName: string;
}

interface PPAUploadAnalysisProps {
  onAnalysisComplete?: () => void;
  preFill?: PreFillData;
}

const EUROPEAN_JURISDICTIONS = [
  'United Kingdom',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Poland',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Ireland',
  'Portugal',
  'Belgium',
  'Austria',
  'Greece',
  'Romania',
  'Czech Republic',
  'Hungary',
  'Other EU',
  'Other Non-EU',
];

export function PPAUploadAnalysis({ onAnalysisComplete, preFill }: PPAUploadAnalysisProps) {
  const { createAnalysis } = usePPAAnalyses();
  const { createPositions } = usePPAPositions(null);
  const { precedents, goldStandardPrecedents } = usePPAPrecedentBank();
  const { ppaPrecedentThreshold } = useUserSettings();
  const [step, setStep] = useState<'upload' | 'configure' | 'analyzing' | 'results'>('upload');
  const [analysisType, setAnalysisType] = useState<PPAAnalysisType>(preFill?.analysisType || 'ppa_vs_bible');
  const [perspective, setPerspective] = useState<PPAPerspective>(preFill?.perspective || 'buyer');
  const [ppaType, setPpaType] = useState<PPAStructureType>(preFill?.ppaType || 'vppa');
  const [jurisdiction, setJurisdiction] = useState(preFill?.jurisdiction || '');
  const [projectName, setProjectName] = useState(preFill?.projectName || '');
  const [counterpartyType, setCounterpartyType] = useState(preFill?.counterpartyType || '');
  const [ppaFile, setPpaFile] = useState<File | null>(null);
  const [comparisonFile, setComparisonFile] = useState<File | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [createdAnalysisId, setCreatedAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'ppa' | 'comparison') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF or Word document (.docx)');
      return;
    }

    if (type === 'ppa') {
      setPpaFile(file);
      // Try to extract project name from filename
      if (!projectName) {
        const nameMatch = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        setProjectName(nameMatch);
      }
    } else {
      setComparisonFile(file);
    }
  }, [projectName]);

  const handleStartAnalysis = async () => {
    if (!ppaFile) {
      toast.error('Please upload a PPA document');
      return;
    }

    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setStep('analyzing');
    setAnalysisProgress(0);
    setError(null);

    try {
      // Step 1: Parse the PPA document
      setAnalysisStatus('Extracting text from document...');
      setAnalysisProgress(10);

      const formData = new FormData();
      formData.append('file', ppaFile);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const parseResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || 'Failed to parse document');
      }

      const { text: ppaText } = await parseResponse.json();
      setAnalysisProgress(30);

      // Step 2: Parse comparison document if provided
      let comparisonText = null;
      if (comparisonFile && analysisType === 'ppa_vs_termsheet') {
        setAnalysisStatus('Extracting text from comparison document...');
        
        const compFormData = new FormData();
        compFormData.append('file', comparisonFile);

        const compParseResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
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

      // Step 3: Generate Market Intelligence from precedent bank
      setAnalysisStatus('Generating market intelligence from precedent bank...');
      
      // Generate comprehensive market intelligence with context awareness
      const marketIntelligence = generateMarketIntelligence(
        precedents, 
        goldStandardPrecedents,
        jurisdiction || undefined, // Pass current jurisdiction for relevance scoring
        perspective, // Pass current perspective for relevance scoring
        ppaType // Pass current PPA type for structure-specific learning
      );
      const intelligencePrompt = formatIntelligenceForPrompt(marketIntelligence);
      
      console.log(`Market Intelligence: ${marketIntelligence.totalDeals} deals, ${marketIntelligence.totalPositions} positions`);
      console.log(`  Confidence: ${marketIntelligence.intelligenceConfidence}, Data Quality: ${marketIntelligence.statisticalDepth.dataQualityScore}/100`);
      console.log(`  Context Relevance: ${marketIntelligence.contextRelevance.relevanceScore}/100 (${marketIntelligence.contextRelevance.jurisdictionMatchCount} jurisdiction, ${marketIntelligence.contextRelevance.ppaTypeMatchCount} type matches)`);
      console.log(`  Market Movement: ${marketIntelligence.temporalAnalysis.marketMovement}`);
      console.log(`  PPA Type Intelligence: ${marketIntelligence.ppaTypeAnalysis.typeRecommendation || 'N/A'}`);
      console.log(`  Learning Velocity: ${marketIntelligence.learningMetrics.learningVelocity}`);
      
      // Filter relevant precedents for raw comparison (exclude gold standard from regular precedents)
      const regularPrecedents = precedents.filter(p => !p.is_gold_standard);
      const relevantPrecedents = regularPrecedents.length >= ppaPrecedentThreshold
        ? regularPrecedents.map(p => ({
            category: p.category,
            position_summary: p.position_summary,
            project_name: p.project_name,
            jurisdiction: p.jurisdiction,
            perspective: p.perspective,
          }))
        : [];
      
      // Always include gold standard precedents for comparison (regardless of threshold)
      const goldStandardForAnalysis = goldStandardPrecedents.map(p => ({
        category: p.category,
        position_summary: p.position_summary,
        project_name: p.project_name,
        jurisdiction: p.jurisdiction,
        perspective: p.perspective,
        template_name: p.template_name,
      }));
      
      console.log(`Passing ${relevantPrecedents.length} raw precedents + synthesized intelligence (threshold: ${ppaPrecedentThreshold})`);
      console.log(`Passing ${goldStandardForAnalysis.length} gold standard template positions`);
      
      setAnalysisStatus('Running AI analysis with market intelligence...');
      
      // Helper function to make the API call with retry
      const callAnalyzeApi = async (retryCount = 0): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout per attempt
        
        const { data: sessionData2 } = await supabase.auth.getSession();
        const authToken = sessionData2?.session?.access_token;
        
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-ppa`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                ppaText,
                comparisonText,
                analysisType,
                perspective,
                jurisdiction,
                projectName,
                ppaType,
                counterpartyType: counterpartyType || null,
                precedents: relevantPrecedents,
                goldStandardPrecedents: goldStandardForAnalysis,
                marketIntelligence: intelligencePrompt,
                intelligenceConfidence: marketIntelligence.intelligenceConfidence,
              }),
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);
          return res;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          // Retry on network errors (connection closed, timeout, etc.) up to 2 times
          if (retryCount < 2 && (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('fetch')))) {
            console.log(`Analysis attempt ${retryCount + 1} failed, retrying...`);
            setAnalysisStatus(`Analysis taking longer than expected, retrying (attempt ${retryCount + 2}/3)...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
            return callAnalyzeApi(retryCount + 1);
          }
          throw fetchError;
        }
      };
      
      const analyzeRes = await callAnalyzeApi();
      
      if (!analyzeRes.ok) {
        let errorMessage = 'Failed to analyze PPA';
        try {
          const errorData = await analyzeRes.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If we can't parse the error JSON, use the status
          errorMessage = `Analysis failed with status ${analyzeRes.status}`;
        }
        throw new Error(errorMessage);
      }
      
      const analyzeResponse = { data: await analyzeRes.json(), error: null };

      // Error already thrown above if response not ok

      setAnalysisProgress(80);
      setAnalysisStatus('Saving analysis results...');

      const { positions: extractedPositions } = analyzeResponse.data;

      // Step 4: Create analysis record with enhanced learning fields
      const analysisResult = await createAnalysis.mutateAsync({
        analysis_type: analysisType,
        perspective,
        project_name: projectName.trim(),
        jurisdiction: jurisdiction || null,
        document_file_name: ppaFile.name,
        document_file_url: null,
        comparison_file_name: comparisonFile?.name || null,
        comparison_file_url: null,
        notes: null,
        parent_analysis_id: null,
        version_number: 1,
        is_comparison: false,
        // New learning fields
        ppa_type: ppaType,
        complexity_score: null, // Will be set after analysis
        key_risk_areas: [],
        counterparty_type: counterpartyType || null,
      });

      // Step 5: Save extracted positions
      if (extractedPositions && extractedPositions.length > 0) {
        await createPositions.mutateAsync(
          extractedPositions.map((pos: any) => ({
            analysis_id: analysisResult.id,
            user_id: analysisResult.user_id,
            category: pos.category,
            position_summary: pos.position_summary,
            source_text: pos.clause_references || pos.source_text || null,
            confidence: pos.confidence || 'medium',
            bible_reference: pos.bible_reference || null,
            comparison_position: pos.market_comparison || pos.comparison_position || null,
            variance_notes: pos.market_position ? `[${pos.market_position.toUpperCase().replace('_', ' ')}] ${pos.variance_notes || ''}`.trim() : (pos.variance_notes || null),
            market_benchmark: pos.market_benchmark || null,
          }))
        );
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
    setStep('upload');
    setPpaFile(null);
    setComparisonFile(null);
    setProjectName('');
    setJurisdiction('');
    setAnalysisType('ppa_vs_bible');
    setPerspective('buyer');
    setCreatedAnalysisId(null);
    setError(null);
  };

  if (step === 'results' && createdAnalysisId) {
    return (
      <PPAAnalysisReport 
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
          <CardTitle>Analyzing PPA</CardTitle>
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
            {preFill ? 'Re-upload Document for Re-analysis' : 'Upload PPA Document'}
          </CardTitle>
          <CardDescription>
            {preFill ? (
              <span className="text-amber-600 dark:text-amber-400">
                Re-analyzing with latest intelligence engine. Please upload: <strong>{preFill.originalFileName}</strong>
              </span>
            ) : (
              'Upload a Power Purchase Agreement (PDF or Word) for analysis'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => handleFileUpload(e, 'ppa')}
              className="hidden"
              id="ppa-upload"
              disabled={step !== 'upload'}
            />
            <label htmlFor="ppa-upload" className="cursor-pointer">
              {ppaFile ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileText className="h-8 w-8" />
                  <div className="text-left">
                    <p className="font-medium">{ppaFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(ppaFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PDF or Word document (max 15MB)
                  </p>
                </div>
              )}
            </label>
          </div>

          {ppaFile && step === 'upload' && (
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
              <Scale className="h-5 w-5" />
              Analysis Configuration
            </CardTitle>
            <CardDescription>
              Choose your analysis type and perspective
            </CardDescription>
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
                placeholder="e.g., VMO2 Solar PPA"
              />
            </div>

            {/* Analysis Type */}
            <div className="space-y-3">
              <Label>Analysis Type</Label>
              <RadioGroup value={analysisType} onValueChange={(v) => setAnalysisType(v as PPAAnalysisType)}>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="ppa_vs_bible" id="ppa_vs_bible" className="mt-1" />
                  <label htmlFor="ppa_vs_bible" className="flex-1 cursor-pointer">
                    <p className="font-medium">PPA vs Knowledge & Precedent Bank</p>
                    <p className="text-sm text-muted-foreground">
                      Analyze against the How-To Bible framework, gold standard templates, and your banked deal precedents
                    </p>
                  </label>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="ppa_vs_termsheet" id="ppa_vs_termsheet" className="mt-1" />
                  <label htmlFor="ppa_vs_termsheet" className="flex-1 cursor-pointer">
                    <p className="font-medium">PPA vs Term Sheet</p>
                    <p className="text-sm text-muted-foreground">
                      Compare PPA draft against a term sheet or heads of terms
                    </p>
                  </label>
                </div>
              </RadioGroup>
            </div>

            {/* Comparison Document (for term sheet comparison) */}
            {analysisType === 'ppa_vs_termsheet' && (
              <div className="space-y-2">
                <Label>Term Sheet / Comparison Document</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.docx"
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
                      <p className="text-sm text-muted-foreground">
                        Upload term sheet (optional)
                      </p>
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
                onValueChange={(v) => setPerspective(v as PPAPerspective)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="buyer" id="buyer" />
                  <label htmlFor="buyer" className="cursor-pointer">Buyer (Offtaker)</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="seller" id="seller" />
                  <label htmlFor="seller" className="cursor-pointer">Seller (Generator)</label>
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
                  {EUROPEAN_JURISDICTIONS.map((j) => (
                    <SelectItem key={j} value={j}>{j}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* PPA Structure Type */}
            <div className="space-y-2">
              <Label htmlFor="ppa-type">PPA Structure Type</Label>
              <Select value={ppaType} onValueChange={(v) => setPpaType(v as PPAStructureType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PPA type" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PPA_STRUCTURE_LABELS) as [PPAStructureType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This helps the system learn type-specific patterns over time
              </p>
            </div>

            {/* Counterparty Type (optional) */}
            <div className="space-y-2">
              <Label htmlFor="counterparty">Counterparty Type (optional)</Label>
              <Input
                id="counterparty"
                value={counterpartyType}
                onChange={(e) => setCounterpartyType(e.target.value)}
                placeholder="e.g., Utility, Corporate, Oil Major, Developer"
              />
              <p className="text-xs text-muted-foreground">
                Helps identify counterparty-specific negotiation patterns
              </p>
            </div>

            {/* Start Analysis */}
            <Button 
              onClick={handleStartAnalysis} 
              className="w-full gap-2"
              disabled={!ppaFile || !projectName.trim() || createAnalysis.isPending}
            >
              {createAnalysis.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Scale className="h-4 w-4" />
              )}
              Start Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
