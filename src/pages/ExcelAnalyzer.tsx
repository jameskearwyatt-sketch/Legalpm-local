import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Calculator, Database, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface CellInfo {
  address: string;
  value: any;
  formula?: string;
  type: string;
}

interface SheetAnalysis {
  name: string;
  rowCount: number;
  colCount: number;
  cells: CellInfo[];
  usedRange: string;
  headers: string[];
  dataRows: any[][];
}

interface WorkbookAnalysis {
  sheetNames: string[];
  sheets: SheetAnalysis[];
}

export default function ExcelAnalyzer() {
  const [analysis, setAnalysis] = useState<WorkbookAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [rawJson, setRawJson] = useState<string>("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);
    
    try {
      const { data: result, error } = await supabase.functions.invoke('parse-excel', {
        body: { file },
      });

      if (error) throw error;
      if (!result) throw new Error('No data returned');

      setAnalysis(result);
      setRawJson(JSON.stringify(result, null, 2));
      toast({ title: "File parsed successfully", description: `Found ${result.sheetNames.length} sheets` });
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      toast({ title: "Error", description: "Failed to parse Excel file", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const formulas = analysis ? analysis.sheets.flatMap(sheet => 
    sheet.cells.filter(c => c.formula).map(c => ({ sheet: sheet.name, ...c }))
  ) : [];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Excel Analyzer</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Upload an Excel file to analyze its structure, formulas, and data
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Excel File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="max-w-md"
              />
              {isLoading && <span className="text-muted-foreground">Analyzing via server...</span>}
              {fileName && !isLoading && (
                <Badge variant="secondary">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  {fileName}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {analysis && (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">
                <Database className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="formulas">
                <Calculator className="h-4 w-4 mr-2" />
                Formulas ({formulas.length})
              </TabsTrigger>
              <TabsTrigger value="sheets">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Sheet Details
              </TabsTrigger>
              <TabsTrigger value="raw">
                <Send className="h-4 w-4 mr-2" />
                Raw JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Workbook Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{analysis.sheetNames.length}</div>
                        <p className="text-xs text-muted-foreground">Sheets</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{formulas.length}</div>
                        <p className="text-xs text-muted-foreground">Formulas</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {analysis.sheets.reduce((acc, s) => acc + s.cells.filter(c => c.value !== undefined).length, 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Data Cells</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {Math.max(...analysis.sheets.map(s => s.rowCount))}
                        </div>
                        <p className="text-xs text-muted-foreground">Max Rows</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Sheets</h3>
                    <div className="flex flex-wrap gap-2">
                      {analysis.sheetNames.map((name) => (
                        <Badge key={name} variant="outline">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="formulas">
              <Card>
                <CardHeader>
                  <CardTitle>All Formulas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32">Sheet</TableHead>
                          <TableHead className="w-20">Cell</TableHead>
                          <TableHead>Formula</TableHead>
                          <TableHead className="w-32">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formulas.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {f.sheet}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{f.address}</TableCell>
                            <TableCell className="font-mono text-xs max-w-md truncate">
                              ={f.formula}
                            </TableCell>
                            <TableCell className="text-sm">
                              {f.value !== undefined ? String(f.value) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sheets">
              <Card>
                <CardHeader>
                  <CardTitle>Sheet Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {analysis.sheets.map((sheet) => (
                      <AccordionItem key={sheet.name} value={sheet.name}>
                        <AccordionTrigger>
                          <div className="flex items-center gap-4">
                            <span>{sheet.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {sheet.rowCount} × {sheet.colCount}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {sheet.cells.filter(c => c.formula).length} formulas
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <ScrollArea className="h-[400px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-20">Cell</TableHead>
                                  <TableHead className="w-20">Type</TableHead>
                                  <TableHead>Value</TableHead>
                                  <TableHead>Formula</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sheet.cells.slice(0, 200).map((cell, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-mono text-sm">{cell.address}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs">
                                        {cell.type === 'n' ? 'number' : 
                                         cell.type === 's' ? 'string' : 
                                         cell.type === 'b' ? 'bool' : 
                                         cell.type === 'd' ? 'date' : cell.type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">
                                      {cell.value !== undefined ? String(cell.value) : "-"}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs max-w-xs truncate">
                                      {cell.formula ? `=${cell.formula}` : "-"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {sheet.cells.length > 200 && (
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                      ... and {sheet.cells.length - 200} more cells
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="raw">
              <Card>
                <CardHeader>
                  <CardTitle>Raw JSON Output</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    value={rawJson} 
                    readOnly 
                    className="font-mono text-xs h-[600px]"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
