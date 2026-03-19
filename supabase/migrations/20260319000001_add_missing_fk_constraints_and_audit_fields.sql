-- Add missing user_id foreign key constraints to all tables
-- These tables have user_id UUID NOT NULL but no REFERENCES auth.users(id)

-- Budget & Financial
ALTER TABLE budget_amendments ADD CONSTRAINT budget_amendments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE budget_drafts ADD CONSTRAINT budget_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE budget_line_items ADD CONSTRAINT budget_line_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE budget_versions ADD CONSTRAINT budget_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE financial_snapshot_history ADD CONSTRAINT financial_snapshot_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Matter related
ALTER TABLE matter_assumptions ADD CONSTRAINT matter_assumptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE matter_bills ADD CONSTRAINT matter_bills_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE matter_clients ADD CONSTRAINT matter_clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE matter_local_counsels ADD CONSTRAINT matter_local_counsels_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- WIP
ALTER TABLE detailed_wip_updates ADD CONSTRAINT detailed_wip_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE wip_email_log ADD CONSTRAINT wip_email_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE wip_email_templates ADD CONSTRAINT wip_email_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE wip_shaping_proposals ADD CONSTRAINT wip_shaping_proposals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Pricing
ALTER TABLE pricing_proposals ADD CONSTRAINT pricing_proposals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE pricing_proposal_items ADD CONSTRAINT pricing_proposal_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE pricing_proposal_versions ADD CONSTRAINT pricing_proposal_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE pricing_proposal_afas ADD CONSTRAINT pricing_proposal_afas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Local Counsel
ALTER TABLE local_counsel_library ADD CONSTRAINT local_counsel_library_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE lc_work_item_quotes ADD CONSTRAINT lc_work_item_quotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE lc_disbursement_allocations ADD CONSTRAINT lc_disbursement_allocations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE unallocated_lc_disbursements ADD CONSTRAINT unallocated_lc_disbursements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Distribution / Contacts
ALTER TABLE distribution_contacts ADD CONSTRAINT distribution_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE distribution_campaigns ADD CONSTRAINT distribution_campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE distribution_email_drafts ADD CONSTRAINT distribution_email_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE distribution_activity_log ADD CONSTRAINT distribution_activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE distribution_contact_history ADD CONSTRAINT distribution_contact_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE distribution_relationship_owners ADD CONSTRAINT distribution_relationship_owners_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE distribution_sectors ADD CONSTRAINT distribution_sectors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE custom_distribution_lists ADD CONSTRAINT custom_distribution_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE custom_list_contacts ADD CONSTRAINT custom_list_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- BM Contacts
ALTER TABLE bm_contact_shortlists ADD CONSTRAINT bm_contact_shortlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE bm_internal_contacts ADD CONSTRAINT bm_internal_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE bm_shortlist_members ADD CONSTRAINT bm_shortlist_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Growth
ALTER TABLE growth_projects ADD CONSTRAINT growth_projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE growth_project_documents ADD CONSTRAINT growth_project_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE growth_project_entries ADD CONSTRAINT growth_project_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE growth_tasks ADD CONSTRAINT growth_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- PPA Analyst
ALTER TABLE ppa_analyses ADD CONSTRAINT ppa_analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ppa_extracted_positions ADD CONSTRAINT ppa_extracted_positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ppa_precedent_bank ADD CONSTRAINT ppa_precedent_bank_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ppa_ai_learnings ADD CONSTRAINT ppa_ai_learnings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tolling Analyst
ALTER TABLE tolling_analyses ADD CONSTRAINT tolling_analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tolling_extracted_positions ADD CONSTRAINT tolling_extracted_positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tolling_precedent_bank ADD CONSTRAINT tolling_precedent_bank_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tolling_learnings ADD CONSTRAINT tolling_learnings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Carbon Analyst
ALTER TABLE carbon_analyses ADD CONSTRAINT carbon_analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE carbon_extracted_positions ADD CONSTRAINT carbon_extracted_positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE carbon_precedent_bank ADD CONSTRAINT carbon_precedent_bank_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE carbon_learnings ADD CONSTRAINT carbon_learnings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- IT Supply Analyst
ALTER TABLE it_supply_analyses ADD CONSTRAINT it_supply_analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE it_supply_extracted_positions ADD CONSTRAINT it_supply_extracted_positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE it_supply_precedent_bank ADD CONSTRAINT it_supply_precedent_bank_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE it_supply_learnings ADD CONSTRAINT it_supply_learnings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Cloud Compute Analyst
ALTER TABLE cloud_compute_analyses ADD CONSTRAINT cloud_compute_analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE cloud_compute_extracted_positions ADD CONSTRAINT cloud_compute_extracted_positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE cloud_compute_precedent_bank ADD CONSTRAINT cloud_compute_precedent_bank_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE cloud_compute_learnings ADD CONSTRAINT cloud_compute_learnings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Misc
ALTER TABLE aggregation_decisions ADD CONSTRAINT aggregation_decisions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE known_assignees ADD CONSTRAINT known_assignees_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE quick_tasks ADD CONSTRAINT quick_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE report_matter_mappings ADD CONSTRAINT report_matter_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE slate_items ADD CONSTRAINT slate_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE time_recording_drafts ADD CONSTRAINT time_recording_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add unique constraint on financial_snapshots to prevent duplicate snapshots per matter per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_snapshots_matter_date_unique
  ON financial_snapshots (matter_id, as_of_date);

-- Add audit trail fields to key tables for legal compliance
-- These track WHO made changes, not just WHEN

ALTER TABLE matters ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE matters ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

ALTER TABLE financial_snapshots ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE financial_snapshots ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

ALTER TABLE budget_amendments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE budget_versions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE pricing_proposals ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE pricing_proposals ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

ALTER TABLE growth_projects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
