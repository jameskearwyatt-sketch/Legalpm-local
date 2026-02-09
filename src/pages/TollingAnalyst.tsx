import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileSearch, History, Database, Brain, FlaskConical } from 'lucide-react';

export default function TollingAnalyst() {
  const [activeTab, setActiveTab] = useState('new-analysis');

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
            </TabsTrigger>
            <TabsTrigger value="learnings" className="gap-2">
              <Brain className="h-4 w-4" />
              AI Learnings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new-analysis">
            <Card>
              <CardHeader>
                <CardTitle>Upload Tolling Agreement</CardTitle>
                <CardDescription>
                  Upload a tolling agreement or term sheet for AI-powered analysis against market standards and your precedent bank.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FlaskConical className="h-16 w-16 text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Tolling Analyst — Coming Soon</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    This workspace will support full analysis of tolling agreements, including capacity charges, heat rate provisions, dispatch rights, and operational covenants. Upload precedents to begin building your tolling intelligence engine.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Analysis History</CardTitle>
                <CardDescription>No tolling analyses yet. Upload your first agreement to get started.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mb-3 opacity-40" />
                  <p className="text-sm">Completed analyses will appear here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="precedent-bank">
            <Card>
              <CardHeader>
                <CardTitle>Tolling Precedent Bank</CardTitle>
                <CardDescription>No precedents banked yet. Analyse a tolling agreement and bank positions to build your library.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mb-3 opacity-40" />
                  <p className="text-sm">Banked positions will appear here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="learnings">
            <Card>
              <CardHeader>
                <CardTitle>AI Learnings</CardTitle>
                <CardDescription>No learnings yet. Use the "Teach the AI" feature during analysis to add corrections.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Brain className="h-12 w-12 mb-3 opacity-40" />
                  <p className="text-sm">AI feedback and corrections will appear here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
