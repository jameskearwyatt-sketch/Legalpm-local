import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Calculator, Plus, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DraftProposalItem, BUDGET_CATEGORIES } from '@/lib/hooks/usePricingProposals';
import { categoryBgColors, categoryTextColors, categoryBorderColors } from '@/components/pricing/CategorizedProposalView';
import { CountryCombobox } from './CountryCombobox';
// Note: LC management now happens in LocalCounselPanel

interface DraggableProposalItemProps {
  id: string;
  item: DraftProposalItem;
  index: number;
  onUpdate: (index: number, updates: Partial<DraftProposalItem>) => void;
  onRemove: (index: number) => void;
  onOpenIterativePricing: (index: number) => void;
  formatCurrency: (value: number) => string;
  viewingHistoricalVersion: boolean;
  customCategories?: string[];
  onAddCustomCategory?: (category: string) => void;
  
  hideIncludeColumn?: boolean;
}

// CURRENCIES no longer needed here

// Memoized component to prevent re-renders when typing in textareas
// Uses custom comparison to ignore work_item/detail changes (handled locally)
function DraggableProposalItemInner({
  id,
  item,
  index,
  onUpdate,
  onRemove,
  onOpenIterativePricing,
  formatCurrency,
  viewingHistoricalVersion,
  customCategories = [],
  onAddCustomCategory,
  
  hideIncludeColumn = false,
}: DraggableProposalItemProps) {
  const [isCustomCategoryDialogOpen, setIsCustomCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Local state for text inputs to avoid triggering parent re-renders on every keystroke
  const [localWorkItem, setLocalWorkItem] = useState(item.work_item);
  const [localDetail, setLocalDetail] = useState(item.detail || '');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sync local state when item changes from parent (e.g., after save/load)
  useEffect(() => {
    setLocalWorkItem(item.work_item);
    setLocalDetail(item.detail || '');
  }, [item.id]); // Only sync when item ID changes, not on every prop update
  
  // Debounced update to parent - reduces re-renders dramatically
  const debouncedUpdate = useCallback((field: 'work_item' | 'detail', value: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onUpdate(index, { [field]: value });
    }, 300); // 300ms debounce for text input
  }, [onUpdate, index]);
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: viewingHistoricalVersion });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Combine standard and custom categories
  const allCategories = [...BUDGET_CATEGORIES, ...customCategories];

  const handleAddCustomCategory = () => {
    if (newCategoryName.trim() && onAddCustomCategory) {
      onAddCustomCategory(newCategoryName.trim());
      onUpdate(index, { category: newCategoryName.trim() });
      setNewCategoryName('');
      setIsCustomCategoryDialogOpen(false);
    }
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        item.is_optional && !item.is_included ? 'opacity-50' : '',
        isDragging && 'opacity-50 bg-muted'
      )}
    >
      {/* Drag Handle */}
      <TableCell className="py-2 w-[30px]">
        {!viewingHistoricalVersion && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </TableCell>

      {/* Delete Button */}
      <TableCell className="py-2 w-[40px]">
        {!viewingHistoricalVersion && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="h-8 w-8"
            title="Delete item"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </TableCell>

      {/* Work Item */}
      <TableCell className="align-top py-2">
        {viewingHistoricalVersion ? (
          <p className="min-w-[250px] text-sm whitespace-pre-wrap">{item.work_item}</p>
        ) : (
          <Textarea
            value={localWorkItem}
            onChange={(e) => {
              setLocalWorkItem(e.target.value);
              debouncedUpdate('work_item', e.target.value);
            }}
            onBlur={() => {
              // Ensure final value is synced on blur
              if (localWorkItem !== item.work_item) {
                onUpdate(index, { work_item: localWorkItem });
              }
            }}
            className="min-w-[250px] text-sm resize-none"
            placeholder="Work item description"
            rows={2}
          />
        )}
      </TableCell>

      {/* Category */}
      <TableCell>
        {viewingHistoricalVersion ? (
          item.category ? (
            <Badge className={cn(
              "text-xs",
              categoryBgColors[item.category as keyof typeof categoryBgColors],
              categoryBorderColors[item.category as keyof typeof categoryBorderColors],
              categoryTextColors[item.category as keyof typeof categoryTextColors]
            )}>
              {item.category}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )
        ) : (
          <>
            <Select
              value={item.category || ''}
              onValueChange={(value) => {
                if (value === '__create_custom__') {
                  setIsCustomCategoryDialogOpen(true);
                } else {
                  onUpdate(index, { category: value || null });
                }
              }}
            >
              <SelectTrigger
                className={cn(
                  "w-[120px] text-xs",
                  item.category && categoryBgColors[item.category as keyof typeof categoryBgColors],
                  item.category && categoryBorderColors[item.category as keyof typeof categoryBorderColors],
                  item.category && categoryTextColors[item.category as keyof typeof categoryTextColors]
                )}
              >
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map(cat => (
                  <SelectItem
                    key={cat}
                    value={cat}
                    className={cn(
                      categoryBgColors[cat as keyof typeof categoryBgColors],
                      categoryTextColors[cat as keyof typeof categoryTextColors],
                      "my-0.5"
                    )}
                  >
                    {cat}
                  </SelectItem>
                ))}
                {onAddCustomCategory && (
                  <SelectItem
                    value="__create_custom__"
                    className="border-t mt-1 pt-1 text-primary"
                  >
                    <span className="flex items-center gap-1">
                      <Plus className="h-3 w-3" />
                      Create Custom...
                    </span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            
            {/* Custom Category Dialog */}
            <Dialog open={isCustomCategoryDialogOpen} onOpenChange={setIsCustomCategoryDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Custom Category</DialogTitle>
                  <DialogDescription>
                    Enter a name for your custom category. This category will only appear in this proposal.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCustomCategory();
                      }
                    }}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCustomCategoryDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCustomCategory} disabled={!newCategoryName.trim()}>
                    Create Category
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </TableCell>

      {/* Provider */}
      <TableCell>
        {viewingHistoricalVersion ? (
          <div>
            <span className="text-sm">{item.provider}</span>
            {item.provider === 'Local Counsel' && item.lc_firm_name && (
              <p className="text-xs text-muted-foreground">{item.lc_firm_name}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
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
            
            {/* Local Counsel Details - simplified: just country selection and firm display */}
            {item.provider === 'Local Counsel' && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={cn(
                        "h-7 text-xs justify-start max-w-[160px]",
                        !(item as any).lc_country && "text-destructive border-destructive"
                      )}
                      title={(item as any).lc_country 
                        ? `${(item as any).lc_country}${item.lc_firm_name ? ` — ${item.lc_firm_name}` : ''}` 
                        : 'Set country (required)'}
                    >
                      <Building2 className="h-3 w-3 mr-1 shrink-0" />
                      <span className="truncate">
                        {(item as any).lc_country 
                          ? `${(item as any).lc_country}${item.lc_firm_name ? ` — ${item.lc_firm_name}` : ''}` 
                          : 'Set country...'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 z-50 bg-popover" align="start">
                    <div className="space-y-3">
                      <div className="font-medium text-sm">Local Counsel Details</div>
                      
                      {/* Country Selection - Required */}
                      <div className="space-y-1">
                        <Label className="text-xs">Country *</Label>
                        <CountryCombobox
                          value={(item as any).lc_country || ''}
                          onValueChange={(value) => {
                            onUpdate(index, { 
                              ...(({ lc_country: value }) as any)
                            });
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      
                      {/* Firm Name - Read-only display */}
                      {item.lc_firm_name && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Selected Firm</Label>
                          <p className="text-sm font-medium">{item.lc_firm_name}</p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground pt-2 border-t">
                        Manage firms and enter quotes in the Local Counsel tab.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
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
          <span className="text-sm font-medium">
            {formatCurrency(item.fee_lower ?? item.fee_amount)}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{formatCurrency(0).charAt(0)}</span>
            <Input
              type="text"
              value={new Intl.NumberFormat('en-GB').format(Math.round((item.fee_lower ?? item.fee_amount) || 0))}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/,/g, '');
                const value = parseFloat(rawValue) || 0;
                // When editing lower, also update fee_amount to midpoint
                const upper = item.fee_upper ?? item.fee_amount ?? 0;
                const midpoint = Math.round((value + upper) / 2);
                onUpdate(index, {
                  fee_lower: value,
                  fee_amount: midpoint,
                  pricing_method: 'manual'
                });
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
          <span className="text-sm font-medium">
            {formatCurrency(item.fee_upper ?? item.fee_amount)}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{formatCurrency(0).charAt(0)}</span>
            <Input
              type="text"
              value={new Intl.NumberFormat('en-GB').format(Math.round((item.fee_upper ?? item.fee_amount) || 0))}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/,/g, '');
                const value = parseFloat(rawValue) || 0;
                // When editing upper, also update fee_amount to midpoint
                const lower = item.fee_lower ?? item.fee_amount ?? 0;
                const midpoint = Math.round((lower + value) / 2);
                onUpdate(index, {
                  fee_upper: value,
                  fee_amount: midpoint,
                  pricing_method: 'manual'
                });
              }}
              className="w-[100px] text-right"
              placeholder="0"
            />
          </div>
        )}
      </TableCell>

      {/* Method */}
      <TableCell>
        <Badge
          variant="outline"
          className={
            item.pricing_method === 'ai_suggested'
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : item.pricing_method === 'pricing_tool'
                ? 'bg-green-50 text-green-700 border-green-200'
                : ''
          }
        >
          {item.pricing_method === 'ai_suggested' ? '✨ AI' :
            item.pricing_method === 'pricing_tool' ? '📊 Iter' : '✏️ Man'}
        </Badge>
      </TableCell>

      {/* Optional */}
      {!hideIncludeColumn && (
        <TableCell className="text-center">
          <Checkbox
            checked={item.is_optional}
            onCheckedChange={(checked) => onUpdate(index, {
              is_optional: !!checked,
              is_included: checked ? false : true
            })}
            disabled={viewingHistoricalVersion}
          />
        </TableCell>
      )}

      {/* Include */}
      {!hideIncludeColumn && (
        <TableCell className="text-center">
          <Switch
            checked={item.is_included}
            onCheckedChange={(checked) => onUpdate(index, { is_included: checked })}
            disabled={!item.is_optional || viewingHistoricalVersion}
          />
        </TableCell>
      )}
    </TableRow>
  );
}

// Custom comparison function - only re-render when meaningful props change
// Ignores work_item and detail since those are managed with local state
function arePropsEqual(
  prevProps: DraggableProposalItemProps,
  nextProps: DraggableProposalItemProps
): boolean {
  // Always re-render if ID or index changed
  if (prevProps.id !== nextProps.id || prevProps.index !== nextProps.index) {
    return false;
  }
  
  // Check item properties that matter for rendering (excluding work_item/detail which use local state)
  const prevItem = prevProps.item;
  const nextItem = nextProps.item;
  
  if (
    prevItem.id !== nextItem.id ||
    prevItem.provider !== nextItem.provider ||
    prevItem.fee_amount !== nextItem.fee_amount ||
    prevItem.fee_lower !== nextItem.fee_lower ||
    prevItem.fee_upper !== nextItem.fee_upper ||
    prevItem.pricing_method !== nextItem.pricing_method ||
    prevItem.category !== nextItem.category ||
    prevItem.lc_firm_name !== nextItem.lc_firm_name ||
    prevItem.lc_country !== nextItem.lc_country ||
    prevItem.is_optional !== nextItem.is_optional ||
    prevItem.is_included !== nextItem.is_included ||
    prevItem.is_multiplied !== nextItem.is_multiplied ||
    prevItem.multiplier_qty !== nextItem.multiplier_qty
  ) {
    return false;
  }
  
  // Check other props
  if (
    prevProps.viewingHistoricalVersion !== nextProps.viewingHistoricalVersion ||
    prevProps.hideIncludeColumn !== nextProps.hideIncludeColumn
  ) {
    return false;
  }
  
  // Arrays - compare by length and reference (shallow)
  if (prevProps.customCategories?.length !== nextProps.customCategories?.length) {
    return false;
  }
  
  return true;
}

export const DraggableProposalItem = memo(DraggableProposalItemInner, arePropsEqual);
