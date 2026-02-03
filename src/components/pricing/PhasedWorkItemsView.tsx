import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Trash2,
  Pencil,
  Check,
  X,
  AlertTriangle,
  CheckSquare,
  Square,
  FolderOpen,
  Folder,
  Copy,
  HelpCircle,
  GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableScrollControls } from '@/components/ui/table-scroll-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DraftProposalItem, ProposalPhase, BUDGET_CATEGORIES } from '@/lib/hooks/usePricingProposals';
import { DraggableProposalItem } from './DraggableProposalItem';
import { categoryBgColors, categoryTextColors } from './CategorizedProposalView';
import { InternalInputDeptSelector, DEPT_COLORS, getDeptColorIndex } from './InternalInputDeptSelector';

interface PhasedWorkItemsViewProps {
  items: DraftProposalItem[];
  phases: ProposalPhase[];
  onItemsChange: (items: DraftProposalItem[]) => void;
  onPhasesChange: (phases: ProposalPhase[]) => void;
  onUpdateItem: (index: number, updates: Partial<DraftProposalItem>) => void;
  onRemoveItem: (index: number) => void;
  onDuplicateItem: (index: number) => void;
  onOpenIterativePricing: (index: number) => void;
  formatCurrency: (value: number) => string;
  viewingHistoricalVersion: boolean;
  customCategories: string[];
  onAddCustomCategory: (category: string) => void;
  existingInputDepts: string[]; // Unique list of departments used across all items
}

type BudgetCategory = typeof BUDGET_CATEGORIES[number];

