import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { DraftLineItem, BUDGET_CATEGORIES } from '@/lib/hooks/useBudgetVersions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const providerOptions = ['Baker McKenzie', 'Local Counsel'] as const;

// Get health color based on WIP percentage of estimate
function getHealthColor(wipAmount: number, feeAmount: number): { bg: string; text: string; indicator: string } {
  if (feeAmount <= 0 || wipAmount === 0) {
    return { bg: '', text: 'text-muted-foreground', indicator: 'bg-muted-foreground' };
  }
  
  const percentage = (wipAmount / feeAmount) * 100;
  
  if (percentage <= 50) {
    return { bg: '', text: 'text-green-600 dark:text-green-400', indicator: 'bg-green-500' };
  } else if (percentage <= 70) {
    return { bg: '', text: 'text-lime-600 dark:text-lime-400', indicator: 'bg-lime-500' };
  } else if (percentage <= 85) {
    return { bg: '', text: 'text-amber-600 dark:text-amber-400', indicator: 'bg-amber-500' };
  } else if (percentage <= 100) {
    return { bg: '', text: 'text-orange-600 dark:text-orange-400', indicator: 'bg-orange-500' };
  } else {
    return { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400', indicator: 'bg-red-500' };
  }
}

interface DraggableBudgetItemProps {
  id: string;
  item: DraftLineItem;
  index: number;
  onEdit: (index: number, field: keyof DraftLineItem, value: string | number) => void;
  onRemove: (index: number) => void;
  onCategoryChange: (index: number, category: string) => void;
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
  isAiSuggested: boolean;
  originalItem?: DraftLineItem;
  updateLineItemOptional: any;
  toggleLineItemIncluded: any;
  canDelete: boolean;
}

export function DraggableBudgetItem({
  id,
  item,
  index,
  onEdit,
  onRemove,
  onCategoryChange,
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
  isAiSuggested,
  originalItem,
  updateLineItemOptional,
  toggleLineItemIncluded,
  canDelete,
}: DraggableBudgetItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Budget values are stored in billing currency - no mandatedRate conversion needed
  const isInBillingCurrencyMode = differentBillingCurrency && agreedBillingAmount > 0;
  const displayAmount = item.fee_amount || 0;
  
  const originalFee = originalItem?.fee_amount || 0;
  const originalDisplayFee = originalFee;
  const newFee = item.fee_amount || 0;
  const newDisplayFee = newFee;
  const hasChanged = isEditing && hasExistingBudget && originalItem && Math.abs(newFee - originalFee) > 0.01;
  const isNewItem = isEditing && hasExistingBudget && !item.id;

  // Editing mode with comparison columns
  if (isEditing && hasExistingBudget) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'grid grid-cols-12 gap-2 items-center rounded-md py-1 px-1 transition-colors',
          isDragging && 'opacity-50',
          isAiSuggested && 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300 dark:ring-blue-700',
          isNewItem && !isAiSuggested && 'bg-green-50 dark:bg-green-950/30 ring-1 ring-green-300 dark:ring-green-700',
          item.is_optional && !item.is_included && 'opacity-50'
        )}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="col-span-1 flex justify-center cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Work Item */}
        <div className="col-span-3">
          <Input
            value={item.work_item}
            onChange={(e) => onEdit(index, 'work_item', e.target.value)}
            placeholder="e.g., Due diligence review"
            className={cn(
              'text-sm',
              isAiSuggested && 'border-blue-400 dark:border-blue-600',
              isNewItem && !isAiSuggested && 'border-green-400 dark:border-green-600'
            )}
          />
        </div>

        {/* Provider */}
        <div className="col-span-2 flex gap-1">
          <Select
            value={item.provider}
            onValueChange={(v) => {
              onEdit(index, 'provider', v);
              // Clear lc_firm_name if switching to Baker McKenzie
              if (v === 'Baker McKenzie') {
                onEdit(index, 'lc_firm_name', '');
              }
            }}
          >
            <SelectTrigger className="text-sm flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {providerOptions.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {item.provider === 'Local Counsel' && existingLcFirmNames.length > 0 && (
            <Select
              value={item.lc_firm_name || ''}
              onValueChange={(v) => onEdit(index, 'lc_firm_name', v)}
            >
              <SelectTrigger className="text-sm flex-1">
                <SelectValue placeholder="Select firm" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {existingLcFirmNames.map((firm) => (
                  <SelectItem key={firm} value={firm}>{firm}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Current (original) value */}
        <div className="col-span-2 text-right">
          {originalItem ? (
            <span className="text-muted-foreground text-sm">
              {formatCurrency(originalDisplayFee, isInBillingCurrencyMode ? billingCurrency : quoteCurrency)}
            </span>
          ) : (
            <span className="text-xs text-green-600 dark:text-green-400 italic">NEW</span>
          )}
        </div>

        {/* New value */}
        <div className="col-span-2">
          <Input
            type="number"
            value={isInBillingCurrencyMode 
              ? (Math.round(newDisplayFee) || '') 
              : (newFee || '')}
            onChange={(e) => onEdit(index, 'fee_amount', e.target.value)}
            placeholder="0"
            className={cn(
              'text-right text-sm',
              isAiSuggested && 'border-blue-400 dark:border-blue-600',
              hasChanged && !isAiSuggested && 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30',
              isNewItem && !isAiSuggested && 'border-green-400 dark:border-green-600'
            )}
          />
        </div>

        {/* Category selector */}
        <div className="col-span-1">
          <Select
            value={item.category || 'Other'}
            onValueChange={(v) => onCategoryChange(index, v)}
          >
            <SelectTrigger className="text-xs h-8 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Delete button */}
        <div className="col-span-1 flex justify-center">
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Normal viewing mode (no budget yet or just viewing)
  const rawWipAmount = item.wip_amount || 0;
  const writeOffAmount = item.wip_write_off || 0;
  // Net WIP = raw WIP minus write-offs (write-offs reduce actual WIP)
  const wipAmount = rawWipAmount - writeOffAmount;
  const wipHealth = getHealthColor(wipAmount, item.fee_amount || 0);
  const hasWipData = rawWipAmount > 0;
  const hasWriteOff = writeOffAmount > 0;
  const wipPercentage = (item.fee_amount || 0) > 0 ? Math.round((wipAmount / (item.fee_amount || 1)) * 100) : 0;
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'grid gap-2 items-center rounded-md py-1 px-1 transition-colors',
        hasExistingBudget ? 'grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto_auto_auto]' : 'grid-cols-12',
        isDragging && 'opacity-50',
        isAiSuggested && 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300 dark:ring-blue-700',
        item.is_optional && !item.is_included && hasExistingBudget && 'opacity-50',
        wipHealth.bg
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'flex justify-center cursor-grab active:cursor-grabbing',
          !hasExistingBudget && 'col-span-1'
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Work Item */}
      <div className={cn(!hasExistingBudget && 'col-span-4')}>
        <Input
          value={item.work_item}
          onChange={(e) => onEdit(index, 'work_item', e.target.value)}
          placeholder="e.g., Due diligence review"
          disabled={hasExistingBudget}
          className="text-sm"
        />
      </div>

      {/* Provider */}
      <div className={cn('flex gap-1', !hasExistingBudget && 'col-span-2')}>
        <Select
          value={item.provider}
          onValueChange={(v) => {
            onEdit(index, 'provider', v);
            if (v === 'Baker McKenzie') {
              onEdit(index, 'lc_firm_name', '');
            }
          }}
          disabled={hasExistingBudget}
        >
          <SelectTrigger className="text-sm flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {providerOptions.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {item.provider === 'Local Counsel' && existingLcFirmNames.length > 0 && (
          <Select
            value={item.lc_firm_name || ''}
            onValueChange={(v) => onEdit(index, 'lc_firm_name', v)}
            disabled={hasExistingBudget}
          >
            <SelectTrigger className="text-sm flex-1">
              <SelectValue placeholder="Select firm" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {existingLcFirmNames.map((firm) => (
                <SelectItem key={firm} value={firm}>{firm}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Fee Amount (Estimate) */}
      <div className={cn(!hasExistingBudget && 'col-span-2')}>
        {!hasExistingBudget ? (
          <Input
            type="number"
            value={item.fee_amount || ''}
            onChange={(e) => onEdit(index, 'fee_amount', e.target.value)}
            placeholder="0"
            className="text-right text-sm"
          />
        ) : (
          <div className="text-right min-w-[80px]">
            <div className="text-xs text-muted-foreground">Estimate</div>
            <div className="font-medium text-sm">
              {formatCurrency(displayAmount, isInBillingCurrencyMode ? billingCurrency : quoteCurrency)}
            </div>
          </div>
        )}
      </div>

      {/* Raw WIP - only show when budget exists */}
      {hasExistingBudget && (
        <div className="text-right min-w-[80px]">
          <div className="text-xs text-muted-foreground">Raw WIP</div>
          <div className="font-medium text-sm text-muted-foreground">
            {hasWipData 
              ? formatCurrency(rawWipAmount, isInBillingCurrencyMode ? billingCurrency : quoteCurrency)
              : '-'}
          </div>
        </div>
      )}

      {/* Write-off column - always show when budget exists */}
      {hasExistingBudget && (
        <div className="text-right min-w-[80px]">
          <div className="text-xs text-muted-foreground">Write-off</div>
          {hasWriteOff ? (
            <div className="font-medium text-sm text-destructive">
              -{formatCurrency(writeOffAmount, isInBillingCurrencyMode ? billingCurrency : quoteCurrency)}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">-</div>
          )}
        </div>
      )}

      {/* Adjusted Budget Used - the key tracking figure */}
      {hasExistingBudget && (
        <div className="text-right min-w-[100px]">
          <div className="text-xs text-muted-foreground">Adj. Used</div>
          <div className={cn('font-medium text-sm flex items-center justify-end gap-1', hasWipData && wipHealth.text)}>
            {hasWipData && (
              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', wipHealth.indicator)} />
            )}
            <span>
              {hasWipData 
                ? formatCurrency(wipAmount, isInBillingCurrencyMode ? billingCurrency : quoteCurrency)
                : '-'}
            </span>
            {hasWipData && (
              <span className={cn('text-xs', wipHealth.text)}>
                ({wipPercentage}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Category selector */}
      <div className={cn(!hasExistingBudget && 'col-span-2')}>
        <Select
          value={item.category || 'Other'}
          onValueChange={(v) => onCategoryChange(index, v)}
        >
          <SelectTrigger className="text-xs h-8 min-w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUDGET_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Optional checkbox - only show when budget exists */}
      {hasExistingBudget && item.id && (
        <div className="flex items-center gap-1">
          <Checkbox
            id={`optional-${item.id}`}
            checked={item.is_optional ?? false}
            onCheckedChange={(checked) => {
              updateLineItemOptional.mutate({ 
                lineItemId: item.id!, 
                isOptional: checked === true 
              });
            }}
          />
          <label htmlFor={`optional-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
            Optional
          </label>
        </div>
      )}

      {/* Include toggle - only show for optional items when budget exists */}
      {hasExistingBudget && item.id && item.is_optional && (
        <div className="flex items-center gap-1">
          <Switch
            id={`include-${item.id}`}
            checked={item.is_included ?? false}
            onCheckedChange={(checked) => {
              toggleLineItemIncluded.mutate({ 
                lineItemId: item.id!, 
                isIncluded: checked 
              });
            }}
          />
          <label htmlFor={`include-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
            {item.is_included ? 'on' : 'off'}
          </label>
        </div>
      )}

      {/* Delete button */}
      <div className={cn('flex justify-center', !hasExistingBudget && 'col-span-1')}>
        {canDelete && !hasExistingBudget && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
