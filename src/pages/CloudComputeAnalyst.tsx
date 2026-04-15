import { useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileSearch, History, Database, Brain, Cloud, Beaker } from 'lucide-react';
import { CloudComputeUploadAnalysis } from '@/components/cloud-compute-analyst/CloudComputeUploadAnalysis';
import { CloudComputeAnalysisList } from '@/components/cloud-compute-analyst/CloudComputeAnalysisList';
import { CloudComputePrecedentBank } from '@/components/cloud-compute-analyst/CloudComputePrecedentBank';
import { CloudComputeLearningsTab } from '@/components/cloud-compute-analyst/CloudComputeLearningsTab';
import { AnalystRegressionHarness } from '@/components/shared/AnalystRegressionHarness';
import { useCloudComputePrecedentBank } from '@/lib/hooks/useCloudComputeAnalyses';
import { useCloudComputeLearnings } from '@/lib/hooks/useCloudComputeLearnings';

export default function CloudComputeAnalyst() {
  const [activeTab, setActiveTab] = useState('new-analysis');
  const { uniqueProjectCount } = useCloudComputePrecedentBank();
  const { activeLearnings } = useCloudComputeLearnings();

  const handleAnalysisComplete = useCallback(() => {
    setActiveTab('history');
  }, []);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Cloud className="h-6 w-6" />
              Cloud Compute Services Analyst
            </h1>
            <p className="text-muted-foreground mt-1">
              Analyze cloud compute offtake agreements against market standards and precedents
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="new-analysis" className="gap-2"><FileSearch className="h-4 w-4" /> New Analysis</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Analysis History</TabsTrigger>
            <TabsTrigger value="precedent-bank" className="gap-2">
              <Database className="h-4 w-4" /> Precedent Bank
              {uniqueProjectCount > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{uniqueProjectCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="learnings" className="gap-2">
              <Brain className="h-4 w-4" /> AI Learnings
              {activeLearnings.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeLearnings.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="regression" className="gap-2"><Beaker className="h-4 w-4" /> Regression</TabsTrigger>
          </TabsList>

          <TabsContent value="new-analysis"><CloudComputeUploadAnalysis onAnalysisComplete={handleAnalysisComplete} /></TabsContent>
          <TabsContent value="history"><CloudComputeAnalysisList /></TabsContent>
          <TabsContent value="precedent-bank"><CloudComputePrecedentBank /></TabsContent>
          <TabsContent value="learnings"><CloudComputeLearningsTab /></TabsContent>
          <TabsContent value="regression"><AnalystRegressionHarness analyst="cloud_compute" analystLabel="Cloud Compute" /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