export function PhasedWorkItemsView({
  items,
  phases,
  onItemsChange,
  onPhasesChange,
  onUpdateItem,
  onRemoveItem,
  onDuplicateItem,
  onOpenIterativePricing,
  formatCurrency,
  viewingHistoricalVersion,
  customCategories,
  onAddCustomCategory,
  existingInputDepts,
}: PhasedWorkItemsViewProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(() => 
    new Set(['unassigned', ...phases.map(p => p.id)])
  );
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [editingPhaseName, setEditingPhaseName] = useState('');
  const [isAddPhaseDialogOpen, setIsAddPhaseDialogOpen] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [isDeleteSelectedDialogOpen, setIsDeleteSelectedDialogOpen] = useState(false);

  // Track known phase IDs to distinguish new phases from reordering
  const knownPhaseIdsRef = useRef<Set<string>>(new Set(phases.map(p => p.id)));

  // Keep expandedPhases in sync with phases - auto-expand ONLY truly new phases, remove deleted ones
  useEffect(() => {
    const currentPhaseIds = new Set(phases.map(p => p.id));
    const knownIds = knownPhaseIdsRef.current;
    
    setExpandedPhases(prev => {
      const next = new Set(prev);
      
      // Only auto-expand phases that are genuinely new (not just reordered)
      phases.forEach(p => {
        if (!knownIds.has(p.id) && !next.has(p.id)) {
          next.add(p.id);
        }
      });
      
      // Remove any phase IDs that no longer exist (except 'unassigned')
      const validIds = new Set(['unassigned', ...phases.map(p => p.id)]);
      next.forEach(id => {
        if (!validIds.has(id)) {
          next.delete(id);
        }
      });
      
      return next;
    });
    
    // Update known phase IDs for next comparison
    knownPhaseIdsRef.current = currentPhaseIds;
  }, [phases]);

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // Count excluded items
  const excludedItemCount = useMemo(() => {
    return items.filter(item => item.is_included === false).length;
  }, [items]);

  // Get set of valid phase IDs for quick lookup
  const validPhaseIds = useMemo(() => new Set(phases.map(p => p.id)), [phases]);

  // Auto-cleanup: If any items have orphaned phase_ids (pointing to deleted phases), 
  // automatically clear them to prevent ghost phases
  useEffect(() => {
    const orphanedItems = items.filter(item => 
      item.phase_id && !validPhaseIds.has(item.phase_id)
    );
    
    if (orphanedItems.length > 0 && !viewingHistoricalVersion) {
      console.log('Cleaning up orphaned phase_ids:', orphanedItems.map(i => i.work_item));
      const cleanedItems = items.map(item => {
        if (item.phase_id && !validPhaseIds.has(item.phase_id)) {
          return { ...item, phase_id: null };
        }
        return item;
      });
      onItemsChange(cleanedItems);
    }
  }, [validPhaseIds]); // Only run when validPhaseIds changes (phase deleted)

  // Group items by phase and then by category
  // IMPORTANT: If an item has a phase_id that doesn't exist in phases, treat it as unassigned
  const groupedItems = useMemo(() => {
    const result: Record<string, Record<string, { item: DraftProposalItem; originalIndex: number }[]>> = {
      unassigned: {},
    };

    // Initialize phase groups
    phases.forEach(phase => {
      result[phase.id] = {};
    });

    // Group items - orphaned phase_ids go to unassigned
    items.forEach((item, index) => {
      // If phase_id exists but the phase was deleted, treat as unassigned
      const phaseExists = item.phase_id && validPhaseIds.has(item.phase_id);
      const phaseId = phaseExists ? item.phase_id! : 'unassigned';
      const category = item.category || 'Other';

      if (!result[phaseId]) {
        result[phaseId] = {};
      }
      if (!result[phaseId][category]) {
        result[phaseId][category] = [];
      }
      result[phaseId][category].push({ item, originalIndex: index });
    });

    return result;
  }, [items, phases, validPhaseIds]);

  // Calculate phase totals
  const phaseTotals = useMemo(() => {
    const totals: Record<string, { lower: number; upper: number; included: number; total: number }> = {};

    Object.entries(groupedItems).forEach(([phaseId, categories]) => {
      let lower = 0;
      let upper = 0;
      let includedCount = 0;
      let totalCount = 0;

      Object.values(categories).forEach(categoryItems => {
        categoryItems.forEach(({ item }) => {
          totalCount++;
          if (item.is_included !== false) {
            lower += item.fee_lower ?? item.fee_amount ?? 0;
            upper += item.fee_upper ?? item.fee_amount ?? 0;
            includedCount++;
          }
        });
      });

      totals[phaseId] = { lower, upper, included: includedCount, total: totalCount };
    });

    return totals;
  }, [groupedItems]);

  // Toggle phase expansion
  const togglePhaseExpansion = useCallback((phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  }, []);

  // Toggle all items in a phase
  const togglePhaseItems = useCallback((phaseId: string, included: boolean) => {
    const newItems = items.map(item => {
      const itemPhaseId = item.phase_id || 'unassigned';
      if (itemPhaseId === phaseId) {
        return { ...item, is_included: included };
      }
      return item;
    });
    onItemsChange(newItems);

    if (phaseId !== 'unassigned') {
      const newPhases = phases.map(p =>
        p.id === phaseId ? { ...p, is_included: included } : p
      );
      onPhasesChange(newPhases);
    }
  }, [items, phases, onItemsChange, onPhasesChange]);

  // Select/deselect all items globally
  const toggleAllItems = useCallback((included: boolean) => {
    const newItems = items.map(item => ({ ...item, is_included: included }));
    onItemsChange(newItems);

    const newPhases = phases.map(p => ({ ...p, is_included: included }));
    onPhasesChange(newPhases);
  }, [items, phases, onItemsChange, onPhasesChange]);

  // Add new phase
  const handleAddPhase = useCallback(() => {
    if (!newPhaseName.trim()) return;
    
    const newPhase: ProposalPhase = {
      id: `phase-${Date.now()}`,
      name: newPhaseName.trim(),
      is_included: true,
    };
    
    onPhasesChange([...phases, newPhase]);
    setExpandedPhases(prev => new Set([...prev, newPhase.id]));
    setNewPhaseName('');
    setIsAddPhaseDialogOpen(false);
  }, [newPhaseName, phases, onPhasesChange]);

  // Save phase name edit
  const savePhaseEdit = useCallback(() => {
    if (!editingPhaseId || !editingPhaseName.trim()) return;
    
    const newPhases = phases.map(p =>
      p.id === editingPhaseId ? { ...p, name: editingPhaseName.trim() } : p
    );
    onPhasesChange(newPhases);
    setEditingPhaseId(null);
    setEditingPhaseName('');
  }, [editingPhaseId, editingPhaseName, phases, onPhasesChange]);

  // Delete phase
  const deletePhase = useCallback((phaseId: string) => {
    // Move all items in this phase to unassigned
    const newItems = items.map(item => {
      if (item.phase_id === phaseId) {
        return { ...item, phase_id: null };
      }
      return item;
    });
    onItemsChange(newItems);

    // Remove the phase
    const newPhases = phases.filter(p => p.id !== phaseId);
    onPhasesChange(newPhases);
  }, [items, phases, onItemsChange, onPhasesChange]);

  // Handle phase drag end (for reordering phases)
  const handlePhaseDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Only handle phase reordering (phase IDs start with 'phase-')
    if (!activeId.startsWith('phase-') || !overId.startsWith('phase-')) return;

    const activeIndex = phases.findIndex(p => p.id === activeId);
    const overIndex = phases.findIndex(p => p.id === overId);

    if (activeIndex === -1 || overIndex === -1) return;

    const newPhases = arrayMove(phases, activeIndex, overIndex);
    onPhasesChange(newPhases);
  }, [phases, onPhasesChange]);

  // Handle item drag end (for reordering items within phases)
  const handleItemDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = parseInt(active.id as string);
    const overIndex = parseInt(over.id as string);

    if (isNaN(activeIndex) || isNaN(overIndex)) return;

    const newItems = arrayMove(items, activeIndex, overIndex);
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  // Check if all items are included
  const allIncluded = useMemo(() => items.length > 0 && items.every(item => item.is_included !== false), [items]);
  const noneIncluded = useMemo(() => items.length > 0 && items.every(item => item.is_included === false), [items]);
  
  // Count of selected (included) items for delete button
  const selectedItemCount = useMemo(() => items.filter(item => item.is_included !== false).length, [items]);
  
  // Delete all selected (included) items
  const deleteSelectedItems = useCallback(() => {
    const newItems = items.filter(item => item.is_included === false);
    onItemsChange(newItems);
    setIsDeleteSelectedDialogOpen(false);
  }, [items, onItemsChange]);

  // Get all categories for a phase (ordered)
  const getOrderedCategories = useCallback((categories: Record<string, any[]>) => {
    const standardCats = BUDGET_CATEGORIES.filter(cat => categories[cat]?.length > 0);
    const customCats = Object.keys(categories).filter(
      cat => !(BUDGET_CATEGORIES as readonly string[]).includes(cat) && categories[cat]?.length > 0
    );
    return [...standardCats, ...customCats];
  }, []);

  // Render phase section
  const renderPhaseSection = (phaseId: string, phaseName: string, isUnassigned: boolean = false) => {
    const categories = groupedItems[phaseId] || {};
    const totals = phaseTotals[phaseId] || { lower: 0, upper: 0, included: 0, total: 0 };
    const isExpanded = expandedPhases.has(phaseId);
    const phase = phases.find(p => p.id === phaseId);
    const hasExcludedItems = totals.included < totals.total;
    const orderedCategories = getOrderedCategories(categories);

    // Get drag handle props from context (if wrapped in SortablePhaseWrapper)
    const dragContext = usePhaseDragHandle();

    // Don't render empty unassigned section
    if (isUnassigned && totals.total === 0) return null;

    return (
      <Card key={phaseId} className="transition-all">
        <Collapsible open={isExpanded} onOpenChange={() => togglePhaseExpansion(phaseId)}>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {!isUnassigned && !viewingHistoricalVersion && dragContext && (
                  <div 
                    className="cursor-grab active:cursor-grabbing"
                    {...dragContext.attributes}
                    {...dragContext.listeners}
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                {!viewingHistoricalVersion && (
                  <Checkbox
                    checked={!hasExcludedItems && totals.total > 0}
                    onCheckedChange={(checked) => togglePhaseItems(phaseId, !!checked)}
                    className="h-5 w-5"
                    aria-label={`Include all items in ${phaseName}`}
                  />
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                    {isExpanded ? (
                      <FolderOpen className="h-5 w-5 text-primary mr-2" />
                    ) : (
                      <Folder className="h-5 w-5 text-muted-foreground mr-2" />
                    )}
                    {editingPhaseId === phaseId ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editingPhaseName}
                          onChange={(e) => setEditingPhaseName(e.target.value)}
                          className="h-7 w-40"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') savePhaseEdit();
                            if (e.key === 'Escape') setEditingPhaseId(null);
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={savePhaseEdit}>
                          <Check className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingPhaseId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-semibold">{phaseName}</span>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <Badge variant="secondary" className="ml-2">
                  {totals.included}/{totals.total}
                </Badge>
                {hasExcludedItems && (
                  <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30">
                    {totals.total - totals.included} excluded
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(totals.lower)} – {formatCurrency(totals.upper)}
                </span>
                {!isUnassigned && !viewingHistoricalVersion && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPhaseId(phase!.id);
                        setEditingPhaseName(phase!.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePhase(phaseId);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0">
              {orderedCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No work items in this phase. Drag items here or assign them from the item row.
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleItemDragEnd}
                >
                  <TableScrollControls>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={!hasExcludedItems && totals.total > 0}
                                onCheckedChange={(checked) => togglePhaseItems(phaseId, !!checked)}
                                disabled={viewingHistoricalVersion}
                              />
                            </TableHead>
                            <TableHead className="w-[30px]"></TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="min-w-[180px]">Work Item</TableHead>
                            <TableHead className="min-w-[400px]">Detail</TableHead>
                            <TableHead className="w-[130px]">Phase</TableHead>
                            <TableHead className="w-[110px]">Category</TableHead>
                            <TableHead className="w-[120px]">Provider</TableHead>
                            <TableHead className="w-[50px] text-center">Calc</TableHead>
                            <TableHead className="text-right w-[100px]">Lower Est.</TableHead>
                            <TableHead className="text-right w-[100px]">Upper Est.</TableHead>
                            <TableHead className="w-[60px] text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center justify-center gap-1 cursor-help">
                                      <span className="text-xs">PC Sum</span>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p className="text-xs">
                                      <strong>Provisional Contract Sum</strong> – Check this when the scope is unclear 
                                      (e.g., unknown entity count). This figure is highly provisional and subject to 
                                      change when the structure is finalized.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableHead>
                            <TableHead className="w-[130px]">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 cursor-help">
                                      <span className="text-xs">BM Input?</span>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <p className="text-xs">
                                      Select an internal BM department/team to request input on this work item.
                                      Rows are highlighted by department for easy identification.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableHead>
                            <TableHead className="w-[70px]">Method</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <SortableContext
                            items={items.map((_, index) => index.toString())}
                            strategy={verticalListSortingStrategy}
                          >
                            {orderedCategories.map(category => {
                              const categoryItems = categories[category] || [];
                              const isStandardCategory = (BUDGET_CATEGORIES as readonly string[]).includes(category);
                              const bgColor = isStandardCategory 
                                ? categoryBgColors[category as BudgetCategory] 
                                : 'bg-muted/50';
                              const textColor = isStandardCategory 
                                ? categoryTextColors[category as BudgetCategory] 
                                : 'text-muted-foreground';

                              return (
                                <React.Fragment key={`${phaseId}-${category}`}>
                                  {/* Category header row */}
                                  <TableRow className={cn("border-b-0", bgColor)}>
                                    <TableCell colSpan={14} className="py-1.5">
                                      <span className={cn("text-xs font-semibold uppercase tracking-wide", textColor)}>
                                        {category}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                  
                                  {/* Items in this category */}
                                  {categoryItems.map(({ item, originalIndex }) => {
                                    // Get row highlighting based on internal input dept
                                    const deptColorStyle = item.internal_input_dept 
                                      ? DEPT_COLORS[getDeptColorIndex(item.internal_input_dept, existingInputDepts)]
                                      : null;
                                    
                                    return (
                                      <TableRow
                                        key={originalIndex}
                                        className={cn(
                                          item.is_included === false && "opacity-50",
                                          item.is_pc_sum && !item.internal_input_dept && "text-violet-700 dark:text-violet-400",
                                          deptColorStyle && `${deptColorStyle.bg} ${deptColorStyle.text}`
                                        )}
                                      >
                                        <TableCell className="py-2 w-[40px]">
                                          <Checkbox
                                            checked={item.is_included !== false}
                                            onCheckedChange={(checked) => onUpdateItem(originalIndex, { is_included: !!checked })}
                                            disabled={viewingHistoricalVersion}
                                          />
                                        </TableCell>
                                        <PhasedItemCells
                                          item={item}
                                          index={originalIndex}
                                          onUpdate={onUpdateItem}
                                          onRemove={onRemoveItem}
                                          onDuplicate={onDuplicateItem}
                                          onOpenIterativePricing={onOpenIterativePricing}
                                          formatCurrency={formatCurrency}
                                          viewingHistoricalVersion={viewingHistoricalVersion}
                                          customCategories={customCategories}
                                          onAddCustomCategory={onAddCustomCategory}
                                          phases={phases}
                                          onPhaseChange={(phaseId) => onUpdateItem(originalIndex, { phase_id: phaseId })}
                                          existingInputDepts={existingInputDepts}
                                        />
                                      </TableRow>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </SortableContext>
                        </TableBody>
                      </Table>
                    </div>
                  </TableScrollControls>
                </DndContext>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Warning banner when items are excluded */}
      {excludedItemCount > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{excludedItemCount} work item{excludedItemCount > 1 ? 's are' : ' is'} excluded</strong> and will not contribute to totals or appear in exports.
          </AlertDescription>
        </Alert>
      )}

      {/* Global controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!viewingHistoricalVersion && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleAllItems(true)}
                disabled={allIncluded}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleAllItems(false)}
                disabled={noneIncluded}
              >
                <Square className="h-4 w-4 mr-1" />
                Deselect All
              </Button>
              <div className="h-4 w-px bg-border mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteSelectedDialogOpen(true)}
                disabled={selectedItemCount === 0}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected ({selectedItemCount})
              </Button>
            </>
          )}
        </div>

        {!viewingHistoricalVersion && (
          <Button onClick={() => setIsAddPhaseDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Phase
          </Button>
        )}
      </div>

      {/* Phase sections with drag-and-drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handlePhaseDragEnd}
      >
        <SortableContext
          items={phases.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {phases.map((phase) => (
              <SortablePhaseWrapper 
                key={phase.id} 
                phaseId={phase.id}
                disabled={viewingHistoricalVersion}
              >
                {renderPhaseSection(phase.id, phase.name, false)}
              </SortablePhaseWrapper>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      {/* Unassigned section (not draggable) */}
      <div className="mt-3">
        {renderPhaseSection('unassigned', 'Unassigned Items', true)}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No work items yet. Upload an RFP or add items manually.</p>
          </CardContent>
        </Card>
      )}

      {/* Add Phase Dialog */}
      <Dialog open={isAddPhaseDialogOpen} onOpenChange={setIsAddPhaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Phase</DialogTitle>
            <DialogDescription>
              Create a new phase to organize your work items.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
              placeholder="e.g., Phase 1: Due Diligence, Pilot Phase"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddPhase();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPhaseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPhase} disabled={!newPhaseName.trim()}>
              Create Phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Selected Confirmation Dialog */}
      <Dialog open={isDeleteSelectedDialogOpen} onOpenChange={setIsDeleteSelectedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Items</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedItemCount} selected work item{selectedItemCount !== 1 ? 's' : ''}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteSelectedDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteSelectedItems}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete {selectedItemCount} Item{selectedItemCount !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sortable wrapper for phase cards - uses context to pass drag handle listeners
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortablePhaseWrapperProps {
  phaseId: string;
  disabled: boolean;
  children: React.ReactNode;
}

// Create a context to pass drag handle props to the phase section
const PhaseDragContext = React.createContext<{
  attributes: Record<string, any>;
  listeners: Record<string, any> | undefined;
} | null>(null);

function SortablePhaseWrapper({ phaseId, disabled, children }: SortablePhaseWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phaseId, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <PhaseDragContext.Provider value={{ attributes, listeners }}>
      <div ref={setNodeRef} style={style}>
        {children}
      </div>
    </PhaseDragContext.Provider>
  );
}

// Hook to use the phase drag handle in child components
function usePhaseDragHandle() {
  return React.useContext(PhaseDragContext);
}

// Inline table cells component for items within the phased view
import { Calculator, Building2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { CountryCombobox } from './CountryCombobox';

interface PhasedItemCellsProps {
  item: DraftProposalItem;
  index: number;
  onUpdate: (index: number, updates: Partial<DraftProposalItem>) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  onOpenIterativePricing: (index: number) => void;
  formatCurrency: (value: number) => string;
  viewingHistoricalVersion: boolean;
  customCategories: string[];
  onAddCustomCategory: (category: string) => void;
  phases: ProposalPhase[];
  onPhaseChange: (phaseId: string | null) => void;
  existingInputDepts: string[];
}

function PhasedItemCells({
  item,
  index,
  onUpdate,
  onRemove,
  onDuplicate,
  onOpenIterativePricing,
  formatCurrency,
  viewingHistoricalVersion,
  customCategories,
  onAddCustomCategory,
  phases,
  onPhaseChange,
  existingInputDepts,
}: PhasedItemCellsProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index.toString(), disabled: viewingHistoricalVersion });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const allCategories = [...BUDGET_CATEGORIES, ...customCategories];

  return (
    <>
      {/* Drag Handle */}
      <TableCell ref={setNodeRef} style={style} className="py-2 w-[30px]">
        {!viewingHistoricalVersion && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </TableCell>

      {/* Delete & Duplicate Buttons */}
      <TableCell className="py-2 w-[40px]">
        {!viewingHistoricalVersion && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDuplicate(index)}
              className="h-7 w-7"
              title="Duplicate item"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              className="h-7 w-7"
              title="Delete item"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        )}
      </TableCell>

      {/* Work Item */}
      <TableCell className="align-top py-2">
        {viewingHistoricalVersion ? (
          <p className="min-w-[180px] text-sm whitespace-pre-wrap">{item.work_item}</p>
        ) : (
          <Textarea
            value={item.work_item}
            onChange={(e) => onUpdate(index, { work_item: e.target.value })}
            className="min-w-[180px] text-sm resize-none min-h-[80px]"
            placeholder="Short description"
          />
        )}
      </TableCell>

      {/* Detail with truncation and hover popover */}
      <TableCell className="align-top py-2">
        {viewingHistoricalVersion ? (
          item.detail ? (
            <p className="min-w-[350px] text-sm text-muted-foreground whitespace-pre-wrap">
              {item.detail}
            </p>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )
        ) : (
          <Textarea
            value={item.detail || ''}
            onChange={(e) => onUpdate(index, { detail: e.target.value || null })}
            className="text-sm resize-none min-w-[350px]"
            placeholder="Full detail"
            style={{ minHeight: item.detail ? `${Math.max(60, Math.ceil((item.detail?.length || 0) / 50) * 24)}px` : '60px' }}
          />
        )}
      </TableCell>

      {/* Phase selector */}
      <TableCell>
        {viewingHistoricalVersion ? (
          <span className="text-sm text-muted-foreground">
            {phases.find(p => p.id === item.phase_id)?.name || 'Unassigned'}
          </span>
        ) : (
          <Select
            value={item.phase_id || 'unassigned'}
            onValueChange={(value) => onPhaseChange(value === 'unassigned' ? null : value)}
          >
            <SelectTrigger className="w-[120px] text-xs h-8">
              <SelectValue placeholder="Phase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <span className="text-muted-foreground">Unassigned</span>
              </SelectItem>
              {phases.map(phase => (
                <SelectItem key={phase.id} value={phase.id}>
                  {phase.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>

      {/* Category */}
      <TableCell>
        {viewingHistoricalVersion ? (
          <span className="text-sm">{item.category || '-'}</span>
        ) : (
          <Select
            value={item.category || ''}
            onValueChange={(value) => onUpdate(index, { category: value || null })}
          >
            <SelectTrigger className="w-[120px] text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {allCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>

      {/* Provider */}
      <TableCell>
        {viewingHistoricalVersion ? (
          <span className="text-sm">{item.provider}</span>
        ) : (
          <Select
            value={item.provider}
            onValueChange={(value: 'Baker McKenzie' | 'Local Counsel') =>
              onUpdate(index, { provider: value })
            }
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Baker McKenzie">Baker McKenzie</SelectItem>
              <SelectItem value="Local Counsel">Local Counsel</SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>

      {/* Calc Button */}
      <TableCell className="text-center">
        {item.provider === 'Baker McKenzie' && !viewingHistoricalVersion ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenIterativePricing(index)}
            title="Iterative pricing calculator"
            className="h-8 w-8"
          >
            <Calculator className="h-4 w-4 text-primary" />
          </Button>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>

      {/* Lower Estimate */}
      <TableCell>
        {viewingHistoricalVersion ? (
          <span className="text-sm font-medium">{formatCurrency(item.fee_lower ?? item.fee_amount)}</span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{formatCurrency(0).charAt(0)}</span>
            <Input
              type="text"
              value={new Intl.NumberFormat('en-GB').format(Math.round((item.fee_lower ?? item.fee_amount) || 0))}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/,/g, '');
                const baseValue = parseFloat(rawValue) || 0;
                const upper = item.fee_upper ?? item.fee_amount ?? 0;
                const midpoint = Math.round((baseValue + upper) / 2);
                onUpdate(index, { fee_lower: baseValue, fee_amount: midpoint, pricing_method: 'manual' });
              }}
              className="w-[100px] text-right"
              placeholder="0"
            />
          </div>
        )}
      </TableCell>

      {/* Upper Estimate */}
      <TableCell>
        {viewingHistoricalVersion ? (
          <span className="text-sm font-medium">{formatCurrency(item.fee_upper ?? item.fee_amount)}</span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{formatCurrency(0).charAt(0)}</span>
            <Input
              type="text"
              value={new Intl.NumberFormat('en-GB').format(Math.round((item.fee_upper ?? item.fee_amount) || 0))}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/,/g, '');
                const baseValue = parseFloat(rawValue) || 0;
                const lower = item.fee_lower ?? item.fee_amount ?? 0;
                const midpoint = Math.round((lower + baseValue) / 2);
                onUpdate(index, { fee_upper: baseValue, fee_amount: midpoint, pricing_method: 'manual' });
              }}
              className="w-[100px] text-right"
              placeholder="0"
            />
          </div>
        )}
      </TableCell>

      {/* PC Sum checkbox */}
      <TableCell className="text-center">
        <Checkbox
          checked={item.is_pc_sum === true}
          onCheckedChange={(checked) => onUpdate(index, { is_pc_sum: !!checked })}
          disabled={viewingHistoricalVersion}
          className={cn(item.is_pc_sum && "border-violet-500 data-[state=checked]:bg-violet-600")}
        />
      </TableCell>

      {/* Internal Input Department */}
      <TableCell>
        <InternalInputDeptSelector
          value={item.internal_input_dept}
          onChange={(value) => onUpdate(index, { internal_input_dept: value })}
          existingDepts={existingInputDepts}
          disabled={viewingHistoricalVersion}
        />
      </TableCell>

      {/* Method */}
      <TableCell>
        <Badge
          variant="outline"
          className={
            item.pricing_method === 'ai_suggested'
              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800'
              : item.pricing_method === 'pricing_tool'
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800'
                : ''
          }
        >
          {item.pricing_method === 'ai_suggested' ? '✨ AI' :
            item.pricing_method === 'pricing_tool' ? '📊 Iter' : '✏️ Man'}
        </Badge>
      </TableCell>
    </>
  );
}
