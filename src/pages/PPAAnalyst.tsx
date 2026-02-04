import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PPAUploadAnalysis } from '@/components/ppa-analyst/PPAUploadAnalysis';
import { PPAAnalysisList } from '@/components/ppa-analyst/PPAAnalysisList';
import { PPAPrecedentBank } from '@/components/ppa-analyst/PPAPrecedentBank';
import { FileSearch, History, Database } from 'lucide-react';

export default function PPAAnalyst() {
  const [activeTab, setActiveTab] = useState('new-analysis');

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold text-foreground">PPA Analyst</h1>
          <p className="text-muted-foreground mt-1">
            Analyze PPAs against the Bible or compare with term sheets
          </p>
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
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new-analysis">
            <PPAUploadAnalysis onAnalysisComplete={() => setActiveTab('history')} />
          </TabsContent>

          <TabsContent value="history">
            <PPAAnalysisList />
          </TabsContent>

          <TabsContent value="precedent-bank">
            <PPAPrecedentBank />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
