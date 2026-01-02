-- Add category column to budget_line_items for work item categorization
ALTER TABLE public.budget_line_items 
ADD COLUMN category text;

-- Add index for efficient grouping by category
CREATE INDEX idx_budget_line_items_category ON public.budget_line_items(category);

-- Add a comment to document the expected values
COMMENT ON COLUMN public.budget_line_items.category IS 'Work item category: Due Diligence, Documentation, Meetings, Closing, Negotiations, Regulatory, Other';