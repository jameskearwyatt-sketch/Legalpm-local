# Memory: features/pricing-proposal/team-summary-sync
Updated: now

The 'Team and Rates' tab is the absolute source of truth for pricing proposal team composition. Names and roles are user-defined, and the app does not auto-populate default roles; only active team members are included in the derived rate card to prevent deleted roles from reappearing. 

Hour allocation follows the **Budget Buffer Model**:
1. Target: The system targets the Upper Estimate pricing (bmUpperTarget).
2. Independent Editing: Changes to one member's hours do NOT redistribute other members' hours. Each member is edited independently.
3. Budget Cap: A member's hours are hard-capped at `(bmUpperTarget - othersRevenue) / memberRate`, rounded to nearest 0.5. The user cannot exceed the remaining budget — they must reduce another member's hours first.
4. Buffer Display: When total allocated revenue is below the target, a blue "Unallocated: $X remaining" banner appears. When fully allocated (within $100), a green "Fully allocated" banner shows.
5. No Locks: The lock/unlock mechanism has been removed. All members are always editable.
6. Budget Scaling: Changes to the aggregate budget (via Work Items) are ratably applied to ALL team members to maintain the target, enforcing a minimum of 0.5 hours.
7. New Members: Newly added team members are automatically assigned initial hours from the remaining unallocated budget.
8. UI: A range slider beneath each hour input allows for quick calibrations. The slider max reflects the member's actual max allowed hours (not a static value).
9. Persistence: The system derives the rate card and team list synchronously using 'useMemo' to prevent one-render lags.
