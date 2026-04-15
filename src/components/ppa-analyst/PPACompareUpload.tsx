import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Loader2, GitCompare, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePPAAnalyses, PPAAnalysis, PPAExtractedPosition } from '@/lib/hooks/usePPAAnalyses';
import { toast } from 'sonner';

interface PPACompareUploadProps {
  parentAnalysis: PPAAnalysis;
  previousPositions: PPAExtractedPosition[];
  onComplete: (newAnalysisId: string) => void;
  onCancel: () => void;
}

export function PPACompareUpload({ 
  parentAnalysis, 
  previousPositions, 
  onComplete, 
  onCancel 
}: PPACompareUploadProps) {
  const { createAnalysisWithPositions } = usePPAAnalyses();
  
  const [newDraftFile, setNewDraftFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'docx', 'doc'].includes(ext || '')) {
        toast.error('Please upload a PDF or Word document');
        return;
      }
      setNewDraftFile(file);
    }
  };

  const handleCompare = useCallback(async () => {
    if (!newDraftFile) {
      toast.error('Please select the new draft file');
      return;
    }

    setIsAnalyzing(true);
    setProgress(10);
    setStatus('Reading new draft...');

    try {
      // Step 1: Parse the new document
      const reader = new FileReader();
      const fileContent = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(newDraftFile);
      });

      setProgress(30);
      setStatus('Extracting text from document...');

      const parseResponse = await supabase.functions.invoke('parse-document-text', {
        body: {
          fileContent,
          fileName: newDraftFile.name,
        },
      });

      if (parseResponse.error) {
        throw new Error('Failed to parse document');
      }

      const newPpaText = parseResponse.data.text;

      setProgress(50);
      setStatus('Comparing against previous draft...');

      // Step 2: Call comparison function
      const compareResponse = await supabase.functions.invoke('compare-ppa-drafts', {
        body: {
          newPpaText,
          previousPositions: previousPositions.map(p => ({
            category: p.category,
            position_summary: p.position_summary,
            source_text: p.source_text,
            variance_notes: p.variance_notes,
          })),
          perspective: parentAnalysis.perspective,
          jurisdiction: parentAnalysis.jurisdiction,
          projectName: parentAnalysis.project_name,
          versionNumber: (parentAnalysis.version_number || 1) + 1,
        },
      });

      if (compareResponse.error) {
        throw new Error(compareResponse.error.message || 'Failed to compare drafts');
      }

      setProgress(80);
      setStatus('Saving comparison results...');

      const { positions: comparedPositions, stats } = compareResponse.data;

      // Step 3: Create new analysis record (linked to parent) + positions atomically
      const newVersion = (parentAnalysis.version_number || 1) + 1;
      const positionsPayload = (comparedPositions ?? []).map((pos: any) => ({
        category: pos.category,
        position_summary: pos.position_summary,
        source_text: pos.source_text || null,
        confidence: pos.confidence || 'review_required',
        bible_reference: null,
        comparison_position: pos.comparison_position || null,
        variance_notes: pos.variance_notes || null,
        previous_position: pos.previous_position || null,
        change_summary: pos.change_summary || null,
        change_type: pos.change_type || null,
        market_benchmark: null,
      }));

      const analysisResult = await createAnalysisWithPositions.mutateAsync({
        analysis: {
          analysis_type: parentAnalysis.analysis_type,
          perspective: parentAnalysis.perspective,
          project_name: `${parentAnalysis.project_name} (v${newVersion})`,
          jurisdiction: parentAnalysis.jurisdiction,
          document_file_name: newDraftFile.name,
          document_file_url: null,
          comparison_file_name: null,
          comparison_file_url: null,
          notes: `Comparison against ${parentAnalysis.document_file_name}. Changes: ${stats.modified} modified, ${stats.added} new, ${stats.removed} removed.`,
          parent_analysis_id: parentAnalysis.id,
          version_number: newVersion,
          is_comparison: true,
          // Inherit PPA type from parent analysis
          ppa_type: parentAnalysis.ppa_type || null,
          complexity_score: null,
          key_risk_areas: [],
          counterparty_type: parentAnalysis.counterparty_type || null,
          // Inherit party names from parent
          buyer_name: parentAnalysis.buyer_name || null,
          seller_name: parentAnalysis.seller_name || null,
          // Inherit normalized names from parent
          buyer_normalized: parentAnalysis.buyer_normalized || null,
          seller_normalized: parentAnalysis.seller_normalized || null,
          // Applied-context trace (comparison flow has no retrieval)
          applied_learning_ids: [],
          applied_precedent_ids: [],
          applied_gold_standard_ids: [],
          // Telemetry
          model_used: null,
          analysis_duration_ms: null,
          input_token_count: null,
          output_token_count: null,
        },
        positions: positionsPayload,
      });

      setProgress(100);
      setStatus('Complete!');

      toast.success(`Comparison complete: ${stats.modified} changes found`);
      onComplete(analysisResult.id);

    } catch (error) {
      console.error('Comparison error:', error);
      toast.error(error instanceof Error ? error.message : 'Comparison failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [newDraftFile, parentAnalysis, previousPositions, createAnalysisWithPositions, onComplete]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="h-5 w-5" />
          Compare New Draft
        </CardTitle>
        <CardDescription>
          Upload a new version of <strong>{parentAnalysis.project_name}</strong> to see what has changed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Previous version info */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <p className="text-sm font-medium">Previous Draft (v{parentAnalysis.version_number || 1})</p>
            <p className="text-sm text-muted-foreground">{parentAnalysis.document_file_name}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">New Draft (v{(parentAnalysis.version_number || 1) + 1})</p>
            <p className="text-sm text-muted-foreground">
              {newDraftFile?.name || 'Upload new version...'}
            </p>
          </div>
        </div>

        {/* File upload */}
        <div className="space-y-2">
          <Label htmlFor="new-draft">New Draft File</Label>
          <Input
            id="new-draft"
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={handleFileChange}
            disabled={isAnalyzing}
          />
          <p className="text-xs text-muted-foreground">
            Upload the latest version of the PPA (PDF or Word)
          </p>
        </div>

        {/* Progress */}
        {isAnalyzing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{status}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isAnalyzing}>
            Cancel
          </Button>
          <Button onClick={handleCompare} disabled={!newDraftFile || isAnalyzing}>
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <GitCompare className="h-4 w-4 mr-2" />
                Compare Drafts
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
