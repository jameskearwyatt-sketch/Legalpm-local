# Memory: features/pricing-proposal/category-breakdown-interactions
Updated: now

Category breakdown tiles (per-phase only, not aggregate totals) support interactive navigation and fee adjustments:

**Navigation**: Clicking a category tile scrolls to and automatically expands the corresponding phase/category section in the detailed work items list.

**Category Fee Editing**: A pencil icon on each category tile allows users to set a target fee for that category; the difference is distributed pro-rata across all included work items in that category using the 'Largest Remainder Method' to ensure exact totals.

**Phase Subtotal Editing**: A pencil icon on the phase subtotal tile allows users to adjust the entire phase total. Distribution uses a two-tier approach: first pro-rata across categories (by their current totals), then within each category across its work items. This preserves the relative category weights while achieving the exact target.

**Aggregate Row**: The 'Aggregate Total' section is visual only—no navigation or editing is available. Users must edit individual phases.

**Smart Rounding**: All adjustments follow smart rounding rules: nearest 1,000 for amounts ≥10,000, and nearest 100 for smaller amounts.
