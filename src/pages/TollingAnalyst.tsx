import { useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileSearch, History, Database, Brain, FlaskConical } from 'lucide-react';
import { TollingUploadAnalysis } from '@/components/tolling-analyst/TollingUploadAnalysis';
import { TollingAnalysisList } from '@/components/tolling-analyst/TollingAnalysisList';
import { TollingPrecedentBank } from '@/components/tolling-analyst/TollingPrecedentBank';
import { TollingLearningsTab } from '@/components/tolling-analyst/TollingLearningsTab';
import { useTollingPrecedentBank } from '@/lib/hooks/useTollingAnalyses';
import { useTollingLearnings } from '@/lib/hooks/useTollingLearnings';

export default function TollingAnalyst() {
  const [activeTab, setActiveTab] = useState('new-analysis');
  const { uniqueProjectCount } = useTollingPrecedentBank();
  const { activeLearnings } = useTollingLearnings();

  const handleAnalysisComplete = useCallback(() => {
    setActiveTab('history');
  }, []);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <FlaskConical className="h-6 w-6" />
              Tolling Analyst
            </h1>
            <p className="text-muted-foreground mt-1">
              Analyze tolling agreements against market standards and precedents
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
          </TabsList>

          <TabsContent value="new-analysis">
            <TollingUploadAnalysis onAnalysisComplete={handleAnalysisComplete} />
          </TabsContent>

          <TabsContent value="history">
            <TollingAnalysisList />
          </TabsContent>

          <TabsContent value="precedent-bank">
            <TollingPrecedentBank />
          </TabsContent>

          <TabsContent value="learnings">
            <TollingLearningsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
