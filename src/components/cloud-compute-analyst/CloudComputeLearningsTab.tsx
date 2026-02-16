import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Lightbulb, Trash2, ChevronDown, ChevronRight, Loader2, Brain } from 'lucide-react';
import { useCloudComputeLearnings, CloudComputeLearning } from '@/lib/hooks/useCloudComputeLearnings';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';

export function CloudComputeLearningsTab() {
  const { learnings, isLoading, deleteLearning, toggleActive } = useCloudComputeLearnings();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const learningsByCategory: Record<string, CloudComputeLearning[]> = {};
  for (const l of learnings) { if (!learningsByCategory[l.category]) learningsByCategory[l.category] = []; learningsByCategory[l.category].push(l); }
  const sortedCategories = Object.keys(learningsByCategory).sort();
  const activeCount = learnings.filter(l => l.is_active).length;
  const toggleCategory = (c: string) => { setExpandedCategories(prev => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n; }); };

  if (isLoading) return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></CardContent></Card>;
  if (learnings.length === 0) return <Card><CardContent className="py-12 text-center"><Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-medium mb-2">No AI Learnings Yet</h3><p className="text-muted-foreground max-w-md mx-auto">When you provide feedback on analysis positions, corrections will be stored here and applied to future analyses.</p></CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-500" /> AI Learnings</CardTitle><CardDescription>Corrections and feedback to improve cloud compute analysis accuracy</CardDescription></CardHeader><CardContent><div className="flex items-center gap-4"><div className="flex items-center gap-2"><Badge variant="default">{activeCount} active</Badge>{learnings.length - activeCount > 0 && <Badge variant="secondary">{learnings.length - activeCount} inactive</Badge>}</div><span className="text-sm text-muted-foreground">across {sortedCategories.length} categories</span></div></CardContent></Card>
      <Card><CardContent className="pt-6 space-y-4">
        {sortedCategories.map(category => {
          const cl = learningsByCategory[category]; const isExpanded = expandedCategories.has(category); const aic = cl.filter(l => l.is_active).length;
          return (
            <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
              <CollapsibleTrigger asChild><button className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"><div className="flex items-center gap-2">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="font-medium">{category}</span><Badge variant="secondary" className="text-xs">{cl.length}</Badge>{aic > 0 && <Badge variant="default" className="text-xs">{aic} active</Badge>}</div></button></CollapsibleTrigger>
              <CollapsibleContent><div className="mt-2 space-y-2 pl-6">
                {cl.map(learning => (
                  <div key={learning.id} className={`p-4 border rounded-lg space-y-3 ${!learning.is_active ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between"><div className="flex-1"><p className="text-xs text-muted-foreground">{format(new Date(learning.created_at), 'PPp')}</p></div><div className="flex items-center gap-2"><Switch checked={learning.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: learning.id, is_active: v })} /><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete?</AlertDialogTitle><AlertDialogDescription>Permanently remove this correction.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteLearning.mutate(learning.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div>
                    <Separator />
                    <div className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Original:</span><div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">{learning.original_position.substring(0, 200)}{learning.original_position.length > 200 && '...'}</div></div>
                    <div className="space-y-1"><span className="text-xs font-medium text-primary">Corrected:</span><div className="text-sm p-2 bg-primary/10 border border-primary/30 rounded">{learning.corrected_position.substring(0, 200)}{learning.corrected_position.length > 200 && '...'}</div></div>
                    {learning.correction_reason && <div className="space-y-1"><span className="text-xs font-medium text-amber-600 dark:text-amber-400">Reason:</span><div className="text-sm p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded">{learning.correction_reason}</div></div>}
                  </div>
                ))}
              </div></CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent></Card>
    </div>
  );
}
