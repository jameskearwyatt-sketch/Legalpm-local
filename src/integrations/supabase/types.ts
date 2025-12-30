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
      matters: {
        Row: {
          agreed_budget_amount: number
          aml_kyc_complete: boolean
          assignment_letter_signed: boolean
          billing_terms: string | null
          budget_notes: string | null
          budget_type: Database["public"]["Enums"]["budget_type"]
          client_id: string
          created_at: string
          currency: string
          fee_earner_mix_notes: string | null
          id: string
          lead_partner: string | null
          matter_name: string
          matter_number: string
          matter_open: boolean
          practice_area: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["matter_status"]
          target_close_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agreed_budget_amount?: number
          aml_kyc_complete?: boolean
          assignment_letter_signed?: boolean
          billing_terms?: string | null
          budget_notes?: string | null
          budget_type?: Database["public"]["Enums"]["budget_type"]
          client_id: string
          created_at?: string
          currency?: string
          fee_earner_mix_notes?: string | null
          id?: string
          lead_partner?: string | null
          matter_name: string
          matter_number: string
          matter_open?: boolean
          practice_area?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["matter_status"]
          target_close_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agreed_budget_amount?: number
          aml_kyc_complete?: boolean
          assignment_letter_signed?: boolean
          billing_terms?: string | null
          budget_notes?: string | null
          budget_type?: Database["public"]["Enums"]["budget_type"]
          client_id?: string
          created_at?: string
          currency?: string
          fee_earner_mix_notes?: string | null
          id?: string
          lead_partner?: string | null
          matter_name?: string
          matter_number?: string
          matter_open?: boolean
          practice_area?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["matter_status"]
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
      invoice_status: "Draft" | "Sent" | "Part Paid" | "Paid" | "Overdue"
      matter_status: "Open" | "On Hold" | "Closed"
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
      invoice_status: ["Draft", "Sent", "Part Paid", "Paid", "Overdue"],
      matter_status: ["Open", "On Hold", "Closed"],
    },
  },
} as const
