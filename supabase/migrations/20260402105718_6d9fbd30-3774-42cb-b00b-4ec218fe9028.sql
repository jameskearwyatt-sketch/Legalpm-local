UPDATE pricing_proposal_items AS v3
SET phase_id = v2.phase_id
FROM pricing_proposal_items AS v2
WHERE v3.version_id = '7e2d967f-e9ec-4baf-a7b7-47214d8d7b22'
  AND v2.version_id = '43c95e68-9966-4123-9e9e-5e7995a24510'
  AND v3.work_item = v2.work_item
  AND v2.phase_id IS NOT NULL
  AND v2.phase_id != ''
  AND (v3.phase_id IS NULL OR v3.phase_id = '');