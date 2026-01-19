import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, Users, Scale, Building, Sparkles, Pencil, Check, X } from "lucide-react";

// Define assumption types with their configuration options
export interface ScopeAssumption {
  id: string;
  label: string;
  description: string;
  category: 'timeline' | 'scope' | 'process' | 'documentation';
  requiresInput: boolean;
  inputType?: 'text' | 'number' | 'select';
  inputLabel?: string;
  inputOptions?: { value: string; label: string }[];
  inputPlaceholder?: string;
  narrativeTemplate: (value?: string) => string;
}

export const SCOPE_ASSUMPTIONS: ScopeAssumption[] = [
  {
    id: 'no_renegotiation',
    label: 'No material renegotiation',
    description: 'Term sheet positions remain stable',
    category: 'scope',
    requiresInput: false,
    narrativeTemplate: () => 'The parties will not materially renegotiate positions already agreed in the term sheet.',
  },
  {
    id: 'time_to_completion',
    label: 'Time to completion',
    description: 'Expected deal timeline',
    category: 'timeline',
    requiresInput: true,
    inputType: 'select',
    inputLabel: 'Expected timeline',
    inputOptions: [
      { value: '1_month', label: '1 month' },
      { value: '2_months', label: '2 months' },
      { value: '3_months', label: '3 months' },
      { value: '4_months', label: '4 months' },
      { value: '6_months', label: '6 months' },
      { value: '9_months', label: '9 months' },
      { value: '12_months', label: '12 months' },
    ],
    narrativeTemplate: (value) => {
      const labels: Record<string, string> = {
        '1_month': 'one month',
        '2_months': 'two months',
        '3_months': 'three months',
        '4_months': 'four months',
        '6_months': 'six months',
        '9_months': 'nine months',
        '12_months': 'twelve months',
      };
      return `The transaction is expected to complete within ${labels[value || '3_months'] || 'three months'} from the date of instruction.`;
    },
  },
  {
    id: 'number_of_turns',
    label: 'Number of turns per document',
    description: 'Rounds of negotiation/markup',
    category: 'documentation',
    requiresInput: true,
    inputType: 'select',
    inputLabel: 'Number of turns',
    inputOptions: [
      { value: '1', label: '1 turn (draft/review only)' },
      { value: '2', label: '2 turns' },
      { value: '3', label: '3 turns' },
      { value: '4', label: '4 turns' },
      { value: '5', label: '5+ turns' },
    ],
    narrativeTemplate: (value) => {
      const turns = value || '3';
      if (turns === '1') {
        return 'Each document will be subject to a single draft or review, with no negotiation rounds included.';
      }
      return `Each document is assumed to require ${turns} rounds of negotiation and markup.`;
    },
  },
  {
    id: 'who_drafts',
    label: 'Who drafts',
    description: 'Whether we draft or respond to counterparty paper',
    category: 'documentation',
    requiresInput: true,
    inputType: 'select',
    inputLabel: 'Drafting approach',
    inputOptions: [
      { value: 'we_draft', label: 'We draft (first pen)' },
      { value: 'they_draft', label: 'Counterparty drafts (we review)' },
      { value: 'mixed', label: 'Mixed (depends on document)' },
    ],
    narrativeTemplate: (value) => {
      if (value === 'we_draft') {
        return 'We will prepare the first drafts of all principal transaction documents.';
      }
      if (value === 'they_draft') {
        return 'The counterparty will prepare the first drafts of principal documents, with our role limited to review and markup.';
      }
      return 'Drafting responsibility will be shared between the parties depending on the document type.';
    },
  },
  {
    id: 'no_regulatory',
    label: 'No regulatory filings',
    description: 'Excludes government/regulatory submissions',
    category: 'scope',
    requiresInput: false,
    narrativeTemplate: () => 'This fee estimate excludes any regulatory filings, government submissions, or antitrust/competition notifications.',
  },
  {
    id: 'no_tax',
    label: 'No tax advice',
    description: 'Tax structuring excluded',
    category: 'scope',
    requiresInput: false,
    narrativeTemplate: () => 'Tax advice and structuring is excluded from this scope and will be provided separately if required.',
  },
  {
    id: 'standard_terms',
    label: 'Standard market terms',
    description: 'Assumes reasonable commercial positions',
    category: 'scope',
    requiresInput: false,
    narrativeTemplate: () => 'The transaction documents will reflect standard market terms and conditions, without unusual or heavily negotiated provisions.',
  },
  {
    id: 'single_counterparty',
    label: 'Single counterparty',
    description: 'Not a multi-party transaction',
    category: 'process',
    requiresInput: false,
    narrativeTemplate: () => 'This is a bilateral transaction with a single counterparty. Multi-party negotiations or consortium arrangements are not included.',
  },
  {
    id: 'client_forms',
    label: "Client's form of documents",
    description: 'Using client preferred templates',
    category: 'documentation',
    requiresInput: false,
    narrativeTemplate: () => "The transaction will use the client's preferred form of documents where available.",
  },
  {
    id: 'single_signing',
    label: 'Single signing',
    description: 'One closing, not staggered',
    category: 'process',
    requiresInput: false,
    narrativeTemplate: () => 'The transaction will complete in a single signing and closing, without staggered completions or deferred conditions.',
  },
  {
    id: 'virtual_completion',
    label: 'Virtual completion',
    description: 'No physical attendance required',
    category: 'process',
    requiresInput: false,
    narrativeTemplate: () => 'Completion will be conducted virtually, with no requirement for physical attendance at any signing meetings.',
  },
];

