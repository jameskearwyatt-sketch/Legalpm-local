# Bug: Raw WIP = Net WIP (Double-Counting Write-Off)

## Root Cause

There is a **mismatch** between what `MatterDetail.tsx` passes and what `FinancialSnapshotUpdateDialog.tsx` expects for `currentValues.wip_amount`.

**MatterDetail (line 1498)** passes `rawWipAmount` — which is already `net + writeOff`:

```
rawWipAmount = (latestSnapshot.wip_amount) + wipWriteOffAmount
```

**The dialog (lines 95-99)** assumes it receives NET WIP and adds write-off again:

```
const netWip = currentValues.wip_amount;        // Actually RAW, not net!
const rawWip = netWip + writeOff;               // Double-adds write-off!
```

### What happens each time the user opens and saves without changing anything:

1. Stored: `wip_amount = 100` (NET), `wip_write_off = 39`
2. MatterDetail passes `wip_amount: 139` (raw = 100 + 39)
3. Dialog thinks 139 is NET, displays Raw WIP as `139 + 39 = 178`
4. On save: `netWip = 178 - 39 = 139` → stored as new `wip_amount`
5. Next open: passes `139 + 39 = 178`, dialog shows `178 + 39 = 217`...

**Each save inflates `wip_amount` by the write-off amount.** The "195,259" figure is likely the result of this cumulative corruption over multiple saves.

## Fix

### 1. `src/pages/MatterDetail.tsx` — line 1498

Change `rawWipAmount` → `wipAmount` (which is NET, matching what the dialog expects):

```typescript
currentValues={{
  wip_amount: wipAmount,  // was: rawWipAmount (WRONG — dialog expects NET)
  wip_write_off_amount: wipWriteOffAmount,
  ...
}}
```

This is a one-line fix. The dialog's internal logic for computing raw from net is already correct — it just needs to receive NET as intended.

### 2. Fix corrupted data for "Bella"

After the code fix, the user will need to manually correct Bella's snapshot by opening "Update Snapshot" and entering the correct Raw WIP and Write-off values. Alternatively, I can query the snapshot history to find the original correct values and fix the data directly. Y Es the user would like you to query and fix data myself.

## Files to edit

- `src/pages/MatterDetail.tsx` — change line 1498 from `rawWipAmount` to `wipAmount`