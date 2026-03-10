

## Plan: "Allocate to Specific Local Counsel Later" Feature

### Problem
When the Master Financial Update wizard detects large disbursements as potential local counsel fees, the user must either allocate them to a specific local counsel immediately or mark them as "not LC fees." In practice, the user often knows it IS an LC fee but doesn't know which firm it belongs to — the associates manage the deals.

### Solution Overview
1. **Wizard: Add "Allocate Later" option** — A third button in the DisbursementReviewDialog's review step: "Yes, but allocate to specific firm later." This records the disbursement as an LC fee with no firm allocation, storing it as unallocated.

2. **Database: New `unallocated_lc_disbursements` table** — Stores WIP/AR/Paid disbursement amounts per matter that the user has confirmed are LC fees but hasn't yet assigned to a specific firm.

3. **Matter Detail: Allocation UI** — On the matter detail page, show a banner/card when unallocated LC disbursements exist, with a button to open an allocation dialog where the user can assign amounts to existing local counsels (or create a new one).

### Database Changes

New table:
```sql
CREATE TABLE public.unallocated_lc_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  wip_amount NUMERIC DEFAULT 0,
  ar_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'master_update',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  allocated_at TIMESTAMPTZ -- NULL until fully allocated
);

ALTER TABLE public.unallocated_lc_disbursements ENABLE ROW LEVEL SECURITY;
-- RLS: users can CRUD their own rows
```

### Code Changes

**1. `DisbursementReviewDialog.tsx`** — Add a third button on the review step: "Yes, allocate to firm later". When clicked, this calls `saveCurrentAndNext` with `isLocalCounselFee: true, allocations: [], allocateLater: true`. Update the `DisbursementReviewResult` interface to include `allocateLater?: boolean`.

**2. `Matters.tsx` (onApplyUpdates handler)** — When a result has `allocateLater: true`, insert a row into `unallocated_lc_disbursements` with the WIP/AR/Paid amounts instead of trying to update a specific local counsel.

**3. New hook: `useUnallocatedLcDisbursements.ts`** — Query/mutate the new table. Provides:
   - Fetch unallocated disbursements for a matter
   - Allocate (transfers amounts to a specific `matter_local_counsels` row, sets `allocated_at`)
   - Delete/edit unallocated entries

**4. New component: `UnallocatedLcBanner.tsx`** — Shown on Matter Detail page when unallocated LC disbursements exist. Displays total unallocated amount with an "Allocate Now" button.

**5. New component: `AllocateLcDialog.tsx`** — Modal where user:
   - Sees unallocated WIP/AR/Paid amounts
   - Selects from existing local counsels or creates a new one
   - Splits amounts across one or more firms
   - On confirm: updates `matter_local_counsels` WIP/billed amounts and marks the unallocated row as allocated

**6. `MatterDetail.tsx`** — Import the hook and banner. Display the banner in the financial section when unallocated disbursements exist.

### UI Flow

```text
Master Update Wizard → Disbursement Detected
  ├── "No, regular disbursement"        → skip
  ├── "Yes, this is LC fee"             → select firm → allocate (existing flow)
  └── "Yes, allocate to firm later" NEW → saved as unallocated
                                           ↓
                            Matter Detail page shows banner:
                            "£X in LC fees pending allocation"
                            [Allocate Now] button
                                           ↓
                            Dialog: pick firm(s), split amounts, confirm
```

