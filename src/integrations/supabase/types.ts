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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bank_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          fingerprint: string
          id: string
          memo: string
          txn_date: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          fingerprint: string
          id?: string
          memo?: string
          txn_date?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          fingerprint?: string
          id?: string
          memo?: string
          txn_date?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          annual_extra_rate: number | null
          archived_at: string | null
          billing_type: string
          bookkeeping_fee: number
          contact_person: string | null
          created_at: string
          created_by: string | null
          customer_code: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          settlement_fee: number
          staff_code: string | null
          stationery_fee: number
          suspended_period: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          annual_extra_rate?: number | null
          archived_at?: string | null
          billing_type?: string
          bookkeeping_fee?: number
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          settlement_fee?: number
          staff_code?: string | null
          stationery_fee?: number
          suspended_period?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          annual_extra_rate?: number | null
          archived_at?: string | null
          billing_type?: string
          bookkeeping_fee?: number
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          settlement_fee?: number
          staff_code?: string | null
          stationery_fee?: number
          suspended_period?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      factory_customers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          customer_code: string | null
          email: string | null
          id: string
          last_change_year: number | null
          name: string
          notes: string | null
          phone: string | null
          responsible_person: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          email?: string | null
          id?: string
          last_change_year?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          responsible_person?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          email?: string | null
          id?: string
          last_change_year?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          responsible_person?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      factory_registrations: {
        Row: {
          application_item: string | null
          approved_date: string | null
          ar_notes: string | null
          branch_name: string | null
          bureau_filed_date: string | null
          company: string
          company_name: string | null
          contact: string | null
          created_at: string
          created_by: string | null
          deposit_invoice_amount: number
          deposit_received_amount: number
          deposit_received_date: string | null
          discount: number
          env_approved_date: string | null
          env_filed_date: string | null
          env_mode: string
          extra_fees: Json
          factory_address: string | null
          factory_name: string
          final_invoice_amount: number
          final_received_amount: number
          final_received_date: string | null
          government_fee: number
          id: string
          inspection_date: string | null
          invoice_type: string
          notes: string | null
          other_fee: number
          po_number: string | null
          quote_amount: number
          quote_terms: Json
          stage: string
          status_note: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          application_item?: string | null
          approved_date?: string | null
          ar_notes?: string | null
          branch_name?: string | null
          bureau_filed_date?: string | null
          company?: string
          company_name?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          deposit_invoice_amount?: number
          deposit_received_amount?: number
          deposit_received_date?: string | null
          discount?: number
          env_approved_date?: string | null
          env_filed_date?: string | null
          env_mode?: string
          extra_fees?: Json
          factory_address?: string | null
          factory_name: string
          final_invoice_amount?: number
          final_received_amount?: number
          final_received_date?: string | null
          government_fee?: number
          id?: string
          inspection_date?: string | null
          invoice_type?: string
          notes?: string | null
          other_fee?: number
          po_number?: string | null
          quote_amount?: number
          quote_terms?: Json
          stage?: string
          status_note?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          application_item?: string | null
          approved_date?: string | null
          ar_notes?: string | null
          branch_name?: string | null
          bureau_filed_date?: string | null
          company?: string
          company_name?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          deposit_invoice_amount?: number
          deposit_received_amount?: number
          deposit_received_date?: string | null
          discount?: number
          env_approved_date?: string | null
          env_filed_date?: string | null
          env_mode?: string
          extra_fees?: Json
          factory_address?: string | null
          factory_name?: string
          final_invoice_amount?: number
          final_received_amount?: number
          final_received_date?: string | null
          government_fee?: number
          id?: string
          inspection_date?: string | null
          invoice_type?: string
          notes?: string | null
          other_fee?: number
          po_number?: string | null
          quote_amount?: number
          quote_terms?: Json
          stage?: string
          status_note?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fee_labels: {
        Row: {
          hidden: boolean
          key: string
          label: string
          position: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          hidden?: boolean
          key: string
          label: string
          position?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          hidden?: boolean
          key?: string
          label?: string
          position?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      filings: {
        Row: {
          advance_fee: number
          approved_date: string | null
          case_type: string
          change_detail: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          customer_code: string | null
          customer_id: string | null
          extra_fees: Json
          filed_date: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          route: string
          service_fee: number
          special_approved_date: string | null
          special_authority: string | null
          special_filed_date: string | null
          stage: string
          stamp_fee: number
          suspended_period: string | null
          tax_approved_date: string | null
          tax_filed_date: string | null
          updated_at: string
        }
        Insert: {
          advance_fee?: number
          approved_date?: string | null
          case_type: string
          change_detail?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          customer_id?: string | null
          extra_fees?: Json
          filed_date?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          route?: string
          service_fee?: number
          special_approved_date?: string | null
          special_authority?: string | null
          special_filed_date?: string | null
          stage?: string
          stamp_fee?: number
          suspended_period?: string | null
          tax_approved_date?: string | null
          tax_filed_date?: string | null
          updated_at?: string
        }
        Update: {
          advance_fee?: number
          approved_date?: string | null
          case_type?: string
          change_detail?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          customer_id?: string | null
          extra_fees?: Json
          filed_date?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          route?: string
          service_fee?: number
          special_approved_date?: string | null
          special_authority?: string | null
          special_filed_date?: string | null
          stage?: string
          stamp_fee?: number
          suspended_period?: string | null
          tax_approved_date?: string | null
          tax_filed_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filings_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          auditor: string | null
          auditor_paid: boolean
          auditor_paid_date: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          due_date: string | null
          id: string
          invoice_no: string
          issue_date: string
          item_years: Json
          items: Json
          notes: string | null
          period_label: string | null
          period_month: number | null
          period_year: number | null
          updated_at: string
          vat_input: number | null
          vat_output: number | null
          vat_prior_credit: number | null
        }
        Insert: {
          amount: number
          auditor?: string | null
          auditor_paid?: boolean
          auditor_paid_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_no?: string
          issue_date?: string
          item_years?: Json
          items?: Json
          notes?: string | null
          period_label?: string | null
          period_month?: number | null
          period_year?: number | null
          updated_at?: string
          vat_input?: number | null
          vat_output?: number | null
          vat_prior_credit?: number | null
        }
        Update: {
          amount?: number
          auditor?: string | null
          auditor_paid?: boolean
          auditor_paid_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_no?: string
          issue_date?: string
          item_years?: Json
          items?: Json
          notes?: string | null
          period_label?: string | null
          period_month?: number | null
          period_year?: number | null
          updated_at?: string
          vat_input?: number | null
          vat_output?: number | null
          vat_prior_credit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_fee: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          paid_date: string
          posted_date: string | null
        }
        Insert: {
          amount: number
          bank_fee?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          paid_date?: string
          posted_date?: string | null
        }
        Update: {
          amount?: number
          bank_fee?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          paid_date?: string
          posted_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          staff_code: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          staff_code?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          staff_code?: string | null
        }
        Relationships: []
      }
      tax_filings: {
        Row: {
          id: string
          invoice_id: string
          item: string
          paid: boolean
          paid_date: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          invoice_id: string
          item: string
          paid?: boolean
          paid_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          invoice_id?: string
          item?: string
          paid?: boolean
          paid_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_filings_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_cancelled_customer: {
        Args: { _customer_id: string }
        Returns: undefined
      }
      bookkeeper_bonus_data: { Args: never; Returns: Json }
      can_see_customer: { Args: { _customer_id: string }; Returns: boolean }
      can_use_factory_customers: { Args: { _uid: string }; Returns: boolean }
      close_filing: { Args: { _filing_id: string }; Returns: undefined }
      customer_bonus_rates: {
        Args: { _customer_id?: string }
        Returns: {
          annual_extra_rate: number
          customer_id: string
        }[]
      }
      extend_suspended_period: { Args: { _p: string }; Returns: string }
      filing_customer_directory: {
        Args: never
        Returns: {
          customer_code: string
          id: string
          name: string
          tax_id: string
        }[]
      }
      filing_customer_names: {
        Args: never
        Returns: {
          customer_code: string
          customer_id: string
          name: string
        }[]
      }
      filing_directory_code: { Args: { _customer_id: string }; Returns: string }
      filing_service_fees: {
        Args: never
        Returns: {
          filing_id: string
          service_fee: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_mn: { Args: { _uid: string }; Returns: boolean }
      is_filing_closer: { Args: { _uid: string }; Returns: boolean }
      is_member: { Args: { _user_id: string }; Returns: boolean }
      set_factory_quote_terms: {
        Args: { _id: string; _terms: Json }
        Returns: undefined
      }
      set_filing_customer_code: {
        Args: { _code: string; _customer_id: string }
        Returns: undefined
      }
      set_filing_service_fee: {
        Args: { _fee: number; _filing_id: string }
        Returns: undefined
      }
      set_staff_code: {
        Args: { _code: string; _user_id: string }
        Returns: undefined
      }
      update_factory_progress: {
        Args: {
          _approved_date: string
          _bureau_filed_date: string
          _env_approved_date: string
          _env_filed_date: string
          _id: string
          _inspection_date: string
          _stage: string
          _status_note: string
        }
        Returns: undefined
      }
      visible_bonus_rate: { Args: { _customer_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "member"],
    },
  },
} as const
