

# Add Two New Standard Assumptions to the General Package

## What
Add two new standard assumptions to `SIMPLE_ASSUMPTIONS` in `src/components/pricing/ScopeAssumptionsTab.tsx`, derived from the KSA-BESS JV custom assumptions, polished for general use:

1. **Legal Annexes (bonds, PCGs, etc.)** — category: `scope`, placed near `excludes_ancillary_contracts`
2. **Excludes RFP Documents** — category: `scope`, placed near `scope_limited_to_rfp`

## New Entries

```typescript
{
  id: 'includes_legal_annexes_review',
  label: 'Review of legal annexes',
  description: 'Covers review and assistance with bonds, guarantees and similar legal annexes',
  category: 'scope',
  sectionType: 'general',
  requiresInput: false,
  narrativeTemplate: () =>
    'Our scope includes the review of and assistance with legal annexes to the transaction documents, including performance bonds, parent company guarantees, and similar security instruments.',
},
{
  id: 'excludes_rfp_documents',
  label: 'Excludes RFP documents',
  description: 'Drafting or reviewing RFP/tender documents is excluded',
  category: 'scope',
  sectionType: 'general',
  requiresInput: false,
  narrativeTemplate: () =>
    'The drafting, review, or negotiation of any request for proposal (RFP) or tender documents is excluded from this scope of work.',
},
```

## Placement
Both will be inserted into the existing `SIMPLE_ASSUMPTIONS` array among the other general scope assumptions — the legal annexes entry after `excludes_ancillary_contracts`, and the RFP exclusion after `scope_limited_to_rfp`.

## File Changed
- `src/components/pricing/ScopeAssumptionsTab.tsx` — add two entries to the `SIMPLE_ASSUMPTIONS` array

