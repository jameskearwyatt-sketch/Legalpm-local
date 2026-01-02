import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Calculator } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { DraftProposalItem, BUDGET_CATEGORIES } from '@/lib/hooks/usePricingProposals';
import { categoryBgColors, categoryTextColors, categoryBorderColors } from '@/components/pricing/CategorizedProposalView';

interface DraggableProposalItemProps {
  id: string;
  item: DraftProposalItem;
  index: number;
  onUpdate: (index: number, updates: Partial<DraftProposalItem>) => void;
  onRemove: (index: number) => void;
  onOpenIterativePricing: (index: number) => void;
  formatCurrency: (value: number) => string;
  viewingHistoricalVersion: boolean;
}

export function DraggableProposalItem({
  id,
  item,
  index,
  onUpdate,
  onRemove,
  onOpenIterativePricing,
  formatCurrency,
  viewingHistoricalVersion,
}: DraggableProposalItemProps) {
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
          <Select
            value={item.category || ''}
            onValueChange={(value) => onUpdate(index, { category: value || null })}
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
              {BUDGET_CATEGORIES.map(cat => (
                <SelectItem
                  key={cat}
                  value={cat}
                  className={cn(
                    categoryBgColors[cat],
                    categoryTextColors[cat],
                    "my-0.5"
                  )}
                >
                  {cat}
                </SelectItem>
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

      {/* Fee */}
      <TableCell>
        {viewingHistoricalVersion ? (
          <span className="text-sm font-medium">{formatCurrency(item.fee_amount || 0)}</span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{formatCurrency(0).charAt(0)}</span>
            <Input
              type="number"
              value={item.fee_amount || ''}
              onChange={(e) => onUpdate(index, {
                fee_amount: parseFloat(e.target.value) || 0,
                pricing_method: 'manual'
              })}
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
