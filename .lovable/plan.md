

## Plan: Export Market Commentary to Word Document

### Overview
Add category multi-select checkboxes to all five Precedent Bank tabs (PPA, Tolling, Carbon, IT Supply, Cloud Compute) with an "Export Market Commentary" button. When clicked, the system calls the existing `whats-market` edge function for each selected category sequentially, then assembles the results into a professional Word document (.docx) that auto-downloads.

### Technical Approach

**1. Shared Export Component: `ExportMarketCommentaryButton.tsx`**
A reusable component that all five precedent banks can use. It receives:
- `selectedCategories: string[]` — which categories are checked
- `groupedPrecedents: Record<string, Precedent[]>` — the precedent data per category
- `context: string` — analyst type (ppa, tolling, carbon, it_supply, cloud_compute)
- `analystTitle: string` — for the document header (e.g., "PPA Analyst")

When clicked, it:
1. Shows a loading dialog with progress (e.g., "Analyzing 3 of 7 categories...")
2. Calls `whats-market` edge function sequentially for each selected category
3. Uses the existing `WhatsMarketResult` interface (balanced/buyerFriendly/sellerFriendly/keyInsights/confidenceNote)
4. Assembles results into a .docx using the existing `exceljs` pattern — but since we need Word, we'll generate a clean HTML blob and use `html-to-image` is wrong here. Instead, we'll create a well-structured HTML document and download it as `.doc` (which Word opens natively), or better, use a lightweight approach: generate a Blob with proper Word-compatible HTML/XML.

**Word Generation Strategy**: Use the "HTML-in-.doc" technique — create a properly formatted HTML string with professional styling (headers, tables, colored sections) and save it as a `.doc` file. Microsoft Word opens HTML `.doc` files natively with full formatting. This avoids adding a heavy docx library.

**2. Category Selection State in Each Precedent Bank**
Add `selectedForExport: string[]` state to each of the five PrecedentBank components. Each category header row gets a checkbox. When categories are selected, the "Export Market Commentary" button appears (sticky at the bottom or in the toolbar area).

**3. Changes per file:**

| File | Change |
|------|--------|
| `src/components/shared/ExportMarketCommentaryButton.tsx` | **New** — Shared button + progress dialog + Word generation logic |
| `src/components/ppa-analyst/PPAPrecedentBank.tsx` | Add `selectedForExport` state, checkboxes on category headers, render export button |
| `src/components/tolling-analyst/TollingPrecedentBank.tsx` | Same pattern |
| `src/components/carbon-analyst/CarbonPrecedentBank.tsx` | Same pattern |
| `src/components/it-supply-analyst/ITSupplyPrecedentBank.tsx` | Same pattern |
| `src/components/cloud-compute-analyst/CloudComputePrecedentBank.tsx` | Same pattern |

**4. Document Structure**
```text
┌─────────────────────────────────────┐
│  MARKET COMMENTARY                  │
│  [Analyst Type] — [Date]            │
│  Based on X deals / Y positions     │
├─────────────────────────────────────┤
│                                     │
│  1. [Category Name]                 │
│  ─────────────────                  │
│  Based on N precedents              │
│                                     │
│  BALANCED MARKET STANDARD           │
│  Summary text...                    │
│  • Bullet point 1                   │
│  • Bullet point 2                   │
│                                     │
│  BUYER-FRIENDLY POSITION            │
│  Summary text...                    │
│  • Bullet point 1                   │
│                                     │
│  SELLER-FRIENDLY POSITION           │
│  Summary text...                    │
│  • Bullet point 1                   │
│                                     │
│  KEY INSIGHTS                       │
│  💡 Insight 1                       │
│  💡 Insight 2                       │
│                                     │
│  Confidence: [note]                 │
│                                     │
│  ═══════════════════════════════════ │
│  2. [Next Category]                 │
│  ...                                │
└─────────────────────────────────────┘
```

**5. Build Error Fix**
Also fix the pre-existing `NodeJS` namespace errors by adding `/// <reference types="node" />` or replacing `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` in the affected files.

### UI Flow
1. User navigates to any Precedent Bank tab
2. Each category group header now shows a checkbox on the left
3. User checks desired categories
4. A floating action bar appears: "Export Market Commentary for N categories" button
5. Click triggers sequential AI analysis with progress indicator
6. On completion, a `.doc` file auto-downloads
7. User opens in Word — professional formatting ready to share

