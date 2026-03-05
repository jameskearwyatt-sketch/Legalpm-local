

# Labelled Levels + Drag-to-Reorder Between Levels in Pyramid

## What changes

### 1. Expand from 4 tiers to 5 levels
Currently the pyramid groups members into 4 tiers (Partners, Counsel/Sr. Associates, Associates, Juniors). Change to 5 discrete levels matching the Teams & Rates dropdown exactly:
- **Partner** (indigo)
- **Counsel** (violet)
- **Senior Associate** (purple)
- **Associate** (sky)
- **Trainee** (emerald)

Each level gets its own labelled row in the pyramid, with a visible label on the left side.

### 2. Drag fee earners between levels
Users can click and drag a member block vertically from one level row to another. This reassigns the member's "modelling level" for cost-thinking purposes without changing their actual job title.

- Members keep the **colour of their original/home level** so the user always knows where they "really" belong. For example, an Associate (sky blue) dragged into the Trainee row stays sky blue.
- On drop, the component fires a new callback `onMemberLevelOverride(key, newLevel)` which stores the override in assumptions state (similar to `summaryKeyPlayers`).

### 3. Visual design
- Each level row has a left-side label (e.g. "Partner", "Counsel") in the tier's colour.
- Empty levels show a dashed placeholder row (as today).
- Dragged member gets a shadow/elevation effect during drag. A drop-zone highlight appears on the target level row.
- The member block's background colour always reflects their **home** level, not the level they've been dragged to.

## Technical approach

### `SummaryPyramid.tsx`
- Update `TierKey` type to 5 values: `"partner" | "counsel" | "seniorAssociate" | "associate" | "trainee"`.
- Update `TIER_COLORS` with 5 entries (split current "senior" into counsel + seniorAssociate).
- Update `classifyTier` to map to 5 levels.
- Update `buildTiers` to produce 5 rows.
- Add a new prop `levelOverrides?: Record<string, string>` — maps member key to overridden level.
- Add a new prop `onMemberLevelOverride?: (key: string, newLevel: string) => void`.
- When building tiers, place members according to their `levelOverrides[m.key] || m.level`.
- Track a `homeTier` on each member (from their actual level) and use that for colour, even when they're in a different level row.
- Implement vertical drag using native HTML drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) on member blocks and tier rows. This is simpler than integrating dnd-kit for this use case.
- Each tier row acts as a drop zone with visual feedback (border highlight on `dragOver`).

### `PricingProposalDetail.tsx`
- Add `summaryLevelOverrides: Record<string, string>` to assumptions state (persisted same as `summaryKeyPlayers`).
- Pass `levelOverrides` and `onMemberLevelOverride` to `SummaryPyramid`.
- The override callback updates assumptions state.

### `DraggableMemberBlock`
- Accept a `homeTierKey` prop (original level colour) separate from the `tierKey` prop (current display row).
- Always render with `TIER_COLORS[homeTierKey]` for the block's background/border/text styling.

## Files to edit
- `src/components/pricing/SummaryPyramid.tsx` — expand to 5 levels, add labels, implement drag-between-levels, add homeTier colouring.
- `src/pages/PricingProposalDetail.tsx` — add `summaryLevelOverrides` state and pass new props to SummaryPyramid.

