export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      budget_amendments: {
        Row: {
          amendment_date: string
          created_at: string
          id: string
          matter_id: string
          new_bm_fee: number
          new_budget: number
          new_local_counsel: number
          notes: string | null
          previous_bm_fee: number
          previous_budget: number
          previous_local_counsel: number
          user_id: string
        }
        Insert: {
          amendment_date?: string
          created_at?: string
          id?: string
          matter_id: string
          new_bm_fee?: number
          new_budget?: number
          new_local_counsel?: number
          notes?: string | null
          previous_bm_fee?: number
          previous_budget?: number
          previous_local_counsel?: number
          user_id: string
        }
        Update: {
          amendment_date?: string
          created_at?: string
          id?: string
          matter_id?: string
          new_bm_fee?: number
          new_budget?: number
          new_local_counsel?: number
          notes?: string | null
          previous_bm_fee?: number
          previous_budget?: number
          previous_local_counsel?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_amendments_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_drafts: {
        Row: {
          bm_total: number
          created_at: string
          id: string
          line_items: Json
          local_counsel_total: number
          matter_id: string
          name: string
          notes: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bm_total?: number
          created_at?: string
          id?: string
          line_items?: Json
          local_counsel_total?: number
          matter_id: string
          name?: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bm_total?: number
          created_at?: string
          id?: string
          line_items?: Json
          local_counsel_total?: number
          matter_id?: string
          name?: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_drafts_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_line_items: {
        Row: {
          budget_version_id: string
          category: string | null
          created_at: string
          fee_amount: number
          id: string
          is_included: boolean
          is_optional: boolean
          lc_country: string | null
          lc_currency: string | null
          lc_firm_name: string | null
          lc_library_id: string | null
          matter_id: string
          provider: string
          sort_order: number
          updated_at: string
          user_id: string
          wip_amount: number
          wip_updated_at: string | null
          wip_write_off: number
          work_item: string
        }
        Insert: {
          budget_version_id: string
          category?: string | null
          created_at?: string
          fee_amount?: number
          id?: string
          is_included?: boolean
          is_optional?: boolean
          lc_country?: string | null
          lc_currency?: string | null
          lc_firm_name?: string | null
          lc_library_id?: string | null
          matter_id: string
          provider: string
          sort_order?: number
          updated_at?: string
          user_id: string
          wip_amount?: number
          wip_updated_at?: string | null
          wip_write_off?: number
          work_item: string
        }
        Update: {
          budget_version_id?: string
          category?: string | null
          created_at?: string
          fee_amount?: number
          id?: string
          is_included?: boolean
          is_optional?: boolean
          lc_country?: string | null
          lc_currency?: string | null
          lc_firm_name?: string | null
          lc_library_id?: string | null
          matter_id?: string
          provider?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          wip_amount?: number
          wip_updated_at?: string | null
          wip_write_off?: number
          work_item?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_line_items_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_versions: {
        Row: {
          bm_total: number
          created_at: string
          finalized_at: string
          id: string
          local_counsel_total: number
          matter_id: string
          notes: string | null
          total_amount: number
          user_id: string
          version_number: number
        }
        Insert: {
          bm_total?: number
          created_at?: string
          finalized_at?: string
          id?: string
          local_counsel_total?: number
          matter_id: string
          notes?: string | null
          total_amount?: number
          user_id: string
          version_number?: number
        }
        Update: {
          bm_total?: number
          created_at?: string
          finalized_at?: string
          id?: string
          local_counsel_total?: number
          matter_id?: string
          notes?: string | null
          total_amount?: number
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          billing_contact: string | null
          created_at: string
          display_name: string | null
          group_sector: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_contact?: string | null
          created_at?: string
          display_name?: string | null
          group_sector?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_contact?: string | null
          created_at?: string
          display_name?: string | null
          group_sector?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_import_formats: {
        Row: {
          column_mappings: Json
          created_at: string
          format_name: string
          header_signature: string | null
          id: string
          sample_headers: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          column_mappings?: Json
          created_at?: string
          format_name: string
          header_signature?: string | null
          id?: string
          sample_headers?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          column_mappings?: Json
          created_at?: string
          format_name?: string
          header_signature?: string | null
          id?: string
          sample_headers?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      detailed_wip_update_items: {
        Row: {
          budget_line_item_id: string
          category: string | null
          created_at: string
          fee_amount: number
          id: string
          lc_firm_name: string | null
          provider: string
          wip_amount: number
          wip_update_id: string
          work_item: string
          write_off_amount: number
        }
        Insert: {
          budget_line_item_id: string
          category?: string | null
          created_at?: string
          fee_amount?: number
          id?: string
          lc_firm_name?: string | null
          provider: string
          wip_amount?: number
          wip_update_id: string
          work_item: string
          write_off_amount?: number
        }
        Update: {
          budget_line_item_id?: string
          category?: string | null
          created_at?: string
          fee_amount?: number
          id?: string
          lc_firm_name?: string | null
          provider?: string
          wip_amount?: number
          wip_update_id?: string
          work_item?: string
          write_off_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "detailed_wip_update_items_wip_update_id_fkey"
            columns: ["wip_update_id"]
            isOneToOne: false
            referencedRelation: "detailed_wip_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      detailed_wip_updates: {
        Row: {
          created_at: string
          id: string
          matter_id: string
          total_wip_amount: number
          total_write_off_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          matter_id: string
          total_wip_amount?: number
          total_write_off_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          matter_id?: string
          total_wip_amount?: number
          total_write_off_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detailed_wip_updates_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      distribution_campaigns: {
        Row: {
          created_at: string
          id: string
          name: string
          saved_filters: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          saved_filters?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          saved_filters?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      distribution_contact_history: {
        Row: {
          change_source: string
          changed_at: string
          contact_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          change_source?: string
          changed_at?: string
          contact_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          change_source?: string
          changed_at?: string
          contact_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_contact_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "distribution_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_contacts: {
        Row: {
          city: string | null
          classification_reason: string | null
          classified_at: string | null
          company: string | null
          company_keywords: string[] | null
          country: string | null
          created_at: string
          do_not_contact: boolean
          email: string
          email_company_mismatch: boolean
          email_mismatch_dismissed: boolean
          email_status: string | null
          emi_focus_areas: string[]
          emi_focus_areas_assigned_at: string | null
          emi_focus_areas_manual_edit: boolean
          full_name: string
          gender: Database["public"]["Enums"]["contact_gender"]
          id: string
          is_consultant: boolean | null
          is_law_firm: boolean | null
          job_title: string | null
          last_enriched_at: string | null
          linkedin_url: string | null
          naics_codes: string[] | null
          notes: string | null
          provenance: string | null
          relationship_owner: string | null
          sectors: string[]
          sectors_ai_assigned: boolean
          sic_codes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          classification_reason?: string | null
          classified_at?: string | null
          company?: string | null
          company_keywords?: string[] | null
          country?: string | null
          created_at?: string
          do_not_contact?: boolean
          email: string
          email_company_mismatch?: boolean
          email_mismatch_dismissed?: boolean
          email_status?: string | null
          emi_focus_areas?: string[]
          emi_focus_areas_assigned_at?: string | null
          emi_focus_areas_manual_edit?: boolean
          full_name: string
          gender?: Database["public"]["Enums"]["contact_gender"]
          id?: string
          is_consultant?: boolean | null
          is_law_firm?: boolean | null
          job_title?: string | null
          last_enriched_at?: string | null
          linkedin_url?: string | null
          naics_codes?: string[] | null
          notes?: string | null
          provenance?: string | null
          relationship_owner?: string | null
          sectors?: string[]
          sectors_ai_assigned?: boolean
          sic_codes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          classification_reason?: string | null
          classified_at?: string | null
          company?: string | null
          company_keywords?: string[] | null
          country?: string | null
          created_at?: string
          do_not_contact?: boolean
          email?: string
          email_company_mismatch?: boolean
          email_mismatch_dismissed?: boolean
          email_status?: string | null
          emi_focus_areas?: string[]
          emi_focus_areas_assigned_at?: string | null
          emi_focus_areas_manual_edit?: boolean
          full_name?: string
          gender?: Database["public"]["Enums"]["contact_gender"]
          id?: string
          is_consultant?: boolean | null
          is_law_firm?: boolean | null
          job_title?: string | null
          last_enriched_at?: string | null
          linkedin_url?: string | null
          naics_codes?: string[] | null
          notes?: string | null
          provenance?: string | null
          relationship_owner?: string | null
          sectors?: string[]
          sectors_ai_assigned?: boolean
          sic_codes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      distribution_email_drafts: {
        Row: {
          body: string
          campaign_id: string | null
          created_at: string
          delivery_mode: Database["public"]["Enums"]["email_delivery_mode"]
          draft_type: Database["public"]["Enums"]["email_draft_type"]
          id: string
          recipient_count: number
          recipient_emails: string[]
          subject: string
          user_id: string
        }
        Insert: {
          body: string
          campaign_id?: string | null
          created_at?: string
          delivery_mode: Database["public"]["Enums"]["email_delivery_mode"]
          draft_type: Database["public"]["Enums"]["email_draft_type"]
          id?: string
          recipient_count?: number
          recipient_emails?: string[]
          subject: string
          user_id: string
        }
        Update: {
          body?: string
          campaign_id?: string | null
          created_at?: string
          delivery_mode?: Database["public"]["Enums"]["email_delivery_mode"]
          draft_type?: Database["public"]["Enums"]["email_draft_type"]
          id?: string
          recipient_count?: number
          recipient_emails?: string[]
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_email_drafts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "distribution_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_relationship_owners: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      distribution_sectors: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      financial_snapshot_history: {
        Row: {
          accounts_receivable: number
          archived_at: string
          as_of_date: string
          billed_amount: number
          id: string
          matter_id: string
          notes: string | null
          operation: string
          paid_amount: number
          snapshot_id: string
          update_source: string | null
          user_id: string
          wip_amount: number
          wip_write_off_amount: number
        }
        Insert: {
          accounts_receivable?: number
          archived_at?: string
          as_of_date: string
          billed_amount?: number
          id?: string
          matter_id: string
          notes?: string | null
          operation: string
          paid_amount?: number
          snapshot_id: string
          update_source?: string | null
          user_id: string
          wip_amount?: number
          wip_write_off_amount?: number
        }
        Update: {
          accounts_receivable?: number
          archived_at?: string
          as_of_date?: string
          billed_amount?: number
          id?: string
          matter_id?: string
          notes?: string | null
          operation?: string
          paid_amount?: number
          snapshot_id?: string
          update_source?: string | null
          user_id?: string
          wip_amount?: number
          wip_write_off_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_snapshot_history_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_snapshots: {
        Row: {
          accounts_receivable: number
          as_of_date: string
          billed_amount: number
          created_at: string
          id: string
          matter_id: string
          notes: string | null
          paid_amount: number
          update_source: string | null
          updated_at: string
          user_id: string
          wip_amount: number
          wip_write_off_amount: number
        }
        Insert: {
          accounts_receivable?: number
          as_of_date: string
          billed_amount?: number
          created_at?: string
          id?: string
          matter_id: string
          notes?: string | null
          paid_amount?: number
          update_source?: string | null
          updated_at?: string
          user_id: string
          wip_amount?: number
          wip_write_off_amount?: number
        }
        Update: {
          accounts_receivable?: number
          as_of_date?: string
          billed_amount?: number
          created_at?: string
          id?: string
          matter_id?: string
          notes?: string | null
          paid_amount?: number
          update_source?: string | null
          updated_at?: string
          user_id?: string
          wip_amount?: number
          wip_write_off_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_snapshots_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_project_documents: {
        Row: {
          ai_summary: string | null
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          project_id: string
          summary_generated_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          project_id: string
          summary_generated_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          project_id?: string
          summary_generated_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "growth_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_project_entries: {
        Row: {
          content: string | null
          created_at: string
          entry_type: string
          file_name: string | null
          file_url: string | null
          id: string
          project_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          entry_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          project_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          entry_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          project_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_project_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "growth_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_projects: {
        Row: {
          ai_summary: string | null
          created_at: string
          description: string | null
          id: string
          is_starred: boolean
          mentee_name: string | null
          name: string
          project_type: Database["public"]["Enums"]["growth_project_type"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_starred?: boolean
          mentee_name?: string | null
          name: string
          project_type: Database["public"]["Enums"]["growth_project_type"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_starred?: boolean
          mentee_name?: string | null
          name?: string
          project_type?: Database["public"]["Enums"]["growth_project_type"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      growth_tasks: {
        Row: {
          assignee: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          deadline_set_at: string | null
          deadline_type: Database["public"]["Enums"]["task_deadline_type"]
          description: string | null
          effort: Database["public"]["Enums"]["task_effort"]
          id: string
          importance: Database["public"]["Enums"]["task_importance"]
          is_completed: boolean
          must_do_today: boolean
          on_slate: boolean
          pinned_to_tasklist: boolean
          project_id: string
          slate_sort_order: number
          sort_order: number
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["task_urgency"]
          user_id: string
        }
        Insert: {
          assignee?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          deadline_set_at?: string | null
          deadline_type?: Database["public"]["Enums"]["task_deadline_type"]
          description?: string | null
          effort?: Database["public"]["Enums"]["task_effort"]
          id?: string
          importance?: Database["public"]["Enums"]["task_importance"]
          is_completed?: boolean
          must_do_today?: boolean
          on_slate?: boolean
          pinned_to_tasklist?: boolean
          project_id: string
          slate_sort_order?: number
          sort_order?: number
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["task_urgency"]
          user_id: string
        }
        Update: {
          assignee?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          deadline_set_at?: string | null
          deadline_type?: Database["public"]["Enums"]["task_deadline_type"]
          description?: string | null
          effort?: Database["public"]["Enums"]["task_effort"]
          id?: string
          importance?: Database["public"]["Enums"]["task_importance"]
          is_completed?: boolean
          must_do_today?: boolean
          on_slate?: boolean
          pinned_to_tasklist?: boolean
          project_id?: string
          slate_sort_order?: number
          sort_order?: number
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["task_urgency"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "growth_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billed_amount: number
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          matter_id: string
          notes: string | null
          paid_amount: number
          paid_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          billed_amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          matter_id: string
          notes?: string | null
          paid_amount?: number
          paid_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          billed_amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          matter_id?: string
          notes?: string | null
          paid_amount?: number
          paid_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      known_assignees: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      lc_disbursement_allocations: {
        Row: {
          allocated_to_lc: boolean
          allocations: Json | null
          created_at: string
          disbursement_type: string
          id: string
          import_date: string
          matter_id: string
          original_amount: number
          user_id: string
        }
        Insert: {
          allocated_to_lc?: boolean
          allocations?: Json | null
          created_at?: string
          disbursement_type: string
          id?: string
          import_date?: string
          matter_id: string
          original_amount?: number
          user_id: string
        }
        Update: {
          allocated_to_lc?: boolean
          allocations?: Json | null
          created_at?: string
          disbursement_type?: string
          id?: string
          import_date?: string
          matter_id?: string
          original_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lc_disbursement_allocations_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      lc_work_item_quotes: {
        Row: {
          created_at: string
          fee_amount: number
          fee_lower: number
          fee_upper: number
          id: string
          lc_library_id: string
          proposal_id: string
          updated_at: string
          user_id: string
          work_item_key: string
        }
        Insert: {
          created_at?: string
          fee_amount?: number
          fee_lower?: number
          fee_upper?: number
          id?: string
          lc_library_id: string
          proposal_id: string
          updated_at?: string
          user_id: string
          work_item_key: string
        }
        Update: {
          created_at?: string
          fee_amount?: number
          fee_lower?: number
          fee_upper?: number
          id?: string
          lc_library_id?: string
          proposal_id?: string
          updated_at?: string
          user_id?: string
          work_item_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "lc_work_item_quotes_lc_library_id_fkey"
            columns: ["lc_library_id"]
            isOneToOne: false
            referencedRelation: "local_counsel_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lc_work_item_quotes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "pricing_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      local_counsel_library: {
        Row: {
          country: string
          created_at: string
          currency: string
          firm_name: string
          id: string
          rate_card: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          country: string
          created_at?: string
          currency?: string
          firm_name: string
          id?: string
          rate_card?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string
          firm_name?: string
          id?: string
          rate_card?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      master_lc_changes: {
        Row: {
          before_billed_amount: number | null
          before_wip_amount: number | null
          created_at: string
          id: string
          local_counsel_id: string
          matter_id: string
          wip_update_id: string
        }
        Insert: {
          before_billed_amount?: number | null
          before_wip_amount?: number | null
          created_at?: string
          id?: string
          local_counsel_id: string
          matter_id: string
          wip_update_id: string
        }
        Update: {
          before_billed_amount?: number | null
          before_wip_amount?: number | null
          created_at?: string
          id?: string
          local_counsel_id?: string
          matter_id?: string
          wip_update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_lc_changes_local_counsel_id_fkey"
            columns: ["local_counsel_id"]
            isOneToOne: false
            referencedRelation: "matter_local_counsels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lc_changes_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lc_changes_wip_update_id_fkey"
            columns: ["wip_update_id"]
            isOneToOne: false
            referencedRelation: "detailed_wip_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      master_wip_snapshot_changes: {
        Row: {
          before_accounts_receivable: number | null
          before_billed_amount: number | null
          before_paid_amount: number | null
          before_wip_amount: number | null
          before_wip_write_off_amount: number | null
          created_at: string
          id: string
          matter_id: string
          snapshot_id: string | null
          was_new_snapshot: boolean
          wip_update_id: string
        }
        Insert: {
          before_accounts_receivable?: number | null
          before_billed_amount?: number | null
          before_paid_amount?: number | null
          before_wip_amount?: number | null
          before_wip_write_off_amount?: number | null
          created_at?: string
          id?: string
          matter_id: string
          snapshot_id?: string | null
          was_new_snapshot?: boolean
          wip_update_id: string
        }
        Update: {
          before_accounts_receivable?: number | null
          before_billed_amount?: number | null
          before_paid_amount?: number | null
          before_wip_amount?: number | null
          before_wip_write_off_amount?: number | null
          created_at?: string
          id?: string
          matter_id?: string
          snapshot_id?: string | null
          was_new_snapshot?: boolean
          wip_update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_wip_snapshot_changes_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_wip_snapshot_changes_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "financial_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_wip_snapshot_changes_wip_update_id_fkey"
            columns: ["wip_update_id"]
            isOneToOne: false
            referencedRelation: "detailed_wip_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_assumptions: {
        Row: {
          assumption_text: string
          created_at: string
          id: string
          is_exceeded: boolean
          is_standard: boolean
          label: string
          matter_id: string
          source_document: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assumption_text: string
          created_at?: string
          id?: string
          is_exceeded?: boolean
          is_standard?: boolean
          label: string
          matter_id: string
          source_document?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assumption_text?: string
          created_at?: string
          id?: string
          is_exceeded?: boolean
          is_standard?: boolean
          label?: string
          matter_id?: string
          source_document?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matter_assumptions_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_bills: {
        Row: {
          amount: number
          created_at: string
          id: string
          matter_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          matter_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          matter_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matter_bills_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_clients: {
        Row: {
          client_id: string
          cm_number: string | null
          created_at: string
          fee_percentage: number
          id: string
          is_master: boolean
          matter_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          cm_number?: string | null
          created_at?: string
          fee_percentage?: number
          id?: string
          is_master?: boolean
          matter_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          cm_number?: string | null
          created_at?: string
          fee_percentage?: number
          id?: string
          is_master?: boolean
          matter_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matter_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_clients_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_local_counsels: {
        Row: {
          allocated_budget: number
          billed_amount: number
          billed_updated_at: string | null
          billing_mode: string | null
          created_at: string
          firm_name: string
          id: string
          last_updated: string | null
          matter_id: string
          update_source: string | null
          updated_at: string
          user_id: string
          wip_amount: number
          wip_updated_at: string | null
        }
        Insert: {
          allocated_budget?: number
          billed_amount?: number
          billed_updated_at?: string | null
          billing_mode?: string | null
          created_at?: string
          firm_name: string
          id?: string
          last_updated?: string | null
          matter_id: string
          update_source?: string | null
          updated_at?: string
          user_id: string
          wip_amount?: number
          wip_updated_at?: string | null
        }
        Update: {
          allocated_budget?: number
          billed_amount?: number
          billed_updated_at?: string | null
          billing_mode?: string | null
          created_at?: string
          firm_name?: string
          id?: string
          last_updated?: string | null
          matter_id?: string
          update_source?: string | null
          updated_at?: string
          user_id?: string
          wip_amount?: number
          wip_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matter_local_counsels_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      matters: {
        Row: {
          agreed_billing_amount: number
          agreed_budget_amount: number
          aml_kyc_complete: boolean
          assignment_letter_signed: boolean
          billing_currency: string | null
          billing_terms: string | null
          bm_fee_component: number
          budget_notes: string | null
          budget_type: Database["public"]["Enums"]["budget_type"]
          category: Database["public"]["Enums"]["matter_category"]
          clarifications_date: string | null
          client_id: string
          cm_number: string | null
          conflicts_check: boolean
          created_at: string
          currency: string
          current_stage: Database["public"]["Enums"]["matter_stage"] | null
          deal_currency: string | null
          deal_value: number | null
          decision_date: string | null
          different_billing_currency: boolean
          exchange_rate: number
          fee_amount_upper_end: number
          fee_currency: string
          fee_earner_mix_notes: string | null
          fee_type: Database["public"]["Enums"]["fee_type"] | null
          id: string
          is_multi_client: boolean
          jurisdictions: string[] | null
          lc_billed: number
          lc_last_updated: string | null
          lc_wip: number
          lead_partner: string | null
          local_counsel_billing: string | null
          local_counsel_fee: number
          manual_budget_amount: number
          matter_display_name: string | null
          matter_managing_attorney: string | null
          matter_name: string
          matter_number: string
          matter_open: boolean
          on_hold_months: number
          opportunity_receipt_date: string | null
          originator: string | null
          pay_full_time_costs: boolean
          pipeline_outcome:
            | Database["public"]["Enums"]["pipeline_outcome"]
            | null
          practice_area: string | null
          pricing_model: string | null
          progress: number
          quote_currency: string | null
          rate_modifier: string | null
          rate_modifier_scope: string | null
          rate_modifier_value: number | null
          show_shaping_proposal: boolean
          source: Database["public"]["Enums"]["matter_source"] | null
          start_date: string | null
          status: Database["public"]["Enums"]["matter_status"]
          submission_deadline: string | null
          submitted: boolean
          target_close_date: string | null
          updated_at: string
          use_manual_budget: boolean
          user_id: string
        }
        Insert: {
          agreed_billing_amount?: number
          agreed_budget_amount?: number
          aml_kyc_complete?: boolean
          assignment_letter_signed?: boolean
          billing_currency?: string | null
          billing_terms?: string | null
          bm_fee_component?: number
          budget_notes?: string | null
          budget_type?: Database["public"]["Enums"]["budget_type"]
          category?: Database["public"]["Enums"]["matter_category"]
          clarifications_date?: string | null
          client_id: string
          cm_number?: string | null
          conflicts_check?: boolean
          created_at?: string
          currency?: string
          current_stage?: Database["public"]["Enums"]["matter_stage"] | null
          deal_currency?: string | null
          deal_value?: number | null
          decision_date?: string | null
          different_billing_currency?: boolean
          exchange_rate?: number
          fee_amount_upper_end?: number
          fee_currency?: string
          fee_earner_mix_notes?: string | null
          fee_type?: Database["public"]["Enums"]["fee_type"] | null
          id?: string
          is_multi_client?: boolean
          jurisdictions?: string[] | null
          lc_billed?: number
          lc_last_updated?: string | null
          lc_wip?: number
          lead_partner?: string | null
          local_counsel_billing?: string | null
          local_counsel_fee?: number
          manual_budget_amount?: number
          matter_display_name?: string | null
          matter_managing_attorney?: string | null
          matter_name: string
          matter_number: string
          matter_open?: boolean
          on_hold_months?: number
          opportunity_receipt_date?: string | null
          originator?: string | null
          pay_full_time_costs?: boolean
          pipeline_outcome?:
            | Database["public"]["Enums"]["pipeline_outcome"]
            | null
          practice_area?: string | null
          pricing_model?: string | null
          progress?: number
          quote_currency?: string | null
          rate_modifier?: string | null
          rate_modifier_scope?: string | null
          rate_modifier_value?: number | null
          show_shaping_proposal?: boolean
          source?: Database["public"]["Enums"]["matter_source"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["matter_status"]
          submission_deadline?: string | null
          submitted?: boolean
          target_close_date?: string | null
          updated_at?: string
          use_manual_budget?: boolean
          user_id: string
        }
        Update: {
          agreed_billing_amount?: number
          agreed_budget_amount?: number
          aml_kyc_complete?: boolean
          assignment_letter_signed?: boolean
          billing_currency?: string | null
          billing_terms?: string | null
          bm_fee_component?: number
          budget_notes?: string | null
          budget_type?: Database["public"]["Enums"]["budget_type"]
          category?: Database["public"]["Enums"]["matter_category"]
          clarifications_date?: string | null
          client_id?: string
          cm_number?: string | null
          conflicts_check?: boolean
          created_at?: string
          currency?: string
          current_stage?: Database["public"]["Enums"]["matter_stage"] | null
          deal_currency?: string | null
          deal_value?: number | null
          decision_date?: string | null
          different_billing_currency?: boolean
          exchange_rate?: number
          fee_amount_upper_end?: number
          fee_currency?: string
          fee_earner_mix_notes?: string | null
          fee_type?: Database["public"]["Enums"]["fee_type"] | null
          id?: string
          is_multi_client?: boolean
          jurisdictions?: string[] | null
          lc_billed?: number
          lc_last_updated?: string | null
          lc_wip?: number
          lead_partner?: string | null
          local_counsel_billing?: string | null
          local_counsel_fee?: number
          manual_budget_amount?: number
          matter_display_name?: string | null
          matter_managing_attorney?: string | null
          matter_name?: string
          matter_number?: string
          matter_open?: boolean
          on_hold_months?: number
          opportunity_receipt_date?: string | null
          originator?: string | null
          pay_full_time_costs?: boolean
          pipeline_outcome?:
            | Database["public"]["Enums"]["pipeline_outcome"]
            | null
          practice_area?: string | null
          pricing_model?: string | null
          progress?: number
          quote_currency?: string | null
          rate_modifier?: string | null
          rate_modifier_scope?: string | null
          rate_modifier_value?: number | null
          show_shaping_proposal?: boolean
          source?: Database["public"]["Enums"]["matter_source"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["matter_status"]
          submission_deadline?: string | null
          submitted?: boolean
          target_close_date?: string | null
          updated_at?: string
          use_manual_budget?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matters_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          allocated_invoice_id: string | null
          amount: number
          created_at: string
          id: string
          matter_id: string
          payment_date: string
          reference: string | null
          user_id: string
        }
        Insert: {
          allocated_invoice_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          matter_id: string
          payment_date: string
          reference?: string | null
          user_id: string
        }
        Update: {
          allocated_invoice_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          matter_id?: string
          payment_date?: string
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_allocated_invoice_id_fkey"
            columns: ["allocated_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_proposal_afas: {
        Row: {
          afa_type: string
          client_narrative: string | null
          client_price: number | null
          config: Json | null
          created_at: string
          effective_rate: number | null
          id: string
          is_enabled: boolean | null
          is_selected_for_export: boolean | null
          margin_impact_percent: number | null
          proposal_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          afa_type: string
          client_narrative?: string | null
          client_price?: number | null
          config?: Json | null
          created_at?: string
          effective_rate?: number | null
          id?: string
          is_enabled?: boolean | null
          is_selected_for_export?: boolean | null
          margin_impact_percent?: number | null
          proposal_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          afa_type?: string
          client_narrative?: string | null
          client_price?: number | null
          config?: Json | null
          created_at?: string
          effective_rate?: number | null
          id?: string
          is_enabled?: boolean | null
          is_selected_for_export?: boolean | null
          margin_impact_percent?: number | null
          proposal_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_proposal_afas_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "pricing_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_proposal_items: {
        Row: {
          ai_rationale: string | null
          associate_hours: number
          category: string | null
          created_at: string
          fee_amount: number
          fee_lower: number
          fee_upper: number
          id: string
          is_included: boolean
          is_optional: boolean
          item_type: string
          lc_country: string | null
          lc_currency: string | null
          lc_firm_name: string | null
          lc_library_id: string | null
          num_turns: number
          partner_hours: number
          pricing_method: string
          proposal_id: string
          provider: string
          sort_order: number
          updated_at: string
          user_id: string
          version_id: string
          work_item: string
        }
        Insert: {
          ai_rationale?: string | null
          associate_hours?: number
          category?: string | null
          created_at?: string
          fee_amount?: number
          fee_lower?: number
          fee_upper?: number
          id?: string
          is_included?: boolean
          is_optional?: boolean
          item_type?: string
          lc_country?: string | null
          lc_currency?: string | null
          lc_firm_name?: string | null
          lc_library_id?: string | null
          num_turns?: number
          partner_hours?: number
          pricing_method?: string
          proposal_id: string
          provider?: string
          sort_order?: number
          updated_at?: string
          user_id: string
          version_id: string
          work_item: string
        }
        Update: {
          ai_rationale?: string | null
          associate_hours?: number
          category?: string | null
          created_at?: string
          fee_amount?: number
          fee_lower?: number
          fee_upper?: number
          id?: string
          is_included?: boolean
          is_optional?: boolean
          item_type?: string
          lc_country?: string | null
          lc_currency?: string | null
          lc_firm_name?: string | null
          lc_library_id?: string | null
          num_turns?: number
          partner_hours?: number
          pricing_method?: string
          proposal_id?: string
          provider?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          version_id?: string
          work_item?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "pricing_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_proposal_items_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "pricing_proposal_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_proposal_versions: {
        Row: {
          bm_total: number
          created_at: string
          id: string
          local_counsel_total: number
          notes: string | null
          proposal_id: string
          total_amount: number
          user_id: string
          version_number: number
        }
        Insert: {
          bm_total?: number
          created_at?: string
          id?: string
          local_counsel_total?: number
          notes?: string | null
          proposal_id: string
          total_amount?: number
          user_id: string
          version_number: number
        }
        Update: {
          bm_total?: number
          created_at?: string
          id?: string
          local_counsel_total?: number
          notes?: string | null
          proposal_id?: string
          total_amount?: number
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "pricing_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_proposals: {
        Row: {
          assumptions: Json | null
          client_id: string
          created_at: string
          currency: string
          current_version: number
          description: string | null
          id: string
          linked_matter_id: string | null
          name: string
          rate_card: Json | null
          scope_assumptions: Json | null
          status: string
          team_rate_currency: string | null
          updated_at: string
          user_id: string
          work_phases: Json | null
        }
        Insert: {
          assumptions?: Json | null
          client_id: string
          created_at?: string
          currency?: string
          current_version?: number
          description?: string | null
          id?: string
          linked_matter_id?: string | null
          name: string
          rate_card?: Json | null
          scope_assumptions?: Json | null
          status?: string
          team_rate_currency?: string | null
          updated_at?: string
          user_id: string
          work_phases?: Json | null
        }
        Update: {
          assumptions?: Json | null
          client_id?: string
          created_at?: string
          currency?: string
          current_version?: number
          description?: string | null
          id?: string
          linked_matter_id?: string | null
          name?: string
          rate_card?: Json | null
          scope_assumptions?: Json | null
          status?: string
          team_rate_currency?: string | null
          updated_at?: string
          user_id?: string
          work_phases?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_proposals_linked_matter_id_fkey"
            columns: ["linked_matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quick_tasks: {
        Row: {
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          effort: Database["public"]["Enums"]["task_effort"]
          id: string
          importance: Database["public"]["Enums"]["task_importance"]
          is_completed: boolean
          is_urgent: boolean
          must_do_today: boolean
          on_slate: boolean
          slate_sort_order: number
          title: string
          urgency: Database["public"]["Enums"]["task_urgency"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          effort?: Database["public"]["Enums"]["task_effort"]
          id?: string
          importance?: Database["public"]["Enums"]["task_importance"]
          is_completed?: boolean
          is_urgent?: boolean
          must_do_today?: boolean
          on_slate?: boolean
          slate_sort_order?: number
          title: string
          urgency?: Database["public"]["Enums"]["task_urgency"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          effort?: Database["public"]["Enums"]["task_effort"]
          id?: string
          importance?: Database["public"]["Enums"]["task_importance"]
          is_completed?: boolean
          is_urgent?: boolean
          must_do_today?: boolean
          on_slate?: boolean
          slate_sort_order?: number
          title?: string
          urgency?: Database["public"]["Enums"]["task_urgency"]
          user_id?: string
        }
        Relationships: []
      }
      report_matter_mappings: {
        Row: {
          created_at: string
          id: string
          imported_client_name: string | null
          imported_matter_name: string | null
          imported_matter_number: string | null
          mapped_matter_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          imported_client_name?: string | null
          imported_matter_name?: string | null
          imported_matter_number?: string | null
          mapped_matter_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          imported_client_name?: string | null
          imported_matter_name?: string | null
          imported_matter_number?: string | null
          mapped_matter_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_matter_mappings_mapped_matter_id_fkey"
            columns: ["mapped_matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      slate_items: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          is_personal: boolean
          must_do_today: boolean
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          is_personal?: boolean
          must_do_today?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          is_personal?: boolean
          must_do_today?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_recording_drafts: {
        Row: {
          created_at: string
          date_range_from: string | null
          date_range_to: string | null
          grid_entries: Json
          id: string
          is_polished: boolean
          mode: string
          name: string
          processed_output: Json | null
          selected_dates: Json | null
          single_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_range_from?: string | null
          date_range_to?: string | null
          grid_entries?: Json
          id?: string
          is_polished?: boolean
          mode: string
          name: string
          processed_output?: Json | null
          selected_dates?: Json | null
          single_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_range_from?: string | null
          date_range_to?: string | null
          grid_entries?: Json
          id?: string
          is_polished?: boolean
          mode?: string
          name?: string
          processed_output?: Json | null
          selected_dates?: Json | null
          single_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_report_formats: {
        Row: {
          column_mappings: Json
          created_at: string
          format_name: string
          header_signature: string | null
          id: string
          sample_headers: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          column_mappings?: Json
          created_at?: string
          format_name: string
          header_signature?: string | null
          id?: string
          sample_headers?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          column_mappings?: Json
          created_at?: string
          format_name?: string
          header_signature?: string | null
          id?: string
          sample_headers?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          default_currency: string
          default_rate_card: Json | null
          id: string
          near_budget_threshold: number
          poor_collection_threshold: number
          updated_at: string
          use_billed_only_for_burn: boolean
          user_id: string
          wip_warning_threshold: number
        }
        Insert: {
          created_at?: string
          default_currency?: string
          default_rate_card?: Json | null
          id?: string
          near_budget_threshold?: number
          poor_collection_threshold?: number
          updated_at?: string
          use_billed_only_for_burn?: boolean
          user_id: string
          wip_warning_threshold?: number
        }
        Update: {
          created_at?: string
          default_currency?: string
          default_rate_card?: Json | null
          id?: string
          near_budget_threshold?: number
          poor_collection_threshold?: number
          updated_at?: string
          use_billed_only_for_burn?: boolean
          user_id?: string
          wip_warning_threshold?: number
        }
        Relationships: []
      }
      wip_proposal_local_counsels: {
        Row: {
          billed_write_off_amount: number
          created_at: string
          firm_name: string
          id: string
          local_counsel_id: string
          proposal_id: string
          proposed_billed_amount: number
          proposed_wip_amount: number
          raw_billed_amount: number
          raw_wip_amount: number
          updated_at: string
          wip_write_off_amount: number
        }
        Insert: {
          billed_write_off_amount?: number
          created_at?: string
          firm_name: string
          id?: string
          local_counsel_id: string
          proposal_id: string
          proposed_billed_amount?: number
          proposed_wip_amount?: number
          raw_billed_amount?: number
          raw_wip_amount?: number
          updated_at?: string
          wip_write_off_amount?: number
        }
        Update: {
          billed_write_off_amount?: number
          created_at?: string
          firm_name?: string
          id?: string
          local_counsel_id?: string
          proposal_id?: string
          proposed_billed_amount?: number
          proposed_wip_amount?: number
          raw_billed_amount?: number
          raw_wip_amount?: number
          updated_at?: string
          wip_write_off_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "wip_proposal_local_counsels_local_counsel_id_fkey"
            columns: ["local_counsel_id"]
            isOneToOne: false
            referencedRelation: "matter_local_counsels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wip_proposal_local_counsels_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "wip_shaping_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      wip_shaping_proposals: {
        Row: {
          accounts_receivable: number
          ar_write_off_amount: number
          billed_amount: number
          created_at: string
          id: string
          is_selected: boolean
          lc_billed_amount: number
          lc_wip_amount: number
          matter_id: string
          notes: string
          paid_amount: number
          proposal_date: string
          status: string
          updated_at: string
          user_id: string
          wip_amount: number
          wip_write_off_amount: number
        }
        Insert: {
          accounts_receivable?: number
          ar_write_off_amount?: number
          billed_amount?: number
          created_at?: string
          id?: string
          is_selected?: boolean
          lc_billed_amount?: number
          lc_wip_amount?: number
          matter_id: string
          notes: string
          paid_amount?: number
          proposal_date?: string
          status?: string
          updated_at?: string
          user_id: string
          wip_amount?: number
          wip_write_off_amount?: number
        }
        Update: {
          accounts_receivable?: number
          ar_write_off_amount?: number
          billed_amount?: number
          created_at?: string
          id?: string
          is_selected?: boolean
          lc_billed_amount?: number
          lc_wip_amount?: number
          matter_id?: string
          notes?: string
          paid_amount?: number
          proposal_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          wip_amount?: number
          wip_write_off_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "wip_shaping_proposals_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      budget_type: "Fixed" | "Cap" | "Estimate" | "Retainer" | "Hourly"
      contact_gender: "male" | "female" | "unknown"
      email_delivery_mode: "bcc_all" | "individual"
      email_draft_type: "event_invitation" | "article_sharing" | "firm_update"
      fee_type:
        | "Discounted Rates with Cap"
        | "Discounted Rates with Estimate"
        | "Discounted Rates with Partial Cap"
        | "Rack Rates with Cap"
        | "Rack Rates with Estimate"
      growth_project_type:
        | "business_development"
        | "professional_development"
        | "learning_development"
      invoice_status: "Draft" | "Sent" | "Part Paid" | "Paid" | "Overdue"
      matter_category: "Live" | "Pipeline" | "Closed" | "Lost"
      matter_source: "RfP" | "Direct from Client" | "Internal Referral"
      matter_stage:
        | "Pre-Start"
        | "Term Sheet"
        | "Documentation - Start"
        | "Documentation - Close"
        | "Paused"
        | "Closed"
        | "Won"
        | "Pending"
        | "Closing Process"
        | "Lost"
      matter_status: "Open" | "On Hold" | "Closed"
      pipeline_outcome: "Won" | "Lost" | "Pending"
      task_deadline_type:
        | "this_week"
        | "next_week"
        | "this_month"
        | "next_month"
        | "in_3_months"
        | "in_6_months"
        | "no_deadline"
      task_effort: "quick_win" | "deep_work" | "unset"
      task_importance: "important" | "not_important" | "unset"
      task_urgency: "urgent" | "not_urgent" | "unset"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      budget_type: ["Fixed", "Cap", "Estimate", "Retainer", "Hourly"],
      contact_gender: ["male", "female", "unknown"],
      email_delivery_mode: ["bcc_all", "individual"],
      email_draft_type: ["event_invitation", "article_sharing", "firm_update"],
      fee_type: [
        "Discounted Rates with Cap",
        "Discounted Rates with Estimate",
        "Discounted Rates with Partial Cap",
        "Rack Rates with Cap",
        "Rack Rates with Estimate",
      ],
      growth_project_type: [
        "business_development",
        "professional_development",
        "learning_development",
      ],
      invoice_status: ["Draft", "Sent", "Part Paid", "Paid", "Overdue"],
      matter_category: ["Live", "Pipeline", "Closed", "Lost"],
      matter_source: ["RfP", "Direct from Client", "Internal Referral"],
      matter_stage: [
        "Pre-Start",
        "Term Sheet",
        "Documentation - Start",
        "Documentation - Close",
        "Paused",
        "Closed",
        "Won",
        "Pending",
        "Closing Process",
        "Lost",
      ],
      matter_status: ["Open", "On Hold", "Closed"],
      pipeline_outcome: ["Won", "Lost", "Pending"],
      task_deadline_type: [
        "this_week",
        "next_week",
        "this_month",
        "next_month",
        "in_3_months",
        "in_6_months",
        "no_deadline",
      ],
      task_effort: ["quick_win", "deep_work", "unset"],
      task_importance: ["important", "not_important", "unset"],
      task_urgency: ["urgent", "not_urgent", "unset"],
    },
  },
} as const