export interface ScopeAssumptionValue {
  assumptionId: string;
  enabled: boolean;
  inputValue?: string;
  narrative: string;
}

export interface ScopeAssumptionsState {
  noAssumptionsApply: boolean;
  assumptions: ScopeAssumptionValue[];
}

const DEFAULT_STATE: ScopeAssumptionsState = {
  noAssumptionsApply: false,
  assumptions: SCOPE_ASSUMPTIONS.map(a => ({
    assumptionId: a.id,
    enabled: false,
    inputValue: undefined,
    narrative: '',
  })),
};

interface ScopeAssumptionsTabProps {
  value: ScopeAssumptionsState | null;
  onChange: (state: ScopeAssumptionsState) => void;
  currency: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  timeline: <Clock className="h-4 w-4" />,
  scope: <Scale className="h-4 w-4" />,
  process: <Users className="h-4 w-4" />,
  documentation: <FileText className="h-4 w-4" />,
};

const categoryLabels: Record<string, string> = {
  timeline: 'Timeline',
  scope: 'Scope Boundaries',
  process: 'Process',
  documentation: 'Documentation',
};

export function ScopeAssumptionsTab({ value, onChange, currency }: ScopeAssumptionsTabProps) {
  const [state, setState] = useState<ScopeAssumptionsState>(value || DEFAULT_STATE);
  const [editingNarrative, setEditingNarrative] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');

  // Sync with prop changes
  useEffect(() => {
    if (value) {
      // Merge incoming value with defaults to handle new assumptions
      const mergedAssumptions = SCOPE_ASSUMPTIONS.map(def => {
        const existing = value.assumptions.find(a => a.assumptionId === def.id);
        return existing || {
          assumptionId: def.id,
          enabled: false,
          inputValue: undefined,
          narrative: '',
        };
      });
      setState({
        noAssumptionsApply: value.noAssumptionsApply,
        assumptions: mergedAssumptions,
      });
    }
  }, [value]);

  const updateState = (newState: ScopeAssumptionsState) => {
    setState(newState);
    onChange(newState);
  };

  const toggleNoAssumptions = (checked: boolean) => {
    updateState({
      ...state,
      noAssumptionsApply: checked,
      // Clear all assumptions if "no assumptions" is checked
      assumptions: checked 
        ? state.assumptions.map(a => ({ ...a, enabled: false, inputValue: undefined, narrative: '' }))
        : state.assumptions,
    });
  };

  const toggleAssumption = (assumptionId: string, enabled: boolean) => {
    const def = SCOPE_ASSUMPTIONS.find(a => a.id === assumptionId);
    if (!def) return;

    const newAssumptions = state.assumptions.map(a => {
      if (a.assumptionId === assumptionId) {
        const narrative = enabled && !def.requiresInput 
          ? def.narrativeTemplate() 
          : (enabled ? a.narrative : '');
        return { ...a, enabled, narrative };
      }
      return a;
    });

    updateState({
      ...state,
      noAssumptionsApply: false,
      assumptions: newAssumptions,
    });
  };

  const updateInputValue = (assumptionId: string, inputValue: string) => {
    const def = SCOPE_ASSUMPTIONS.find(a => a.id === assumptionId);
    if (!def) return;

    const newAssumptions = state.assumptions.map(a => {
      if (a.assumptionId === assumptionId) {
        return { 
          ...a, 
          inputValue, 
          narrative: def.narrativeTemplate(inputValue),
        };
      }
      return a;
    });

    updateState({
      ...state,
      assumptions: newAssumptions,
    });
  };

  const startEditingNarrative = (assumptionId: string) => {
    const assumption = state.assumptions.find(a => a.assumptionId === assumptionId);
    if (assumption) {
      setEditingNarrative(assumptionId);
      setEditedText(assumption.narrative);
    }
  };

  const saveNarrative = (assumptionId: string) => {
    const newAssumptions = state.assumptions.map(a => {
      if (a.assumptionId === assumptionId) {
        return { ...a, narrative: editedText };
      }
      return a;
    });

    updateState({
      ...state,
      assumptions: newAssumptions,
    });
    setEditingNarrative(null);
  };

  const cancelEditing = () => {
    setEditingNarrative(null);
    setEditedText('');
  };

  const regenerateNarrative = (assumptionId: string) => {
    const def = SCOPE_ASSUMPTIONS.find(a => a.id === assumptionId);
    const assumption = state.assumptions.find(a => a.assumptionId === assumptionId);
    if (!def || !assumption) return;

    const newAssumptions = state.assumptions.map(a => {
      if (a.assumptionId === assumptionId) {
        return { 
          ...a, 
          narrative: def.narrativeTemplate(a.inputValue),
        };
      }
      return a;
    });

    updateState({
      ...state,
      assumptions: newAssumptions,
    });
  };

  const enabledAssumptions = state.assumptions.filter(a => a.enabled);
  const groupedAssumptions = SCOPE_ASSUMPTIONS.reduce((acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  }, {} as Record<string, ScopeAssumption[]>);

  return (
    <div className="space-y-6">
      {/* No Assumptions Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Scope Assumptions
          </CardTitle>
          <CardDescription>
            Select the assumptions that apply to this engagement. These will be included in the Excel export.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg">
            <Checkbox 
              id="no-assumptions"
              checked={state.noAssumptionsApply}
              onCheckedChange={(checked) => toggleNoAssumptions(!!checked)}
            />
            <Label htmlFor="no-assumptions" className="text-sm font-medium cursor-pointer">
              No assumptions apply to this engagement
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Assumption Selection by Category */}
      {!state.noAssumptionsApply && (
        <div className="grid gap-6 lg:grid-cols-2">
          {Object.entries(groupedAssumptions).map(([category, assumptions]) => (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {categoryIcons[category]}
                  {categoryLabels[category]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assumptions.map(def => {
                  const assumption = state.assumptions.find(a => a.assumptionId === def.id);
                  const isEnabled = assumption?.enabled || false;
                  const inputValue = assumption?.inputValue;

                  return (
                    <div key={def.id} className="space-y-2">
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id={def.id}
                          checked={isEnabled}
                          onCheckedChange={(checked) => toggleAssumption(def.id, !!checked)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 space-y-1">
                          <Label htmlFor={def.id} className="text-sm font-medium cursor-pointer">
                            {def.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{def.description}</p>
                        </div>
                      </div>

                      {/* Input field for assumptions that require it */}
                      {isEnabled && def.requiresInput && (
                        <div className="ml-7 mt-2">
                          <Label className="text-xs text-muted-foreground">{def.inputLabel}</Label>
                          {def.inputType === 'select' && def.inputOptions && (
                            <Select
                              value={inputValue || ''}
                              onValueChange={(val) => updateInputValue(def.id, val)}
                            >
                              <SelectTrigger className="h-8 text-sm mt-1">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {def.inputOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {def.inputType === 'text' && (
                            <Input
                              value={inputValue || ''}
                              onChange={(e) => updateInputValue(def.id, e.target.value)}
                              placeholder={def.inputPlaceholder}
                              className="h-8 text-sm mt-1"
                            />
                          )}
                          {def.inputType === 'number' && (
                            <Input
                              type="number"
                              value={inputValue || ''}
                              onChange={(e) => updateInputValue(def.id, e.target.value)}
                              placeholder={def.inputPlaceholder}
                              className="h-8 text-sm mt-1 w-24"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generated Narratives Preview & Edit */}
      {!state.noAssumptionsApply && enabledAssumptions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Generated Assumptions
            </CardTitle>
            <CardDescription>
              Review and edit the narrative text. Click the edit icon to modify any assumption.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {enabledAssumptions.map(assumption => {
              const def = SCOPE_ASSUMPTIONS.find(a => a.id === assumption.assumptionId);
              if (!def) return null;

              // Check if input is required but not provided
              const needsInput = def.requiresInput && !assumption.inputValue;
              const isEditing = editingNarrative === assumption.assumptionId;

              return (
                <div 
                  key={assumption.assumptionId} 
                  className="p-3 bg-muted/30 rounded-lg border border-border/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {def.label}
                        </Badge>
                        {needsInput && (
                          <Badge variant="secondary" className="text-xs text-amber-600 bg-amber-100/50 dark:bg-amber-900/30 dark:text-amber-400">
                            Needs input
                          </Badge>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="min-h-[60px] text-sm"
                          />
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => saveNarrative(assumption.assumptionId)}
                              className="h-7"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={cancelEditing}
                              className="h-7"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => regenerateNarrative(assumption.assumptionId)}
                              className="h-7 ml-auto"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Regenerate
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">
                          {assumption.narrative || (needsInput ? 'Please select an option above' : 'No narrative generated')}
                        </p>
                      )}
                    </div>
                    
                    {!isEditing && assumption.narrative && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={() => startEditingNarrative(assumption.assumptionId)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!state.noAssumptionsApply && enabledAssumptions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Scale className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No assumptions selected yet.</p>
            <p className="text-xs mt-1">Select assumptions from the categories above, or check "No assumptions apply".</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper to get narratives for export
export function getAssumptionNarratives(state: ScopeAssumptionsState | null): string[] {
  if (!state || state.noAssumptionsApply) return [];
  
  return state.assumptions
    .filter(a => a.enabled && a.narrative)
    .map(a => a.narrative);
}
