import { useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileSearch, History, Database, Brain, Leaf, Beaker } from 'lucide-react';
import { CarbonUploadAnalysis } from '@/components/carbon-analyst/CarbonUploadAnalysis';
import { CarbonAnalysisList } from '@/components/carbon-analyst/CarbonAnalysisList';
import { CarbonPrecedentBank } from '@/components/carbon-analyst/CarbonPrecedentBank';
import { CarbonLearningsTab } from '@/components/carbon-analyst/CarbonLearningsTab';
import { AnalystRegressionHarness } from '@/components/shared/AnalystRegressionHarness';
import { useCarbonPrecedentBank } from '@/lib/hooks/useCarbonAnalyses';
import { useCarbonLearnings } from '@/lib/hooks/useCarbonLearnings';

export default function CarbonCreditAnalyst() {
  const [activeTab, setActiveTab] = useState('new-analysis');
  const { uniqueProjectCount } = useCarbonPrecedentBank();
  const { activeLearnings } = useCarbonLearnings();

  const handleAnalysisComplete = useCallback(() => {
    setActiveTab('history');
  }, []);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Leaf className="h-6 w-6" />
              Carbon Credit Offtake Analyst
            </h1>
            <p className="text-muted-foreground mt-1">
              Analyze carbon credit offtake agreements against market standards and precedents
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
              {uniqueProjectCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {uniqueProjectCount}
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
            <CarbonUploadAnalysis onAnalysisComplete={handleAnalysisComplete} />
          </TabsContent>

          <TabsContent value="history">
            <CarbonAnalysisList />
          </TabsContent>

          <TabsContent value="precedent-bank">
            <CarbonPrecedentBank />
          </TabsContent>

          <TabsContent value="learnings">
            <CarbonLearningsTab />
          </TabsContent>

          <TabsContent value="regression">
            <AnalystRegressionHarness analyst="carbon" analystLabel="Carbon Credit" />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
