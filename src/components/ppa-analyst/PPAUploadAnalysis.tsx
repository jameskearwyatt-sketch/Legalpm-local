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
 import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePPAAnalyses, usePPAPositions, usePPAPrecedentBank, PPAAnalysisType, PPAPerspective, PPAStructureType, PPA_STRUCTURE_LABELS } from '@/lib/hooks/usePPAAnalyses';
 import { usePPALearnings } from '@/lib/hooks/usePPALearnings';
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
   onClearPreFill?: () => void;
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

export function PPAUploadAnalysis({ onAnalysisComplete, preFill, onClearPreFill }: PPAUploadAnalysisProps) {
  const { createAnalysis } = usePPAAnalyses();
  const { createPositions } = usePPAPositions(null);
  const { precedents, goldStandardPrecedents } = usePPAPrecedentBank();
   const { formatLearningsForPrompt, activeLearnings } = usePPALearnings();
  const { ppaPrecedentThreshold } = useUserSettings();
  const [step, setStep] = useState<'upload' | 'configure' | 'confirming' | 'analyzing' | 'results'>('upload');
  const [analysisType, setAnalysisType] = useState<PPAAnalysisType>(preFill?.analysisType || 'ppa_vs_bible');
  const [perspective, setPerspective] = useState<PPAPerspective>(preFill?.perspective || 'buyer');
  const [ppaType, setPpaType] = useState<PPAStructureType>(preFill?.ppaType || 'vppa');
  const [jurisdiction, setJurisdiction] = useState(preFill?.jurisdiction || '');
  const [projectName, setProjectName] = useState(preFill?.projectName || '');
  const [counterpartyType, setCounterpartyType] = useState(preFill?.counterpartyType || '');
  const [buyerName, setBuyerName] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [buyerNormalized, setBuyerNormalized] = useState('');
  const [sellerNormalized, setSellerNormalized] = useState('');
  const [ppaFile, setPpaFile] = useState<File | null>(null);
  const [comparisonFile, setComparisonFile] = useState<File | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [createdAnalysisId, setCreatedAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDetectingMetadata, setIsDetectingMetadata] = useState(false);
  const [detectionNotes, setDetectionNotes] = useState<string | null>(null);

  // Auto-detect PPA metadata after file upload
  const detectPPAMetadata = useCallback(async (file: File) => {
    setIsDetectingMetadata(true);
    setDetectionNotes(null);
    
    try {
      // First, parse the document to get text
      const formData = new FormData();
      formData.append('file', file);

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
        const errText = await parseResponse.text();
        console.error('Failed to parse document for metadata detection:', parseResponse.status, errText);
        toast.error('Failed to parse document - please try again');
        return;
      }

      const { text: documentText } = await parseResponse.json();
      console.log('Document parsed, text length:', documentText?.length);

      // Now detect metadata
      const detectResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-ppa-metadata`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ documentText }),
        }
      );

      if (!detectResponse.ok) {
        const errText = await detectResponse.text();
        console.error('Failed to detect PPA metadata:', detectResponse.status, errText);
        toast.error('Failed to detect PPA metadata - please fill in fields manually');
        return;
      }

      const metadata = await detectResponse.json();
      console.log('Auto-detected PPA metadata:', metadata);

      // Auto-fill fields if detected with reasonable confidence
      if (metadata.jurisdiction && metadata.jurisdiction_confidence !== 'low') {
        // Map detected jurisdiction to our list
        const matchedJurisdiction = EUROPEAN_JURISDICTIONS.find(
          j => j.toLowerCase() === metadata.jurisdiction.toLowerCase() ||
               metadata.jurisdiction.toLowerCase().includes(j.toLowerCase())
        );
        if (matchedJurisdiction) {
          setJurisdiction(matchedJurisdiction);
        }
      }

      if (metadata.ppa_type && metadata.ppa_type_confidence !== 'low') {
        const validTypes: PPAStructureType[] = ['vppa', 'physical', 'sleeved', 'private_wire'];
        if (validTypes.includes(metadata.ppa_type)) {
          setPpaType(metadata.ppa_type);
        }
      }

      if (metadata.counterparty_type && metadata.counterparty_type_confidence !== 'low') {
        setCounterpartyType(metadata.counterparty_type);
      }

      // Auto-fill buyer and seller names (both full and normalized)
      if (metadata.buyer_name && metadata.buyer_name_confidence !== 'low') {
        setBuyerName(metadata.buyer_name);
        if (metadata.buyer_normalized) {
          setBuyerNormalized(metadata.buyer_normalized);
        }
      }

      if (metadata.seller_name && metadata.seller_name_confidence !== 'low') {
        setSellerName(metadata.seller_name);
        if (metadata.seller_normalized) {
          setSellerNormalized(metadata.seller_normalized);
        }
      }

      if (metadata.detection_notes) {
        setDetectionNotes(metadata.detection_notes);
      }

      toast.success('Document metadata auto-detected', {
        description: 'Review the pre-filled fields and adjust if needed.',
      });

    } catch (err) {
      console.warn('Error detecting PPA metadata:', err);
      // Non-critical - just log and continue
    } finally {
      setIsDetectingMetadata(false);
    }
  }, []);

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
      // Don't auto-detect on upload - we'll do it when user clicks Start Analysis
    } else {
      setComparisonFile(file);
    }
  }, [projectName]);

  // Handler for "Start Analysis" button - detects metadata first, then shows confirmation
  const handleDetectAndConfirm = async () => {
    if (!ppaFile) {
      toast.error('Please upload a PPA document');
      return;
    }

    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    // Move to confirming step
    setStep('confirming');
    setError(null);

    // If we already have pre-filled data, skip detection
    if (preFill) {
      return;
    }

    // Auto-detect metadata from the document
    await detectPPAMetadata(ppaFile);
  };

  // Handler for "Confirm & Start Full Analysis" button
  const handleConfirmAndAnalyze = () => {
    handleStartAnalysis();
  };

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
      
       // Format user learnings for the AI
       const userLearningsPrompt = formatLearningsForPrompt();
       if (activeLearnings.length > 0) {
         console.log(`Including ${activeLearnings.length} user learnings for AI guidance`);
       }
       
      setAnalysisStatus('Running AI analysis with market intelligence...');
      
      // Helper function to make the API call with retry
      const callAnalyzeApi = async (retryCount = 0): Promise<Response> => {
        const controller = new AbortController();
        // 5 minute timeout per attempt - long enough for complex PPA analysis
        const timeoutId = setTimeout(() => controller.abort(), 300000);
        
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
                 userLearnings: userLearningsPrompt,
              }),
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);
          return res;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          // Retry on network errors (connection closed, timeout, etc.) up to 3 times
          if (retryCount < 3 && (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('fetch')))) {
            console.log(`Analysis attempt ${retryCount + 1} failed, retrying...`);
            setAnalysisStatus(`Analysis taking longer than expected, retrying (attempt ${retryCount + 2}/4)...`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retry
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
        // Party names
        buyer_name: buyerName || null,
        seller_name: sellerName || null,
        // Normalized names for intelligent search
        buyer_normalized: buyerNormalized || null,
        seller_normalized: sellerNormalized || null,
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
              <div className="flex items-center justify-between">
                <span className="text-amber-600 dark:text-amber-400">
                  Re-analyzing with latest intelligence engine. Please upload: <strong>{preFill.originalFileName}</strong>
                </span>
                {onClearPreFill && (
                  <Button variant="ghost" size="sm" onClick={onClearPreFill} className="ml-2 h-6 px-2">
                    <X className="h-3 w-3 mr-1" />
                    Start Fresh
                  </Button>
                )}
              </div>
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
            <div className="space-y-3">
              {isDetectingMetadata && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Scanning document to detect metadata...
                  </span>
                </div>
              )}
              <Button 
                onClick={() => setStep('configure')} 
                className="w-full gap-2"
                disabled={isDetectingMetadata}
              >
                {isDetectingMetadata ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Detecting...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
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

            {/* Auto-detection notes */}
            {detectionNotes && !preFill && (
              <div className="flex items-start gap-2 p-3 bg-primary/10 text-primary rounded-lg">
                <Brain className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Auto-detected from document</p>
                  <p className="text-xs opacity-80">{detectionNotes}</p>
                </div>
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

            {/* Party Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyer-name">Buyer / Offtaker</Label>
                <Input
                  id="buyer-name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="e.g., Statkraft, Shell, Microsoft"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seller-name">Seller / Generator</Label>
                <Input
                  id="seller-name"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="e.g., Orsted, RWE, BayWa"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">
              Party names help you search precedents by counterparty later
            </p>

            {/* Start Analysis - triggers metadata detection first */}
            <Button 
              onClick={handleDetectAndConfirm} 
              className="w-full gap-2"
              disabled={!ppaFile || !projectName.trim() || isDetectingMetadata}
            >
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
                  <p className="text-sm text-muted-foreground">Detecting parties, structure type, and jurisdiction</p>
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
                </div>
              </div>
            )}

            {!isDetectingMetadata && (
              <>
                {/* PPA Structure Type */}
                <div className="space-y-3">
                  <Label>PPA Structure Type</Label>
                  <RadioGroup 
                    value={ppaType} 
                    onValueChange={(v) => setPpaType(v as PPAStructureType)}
                    className="grid grid-cols-2 gap-3"
                  >
                    <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="vppa" id="confirm-vppa" />
                      <label htmlFor="confirm-vppa" className="cursor-pointer text-sm">Virtual PPA</label>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="physical" id="confirm-physical" />
                      <label htmlFor="confirm-physical" className="cursor-pointer text-sm">Physical PPA</label>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="sleeved" id="confirm-sleeved" />
                      <label htmlFor="confirm-sleeved" className="cursor-pointer text-sm">Sleeved PPA</label>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="private_wire" id="confirm-private_wire" />
                      <label htmlFor="confirm-private_wire" className="cursor-pointer text-sm">Private Wire</label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Jurisdiction */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-jurisdiction">Jurisdiction</Label>
                  <Select value={jurisdiction} onValueChange={setJurisdiction}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select jurisdiction" />
                    </SelectTrigger>
                    <SelectContent>
                      {EUROPEAN_JURISDICTIONS.map((j) => (
                        <SelectItem key={j} value={j}>{j}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Counterparty Type */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-counterparty">Counterparty Type</Label>
                  <Input
                    id="confirm-counterparty"
                    value={counterpartyType}
                    onChange={(e) => setCounterpartyType(e.target.value)}
                    placeholder="e.g., Utility, Corporate, Oil Major"
                  />
                </div>

                {/* Party Names */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="confirm-buyer">Buyer / Offtaker</Label>
                    <Input
                      id="confirm-buyer"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="e.g., Statkraft, Shell"
                    />
                    {buyerNormalized && buyerNormalized !== buyerName && (
                      <p className="text-xs text-muted-foreground">
                        Will be grouped as: <span className="font-medium">{buyerNormalized}</span>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-seller">Seller / Generator</Label>
                    <Input
                      id="confirm-seller"
                      value={sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      placeholder="e.g., Orsted, RWE"
                    />
                    {sellerNormalized && sellerNormalized !== sellerName && (
                      <p className="text-xs text-muted-foreground">
                        Will be grouped as: <span className="font-medium">{sellerNormalized}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep('configure')}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleConfirmAndAnalyze} 
                    className="flex-1 gap-2"
                    disabled={createAnalysis.isPending}
                  >
                    {createAnalysis.isPending ? (
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
