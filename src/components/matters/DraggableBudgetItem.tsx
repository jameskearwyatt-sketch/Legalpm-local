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

  const isInBillingCurrencyMode = differentBillingCurrency && agreedBillingAmount > 0;
  const displayAmount = isInBillingCurrencyMode
    ? (item.fee_amount || 0) * mandatedRate
    : item.fee_amount || 0;
  
  const originalFee = originalItem?.fee_amount || 0;
  const originalDisplayFee = isInBillingCurrencyMode ? originalFee * mandatedRate : originalFee;
  const newFee = item.fee_amount || 0;
  const newDisplayFee = isInBillingCurrencyMode ? newFee * mandatedRate : newFee;
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
        <div className="col-span-2">
          <Select
            value={item.provider}
            onValueChange={(v) => onEdit(index, 'provider', v)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'grid grid-cols-12 gap-2 items-center rounded-md py-1 px-1 transition-colors',
        isDragging && 'opacity-50',
        isAiSuggested && 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300 dark:ring-blue-700',
        item.is_optional && !item.is_included && hasExistingBudget && 'opacity-50'
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
      <div className="col-span-4">
        <Input
          value={item.work_item}
          onChange={(e) => onEdit(index, 'work_item', e.target.value)}
          placeholder="e.g., Due diligence review"
          disabled={hasExistingBudget}
          className="text-sm"
        />
      </div>

      {/* Provider */}
      <div className="col-span-2">
        <Select
          value={item.provider}
          onValueChange={(v) => onEdit(index, 'provider', v)}
          disabled={hasExistingBudget}
        >
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fee Amount */}
      <div className="col-span-2">
        {!hasExistingBudget ? (
          <Input
            type="number"
            value={isInBillingCurrencyMode 
              ? (Math.round((item.fee_amount || 0) * mandatedRate) || '') 
              : (item.fee_amount || '')}
            onChange={(e) => onEdit(index, 'fee_amount', e.target.value)}
            placeholder="0"
            className="text-right text-sm"
          />
        ) : (
          <div className="text-right">
            <div className="font-medium text-sm">
              {formatCurrency(displayAmount, isInBillingCurrencyMode ? billingCurrency : quoteCurrency)}
            </div>
          </div>
        )}
      </div>

      {/* Category selector */}
      <div className="col-span-2">
        <Select
          value={item.category || 'Other'}
          onValueChange={(v) => onCategoryChange(index, v)}
        >
          <SelectTrigger className="text-xs h-8">
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
