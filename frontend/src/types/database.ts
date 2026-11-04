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
      billing_records: {
        Row: {
          charge_type: string | null
          cost: number
          created_at: string
          currency: string
          id: string
          import_batch_id: string
          provider: string
          region: string | null
          resource_id: string | null
          resource_name: string | null
          resource_type: string | null
          service_name: string
          source_row_hash: string
          usage_end: string | null
          usage_quantity: number | null
          usage_start: string
          usage_unit: string | null
          user_id: string
        }
        Insert: {
          charge_type?: string | null
          cost: number
          created_at?: string
          currency: string
          id?: string
          import_batch_id: string
          provider: string
          region?: string | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type?: string | null
          service_name: string
          source_row_hash: string
          usage_end?: string | null
          usage_quantity?: number | null
          usage_start: string
          usage_unit?: string | null
          user_id: string
        }
        Update: {
          charge_type?: string | null
          cost?: number
          created_at?: string
          currency?: string
          id?: string
          import_batch_id?: string
          provider?: string
          region?: string | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type?: string | null
          service_name?: string
          source_row_hash?: string
          usage_end?: string | null
          usage_quantity?: number | null
          usage_start?: string
          usage_unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_records_import_batch_id_user_id_fkey"
            columns: ["import_batch_id", "user_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      cloud_profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          provider: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          provider: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      cost_anomalies: {
        Row: {
          baseline_average: number
          created_at: string
          currency: string
          current_cost: number
          id: string
          increase_pct: number
          period: string
          provider: string
          severity: string
          user_id: string
        }
        Insert: {
          baseline_average: number
          created_at?: string
          currency: string
          current_cost: number
          id?: string
          increase_pct: number
          period: string
          provider: string
          severity: string
          user_id: string
        }
        Update: {
          baseline_average?: number
          created_at?: string
          currency?: string
          current_cost?: number
          id?: string
          increase_pct?: number
          period?: string
          provider?: string
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          cloud_profile_id: string
          created_at: string
          data_type: string
          duplicate_rows: number
          id: string
          invalid_rows: number
          original_filename: string
          status: string
          total_rows: number
          user_id: string
          valid_rows: number
        }
        Insert: {
          cloud_profile_id: string
          created_at?: string
          data_type: string
          duplicate_rows?: number
          id?: string
          invalid_rows?: number
          original_filename: string
          status?: string
          total_rows?: number
          user_id: string
          valid_rows?: number
        }
        Update: {
          cloud_profile_id?: string
          created_at?: string
          data_type?: string
          duplicate_rows?: number
          id?: string
          invalid_rows?: number
          original_filename?: string
          status?: string
          total_rows?: number
          user_id?: string
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_cloud_profile_id_user_id_fkey"
            columns: ["cloud_profile_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cloud_profiles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      optimization_recommendations: {
        Row: {
          category: string
          created_at: string
          currency: string | null
          estimated_monthly_savings: number | null
          evidence: Json
          explanation: string
          id: string
          import_batch_id: string | null
          provider: string
          resource_id: string | null
          reviewed_at: string | null
          severity: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string | null
          estimated_monthly_savings?: number | null
          evidence?: Json
          explanation: string
          id?: string
          import_batch_id?: string | null
          provider: string
          resource_id?: string | null
          reviewed_at?: string | null
          severity: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string | null
          estimated_monthly_savings?: number | null
          evidence?: Json
          explanation?: string
          id?: string
          import_batch_id?: string | null
          provider?: string
          resource_id?: string | null
          reviewed_at?: string | null
          severity?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_recommendations_import_batch_user_fkey"
            columns: ["import_batch_id", "user_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      pricing_catalogue: {
        Row: {
          compute_hourly_cost: number
          created_at: string
          currency: string
          id: string
          import_batch_id: string
          instance_type: string
          memory_gb: number
          pricing_date: string
          provider: string
          region: string
          source_row_hash: string
          storage_gb_month_cost: number
          user_id: string
          vcpu: number
        }
        Insert: {
          compute_hourly_cost: number
          created_at?: string
          currency: string
          id?: string
          import_batch_id: string
          instance_type: string
          memory_gb: number
          pricing_date: string
          provider: string
          region: string
          source_row_hash: string
          storage_gb_month_cost: number
          user_id: string
          vcpu: number
        }
        Update: {
          compute_hourly_cost?: number
          created_at?: string
          currency?: string
          id?: string
          import_batch_id?: string
          instance_type?: string
          memory_gb?: number
          pricing_date?: string
          provider?: string
          region?: string
          source_row_hash?: string
          storage_gb_month_cost?: number
          user_id?: string
          vcpu?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_catalogue_import_batch_id_user_id_fkey"
            columns: ["import_batch_id", "user_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      resource_metrics: {
        Row: {
          active_hours: number | null
          cpu_utilization_pct: number | null
          created_at: string
          id: string
          import_batch_id: string
          memory_utilization_pct: number | null
          observed_at: string
          observed_hours: number | null
          provider: string
          resource_id: string
          user_id: string
        }
        Insert: {
          active_hours?: number | null
          cpu_utilization_pct?: number | null
          created_at?: string
          id?: string
          import_batch_id: string
          memory_utilization_pct?: number | null
          observed_at: string
          observed_hours?: number | null
          provider: string
          resource_id: string
          user_id: string
        }
        Update: {
          active_hours?: number | null
          cpu_utilization_pct?: number | null
          created_at?: string
          id?: string
          import_batch_id?: string
          memory_utilization_pct?: number | null
          observed_at?: string
          observed_hours?: number | null
          provider?: string
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_metrics_import_batch_id_user_id_fkey"
            columns: ["import_batch_id", "user_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
