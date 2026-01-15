import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraftLineItem, BUDGET_CATEGORIES, BudgetCategory } from '@/lib/hooks/useBudgetVersions';
import { CategoryGroup } from './CategoryGroup';
import { DraggableBudgetItem } from './DraggableBudgetItem';
import { Loader2, Wand2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Category color maps for summary boxes
const categoryBgColors: Record<BudgetCategory, string> = {
  'Due Diligence': 'bg-blue-100 dark:bg-blue-900/40',
  'Documentation': 'bg-purple-100 dark:bg-purple-900/40',
  'Negotiations': 'bg-amber-100 dark:bg-amber-900/40',
  'Meetings': 'bg-green-100 dark:bg-green-900/40',
  'Regulatory': 'bg-red-100 dark:bg-red-900/40',
  'Closing': 'bg-teal-100 dark:bg-teal-900/40',
  'Tax': 'bg-orange-100 dark:bg-orange-900/40',
  'Legal Opinions': 'bg-indigo-100 dark:bg-indigo-900/40',
  'Other': 'bg-gray-100 dark:bg-gray-800/50',
};

const categoryTextColors: Record<BudgetCategory, string> = {
  'Due Diligence': 'text-blue-700 dark:text-blue-300',
  'Documentation': 'text-purple-700 dark:text-purple-300',
  'Negotiations': 'text-amber-700 dark:text-amber-300',
  'Meetings': 'text-green-700 dark:text-green-300',
  'Regulatory': 'text-red-700 dark:text-red-300',
  'Closing': 'text-teal-700 dark:text-teal-300',
  'Tax': 'text-orange-700 dark:text-orange-300',
  'Legal Opinions': 'text-indigo-700 dark:text-indigo-300',
  'Other': 'text-gray-700 dark:text-gray-300',
};

interface CategorizedBudgetViewProps {
  items: DraftLineItem[];
  onItemsChange: (items: DraftLineItem[]) => void;
  onItemEdit: (index: number, field: keyof DraftLineItem, value: string | number) => void;
  onRemoveItem: (index: number) => void;
  onAddItem: () => void;
  isEditing: boolean;
  hasExistingBudget: boolean;
  formatCurrency: (value: number, currency?: string) => string;
  currency: string;
  billingCurrency: string;
  quoteCurrency: string;
  differentBillingCurrency: boolean;
  agreedBillingAmount: number;
  mandatedRate: number;
  existingLcFirmNames: string[];
  hasOptionalItems: boolean;
  aiSuggestedIndices: Set<number>;
  originalItems: DraftLineItem[];
  updateLineItemOptional: any;
  toggleLineItemIncluded: any;
  matterId: string;
}

export function CategorizedBudgetView({
  items,
  onItemsChange,
  onItemEdit,
  onRemoveItem,
  onAddItem,
  isEditing,
  hasExistingBudget,
  formatCurrency,
  currency,
  billingCurrency,
  quoteCurrency,
  differentBillingCurrency,
  agreedBillingAmount,
  mandatedRate,
  existingLcFirmNames,
  hasOptionalItems,
  aiSuggestedIndices,
  originalItems,
  updateLineItemOptional,
  toggleLineItemIncluded,
  matterId,
}: CategorizedBudgetViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCategorizing, setIsCategorizing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Get unique provider names (Baker McKenzie + each LC firm)
  const providerNames = useMemo(() => {
    const lcFirms = new Set<string>();
    items.forEach(item => {
      if (item.provider === 'Local Counsel' && item.lc_firm_name) {
        lcFirms.add(item.lc_firm_name);
      }
    });
    return ['Baker McKenzie', ...Array.from(lcFirms).sort()];
  }, [items]);

  // Create composite group key from category and provider
  const getGroupKey = (category: string, provider: string, lcFirmName?: string | null) => {
    const providerName = provider === 'Local Counsel' && lcFirmName ? lcFirmName : 'Baker McKenzie';
    return `${category}|${providerName}`;
  };

  // Group items by category AND provider
  const groupedItems = useMemo(() => {
    const groups: Record<string, { items: DraftLineItem[]; indices: number[]; category: BudgetCategory; providerName: string }> = {};
    
    // Group items
    items.forEach((item, index) => {
      const category = (item.category || 'Other') as BudgetCategory;
      const providerName = item.provider === 'Local Counsel' && item.lc_firm_name ? item.lc_firm_name : 'Baker McKenzie';
      const key = `${category}|${providerName}`;
      
      if (!groups[key]) {
        groups[key] = { items: [], indices: [], category, providerName };
      }
      groups[key].items.push(item);
      groups[key].indices.push(index);
    });
    
    return groups;
  }, [items]);

  // Get all possible group keys in order (category order, then provider order)
  // Include both standard categories and any custom categories found in items
  const orderedGroupKeys = useMemo(() => {
    // First, get all categories from items (including custom ones)
    const customCategories = new Set<string>();
    items.forEach(item => {
      const category = item.category || 'Other';
      if (!(BUDGET_CATEGORIES as readonly string[]).includes(category)) {
        customCategories.add(category);
      }
    });
    
    // Combine standard categories with custom ones
    const allCategories = [...BUDGET_CATEGORIES, ...Array.from(customCategories).sort()];
    
    const keys: string[] = [];
    allCategories.forEach(category => {
      providerNames.forEach(providerName => {
        keys.push(`${category}|${providerName}`);
      });
    });
    return keys;
  }, [items, providerNames]);

  // Calculate subtotals per group
  const groupSubtotals = useMemo(() => {
    const subtotals: Record<string, number> = {};
    
    Object.entries(groupedItems).forEach(([key, group]) => {
      const includedItems = group.items.filter(item => 
        !item.is_optional || (item.is_optional && item.is_included !== false)
      );
      subtotals[key] = includedItems.reduce((sum, item) => sum + (item.fee_amount || 0), 0);
    });
    
    return subtotals;
  }, [groupedItems]);

  // Calculate budget used (WIP - write-offs) per group
  const groupBudgetUsed = useMemo(() => {
    const used: Record<string, number> = {};
    
    Object.entries(groupedItems).forEach(([key, group]) => {
      used[key] = group.items.reduce((sum, item) => {
        const rawWip = item.wip_amount || 0;
        const writeOff = item.wip_write_off || 0;
        return sum + (rawWip - writeOff);
      }, 0);
    });
    
    return used;
  }, [groupedItems]);

  // Calculate write-off totals per group
  const groupWriteOffs = useMemo(() => {
    const writeOffs: Record<string, number> = {};
    
    Object.entries(groupedItems).forEach(([key, group]) => {
      writeOffs[key] = group.items.reduce((sum, item) => {
        return sum + (item.wip_write_off || 0);
      }, 0);
    });
    
    return writeOffs;
  }, [groupedItems]);

  // Calculate totals per master category (combining all providers)
  const categoryTotals = useMemo(() => {
    const totals: Record<BudgetCategory, { budget: number; used: number; writeOff: number }> = {} as Record<BudgetCategory, { budget: number; used: number; writeOff: number }>;
    
    BUDGET_CATEGORIES.forEach(category => {
      totals[category] = { budget: 0, used: 0, writeOff: 0 };
    });
    
    items.forEach(item => {
      const category = (item.category || 'Other') as BudgetCategory;
      const isIncluded = !item.is_optional || (item.is_optional && item.is_included !== false);
      
      // Ensure category exists in totals (fallback for custom categories)
      if (!totals[category]) {
        totals[category] = { budget: 0, used: 0, writeOff: 0 };
      }
      
      if (isIncluded) {
        totals[category].budget += item.fee_amount || 0;
      }
      // Always count WIP regardless of optional status
      const rawWip = item.wip_amount || 0;
      const writeOff = item.wip_write_off || 0;
      totals[category].used += rawWip - writeOff;
      totals[category].writeOff += writeOff;
    });
    
    return totals;
  }, [items]);

  // Calculate totals per provider (Baker McKenzie + each LC firm)
  const providerTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    
    items.forEach(item => {
      const providerName = item.provider === 'Local Counsel' && item.lc_firm_name 
        ? item.lc_firm_name 
        : 'Baker McKenzie';
      const isIncluded = !item.is_optional || (item.is_optional && item.is_included !== false);
      
      if (isIncluded) {
        if (!totals[providerName]) {
          totals[providerName] = 0;
        }
        totals[providerName] += item.fee_amount || 0;
      }
    });
    
    return totals;
  }, [items]);

  // Save category change to database
  const saveCategoryToDb = async (itemId: string, category: string) => {
    try {
      const { error } = await supabase
        .from('budget_line_items')
        .update({ category })
        .eq('id', itemId);
      
      if (error) {
        console.error('Error saving category:', error);
        toast.error('Failed to save category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  // Update item category locally and persist to DB if it has an ID
  const updateItemCategory = (index: number, newCategory: string) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], category: newCategory };
    onItemsChange(updatedItems);
    
    // If item has an ID, persist to database immediately
    const item = items[index];
    if (item.id) {
      saveCategoryToDb(item.id, newCategory);
    }
  };

  // Auto-categorize items using AI
  const handleAutoCategorize = async () => {
    // Categorize all items with work_item text, not just uncategorized ones
    const itemsToCategorize = items
      .map((item, index) => ({ ...item, index }))
      .filter(item => item.work_item.trim());
    
    if (itemsToCategorize.length === 0) {
      toast.info('No items to categorize');
      return;
    }

    setIsCategorizing(true);
    try {
      const response = await supabase.functions.invoke('categorize-budget-items', {
        body: { 
          items: itemsToCategorize.map(item => ({
            index: item.index,
            work_item: item.work_item
          }))
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to categorize items');
      }

      const { categorizations } = response.data;
      
      if (!categorizations || categorizations.length === 0) {
        toast.error('No categorizations returned');
        return;
      }

      // Apply categorizations
      const updatedItems = [...items];
      const itemsToSave: { id: string; category: string }[] = [];
      
      categorizations.forEach((cat: { index: number; category: string }) => {
        if (updatedItems[cat.index]) {
          updatedItems[cat.index] = { ...updatedItems[cat.index], category: cat.category };
          // If item has an ID, queue it for DB save
          const item = items[cat.index];
          if (item.id) {
            itemsToSave.push({ id: item.id, category: cat.category });
          }
        }
      });
      
      onItemsChange(updatedItems);
      
      // Save all categorized items to DB
      for (const item of itemsToSave) {
        await saveCategoryToDb(item.id, item.category);
      }
      
      toast.success(`Categorized ${categorizations.length} items`);
    } catch (error) {
      console.error('Error categorizing items:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to categorize items');
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const activeIndex = parseInt(active.id as string);
    const overData = over.data.current;
    
    // Check if dropping on a category header
    if (overData?.type === 'category') {
      const newCategory = overData.category as BudgetCategory;
      updateItemCategory(activeIndex, newCategory);
      return;
    }

    // Dropping on another item - get that item's category
    const overIndex = parseInt(over.id as string);
    if (!isNaN(overIndex) && items[overIndex]) {
      const newCategory = items[overIndex].category || 'Other';
      if (items[activeIndex].category !== newCategory) {
        updateItemCategory(activeIndex, newCategory);
      }
    }
  };

  // Handle manual category selection from dropdown
  const handleCategoryChange = (index: number, newCategory: string) => {
    updateItemCategory(index, newCategory);
  };

  const activeItem = activeId !== null ? items[parseInt(activeId)] : null;

  // Count uncategorized items
  const uncategorizedCount = items.filter(item => !item.category && item.work_item.trim()).length;

  return (
    <div className="space-y-4">
      {/* Auto-categorize button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {uncategorizedCount > 0 && (
            <span>{uncategorizedCount} item(s) need categorization</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoCategorize}
          disabled={isCategorizing || items.filter(i => i.work_item.trim()).length === 0}
        >
          {isCategorizing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Categorizing...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Auto-Categorize
            </>
          )}
        </Button>
      </div>

      {/* Line Items with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {orderedGroupKeys.map(groupKey => {
            const group = groupedItems[groupKey];
            const [category, providerName] = groupKey.split('|') as [BudgetCategory, string];
            
            if (!group || group.items.length === 0) {
              // Show empty groups as drop targets when editing
              if (isEditing || !hasExistingBudget) {
                return (
                  <CategoryGroup
                    key={groupKey}
                    category={category}
                    providerName={providerName}
                    groupKey={groupKey}
                    subtotal={0}
                    budgetUsed={0}
                    writeOffTotal={0}
                    formatCurrency={formatCurrency}
                    currency={differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : currency}
                    mandatedRate={mandatedRate}
                    isEmpty
                  >
                    <div className="text-center py-2 text-sm text-muted-foreground italic">
                      Drag items here
                    </div>
                  </CategoryGroup>
                );
              }
              return null;
            }
            
            // Budget values are stored in billing currency - no mandatedRate conversion needed
            const displaySubtotal = groupSubtotals[groupKey] || 0;
            const displayBudgetUsed = groupBudgetUsed[groupKey] || 0;
            const displayWriteOffs = groupWriteOffs[groupKey] || 0;
            
            return (
              <CategoryGroup
                key={groupKey}
                category={category}
                providerName={providerName}
                groupKey={groupKey}
                subtotal={displaySubtotal}
                budgetUsed={displayBudgetUsed}
                writeOffTotal={displayWriteOffs}
                formatCurrency={formatCurrency}
                currency={differentBillingCurrency && agreedBillingAmount > 0 ? billingCurrency : currency}
                mandatedRate={mandatedRate}
              >
                <SortableContext
                  items={group.indices.map(i => i.toString())}
                  strategy={verticalListSortingStrategy}
                >
                  {group.items.map((item, localIdx) => {
                    const globalIndex = group.indices[localIdx];
                    return (
                      <DraggableBudgetItem
                        key={globalIndex}
                        id={globalIndex.toString()}
                        item={item}
                        index={globalIndex}
                        onEdit={onItemEdit}
                        onRemove={onRemoveItem}
                        onCategoryChange={handleCategoryChange}
                        isEditing={isEditing}
                        hasExistingBudget={hasExistingBudget}
                        formatCurrency={formatCurrency}
                        currency={currency}
                        billingCurrency={billingCurrency}
                        quoteCurrency={quoteCurrency}
                        differentBillingCurrency={differentBillingCurrency}
                        agreedBillingAmount={agreedBillingAmount}
                        mandatedRate={mandatedRate}
                        existingLcFirmNames={existingLcFirmNames}
                        hasOptionalItems={hasOptionalItems}
                        isAiSuggested={aiSuggestedIndices.has(globalIndex)}
                        originalItem={originalItems.find(orig => orig.id === item.id)}
                        updateLineItemOptional={updateLineItemOptional}
                        toggleLineItemIncluded={toggleLineItemIncluded}
                        canDelete={items.length > 1}
                      />
                    );
                  })}
                </SortableContext>
              </CategoryGroup>
            );
          })}
        </div>

        <DragOverlay>
          {activeItem && (
            <div className="bg-background border rounded-md p-2 shadow-lg opacity-90">
              <span className="text-sm font-medium">{activeItem.work_item || 'Untitled item'}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add Line Item Button */}
      {(isEditing || !hasExistingBudget) && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAddItem}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Work Item
        </Button>
      )}
    </div>
  );
}
