import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DraftProposalItem, ProposalPhase, BUDGET_CATEGORIES } from '@/lib/hooks/usePricingProposals';
import { categoryBgColors, categoryTextColors, categoryBorderColors } from './CategorizedProposalView';
import { CountryCombobox } from './CountryCombobox';

interface AddWorkItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: DraftProposalItem) => void;
  phases: ProposalPhase[];
  customCategories: string[];
  onAddCustomCategory: (category: string) => void;
  currencySymbol: string;
}

export function AddWorkItemDialog({
  open,
  onOpenChange,
  onAdd,
  phases,
  customCategories,
  onAddCustomCategory,
  currencySymbol,
}: AddWorkItemDialogProps) {
  // Form state
  const [workItem, setWorkItem] = useState('');
  const [detail, setDetail] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [provider, setProvider] = useState<'Baker McKenzie' | 'Local Counsel'>('Baker McKenzie');
  const [feeLower, setFeeLower] = useState<string>('0');
  const [feeUpper, setFeeUpper] = useState<string>('0');
  const [lcCountry, setLcCountry] = useState<string>('');
  
  // Custom category dialog state
  const [isCustomCategoryDialogOpen, setIsCustomCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setWorkItem('');
      setDetail('');
      setCategory(null);
      setPhaseId(null);
      setProvider('Baker McKenzie');
      setFeeLower('0');
      setFeeUpper('0');
      setLcCountry('');
    }
  }, [open]);

  const allCategories = [...BUDGET_CATEGORIES, ...customCategories];

  const handleAddCustomCategory = () => {
    if (newCategoryName.trim()) {
      onAddCustomCategory(newCategoryName.trim());
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsCustomCategoryDialogOpen(false);
    }
  };

  const handleSubmit = () => {
    const lower = parseFloat(feeLower.replace(/,/g, '')) || 0;
    const upper = parseFloat(feeUpper.replace(/,/g, '')) || 0;
    const midpoint = Math.round((lower + upper) / 2);

    const newItem: DraftProposalItem = {
      work_item: workItem,
      detail: detail || null,
      provider,
      fee_amount: midpoint,
      fee_lower: lower,
      fee_upper: upper,
      pricing_method: 'manual',
      category,
      phase_id: phaseId,
      is_optional: false,
      is_included: true,
      is_pc_sum: false,
      internal_input_dept: null,
      partner_hours: 0,
      associate_hours: 0,
      num_turns: 1,
      item_type: 'documentation',
      ...(provider === 'Local Counsel' && lcCountry ? {
        lc_country: lcCountry,
      } : {}),
    };

    onAdd(newItem);
    onOpenChange(false);
  };

  const formatNumber = (value: string): string => {
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('en-GB').format(num);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Add Work Item</DialogTitle>
            <DialogDescription>
              Enter the details for the new work item. It will be placed in the correct position based on the phase and category you select.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Work Item (short description) */}
            <div className="space-y-2">
              <Label htmlFor="work-item">Work Item *</Label>
              <Input
                id="work-item"
                value={workItem}
                onChange={(e) => setWorkItem(e.target.value)}
                placeholder="Short description (50 chars recommended)"
                maxLength={100}
              />
            </div>

            {/* Detail (full description) */}
            <div className="space-y-2">
              <Label htmlFor="detail">Detail</Label>
              <Textarea
                id="detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Full verbatim text / detailed description"
                rows={3}
              />
            </div>

            {/* Phase and Category row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Phase */}
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select
                  value={phaseId || 'unassigned'}
                  onValueChange={(value) => setPhaseId(value === 'unassigned' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {phases.map((phase) => (
                      <SelectItem key={phase.id} value={phase.id}>
                        {phase.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={category || ''}
                  onValueChange={(value) => {
                    if (value === '__create_custom__') {
                      setIsCustomCategoryDialogOpen(true);
                    } else {
                      setCategory(value || null);
                    }
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      category && categoryBgColors[category as keyof typeof categoryBgColors],
                      category && categoryBorderColors[category as keyof typeof categoryBorderColors],
                      category && categoryTextColors[category as keyof typeof categoryTextColors]
                    )}
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat) => (
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
                    <SelectItem
                      value="__create_custom__"
                      className="border-t mt-1 pt-1 text-primary"
                    >
                      <span className="flex items-center gap-1">
                        <Plus className="h-3 w-3" />
                        Create Custom...
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={provider}
                onValueChange={(value: 'Baker McKenzie' | 'Local Counsel') => setProvider(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baker McKenzie">Baker McKenzie</SelectItem>
                  <SelectItem value="Local Counsel">Local Counsel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Local Counsel Country (if LC selected) */}
            {provider === 'Local Counsel' && (
              <div className="space-y-2">
                <Label>Country *</Label>
                <CountryCombobox
                  value={lcCountry}
                  onValueChange={setLcCountry}
                />
              </div>
            )}

            {/* Fee estimates row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fee-lower">Lower Estimate ({currencySymbol})</Label>
                <Input
                  id="fee-lower"
                  type="text"
                  value={formatNumber(feeLower)}
                  onChange={(e) => setFeeLower(e.target.value.replace(/,/g, ''))}
                  placeholder="0"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee-upper">Upper Estimate ({currencySymbol})</Label>
                <Input
                  id="fee-upper"
                  type="text"
                  value={formatNumber(feeUpper)}
                  onChange={(e) => setFeeUpper(e.target.value.replace(/,/g, ''))}
                  placeholder="0"
                  className="text-right"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!workItem.trim()}>
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
  );
}
