import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Clock, Users, Scale, Sparkles, Pencil, Check, X, ChevronDown, ChevronRight, File } from "lucide-react";
import { DraftProposalItem } from "@/lib/hooks/usePricingProposals";

// Simple assumptions (non-document-specific)
export interface SimpleAssumption {
  id: string;
  label: string;
  description: string;
  category: 'timeline' | 'scope' | 'process';
  requiresInput: boolean;
  inputType?: 'text' | 'number' | 'select';
  inputLabel?: string;
  inputOptions?: { value: string; label: string }[];
  narrativeTemplate: (value?: string) => string;
}

export const SIMPLE_ASSUMPTIONS: SimpleAssumption[] = [
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

// Document-specific assumption types
export type DocumentAssumptionType = 'turns' | 'who_drafts' | 'client_form';

export interface DocumentConfig {
  workItemName: string;
  turns?: number;
  whoDrafts?: 'we_draft' | 'they_draft';
  clientForm?: boolean;
}

export interface SimpleAssumptionValue {
  assumptionId: string;
  enabled: boolean;
  inputValue?: string;
  narrative: string;
}

export interface DocumentAssumptionsState {
  turnsEnabled: boolean;
  whoDraftsEnabled: boolean;
  clientFormEnabled: boolean;
  configs: DocumentConfig[];
}

export interface ScopeAssumptionsState {
  noAssumptionsApply: boolean;
  simpleAssumptions: SimpleAssumptionValue[];
  documentAssumptions: DocumentAssumptionsState;
  // Generated narratives for documents (stored for editing)
  documentNarratives: string[];
}

const DEFAULT_DOCUMENT_STATE: DocumentAssumptionsState = {
  turnsEnabled: false,
  whoDraftsEnabled: false,
  clientFormEnabled: false,
  configs: [],
};

const createDefaultState = (): ScopeAssumptionsState => ({
  noAssumptionsApply: false,
  simpleAssumptions: SIMPLE_ASSUMPTIONS.map(a => ({
    assumptionId: a.id,
    enabled: false,
    inputValue: undefined,
    narrative: '',
  })),
  documentAssumptions: DEFAULT_DOCUMENT_STATE,
  documentNarratives: [],
});

interface ScopeAssumptionsTabProps {
  value: ScopeAssumptionsState | null;
  onChange: (state: ScopeAssumptionsState) => void;
  currency: string;
  workItems?: DraftProposalItem[];
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

// Generate amalgamated narrative for a document
function generateDocumentNarrative(config: DocumentConfig): string {
  const parts: string[] = [];
  const docName = config.workItemName;
  
  // Who drafts
  if (config.whoDrafts === 'we_draft') {
    parts.push(`We will prepare the first draft of the ${docName}`);
  } else if (config.whoDrafts === 'they_draft') {
    parts.push(`The counterparty will prepare the first draft of the ${docName}, with our role limited to review and markup`);
  }
  
  // Client form
  if (config.clientForm) {
    if (parts.length > 0) {
      parts[parts.length - 1] += ` using Client's preferred form`;
    } else {
      parts.push(`The ${docName} will use Client's preferred form`);
    }
  }
  
  // Turns
  if (config.turns !== undefined && config.turns > 0) {
    if (parts.length > 0) {
      if (config.turns === 1) {
        parts[parts.length - 1] += `, with a single review round (no negotiation)`;
      } else {
        parts[parts.length - 1] += `, with no more than ${config.turns} rounds of negotiation expected`;
      }
    } else {
      if (config.turns === 1) {
        parts.push(`The ${docName} will be subject to a single review round, with no negotiation rounds included`);
      } else {
        parts.push(`The ${docName} is assumed to require no more than ${config.turns} rounds of negotiation`);
      }
    }
  }
  
  if (parts.length === 0) return '';
  return parts.join('. ') + '.';
}

export function ScopeAssumptionsTab({ value, onChange, currency, workItems = [] }: ScopeAssumptionsTabProps) {
  const [state, setState] = useState<ScopeAssumptionsState>(value || createDefaultState());
  const [editingNarrative, setEditingNarrative] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [docSectionOpen, setDocSectionOpen] = useState(false);

  // Filter work items to only documentation/negotiation categories
  const documentWorkItems = useMemo(() => {
    return workItems.filter(item => 
      item.work_item.trim() !== '' &&
      (item.category === 'Documentation' || 
       item.category === 'Negotiations' || 
       item.item_type === 'documentation' || 
       item.item_type === 'negotiation')
    );
  }, [workItems]);

  // Sync with prop changes (but preserve selections)
  useEffect(() => {
    if (value) {
      // Merge incoming value with defaults to handle new assumptions
      const mergedSimple = SIMPLE_ASSUMPTIONS.map(def => {
        const existing = value.simpleAssumptions?.find(a => a.assumptionId === def.id);
        return existing || {
          assumptionId: def.id,
          enabled: false,
          inputValue: undefined,
          narrative: '',
        };
      });
      setState({
        noAssumptionsApply: value.noAssumptionsApply,
        simpleAssumptions: mergedSimple,
        documentAssumptions: value.documentAssumptions || DEFAULT_DOCUMENT_STATE,
        documentNarratives: value.documentNarratives || [],
      });
    }
  }, [value]);

  // Regenerate document narratives when configs change
  useEffect(() => {
    const docAssumptions = state.documentAssumptions || DEFAULT_DOCUMENT_STATE;
    if (!docAssumptions.configs?.length) return;
    
    const hasAnyDocAssumption = 
      docAssumptions.turnsEnabled ||
      docAssumptions.whoDraftsEnabled ||
      docAssumptions.clientFormEnabled;
    
    if (!hasAnyDocAssumption) return;

    // Only regenerate if narratives are empty or configs changed
    const newNarratives = docAssumptions.configs
      .filter(c => c.turns !== undefined || c.whoDrafts !== undefined || c.clientForm)
      .map(generateDocumentNarrative)
      .filter(n => n.length > 0);
    
    if (JSON.stringify(newNarratives) !== JSON.stringify(state.documentNarratives || [])) {
      const newState = { ...state, documentNarratives: newNarratives };
      setState(newState);
      onChange(newState);
    }
  }, [state.documentAssumptions]);

  const updateState = (newState: ScopeAssumptionsState) => {
    setState(newState);
    onChange(newState);
  };

  // Toggle "No Assumptions Apply" - preserves selections, just hides them
  const toggleNoAssumptions = (checked: boolean) => {
    updateState({
      ...state,
      noAssumptionsApply: checked,
      // Don't clear anything - just toggle the flag
    });
  };

  const toggleSimpleAssumption = (assumptionId: string, enabled: boolean) => {
    const def = SIMPLE_ASSUMPTIONS.find(a => a.id === assumptionId);
    if (!def) return;

    const newAssumptions = (state.simpleAssumptions || []).map(a => {
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
      simpleAssumptions: newAssumptions,
    });
  };

  const updateSimpleInputValue = (assumptionId: string, inputValue: string) => {
    const def = SIMPLE_ASSUMPTIONS.find(a => a.id === assumptionId);
    if (!def) return;

    const newAssumptions = (state.simpleAssumptions || []).map(a => {
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
      simpleAssumptions: newAssumptions,
    });
  };

  // Document assumption toggles
  const toggleDocumentAssumptionType = (type: DocumentAssumptionType, enabled: boolean) => {
    const currentDocState = state.documentAssumptions || DEFAULT_DOCUMENT_STATE;
    const newDocState = { ...currentDocState };
    
    if (type === 'turns') newDocState.turnsEnabled = enabled;
    if (type === 'who_drafts') newDocState.whoDraftsEnabled = enabled;
    if (type === 'client_form') newDocState.clientFormEnabled = enabled;

    updateState({
      ...state,
      noAssumptionsApply: false,
      documentAssumptions: newDocState,
    });
    
    if (enabled) setDocSectionOpen(true);
  };

  // Toggle a work item for document assumptions
  const toggleWorkItemSelected = (workItemName: string, selected: boolean) => {
    const currentDocState = state.documentAssumptions || DEFAULT_DOCUMENT_STATE;
    let configs = [...(currentDocState.configs || [])];
    
    if (selected) {
      // Add if not exists
      if (!configs.find(c => c.workItemName === workItemName)) {
        configs.push({ workItemName });
      }
    } else {
      // Remove
      configs = configs.filter(c => c.workItemName !== workItemName);
    }

    updateState({
      ...state,
      documentAssumptions: { ...currentDocState, configs },
    });
  };

  // Update document config
  const updateDocumentConfig = (workItemName: string, updates: Partial<DocumentConfig>) => {
    const currentDocState = state.documentAssumptions || DEFAULT_DOCUMENT_STATE;
    const configs = (currentDocState.configs || []).map(c => {
      if (c.workItemName === workItemName) {
        return { ...c, ...updates };
      }
      return c;
    });

    updateState({
      ...state,
      documentAssumptions: { ...currentDocState, configs },
    });
  };

  // Narrative editing
  const startEditingNarrative = (key: string, text: string) => {
    setEditingNarrative(key);
    setEditedText(text);
  };

  const saveSimpleNarrative = (assumptionId: string) => {
    const newAssumptions = state.simpleAssumptions.map(a => {
      if (a.assumptionId === assumptionId) {
        return { ...a, narrative: editedText };
      }
      return a;
    });

    updateState({
      ...state,
      simpleAssumptions: newAssumptions,
    });
    setEditingNarrative(null);
  };

  const saveDocNarrative = (index: number) => {
    const newNarratives = [...(state.documentNarratives || [])];
    newNarratives[index] = editedText;
    updateState({
      ...state,
      documentNarratives: newNarratives,
    });
    setEditingNarrative(null);
  };

  const cancelEditing = () => {
    setEditingNarrative(null);
    setEditedText('');
  };

  const regenerateSimpleNarrative = (assumptionId: string) => {
    const def = SIMPLE_ASSUMPTIONS.find(a => a.id === assumptionId);
    const assumption = (state.simpleAssumptions || []).find(a => a.assumptionId === assumptionId);
    if (!def || !assumption) return;

    const newAssumptions = (state.simpleAssumptions || []).map(a => {
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
      simpleAssumptions: newAssumptions,
    });
  };

  const enabledSimpleAssumptions = (state.simpleAssumptions || []).filter(a => a.enabled);
  const documentAssumptions = state.documentAssumptions || DEFAULT_DOCUMENT_STATE;
  const hasDocumentAssumptions = documentAssumptions.turnsEnabled || 
    documentAssumptions.whoDraftsEnabled || 
    documentAssumptions.clientFormEnabled;
  const hasAnyEnabled = enabledSimpleAssumptions.length > 0 || 
    hasDocumentAssumptions ||
    (state.documentNarratives || []).length > 0;

  const groupedSimple = SIMPLE_ASSUMPTIONS.reduce((acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  }, {} as Record<string, SimpleAssumption[]>);

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

      {/* Main assumption selection - hidden when "no assumptions" is checked */}
      {!state.noAssumptionsApply && (
        <>
          {/* Simple Assumptions by Category */}
          <div className="grid gap-6 lg:grid-cols-2">
            {Object.entries(groupedSimple).map(([category, assumptions]) => (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {categoryIcons[category]}
                    {categoryLabels[category]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {assumptions.map(def => {
                    const assumption = state.simpleAssumptions.find(a => a.assumptionId === def.id);
                    const isEnabled = assumption?.enabled || false;
                    const inputValue = assumption?.inputValue;

                    return (
                      <div key={def.id} className="space-y-2">
                        <div className="flex items-start space-x-3">
                          <Checkbox 
                            id={def.id}
                            checked={isEnabled}
                            onCheckedChange={(checked) => toggleSimpleAssumption(def.id, !!checked)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-1">
                            <Label htmlFor={def.id} className="text-sm font-medium cursor-pointer">
                              {def.label}
                            </Label>
                            <p className="text-xs text-muted-foreground">{def.description}</p>
                          </div>
                        </div>

                        {isEnabled && def.requiresInput && (
                          <div className="ml-7 mt-2">
                            <Label className="text-xs text-muted-foreground">{def.inputLabel}</Label>
                            {def.inputType === 'select' && def.inputOptions && (
                              <Select
                                value={inputValue || ''}
                                onValueChange={(val) => updateSimpleInputValue(def.id, val)}
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
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Document-Specific Assumptions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documentation Assumptions
              </CardTitle>
              <CardDescription>
                Configure assumptions for specific documents. Select which documents each assumption applies to.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document assumption type toggles */}
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox 
                    id="doc-turns"
                    checked={state.documentAssumptions.turnsEnabled}
                    onCheckedChange={(checked) => toggleDocumentAssumptionType('turns', !!checked)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label htmlFor="doc-turns" className="text-sm font-medium cursor-pointer">
                      Number of turns per document
                    </Label>
                    <p className="text-xs text-muted-foreground">Specify expected negotiation rounds</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox 
                    id="doc-drafts"
                    checked={state.documentAssumptions.whoDraftsEnabled}
                    onCheckedChange={(checked) => toggleDocumentAssumptionType('who_drafts', !!checked)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label htmlFor="doc-drafts" className="text-sm font-medium cursor-pointer">
                      Who drafts each document
                    </Label>
                    <p className="text-xs text-muted-foreground">Whether we draft or respond to counterparty paper</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox 
                    id="doc-client-form"
                    checked={state.documentAssumptions.clientFormEnabled}
                    onCheckedChange={(checked) => toggleDocumentAssumptionType('client_form', !!checked)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label htmlFor="doc-client-form" className="text-sm font-medium cursor-pointer">
                      Client's form of documents
                    </Label>
                    <p className="text-xs text-muted-foreground">Documents using client's preferred templates</p>
                  </div>
                </div>
              </div>

              {/* Document selection and configuration */}
              {hasDocumentAssumptions && documentWorkItems.length > 0 && (
                <Collapsible open={docSectionOpen} onOpenChange={setDocSectionOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <File className="h-4 w-4" />
                        Configure Documents ({state.documentAssumptions.configs.length} selected)
                      </span>
                      {docSectionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-lg p-3 bg-muted/20">
                      {documentWorkItems.map(item => {
                        const config = state.documentAssumptions.configs.find(c => c.workItemName === item.work_item);
                        const isSelected = !!config;

                        return (
                          <div key={item.work_item} className="space-y-2 p-3 rounded-lg border bg-background">
                            <div className="flex items-start space-x-3">
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={(checked) => toggleWorkItemSelected(item.work_item, !!checked)}
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <Label className="text-sm font-medium cursor-pointer">
                                  {item.work_item}
                                </Label>
                                {item.category && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {item.category}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {isSelected && (
                              <div className="ml-7 grid gap-3 sm:grid-cols-3 mt-2">
                                {state.documentAssumptions.turnsEnabled && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Turns</Label>
                                    <Select
                                      value={config?.turns?.toString() || ''}
                                      onValueChange={(val) => updateDocumentConfig(item.work_item, { turns: parseInt(val) })}
                                    >
                                      <SelectTrigger className="h-8 text-sm mt-1">
                                        <SelectValue placeholder="Select..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="1">1 (draft/review only)</SelectItem>
                                        <SelectItem value="2">2 turns</SelectItem>
                                        <SelectItem value="3">3 turns</SelectItem>
                                        <SelectItem value="4">4 turns</SelectItem>
                                        <SelectItem value="5">5 turns</SelectItem>
                                        <SelectItem value="6">6+ turns</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {state.documentAssumptions.whoDraftsEnabled && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Who drafts</Label>
                                    <Select
                                      value={config?.whoDrafts || ''}
                                      onValueChange={(val) => updateDocumentConfig(item.work_item, { whoDrafts: val as 'we_draft' | 'they_draft' })}
                                    >
                                      <SelectTrigger className="h-8 text-sm mt-1">
                                        <SelectValue placeholder="Select..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="we_draft">We draft</SelectItem>
                                        <SelectItem value="they_draft">They draft</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {state.documentAssumptions.clientFormEnabled && (
                                  <div className="flex items-end">
                                    <div className="flex items-center space-x-2 h-8">
                                      <Checkbox 
                                        id={`client-form-${item.work_item}`}
                                        checked={config?.clientForm || false}
                                        onCheckedChange={(checked) => updateDocumentConfig(item.work_item, { clientForm: !!checked })}
                                      />
                                      <Label htmlFor={`client-form-${item.work_item}`} className="text-xs cursor-pointer">
                                        Client's form
                                      </Label>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {documentWorkItems.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No documentation or negotiation work items found. Add work items in the Work Items tab first.
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {hasDocumentAssumptions && documentWorkItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/50 rounded-lg">
                  Add documentation or negotiation work items in the Work Items tab to configure document-specific assumptions.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Generated Narratives Preview & Edit */}
          {hasAnyEnabled && (
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
                {/* Simple assumption narratives */}
                {enabledSimpleAssumptions.map(assumption => {
                  const def = SIMPLE_ASSUMPTIONS.find(a => a.id === assumption.assumptionId);
                  if (!def) return null;

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
                              <Badge variant="secondary" className="text-xs">
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
                                  onClick={() => saveSimpleNarrative(assumption.assumptionId)}
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
                                  onClick={() => regenerateSimpleNarrative(assumption.assumptionId)}
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
                            onClick={() => startEditingNarrative(assumption.assumptionId, assumption.narrative)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Document narratives */}
                {state.documentNarratives.map((narrative, index) => {
                  const isEditing = editingNarrative === `doc-${index}`;

                  return (
                    <div 
                      key={`doc-${index}`} 
                      className="p-3 bg-primary/5 rounded-lg border border-primary/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs text-primary border-primary/30">
                              Documentation
                            </Badge>
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
                                  onClick={() => saveDocNarrative(index)}
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
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-foreground">{narrative}</p>
                          )}
                        </div>
                        
                        {!isEditing && narrative && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => startEditingNarrative(`doc-${index}`, narrative)}
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
          {!hasAnyEnabled && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Scale className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No assumptions selected yet.</p>
                <p className="text-xs mt-1">Select assumptions from the categories above, or check "No assumptions apply".</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// Helper to get all narratives for export
export function getAssumptionNarratives(state: ScopeAssumptionsState | null): string[] {
  if (!state || state.noAssumptionsApply) return [];
  
  const simpleNarratives = state.simpleAssumptions
    .filter(a => a.enabled && a.narrative)
    .map(a => a.narrative);
  
  const docNarratives = state.documentNarratives || [];
  
  return [...simpleNarratives, ...docNarratives];
}
