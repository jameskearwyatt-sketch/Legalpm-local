import { useState } from 'react';
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
import { useLocalCounselLibrary, LocalCounselLibraryEntry } from '@/lib/hooks/useLocalCounselLibrary';
import { CURRENCY_SYMBOLS } from '@/lib/currencyUtils';

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
  afaDiscountMultiplier?: number;
}

const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

export function DraggableProposalItem({
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
  afaDiscountMultiplier = 1,
}: DraggableProposalItemProps) {
  const { library, entriesByCountry } = useLocalCounselLibrary();
  const [isCustomCategoryDialogOpen, setIsCustomCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
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
            value={item.work_item}
            onChange={(e) => onUpdate(index, { work_item: e.target.value })}
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
            
            {/* Local Counsel Details - inline with edit/add buttons */}
            {item.provider === 'Local Counsel' && (
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={cn(
                        "h-7 text-xs justify-start flex-1 max-w-[110px]",
                        !item.lc_firm_name && "text-muted-foreground"
                      )}
                      title={item.lc_firm_name ? `${item.lc_firm_name} (${(item as any).lc_country || 'No country'})` : 'Set local counsel details'}
                    >
                      <Building2 className="h-3 w-3 mr-1 shrink-0" />
                      <span className="truncate">{item.lc_firm_name || 'Set firm...'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 z-50 bg-popover" align="start">
                    <div className="space-y-3">
                      <div className="font-medium text-sm">Local Counsel Details</div>
                      
                      {/* Country Selection */}
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
                      
                      {/* Firm Name - always manual entry, auto-saves to library */}
                      <div className="space-y-1">
                        <Label className="text-xs">Firm Name *</Label>
                        <Input
                          value={item.lc_firm_name || ''}
                          onChange={(e) => onUpdate(index, { lc_firm_name: e.target.value })}
                          onBlur={() => {
                            // Auto-save to library when firm name is entered
                            const firmName = item.lc_firm_name?.trim();
                            const country = (item as any).lc_country;
                            if (firmName && country) {
                              // Use the autoSaveEntry mutation (silent, no toast)
                              const existingEntry = library.find(
                                e => e.firm_name.toLowerCase() === firmName.toLowerCase() && e.country === country
                              );
                              if (!existingEntry) {
                                // Note: We'll handle this in the parent component
                              }
                            }
                          }}
                          placeholder="e.g. Rodriguez & Partners"
                          className="h-8 text-xs"
                        />
                        {(item as any).lc_country && entriesByCountry[(item as any).lc_country]?.length > 0 && (
                          <div className="text-xs text-muted-foreground pt-1">
                            <span>Or select existing: </span>
                            <Select
                              value={(item as any).lc_library_id || ''}
                              onValueChange={(value) => {
                                const firm = library.find(f => f.id === value);
                                if (firm) {
                                  onUpdate(index, {
                                    lc_firm_name: firm.firm_name,
                                    ...(({ lc_library_id: firm.id, lc_currency: firm.currency, lc_country: firm.country }) as any)
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="h-6 text-xs mt-1">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {entriesByCountry[(item as any).lc_country]?.map((firm) => (
                                  <SelectItem key={firm.id} value={firm.id}>
                                    {firm.firm_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      
                      {/* Currency Selection */}
                      <div className="space-y-1">
                        <Label className="text-xs">Currency</Label>
                        <Select
                          value={(item as any).lc_currency || 'USD'}
                          onValueChange={(value) => {
                            onUpdate(index, { 
                              ...(({ lc_currency: value }) as any)
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((curr) => (
                              <SelectItem key={curr} value={curr}>
                                {curr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <p className="text-xs text-muted-foreground pt-2 border-t">
                        Firms are automatically saved to your library for reuse across proposals.
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
            {formatCurrency((item.fee_lower ?? item.fee_amount) * (item.provider === 'Baker McKenzie' ? afaDiscountMultiplier : 1))}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{formatCurrency(0).charAt(0)}</span>
            <Input
              type="text"
              value={new Intl.NumberFormat('en-GB').format(Math.round(((item.fee_lower ?? item.fee_amount) || 0) * (item.provider === 'Baker McKenzie' ? afaDiscountMultiplier : 1)))}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/,/g, '');
                // Reverse the discount to get the base value
                const displayedValue = parseFloat(rawValue) || 0;
                const baseValue = item.provider === 'Baker McKenzie' && afaDiscountMultiplier !== 1 
                  ? Math.round(displayedValue / afaDiscountMultiplier) 
                  : displayedValue;
                // When editing lower, also update fee_amount to midpoint
                const upper = item.fee_upper ?? item.fee_amount ?? 0;
                const midpoint = Math.round((baseValue + upper) / 2);
                onUpdate(index, {
                  fee_lower: baseValue,
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
            {formatCurrency((item.fee_upper ?? item.fee_amount) * (item.provider === 'Baker McKenzie' ? afaDiscountMultiplier : 1))}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{formatCurrency(0).charAt(0)}</span>
            <Input
              type="text"
              value={new Intl.NumberFormat('en-GB').format(Math.round(((item.fee_upper ?? item.fee_amount) || 0) * (item.provider === 'Baker McKenzie' ? afaDiscountMultiplier : 1)))}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/,/g, '');
                // Reverse the discount to get the base value
                const displayedValue = parseFloat(rawValue) || 0;
                const baseValue = item.provider === 'Baker McKenzie' && afaDiscountMultiplier !== 1 
                  ? Math.round(displayedValue / afaDiscountMultiplier) 
                  : displayedValue;
                // When editing upper, also update fee_amount to midpoint
                const lower = item.fee_lower ?? item.fee_amount ?? 0;
                const midpoint = Math.round((lower + baseValue) / 2);
                onUpdate(index, {
                  fee_upper: baseValue,
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

      {/* Include */}
      <TableCell className="text-center">
        <Switch
          checked={item.is_included}
          onCheckedChange={(checked) => onUpdate(index, { is_included: checked })}
          disabled={!item.is_optional || viewingHistoricalVersion}
        />
      </TableCell>
    </TableRow>
  );
}
