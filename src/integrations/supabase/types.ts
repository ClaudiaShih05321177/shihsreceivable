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
      customers: {
        Row: {
          address: string | null
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
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
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
      bookkeeper_bonus_data: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: { Args: { _user_id: string }; Returns: boolean }
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
