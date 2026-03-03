# Memory: features/pricing-proposal/category-breakdown-interactions
Updated: now

Category breakdown tiles support interactive navigation and fee adjustments:

**Navigation**: Clicking a category tile scrolls to and automatically expands the corresponding phase/category section in the detailed work items list.

**Category Fee Editing**: A pencil icon on each category tile allows users to set a target fee for that category; the difference is distributed pro-rata across all included work items in that category using the 'Largest Remainder Method' to ensure exact totals. Zero-fee items are excluded from redistribution.

**Phase Subtotal Editing**: A pencil icon on the phase subtotal tile allows users to adjust the entire phase total. Distribution uses a two-tier approach: first pro-rata across categories (by their current totals), then within each category across its work items.

**Aggregate Category Tiles**: Pencil icon and lock toggle available on aggregate category tiles. Editing adjusts the category fee across ALL phases simultaneously. Locking/unlocking toggles the category lock in every phase at once (uses `aggregate:Category` key format).

**Aggregate Total**: Pencil icon on the aggregate total box allows adjusting the entire proposal total, distributing pro-rata across all phases and categories.

**Lock Override Prompt**: When editing a scope that contains locked items (phase subtotal, aggregate category, or aggregate total), an AlertDialog asks whether to include or skip locked items.

**Smart Rounding**: All adjustments follow smart rounding rules: nearest 1,000 for amounts ≥10,000, and nearest 100 for smaller amounts.
