import { useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PPAUploadAnalysis } from '@/components/ppa-analyst/PPAUploadAnalysis';
import { PPAAnalysisList } from '@/components/ppa-analyst/PPAAnalysisList';
import { PPAPrecedentBank } from '@/components/ppa-analyst/PPAPrecedentBank';
 import { PPALearningsTab } from '@/components/ppa-analyst/PPALearningsTab';
 import { FileSearch, History, Database, Settings2, Brain } from 'lucide-react';
import { useUserSettings } from '@/lib/hooks/useUserSettings';
 import { usePPAPrecedentBank, PPAAnalysis, PPAStructureType, PPAPerspective, PPAAnalysisType } from '@/lib/hooks/usePPAAnalyses';
 import { usePPALearnings } from '@/lib/hooks/usePPALearnings';
import { toast } from 'sonner';

// Pre-fill state for re-analysis
interface ReanalyzePreFill {
  projectName: string;
  jurisdiction: string;
  perspective: PPAPerspective;
  analysisType: PPAAnalysisType;
  ppaType: PPAStructureType;
  counterpartyType: string;
  originalFileName: string;
}

export default function PPAAnalyst() {
  const [activeTab, setActiveTab] = useState('new-analysis');
  const [reanalyzePreFill, setReanalyzePreFill] = useState<ReanalyzePreFill | null>(null);
  const { ppaPrecedentThreshold, updateSettings } = useUserSettings();
  const { uniqueProjectCount, uniqueTemplateCount } = usePPAPrecedentBank();
   const { activeLearnings } = usePPALearnings();
  
  // Count unique deals, not individual positions
  const precedentCount = uniqueProjectCount;
  const templateCount = uniqueTemplateCount;
  const marketComparisonEnabled = precedentCount >= ppaPrecedentThreshold;

  const handleThresholdChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 50) {
      updateSettings.mutate({ ppa_precedent_threshold: num });
    }
  };

  const handleReanalyze = useCallback((analysis: PPAAnalysis) => {
    // Pre-fill the form with the existing analysis settings
    setReanalyzePreFill({
      projectName: analysis.project_name,
      jurisdiction: analysis.jurisdiction || '',
      perspective: analysis.perspective,
      analysisType: analysis.analysis_type,
      ppaType: (analysis as any).ppa_type || 'vppa',
      counterpartyType: (analysis as any).counterparty_type || '',
      originalFileName: analysis.document_file_name,
    });
    
    toast.info(`Re-analyze: ${analysis.project_name}`, {
      description: `Please upload "${analysis.document_file_name}" again to re-run with the latest intelligence engine.`,
    });
    
    setActiveTab('new-analysis');
  }, []);

  const handleAnalysisComplete = useCallback(() => {
    setReanalyzePreFill(null);
    setActiveTab('history');
  }, []);
 
   const handleClearPreFill = useCallback(() => {
     setReanalyzePreFill(null);
   }, []);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">PPA Analyst</h1>
            <p className="text-muted-foreground mt-1">
              Analyze PPAs and term sheets against market standards and precedents
            </p>
          </div>
          
          {/* Market Comparison Status */}
          <Card className="w-80">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Market Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Precedents banked:</span>
                <Badge variant={marketComparisonEnabled ? "default" : "secondary"}>
                  {precedentCount}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="threshold" className="text-sm text-muted-foreground whitespace-nowrap">
                  Min. threshold:
                </Label>
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  max={50}
                  value={ppaPrecedentThreshold}
                  onChange={(e) => handleThresholdChange(e.target.value)}
                  className="w-16 h-8 text-center"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {marketComparisonEnabled 
                  ? '✓ Market position analysis active'
                  : `Need ${ppaPrecedentThreshold - precedentCount} more precedent${ppaPrecedentThreshold - precedentCount !== 1 ? 's' : ''} to enable`
                }
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="new-analysis" className="gap-2">
              <FileSearch className="h-4 w-4" />
              New Analysis
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Analysis History
            </TabsTrigger>
            <TabsTrigger value="precedent-bank" className="gap-2">
              <Database className="h-4 w-4" />
              Precedent Bank
              {precedentCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {precedentCount}
                </Badge>
              )}
            </TabsTrigger>
             <TabsTrigger value="learnings" className="gap-2">
               <Brain className="h-4 w-4" />
               AI Learnings
               {activeLearnings.length > 0 && (
                 <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                   {activeLearnings.length}
                 </Badge>
               )}
             </TabsTrigger>
          </TabsList>

          <TabsContent value="new-analysis">
            <PPAUploadAnalysis 
              onAnalysisComplete={handleAnalysisComplete} 
              preFill={reanalyzePreFill || undefined}
               onClearPreFill={reanalyzePreFill ? handleClearPreFill : undefined}
            />
          </TabsContent>

          <TabsContent value="history">
            <PPAAnalysisList onReanalyze={handleReanalyze} />
          </TabsContent>

          <TabsContent value="precedent-bank">
            <PPAPrecedentBank />
          </TabsContent>
 
           <TabsContent value="learnings">
             <PPALearningsTab />
           </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
