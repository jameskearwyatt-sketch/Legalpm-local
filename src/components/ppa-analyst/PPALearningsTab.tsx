 import { useState } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Switch } from '@/components/ui/switch';
 import { Separator } from '@/components/ui/separator';
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger,
 } from '@/components/ui/alert-dialog';
 import { Lightbulb, Trash2, ChevronDown, ChevronRight, Loader2, Brain } from 'lucide-react';
 import { usePPALearnings, PPALearning } from '@/lib/hooks/usePPALearnings';
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
 import { format } from 'date-fns';
 
 export function PPALearningsTab() {
   const { learnings, isLoading, deleteLearning, toggleActive } = usePPALearnings();
   const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
 
   // Group learnings by category
   const learningsByCategory: Record<string, PPALearning[]> = {};
   for (const learning of learnings) {
     if (!learningsByCategory[learning.category]) {
       learningsByCategory[learning.category] = [];
     }
     learningsByCategory[learning.category].push(learning);
   }
 
   const sortedCategories = Object.keys(learningsByCategory).sort();
   const activeCount = learnings.filter(l => l.is_active).length;
 
   const toggleCategory = (category: string) => {
     setExpandedCategories(prev => {
       const next = new Set(prev);
       if (next.has(category)) {
         next.delete(category);
       } else {
         next.add(category);
       }
       return next;
     });
   };
 
   if (isLoading) {
     return (
       <Card>
         <CardContent className="py-8 flex justify-center">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </CardContent>
       </Card>
     );
   }
 
   if (learnings.length === 0) {
     return (
       <Card>
         <CardContent className="py-12 text-center">
           <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
           <h3 className="text-lg font-medium mb-2">No AI Learnings Yet</h3>
           <p className="text-muted-foreground max-w-md mx-auto">
             When you provide feedback on analysis positions using the "Teach AI" button,
             those corrections will be stored here and applied to future analyses.
           </p>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <div className="space-y-6">
       {/* Summary Card */}
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Lightbulb className="h-5 w-5 text-amber-500" />
             AI Learnings
           </CardTitle>
           <CardDescription>
             Corrections and feedback you've provided to improve AI analysis accuracy
           </CardDescription>
         </CardHeader>
         <CardContent>
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <Badge variant="default">{activeCount} active</Badge>
               {learnings.length - activeCount > 0 && (
                 <Badge variant="secondary">{learnings.length - activeCount} inactive</Badge>
               )}
             </div>
             <span className="text-sm text-muted-foreground">
               across {sortedCategories.length} categories
             </span>
           </div>
         </CardContent>
       </Card>
 
       {/* Learnings by Category */}
       <Card>
         <CardContent className="pt-6 space-y-4">
           {sortedCategories.map(category => {
             const categoryLearnings = learningsByCategory[category];
             const isExpanded = expandedCategories.has(category);
             const activeInCategory = categoryLearnings.filter(l => l.is_active).length;
 
             return (
               <Collapsible
                 key={category}
                 open={isExpanded}
                 onOpenChange={() => toggleCategory(category)}
               >
                 <CollapsibleTrigger asChild>
                   <button className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                     <div className="flex items-center gap-2">
                       {isExpanded ? (
                         <ChevronDown className="h-4 w-4" />
                       ) : (
                         <ChevronRight className="h-4 w-4" />
                       )}
                       <span className="font-medium">{category}</span>
                       <Badge variant="secondary" className="text-xs">
                         {categoryLearnings.length}
                       </Badge>
                       {activeInCategory > 0 && (
                         <Badge variant="default" className="text-xs">
                           {activeInCategory} active
                         </Badge>
                       )}
                     </div>
                   </button>
                 </CollapsibleTrigger>
                 <CollapsibleContent>
                   <div className="mt-2 space-y-2 pl-6">
                     {categoryLearnings.map(learning => (
                       <LearningCard
                         key={learning.id}
                         learning={learning}
                         onToggleActive={(isActive) => toggleActive.mutate({ id: learning.id, is_active: isActive })}
                         onDelete={() => deleteLearning.mutate(learning.id)}
                       />
                     ))}
                   </div>
                 </CollapsibleContent>
               </Collapsible>
             );
           })}
         </CardContent>
       </Card>
     </div>
   );
 }
 
 interface LearningCardProps {
   learning: PPALearning;
   onToggleActive: (isActive: boolean) => void;
   onDelete: () => void;
 }
 
 function LearningCard({ learning, onToggleActive, onDelete }: LearningCardProps) {
   return (
     <div className={`p-4 border rounded-lg space-y-3 ${!learning.is_active ? 'opacity-60' : ''}`}>
       <div className="flex items-start justify-between">
         <div className="space-y-1 flex-1">
           <div className="flex items-center gap-2 flex-wrap">
             {learning.project_context && (
               <span className="text-xs text-muted-foreground font-medium">
                 From: {learning.project_context}
               </span>
             )}
             {learning.jurisdiction && (
               <Badge variant="outline" className="text-xs">{learning.jurisdiction}</Badge>
             )}
             {learning.ppa_type && (
               <Badge variant="outline" className="text-xs">{learning.ppa_type}</Badge>
             )}
           </div>
           <p className="text-xs text-muted-foreground">
             {format(new Date(learning.created_at), 'PPp')}
           </p>
         </div>
         <div className="flex items-center gap-2">
           <Switch
             checked={learning.is_active}
             onCheckedChange={onToggleActive}
           />
           <AlertDialog>
             <AlertDialogTrigger asChild>
               <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                 <Trash2 className="h-4 w-4" />
               </Button>
             </AlertDialogTrigger>
             <AlertDialogContent>
               <AlertDialogHeader>
                 <AlertDialogTitle>Delete Learning?</AlertDialogTitle>
                 <AlertDialogDescription>
                   This will permanently remove this correction from the AI's memory.
                   The AI will no longer apply this feedback to future analyses.
                 </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                 <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                   Delete
                 </AlertDialogAction>
               </AlertDialogFooter>
             </AlertDialogContent>
           </AlertDialog>
         </div>
       </div>
 
       <Separator />
 
       {/* Original Position */}
       <div className="space-y-1">
         <span className="text-xs font-medium text-muted-foreground">Original (Incorrect) Analysis:</span>
         <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded text-ellipsis overflow-hidden max-h-20">
           {learning.original_position.substring(0, 200)}
           {learning.original_position.length > 200 && '...'}
         </div>
       </div>
 
       {/* User Feedback */}
       <div className="space-y-1">
         <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Your Correction:</span>
         <div className="text-sm p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded">
           {learning.user_feedback}
         </div>
       </div>
 
       {/* Corrected Position */}
       {learning.corrected_position && (
         <div className="space-y-1">
           <span className="text-xs font-medium text-primary">Corrected Analysis:</span>
           <div className="text-sm p-2 bg-primary/10 border border-primary/30 rounded">
             {learning.corrected_position.substring(0, 200)}
             {learning.corrected_position.length > 200 && '...'}
           </div>
         </div>
       )}
     </div>
   );
 }