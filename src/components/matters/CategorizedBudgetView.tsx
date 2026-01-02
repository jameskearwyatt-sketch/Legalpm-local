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

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, { items: DraftLineItem[]; indices: number[] }> = {};
    
    // Initialize all categories
    BUDGET_CATEGORIES.forEach(cat => {
      groups[cat] = { items: [], indices: [] };
    });
    
    // Group items
    items.forEach((item, index) => {
      const category = item.category || 'Other';
      if (!groups[category]) {
        groups[category] = { items: [], indices: [] };
      }
      groups[category].items.push(item);
      groups[category].indices.push(index);
    });
    
    return groups;
  }, [items]);

  // Calculate subtotals per category
  const categorySubtotals = useMemo(() => {
    const subtotals: Record<string, number> = {};
    
    BUDGET_CATEGORIES.forEach(cat => {
      const categoryItems = groupedItems[cat]?.items || [];
      const includedItems = categoryItems.filter(item => 
        !item.is_optional || (item.is_optional && item.is_included !== false)
      );
      subtotals[cat] = includedItems.reduce((sum, item) => sum + (item.fee_amount || 0), 0);
    });
    
    return subtotals;
  }, [groupedItems]);

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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {BUDGET_CATEGORIES.map(category => {
            const group = groupedItems[category];
            if (!group || group.items.length === 0) {
              // Show empty category as drop target when editing
              if (isEditing || !hasExistingBudget) {
                return (
                  <CategoryGroup
                    key={category}
                    category={category}
                    subtotal={0}
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
            
            const displaySubtotal = differentBillingCurrency && agreedBillingAmount > 0
              ? categorySubtotals[category] * mandatedRate
              : categorySubtotals[category];
            
            return (
              <CategoryGroup
                key={category}
                category={category}
                subtotal={displaySubtotal}
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
