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
      budget_line_items: {
        Row: {
          budget_version_id: string
          category: string | null
          created_at: string
          fee_amount: number
          id: string
          is_included: boolean
          is_optional: boolean
          lc_firm_name: string | null
          matter_id: string
          provider: string
          sort_order: number
          updated_at: string
          user_id: string
          wip_amount: number
          wip_updated_at: string | null
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
          lc_firm_name?: string | null
          matter_id: string
          provider: string
          sort_order?: number
          updated_at?: string
          user_id: string
          wip_amount?: number
          wip_updated_at?: string | null
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
          lc_firm_name?: string | null
          matter_id?: string
          provider?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          wip_amount?: number
          wip_updated_at?: string | null
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
          group_sector: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_contact?: string | null
          created_at?: string
          group_sector?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_contact?: string | null
          created_at?: string
          group_sector?: string | null
          id?: string
          name?: string
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          matter_id: string
          total_wip_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          matter_id?: string
          total_wip_amount?: number
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
      financial_snapshots: {
        Row: {
          as_of_date: string
          billed_amount: number
          created_at: string
          id: string
          matter_id: string
          notes: string | null
          paid_amount: number
          updated_at: string
          user_id: string
          wip_amount: number
        }
        Insert: {
          as_of_date: string
          billed_amount?: number
          created_at?: string
          id?: string
          matter_id: string
          notes?: string | null
          paid_amount?: number
          updated_at?: string
          user_id: string
          wip_amount?: number
        }
        Update: {
          as_of_date?: string
          billed_amount?: number
          created_at?: string
          id?: string
          matter_id?: string
          notes?: string | null
          paid_amount?: number
          updated_at?: string
          user_id?: string
          wip_amount?: number
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
      matter_assumptions: {
        Row: {
          assumption_text: string
          created_at: string
          id: string
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
          created_at: string
          firm_name: string
          id: string
          last_updated: string | null
          matter_id: string
          updated_at: string
          user_id: string
          wip_amount: number
        }
        Insert: {
          allocated_budget?: number
          billed_amount?: number
          created_at?: string
          firm_name: string
          id?: string
          last_updated?: string | null
          matter_id: string
          updated_at?: string
          user_id: string
          wip_amount?: number
        }
        Update: {
          allocated_budget?: number
          billed_amount?: number
          created_at?: string
          firm_name?: string
          id?: string
          last_updated?: string | null
          matter_id?: string
          updated_at?: string
          user_id?: string
          wip_amount?: number
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
          lc_billed: number
          lc_last_updated: string | null
          lc_wip: number
          lead_partner: string | null
          local_counsel_billing: string | null
          local_counsel_fee: number
          matter_managing_attorney: string | null
          matter_name: string
          matter_number: string
          matter_open: boolean
          opportunity_receipt_date: string | null
          originator: string | null
          pipeline_outcome:
            | Database["public"]["Enums"]["pipeline_outcome"]
            | null
          practice_area: string | null
          quote_currency: string | null
          source: Database["public"]["Enums"]["matter_source"] | null
          start_date: string | null
          status: Database["public"]["Enums"]["matter_status"]
          submission_deadline: string | null
          submitted: boolean
          target_close_date: string | null
          updated_at: string
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
          lc_billed?: number
          lc_last_updated?: string | null
          lc_wip?: number
          lead_partner?: string | null
          local_counsel_billing?: string | null
          local_counsel_fee?: number
          matter_managing_attorney?: string | null
          matter_name: string
          matter_number: string
          matter_open?: boolean
          opportunity_receipt_date?: string | null
          originator?: string | null
          pipeline_outcome?:
            | Database["public"]["Enums"]["pipeline_outcome"]
            | null
          practice_area?: string | null
          quote_currency?: string | null
          source?: Database["public"]["Enums"]["matter_source"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["matter_status"]
          submission_deadline?: string | null
          submitted?: boolean
          target_close_date?: string | null
          updated_at?: string
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
          lc_billed?: number
          lc_last_updated?: string | null
          lc_wip?: number
          lead_partner?: string | null
          local_counsel_billing?: string | null
          local_counsel_fee?: number
          matter_managing_attorney?: string | null
          matter_name?: string
          matter_number?: string
          matter_open?: boolean
          opportunity_receipt_date?: string | null
          originator?: string | null
          pipeline_outcome?:
            | Database["public"]["Enums"]["pipeline_outcome"]
            | null
          practice_area?: string | null
          quote_currency?: string | null
          source?: Database["public"]["Enums"]["matter_source"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["matter_status"]
          submission_deadline?: string | null
          submitted?: boolean
          target_close_date?: string | null
          updated_at?: string
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
          lc_firm_name: string | null
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
          lc_firm_name?: string | null
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
          lc_firm_name?: string | null
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
          name: string
          rate_card: Json | null
          status: string
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
          name: string
          rate_card?: Json | null
          status?: string
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
          name?: string
          rate_card?: Json | null
          status?: string
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
      fee_type:
        | "Discounted Rates with Cap"
        | "Discounted Rates with Estimate"
        | "Discounted Rates with Partial Cap"
        | "Rack Rates with Cap"
        | "Rack Rates with Estimate"
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
      fee_type: [
        "Discounted Rates with Cap",
        "Discounted Rates with Estimate",
        "Discounted Rates with Partial Cap",
        "Rack Rates with Cap",
        "Rack Rates with Estimate",
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
    },
  },
} as const
