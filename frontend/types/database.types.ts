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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      airfoils: {
        Row: {
          camber_loc_pct: number | null
          camber_pct: number | null
          created_at: string | null
          description: string | null
          file_path: string
          id: string
          le_radius: number | null
          lower_surface_nodes: number | null
          lower_x_coordinates: number[] | null
          lower_y_coordinates: number[] | null
          name: string
          source_url: string | null
          te_angle: number | null
          te_thickness: number | null
          thickness_loc_pct: number | null
          thickness_pct: number | null
          updated_at: string | null
          upper_surface_nodes: number | null
          upper_x_coordinates: number[] | null
          upper_y_coordinates: number[] | null
        }
        Insert: {
          camber_loc_pct?: number | null
          camber_pct?: number | null
          created_at?: string | null
          description?: string | null
          file_path: string
          id?: string
          le_radius?: number | null
          lower_surface_nodes?: number | null
          lower_x_coordinates?: number[] | null
          lower_y_coordinates?: number[] | null
          name: string
          source_url?: string | null
          te_angle?: number | null
          te_thickness?: number | null
          thickness_loc_pct?: number | null
          thickness_pct?: number | null
          updated_at?: string | null
          upper_surface_nodes?: number | null
          upper_x_coordinates?: number[] | null
          upper_y_coordinates?: number[] | null
        }
        Update: {
          camber_loc_pct?: number | null
          camber_pct?: number | null
          created_at?: string | null
          description?: string | null
          file_path?: string
          id?: string
          le_radius?: number | null
          lower_surface_nodes?: number | null
          lower_x_coordinates?: number[] | null
          lower_y_coordinates?: number[] | null
          name?: string
          source_url?: string | null
          te_angle?: number | null
          te_thickness?: number | null
          thickness_loc_pct?: number | null
          thickness_pct?: number | null
          updated_at?: string | null
          upper_surface_nodes?: number | null
          upper_x_coordinates?: number[] | null
          upper_y_coordinates?: number[] | null
        }
        Relationships: []
      }
      batch_jobs: {
        Row: {
          airfoil_ids: string[] | null
          created_at: string | null
          inputs: Json
          job_id: string
          progress: number | null
          result_location: string | null
          scope: Database["public"]["Enums"]["job_scope"]
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string | null
        }
        Insert: {
          airfoil_ids?: string[] | null
          created_at?: string | null
          inputs: Json
          job_id?: string
          progress?: number | null
          result_location?: string | null
          scope: Database["public"]["Enums"]["job_scope"]
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string | null
        }
        Update: {
          airfoil_ids?: string[] | null
          created_at?: string | null
          inputs?: Json
          job_id?: string
          progress?: number | null
          result_location?: string | null
          scope?: Database["public"]["Enums"]["job_scope"]
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      performance_cache: {
        Row: {
          airfoil_id: string
          cond_hash: string
          created_at: string | null
          id: string
          inputs: Json
          outputs: Json
        }
        Insert: {
          airfoil_id: string
          cond_hash: string
          created_at?: string | null
          id?: string
          inputs: Json
          outputs: Json
        }
        Update: {
          airfoil_id?: string
          cond_hash?: string
          created_at?: string | null
          id?: string
          inputs?: Json
          outputs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "performance_cache_airfoil_id_fkey"
            columns: ["airfoil_id"]
            isOneToOne: false
            referencedRelation: "airfoils"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      job_scope: "single" | "compare" | "entire_db"
      job_status: "queued" | "running" | "done" | "failed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      job_scope: ["single", "compare", "entire_db"],
      job_status: ["queued", "running", "done", "failed"],
    },
  },
} as const
