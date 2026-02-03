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
import { FileText, Clock, Users, Scale, Sparkles, Pencil, Check, X, ChevronDown, ChevronRight, File, Plus, Trash2 } from "lucide-react";
import { DraftProposalItem, CustomAssumption } from "@/lib/hooks/usePricingProposals";

// Simple assumptions (non-document-specific)
export interface SimpleAssumption {
  id: string;
  label: string;
  description: string;
  category: 'timeline' | 'scope' | 'process';
  sectionType: 'general' | 'sector_specific';
  requiresInput: boolean;
  inputType?: 'text' | 'number' | 'select';
  inputLabel?: string;
  inputOptions?: { value: string; label: string }[];
  narrativeTemplate: (value?: string) => string;
}

export const SIMPLE_ASSUMPTIONS: SimpleAssumption[] = [
  // --- GENERAL ASSUMPTIONS ---
  {
    id: 'scope_limited_to_rfp',
    label: 'Scope limited to RFP',
    description: 'Work limited to matters described in the RFP',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'Our Scope of Work is limited to the matters described and assumptions provided in the RFP, as revised.',
  },
  {
    id: 'budget_flexibility',
    label: 'Budget flexibility between steps',
    description: 'Unused budget can cover overruns in other steps',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'If the budget for a particular step of the work is not fully used, we can use the remaining budget for any cost overruns in other steps of the work.',
  },
  {
    id: 'excludes_vat_expenses',
    label: 'Excludes VAT & expenses',
    description: 'Fee excludes VAT and disbursements',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'Our fee proposal is exclusive of VAT and any expenses or disbursements associated with the performance of our legal services.',
  },
  {
    id: 'no_renegotiation',
    label: 'No material renegotiation',
    description: 'Term sheet positions remain stable',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'Key positions agreed in the Term Sheet will not be re-opened during the negotiation of the agreements.',
  },
  {
    id: 'no_technical_meetings',
    label: 'No technical/commercial meetings',
    description: 'We will not participate in client-counterparty meetings',
    category: 'process',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'We will not participate in technical or commercial meetings between the client and its counterparties.',
  },
  {
    id: 'client_provides_annexes',
    label: 'Client provides commercial annexes',
    description: 'Commercial annexes provided by client',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'Commercial annexes to the agreements will be provided by the client.',
  },
  {
    id: 'excludes_ancillary_contracts',
    label: 'Excludes ancillary contracts',
    description: 'No ancillary agreements in scope',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'Our scope of work does not include the preparation, review or negotiation of ancillary contracts or agreements.',
  },
  {
    id: 'time_to_completion',
    label: 'Time to completion',
    description: 'Expected deal timeline from substantial commencement',
    category: 'timeline',
    sectionType: 'general',
    requiresInput: true,
    inputType: 'select',
    inputLabel: 'Expected timeline',
    inputOptions: [
      { value: '0.5_months', label: '2 weeks' },
      { value: '1_month', label: '1 month' },
      { value: '1.5_months', label: '1.5 months' },
      { value: '2_months', label: '2 months' },
      { value: '2.5_months', label: '2.5 months' },
      { value: '3_months', label: '3 months' },
      { value: '3.5_months', label: '3.5 months' },
      { value: '4_months', label: '4 months' },
      { value: '4.5_months', label: '4.5 months' },
      { value: '5_months', label: '5 months' },
      { value: '5.5_months', label: '5.5 months' },
      { value: '6_months', label: '6 months' },
      { value: '7_months', label: '7 months' },
      { value: '8_months', label: '8 months' },
      { value: '9_months', label: '9 months' },
      { value: '10_months', label: '10 months' },
      { value: '11_months', label: '11 months' },
      { value: '12_months', label: '12 months' },
      { value: '15_months', label: '15 months' },
      { value: '18_months', label: '18 months' },
      { value: '24_months', label: '24 months' },
    ],
    narrativeTemplate: (value) => {
      const labels: Record<string, string> = {
        '0.5_months': 'two weeks',
        '1_month': 'one month',
        '1.5_months': 'one and a half months',
        '2_months': 'two months',
        '2.5_months': 'two and a half months',
        '3_months': 'three months',
        '3.5_months': 'three and a half months',
        '4_months': 'four months',
        '4.5_months': 'four and a half months',
        '5_months': 'five months',
        '5.5_months': 'five and a half months',
        '6_months': 'six months',
        '7_months': 'seven months',
        '8_months': 'eight months',
        '9_months': 'nine months',
        '10_months': 'ten months',
        '11_months': 'eleven months',
        '12_months': 'twelve months',
        '15_months': 'fifteen months',
        '18_months': 'eighteen months',
        '24_months': 'twenty-four months',
      };
      return `The transaction is expected to complete within ${labels[value || '3_months'] || 'three months'} from the date of substantial commencement of our work.`;
    },
  },
  {
    id: 'no_regulatory',
    label: 'No regulatory filings',
    description: 'Excludes government/regulatory submissions',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'This fee estimate excludes any regulatory filings, government submissions, or antitrust/competition notifications.',
  },
  {
    id: 'no_tax',
    label: 'No tax advice',
    description: 'Tax structuring excluded',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'Tax advice and structuring is excluded from this scope and will be provided separately if required.',
  },
  {
    id: 'standard_terms',
    label: 'Standard market terms',
    description: 'Assumes reasonable commercial positions',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'The transaction documents will reflect standard market terms and conditions, without unusual or heavily negotiated provisions.',
  },
  {
    id: 'single_counterparty',
    label: 'Single counterparty',
    description: 'Not a multi-party transaction',
    category: 'process',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'This is a bilateral transaction with a single counterparty. Multi-party negotiations or consortium arrangements are not included.',
  },
  {
    id: 'single_signing',
    label: 'Single signing',
    description: 'One closing, not staggered',
    category: 'process',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'The transaction will complete in a single signing and closing, without staggered completions or deferred conditions.',
  },
  {
    id: 'virtual_completion',
    label: 'Virtual completion',
    description: 'No physical attendance required',
    category: 'process',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'Completion will be conducted virtually, with no requirement for physical attendance at any signing meetings.',
  },
  {
    id: 'client_timely_provision',
    label: 'Client timely provision of information',
    description: 'Client provides documents and decisions promptly',
    category: 'process',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'The client will provide all necessary documents, information, and instructions in a timely manner and will be available to make decisions as required to keep the transaction on track.',
  },
  {
    id: 'counterparty_experienced_counsel',
    label: 'Counterparty has experienced counsel',
    description: 'Counterparty represented by competent advisors',
    category: 'process',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'The counterparty will be represented by experienced legal counsel familiar with transactions of this nature.',
  },
  {
    id: 'counterparty_reasonable_conduct',
    label: 'Counterparty reasonable conduct',
    description: 'Counterparty engages constructively in negotiations',
    category: 'process',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'The counterparty will engage constructively in negotiations and respond to queries within reasonable timeframes.',
  },
  {
    id: 'no_disputes',
    label: 'No disputes or litigation',
    description: 'Transaction proceeds without contentious issues',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'The transaction will proceed without disputes, litigation, or the need for contentious proceedings of any kind.',
  },
  {
    id: 'single_jurisdiction',
    label: 'Single jurisdiction',
    description: 'Documents governed by one law',
    category: 'scope',
    sectionType: 'general',
    requiresInput: false,
    narrativeTemplate: () => 'All transaction documents will be governed by a single jurisdiction. Multi-jurisdictional advice or coordination with foreign counsel is excluded unless separately scoped.',
  },
  // --- SECTOR-SPECIFIC ASSUMPTIONS (placeholder for future) ---
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
  customAssumptions?: CustomAssumption[];
  // Custom-edited process narrative (overrides auto-generated)
  processNarrativeOverride?: string;
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
  customAssumptions: [],
  processNarrativeOverride: undefined,
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

// Extract the actual document name from a work item name
// e.g., "Negotiation of the VPPA" → "VPPA"
// e.g., "Draft VPPA" → "VPPA"
// e.g., "VPPA review and markup" → "VPPA"
function extractDocumentName(workItemName: string): string {
  const name = workItemName.trim();
  
  // Common patterns to strip out
  const prefixPatterns = [
    /^(negotiation\s+of\s+(the\s+)?)/i,
    /^(negotiate\s+(the\s+)?)/i,
    /^(drafting\s+of\s+(the\s+)?)/i,
    /^(draft(ing)?\s+(the\s+)?)/i,
    /^(review\s+(of\s+)?(the\s+)?)/i,
    /^(preparation\s+of\s+(the\s+)?)/i,
    /^(prepare\s+(the\s+)?)/i,
    /^(finalise?\s+(the\s+)?)/i,
    /^(execute?\s+(the\s+)?)/i,
  ];
  
  const suffixPatterns = [
    /(\s+review\s+and\s+markup)$/i,
    /(\s+review)$/i,
    /(\s+drafting)$/i,
    /(\s+negotiation)$/i,
    /(\s+preparation)$/i,
    /(\s+finalisation)$/i,
  ];
  
  let result = name;
  
  // Remove prefixes
  for (const pattern of prefixPatterns) {
    result = result.replace(pattern, '');
  }
  
  // Remove suffixes
  for (const pattern of suffixPatterns) {
    result = result.replace(pattern, '');
  }
  
  // If we stripped everything or nothing, return the original
  if (!result.trim() || result === name) {
    return name;
  }
  
  return result.trim();
}

// Generate amalgamated narrative for a document
function generateDocumentNarrative(config: DocumentConfig): string {
  const parts: string[] = [];
  const docName = extractDocumentName(config.workItemName);
  
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

// Generate a combined process assumption narrative from enabled process assumptions
function generateProcessNarrative(enabledProcessAssumptions: SimpleAssumptionValue[]): string {
  if (enabledProcessAssumptions.length === 0) return '';
  
  const parts: string[] = [];
  
  const hasSingleCounterparty = enabledProcessAssumptions.some(a => a.assumptionId === 'single_counterparty');
  const hasSingleSigning = enabledProcessAssumptions.some(a => a.assumptionId === 'single_signing');
  const hasVirtualCompletion = enabledProcessAssumptions.some(a => a.assumptionId === 'virtual_completion');
  
  // Build a cohesive sentence
  if (hasSingleCounterparty && hasSingleSigning && hasVirtualCompletion) {
    return 'This is a bilateral transaction with a single counterparty, completing in a single virtual signing without staggered completions or physical attendance requirements.';
  }
  
  if (hasSingleCounterparty && hasSingleSigning) {
    return 'This is a bilateral transaction with a single counterparty, completing in a single signing and closing without staggered completions or deferred conditions.';
  }
  
  if (hasSingleCounterparty && hasVirtualCompletion) {
    return 'This is a bilateral transaction with a single counterparty. Completion will be conducted virtually, with no requirement for physical attendance.';
  }
  
  if (hasSingleSigning && hasVirtualCompletion) {
    return 'The transaction will complete in a single virtual signing, without staggered completions or physical attendance requirements.';
  }
  
  // Individual assumptions
  if (hasSingleCounterparty) {
    parts.push('This is a bilateral transaction with a single counterparty');
  }
  if (hasSingleSigning) {
    parts.push('the transaction will complete in a single signing and closing');
  }
  if (hasVirtualCompletion) {
    parts.push('completion will be conducted virtually');
  }
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '.';
  }
  
  // Join with proper capitalization
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const rest = parts.slice(1);
  return first + ', ' + rest.join(', and ') + '.';
}

export function ScopeAssumptionsTab({ value, onChange, currency, workItems = [] }: ScopeAssumptionsTabProps) {
  const [state, setState] = useState<ScopeAssumptionsState>(value || createDefaultState());
  const [editingNarrative, setEditingNarrative] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [docSectionOpen, setDocSectionOpen] = useState(false);
  const [newCustomAssumption, setNewCustomAssumption] = useState('');

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
        customAssumptions: value.customAssumptions || [],
        processNarrativeOverride: value.processNarrativeOverride,
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
      // Clear process narrative override when regenerating
      processNarrativeOverride: undefined,
    });
  };

  // Process narrative editing
  const saveProcessNarrative = () => {
    updateState({
      ...state,
      processNarrativeOverride: editedText,
    });
    setEditingNarrative(null);
  };

  const regenerateProcessNarrative = () => {
    updateState({
      ...state,
      processNarrativeOverride: undefined,
    });
    setEditingNarrative(null);
  };

  // Custom assumption handlers
  const addCustomAssumption = () => {
    const text = newCustomAssumption.trim();
    if (!text) return;
    
    const newCustom: CustomAssumption = {
      id: `custom-${Date.now()}`,
      text,
      enabled: true,
    };
    
    updateState({
      ...state,
      customAssumptions: [...(state.customAssumptions || []), newCustom],
    });
    setNewCustomAssumption('');
  };

  const toggleCustomAssumption = (id: string, enabled: boolean) => {
    updateState({
      ...state,
      customAssumptions: (state.customAssumptions || []).map(a =>
        a.id === id ? { ...a, enabled } : a
      ),
    });
  };

  const removeCustomAssumption = (id: string) => {
    updateState({
      ...state,
      customAssumptions: (state.customAssumptions || []).filter(a => a.id !== id),
    });
  };

  const handleCustomAssumptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addCustomAssumption();
    }
  };

  const enabledSimpleAssumptions = (state.simpleAssumptions || []).filter(a => a.enabled);
  const documentAssumptions = state.documentAssumptions || DEFAULT_DOCUMENT_STATE;
  const hasDocumentAssumptions = documentAssumptions.turnsEnabled || 
    documentAssumptions.whoDraftsEnabled || 
    documentAssumptions.clientFormEnabled;
  
  // Split process assumptions from others for combined narrative
  const enabledProcessAssumptions = enabledSimpleAssumptions.filter(a => {
    const def = SIMPLE_ASSUMPTIONS.find(d => d.id === a.assumptionId);
    return def?.category === 'process';
  });
  const enabledNonProcessAssumptions = enabledSimpleAssumptions.filter(a => {
    const def = SIMPLE_ASSUMPTIONS.find(d => d.id === a.assumptionId);
    return def?.category !== 'process';
  });
  const generatedProcessNarrative = generateProcessNarrative(enabledProcessAssumptions);
  // Use override if set, otherwise use generated
  const combinedProcessNarrative = state.processNarrativeOverride ?? generatedProcessNarrative;
  
  const enabledCustomAssumptions = (state.customAssumptions || []).filter(a => a.enabled);
  
  const hasAnyEnabled = enabledSimpleAssumptions.length > 0 || 
    hasDocumentAssumptions ||
    (state.documentNarratives || []).length > 0 ||
    enabledCustomAssumptions.length > 0;

  // Group by section type first, then by category
  const generalAssumptions = SIMPLE_ASSUMPTIONS.filter(a => a.sectionType === 'general');
  const sectorSpecificAssumptions = SIMPLE_ASSUMPTIONS.filter(a => a.sectionType === 'sector_specific');
  
  const groupByCategory = (assumptions: SimpleAssumption[]) => {
    return assumptions.reduce((acc, def) => {
      if (!acc[def.category]) acc[def.category] = [];
      acc[def.category].push(def);
      return acc;
    }, {} as Record<string, SimpleAssumption[]>);
  };
  
  const groupedGeneral = groupByCategory(generalAssumptions);
  const groupedSectorSpecific = groupByCategory(sectorSpecificAssumptions);

  const renderAssumptionGroup = (groupedAssumptions: Record<string, SimpleAssumption[]>) => (
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
              const assumption = (state.simpleAssumptions || []).find(a => a.assumptionId === def.id);
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
  );

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
          {/* General Assumptions Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">General Assumptions</h3>
              <Badge variant="secondary" className="text-xs">
                {generalAssumptions.length} available
              </Badge>
            </div>
            {renderAssumptionGroup(groupedGeneral)}
          </div>

          {/* Sector-Specific Assumptions Section */}
          {sectorSpecificAssumptions.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Sector-Specific Assumptions</h3>
                <Badge variant="outline" className="text-xs">
                  {sectorSpecificAssumptions.length} available
                </Badge>
              </div>
              {renderAssumptionGroup(groupedSectorSpecific)}
            </div>
          )}

          {/* Placeholder when no sector-specific assumptions exist */}
          {sectorSpecificAssumptions.length === 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-muted-foreground">Sector-Specific Assumptions</h3>
              </div>
              <p className="text-sm text-muted-foreground italic">
                No sector-specific assumptions configured. Sector-specific assumptions can be added for specialized practice areas.
              </p>
            </div>
          )}

          {/* Custom Assumptions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Custom Assumptions
              </CardTitle>
              <CardDescription>
                Add your own custom assumptions. Type your assumption and press Enter to add.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input for new custom assumption */}
              <div className="flex gap-2">
                <Input
                  value={newCustomAssumption}
                  onChange={(e) => setNewCustomAssumption(e.target.value)}
                  onKeyDown={handleCustomAssumptionKeyDown}
                  placeholder="Type a custom assumption and press Enter..."
                  className="flex-1"
                />
                <Button
                  onClick={addCustomAssumption}
                  disabled={!newCustomAssumption.trim()}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {/* List of custom assumptions */}
              {(state.customAssumptions || []).length > 0 ? (
                <div className="space-y-2">
                  {(state.customAssumptions || []).map((assumption) => (
                    <div 
                      key={assumption.id} 
                      className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border/50"
                    >
                      <Checkbox
                        checked={assumption.enabled}
                        onCheckedChange={(checked) => toggleCustomAssumption(assumption.id, !!checked)}
                        className="mt-0.5"
                      />
                      <p className={`flex-1 text-sm ${!assumption.enabled ? 'text-muted-foreground line-through' : ''}`}>
                        {assumption.text}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeCustomAssumption(assumption.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No custom assumptions added yet.
                </p>
              )}
            </CardContent>
          </Card>

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
                    checked={documentAssumptions.turnsEnabled}
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
                    checked={documentAssumptions.whoDraftsEnabled}
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
                    checked={documentAssumptions.clientFormEnabled}
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
                        Configure Documents ({(documentAssumptions.configs || []).length} selected)
                      </span>
                      {docSectionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-lg p-3 bg-muted/20">
                      {documentWorkItems.map(item => {
                        const config = (documentAssumptions.configs || []).find(c => c.workItemName === item.work_item);
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
                                {documentAssumptions.turnsEnabled && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Number of turns</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="99"
                                      placeholder="e.g. 3"
                                      className="h-8 text-sm mt-1 w-24"
                                      value={config?.turns || ''}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        const num = val ? parseInt(val) : undefined;
                                        updateDocumentConfig(item.work_item, { turns: num });
                                      }}
                                      onKeyDown={(e) => {
                                        // Prevent non-numeric input
                                        if (!/[0-9]/.test(e.key) && 
                                            !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                                          e.preventDefault();
                                        }
                                      }}
                                    />
                                  </div>
                                )}

                                {documentAssumptions.whoDraftsEnabled && (
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

                                {documentAssumptions.clientFormEnabled && (
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
                {/* Non-process assumption narratives (individual) */}
                {enabledNonProcessAssumptions.map(assumption => {
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

                {/* Combined Process narrative */}
                {combinedProcessNarrative && (
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            Process
                          </Badge>
                          {enabledProcessAssumptions.map(a => {
                            const def = SIMPLE_ASSUMPTIONS.find(d => d.id === a.assumptionId);
                            return def ? (
                              <Badge key={a.assumptionId} variant="secondary" className="text-xs">
                                {def.label}
                              </Badge>
                            ) : null;
                          })}
                          {state.processNarrativeOverride && (
                            <Badge variant="secondary" className="text-xs">
                              Edited
                            </Badge>
                          )}
                        </div>
                        
                        {editingNarrative === 'process' ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              className="min-h-[60px] text-sm"
                            />
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={saveProcessNarrative}
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
                                onClick={regenerateProcessNarrative}
                                className="h-7 ml-auto"
                              >
                                <Sparkles className="h-3 w-3 mr-1" />
                                Regenerate
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-foreground">{combinedProcessNarrative}</p>
                        )}
                      </div>
                      
                      {editingNarrative !== 'process' && combinedProcessNarrative && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => startEditingNarrative('process', combinedProcessNarrative)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Document narratives */}
                {(state.documentNarratives || []).map((narrative, index) => {
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
  
  // Get non-process assumption narratives
  const nonProcessNarratives = state.simpleAssumptions
    .filter(a => {
      if (!a.enabled || !a.narrative) return false;
      const def = SIMPLE_ASSUMPTIONS.find(d => d.id === a.assumptionId);
      return def?.category !== 'process';
    })
    .map(a => a.narrative);
  
  // Get process narrative (override or generated)
  const enabledProcessAssumptions = state.simpleAssumptions.filter(a => {
    if (!a.enabled) return false;
    const def = SIMPLE_ASSUMPTIONS.find(d => d.id === a.assumptionId);
    return def?.category === 'process';
  });
  
  const processNarrative = state.processNarrativeOverride ?? generateProcessNarrative(enabledProcessAssumptions);
  
  const docNarratives = state.documentNarratives || [];
  
  // Include enabled custom assumptions
  const customNarratives = (state.customAssumptions || [])
    .filter(a => a.enabled && a.text)
    .map(a => a.text);
  
  const allNarratives = [...nonProcessNarratives];
  if (processNarrative) {
    allNarratives.push(processNarrative);
  }
  allNarratives.push(...docNarratives, ...customNarratives);
  
  return allNarratives;
}
