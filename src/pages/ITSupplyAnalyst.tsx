import { useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileSearch, History, Database, Brain, Cpu } from 'lucide-react';
import { ITSupplyUploadAnalysis } from '@/components/it-supply-analyst/ITSupplyUploadAnalysis';
import { ITSupplyAnalysisList } from '@/components/it-supply-analyst/ITSupplyAnalysisList';
import { ITSupplyPrecedentBank } from '@/components/it-supply-analyst/ITSupplyPrecedentBank';
import { ITSupplyLearningsTab } from '@/components/it-supply-analyst/ITSupplyLearningsTab';
import { useITSupplyPrecedentBank } from '@/lib/hooks/useITSupplyAnalyses';
import { useITSupplyLearnings } from '@/lib/hooks/useITSupplyLearnings';

export default function ITSupplyAnalyst() {
  const [activeTab, setActiveTab] = useState('new-analysis');
  const { uniqueProjectCount } = useITSupplyPrecedentBank();
  const { activeLearnings } = useITSupplyLearnings();

  const handleAnalysisComplete = useCallback(() => {
    setActiveTab('history');
  }, []);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Cpu className="h-6 w-6" />
              IT Supply Analyst
            </h1>
            <p className="text-muted-foreground mt-1">
              Analyze chip and server supply contracts against market standards and precedents
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
          </TabsList>

          <TabsContent value="new-analysis"><ITSupplyUploadAnalysis onAnalysisComplete={handleAnalysisComplete} /></TabsContent>
          <TabsContent value="history"><ITSupplyAnalysisList /></TabsContent>
          <TabsContent value="precedent-bank"><ITSupplyPrecedentBank /></TabsContent>
          <TabsContent value="learnings"><ITSupplyLearningsTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
