import { useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PPAUploadAnalysis } from '@/components/ppa-analyst/PPAUploadAnalysis';
import { PPAAnalysisList } from '@/components/ppa-analyst/PPAAnalysisList';
import { PPAPrecedentBank } from '@/components/ppa-analyst/PPAPrecedentBank';
 import { PPALearningsTab } from '@/components/ppa-analyst/PPALearningsTab';
 import { FileSearch, History, Database, Brain, Beaker } from 'lucide-react';
import { AnalystRegressionHarness } from '@/components/shared/AnalystRegressionHarness';
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
  const { uniqueProjectCount } = usePPAPrecedentBank();
   const { activeLearnings } = usePPALearnings();

  // Count unique deals, not individual positions
  const precedentCount = uniqueProjectCount;

  const handleReanalyze = useCallback((analysis: PPAAnalysis) => {
    // Pre-fill the form with the existing analysis settings
    setReanalyzePreFill({
      projectName: analysis.project_name,
      jurisdiction: analysis.jurisdiction || '',
      perspective: analysis.perspective,
      analysisType: analysis.analysis_type,
      ppaType: analysis.ppa_type || 'vppa',
      counterpartyType: analysis.counterparty_type || '',
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
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">PPA Analyst</h1>
            <p className="text-muted-foreground mt-1">
              Analyze PPAs and term sheets against market standards and precedents
            </p>
          </div>
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
            <TabsTrigger value="regression" className="gap-2">
              <Beaker className="h-4 w-4" />
              Regression
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

          <TabsContent value="regression">
            <AnalystRegressionHarness analyst="ppa" analystLabel="PPA" />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
