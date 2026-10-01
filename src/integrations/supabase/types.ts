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
      ai_agents: {
        Row: {
          ai_provider_id: string | null
          cost_per_minute: number | null
          created_at: string
          enabled: boolean
          external_agent_id: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          ai_provider_id?: string | null
          cost_per_minute?: number | null
          created_at?: string
          enabled?: boolean
          external_agent_id: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          ai_provider_id?: string | null
          cost_per_minute?: number | null
          created_at?: string
          enabled?: boolean
          external_agent_id?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_ai_provider_id_fkey"
            columns: ["ai_provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          connection_status: string
          created_at: string
          enabled: boolean
          id: string
          last_error: string | null
          last_sync_at: string | null
          name: string
          organization_id: string
          provider_type: string
        }
        Insert: {
          connection_status?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          organization_id: string
          provider_type?: string
        }
        Update: {
          connection_status?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          organization_id?: string
          provider_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_credentials: {
        Row: {
          created_at: string
          id: string
          key_name: string
          organization_id: string
          owner_id: string
          owner_type: string
          secret_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_name: string
          organization_id: string
          owner_id: string
          owner_type: string
          secret_value: string
        }
        Update: {
          created_at?: string
          id?: string
          key_name?: string
          organization_id?: string
          owner_id?: string
          owner_type?: string
          secret_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asterisk_instances: {
        Row: {
          ami_host: string | null
          ami_port: number | null
          ami_username: string | null
          asterisk_host: string | null
          cdr_db_host: string | null
          cdr_db_name: string | null
          cdr_db_port: number | null
          cdr_db_user: string | null
          connection_status: string
          created_at: string
          enabled: boolean
          id: string
          last_error: string | null
          last_sync_at: string | null
          name: string
          organization_id: string
          recording_path: string | null
        }
        Insert: {
          ami_host?: string | null
          ami_port?: number | null
          ami_username?: string | null
          asterisk_host?: string | null
          cdr_db_host?: string | null
          cdr_db_name?: string | null
          cdr_db_port?: number | null
          cdr_db_user?: string | null
          connection_status?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          organization_id: string
          recording_path?: string | null
        }
        Update: {
          ami_host?: string | null
          ami_port?: number | null
          ami_username?: string | null
          asterisk_host?: string | null
          cdr_db_host?: string | null
          cdr_db_name?: string | null
          cdr_db_port?: number | null
          cdr_db_user?: string | null
          connection_status?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          organization_id?: string
          recording_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asterisk_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_recordings: {
        Row: {
          call_id: string
          created_at: string
          duration_secs: number | null
          format: string | null
          id: string
          organization_id: string
          provider: string
          recording_url: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          duration_secs?: number | null
          format?: string | null
          id?: string
          organization_id: string
          provider: string
          recording_url?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          duration_secs?: number | null
          format?: string | null
          id?: string
          organization_id?: string
          provider?: string
          recording_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_recordings_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_summaries: {
        Row: {
          call_id: string
          call_outcome: string | null
          call_successful: boolean | null
          created_at: string
          customer_intent: string | null
          id: string
          next_action: string | null
          organization_id: string
          summary_title: string | null
          transcript_summary: string | null
        }
        Insert: {
          call_id: string
          call_outcome?: string | null
          call_successful?: boolean | null
          created_at?: string
          customer_intent?: string | null
          id?: string
          next_action?: string | null
          organization_id: string
          summary_title?: string | null
          transcript_summary?: string | null
        }
        Update: {
          call_id?: string
          call_outcome?: string | null
          call_successful?: boolean | null
          created_at?: string
          customer_intent?: string | null
          id?: string
          next_action?: string | null
          organization_id?: string
          summary_title?: string | null
          transcript_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_summaries_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string
          id: string
          message: string
          organization_id: string
          role: Database["public"]["Enums"]["message_role"]
          sequence: number
          spoken_at: string | null
        }
        Insert: {
          call_id: string
          id?: string
          message: string
          organization_id: string
          role: Database["public"]["Enums"]["message_role"]
          sequence?: number
          spoken_at?: string | null
        }
        Update: {
          call_id?: string
          id?: string
          message?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["message_role"]
          sequence?: number
          spoken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          ai_agent_id: string | null
          ai_cost: number
          answered_at: string | null
          asterisk_instance_id: string | null
          asterisk_linkedid: string | null
          asterisk_uniqueid: string | null
          billable_secs: number
          call_successful: boolean | null
          caller_number: string | null
          conversation_id: string | null
          correlation_confidence: number | null
          correlation_status: Database["public"]["Enums"]["correlation_status"]
          created_at: string
          currency: string
          destination_number: string | null
          direction: Database["public"]["Enums"]["call_direction"]
          disposition: string | null
          duration_secs: number
          ended_at: string | null
          exchange_rate: number | null
          external_agent_id: string | null
          id: string
          organization_id: string
          provider_reported_cost: number | null
          sip_cost: number
          sip_number_id: string | null
          sip_provider_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
          total_cost: number
        }
        Insert: {
          ai_agent_id?: string | null
          ai_cost?: number
          answered_at?: string | null
          asterisk_instance_id?: string | null
          asterisk_linkedid?: string | null
          asterisk_uniqueid?: string | null
          billable_secs?: number
          call_successful?: boolean | null
          caller_number?: string | null
          conversation_id?: string | null
          correlation_confidence?: number | null
          correlation_status?: Database["public"]["Enums"]["correlation_status"]
          created_at?: string
          currency?: string
          destination_number?: string | null
          direction?: Database["public"]["Enums"]["call_direction"]
          disposition?: string | null
          duration_secs?: number
          ended_at?: string | null
          exchange_rate?: number | null
          external_agent_id?: string | null
          id?: string
          organization_id: string
          provider_reported_cost?: number | null
          sip_cost?: number
          sip_number_id?: string | null
          sip_provider_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          total_cost?: number
        }
        Update: {
          ai_agent_id?: string | null
          ai_cost?: number
          answered_at?: string | null
          asterisk_instance_id?: string | null
          asterisk_linkedid?: string | null
          asterisk_uniqueid?: string | null
          billable_secs?: number
          call_successful?: boolean | null
          caller_number?: string | null
          conversation_id?: string | null
          correlation_confidence?: number | null
          correlation_status?: Database["public"]["Enums"]["correlation_status"]
          created_at?: string
          currency?: string
          destination_number?: string | null
          direction?: Database["public"]["Enums"]["call_direction"]
          disposition?: string | null
          duration_secs?: number
          ended_at?: string | null
          exchange_rate?: number | null
          external_agent_id?: string | null
          id?: string
          organization_id?: string
          provider_reported_cost?: number | null
          sip_cost?: number
          sip_number_id?: string | null
          sip_provider_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "calls_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_asterisk_instance_id_fkey"
            columns: ["asterisk_instance_id"]
            isOneToOne: false
            referencedRelation: "asterisk_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_sip_number_id_fkey"
            columns: ["sip_number_id"]
            isOneToOne: false
            referencedRelation: "sip_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_sip_provider_id_fkey"
            columns: ["sip_provider_id"]
            isOneToOne: false
            referencedRelation: "sip_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          name: string
          slug: string
          usd_to_bdt: number
        }
        Insert: {
          base_currency?: string
          created_at?: string
          id?: string
          name: string
          slug: string
          usd_to_bdt?: number
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          usd_to_bdt?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      sip_numbers: {
        Row: {
          ai_agent_id: string | null
          asterisk_instance_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["call_direction"]
          enabled: boolean
          id: string
          label: string | null
          number: string
          organization_id: string
          sip_provider_id: string | null
        }
        Insert: {
          ai_agent_id?: string | null
          asterisk_instance_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"]
          enabled?: boolean
          id?: string
          label?: string | null
          number: string
          organization_id: string
          sip_provider_id?: string | null
        }
        Update: {
          ai_agent_id?: string | null
          asterisk_instance_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"]
          enabled?: boolean
          id?: string
          label?: string | null
          number?: string
          organization_id?: string
          sip_provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sip_numbers_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sip_numbers_asterisk_instance_id_fkey"
            columns: ["asterisk_instance_id"]
            isOneToOne: false
            referencedRelation: "asterisk_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sip_numbers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sip_numbers_sip_provider_id_fkey"
            columns: ["sip_provider_id"]
            isOneToOne: false
            referencedRelation: "sip_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sip_providers: {
        Row: {
          billing_increment: number
          created_at: string
          currency: string
          enabled: boolean
          id: string
          incoming_rate: number
          minimum_duration: number
          name: string
          organization_id: string
          outgoing_rate: number
          provider_type: string | null
          sip_host: string | null
          sip_username: string | null
        }
        Insert: {
          billing_increment?: number
          created_at?: string
          currency?: string
          enabled?: boolean
          id?: string
          incoming_rate?: number
          minimum_duration?: number
          name: string
          organization_id: string
          outgoing_rate?: number
          provider_type?: string | null
          sip_host?: string | null
          sip_username?: string | null
        }
        Update: {
          billing_increment?: number
          created_at?: string
          currency?: string
          enabled?: boolean
          id?: string
          incoming_rate?: number
          minimum_duration?: number
          name?: string
          organization_id?: string
          outgoing_rate?: number
          provider_type?: string | null
          sip_host?: string | null
          sip_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sip_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          job_type: string
          organization_id: string
          records_processed: number
          started_at: string
          status: Database["public"]["Enums"]["sync_status"]
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          organization_id: string
          records_processed?: number
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          organization_id?: string
          records_processed?: number
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error_message: string | null
          external_id: string | null
          id: string
          organization_id: string | null
          payload: Json
          processed: boolean
          received_at: string
          source: string
        }
        Insert: {
          error_message?: string | null
          external_id?: string | null
          id?: string
          organization_id?: string | null
          payload: Json
          processed?: boolean
          received_at?: string
          source: string
        }
        Update: {
          error_message?: string | null
          external_id?: string | null
          id?: string
          organization_id?: string | null
          payload?: Json
          processed?: boolean
          received_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "manager" | "viewer"
      call_direction: "inbound" | "outbound" | "internal" | "unknown"
      call_status:
        | "answered"
        | "missed"
        | "failed"
        | "busy"
        | "no_answer"
        | "congestion"
        | "unknown"
      correlation_status:
        | "matched"
        | "pending"
        | "unmatched"
        | "manually_matched"
      message_role: "user" | "assistant" | "system" | "tool"
      sync_status: "pending" | "running" | "completed" | "failed"
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
      app_role: ["super_admin", "admin", "manager", "viewer"],
      call_direction: ["inbound", "outbound", "internal", "unknown"],
      call_status: [
        "answered",
        "missed",
        "failed",
        "busy",
        "no_answer",
        "congestion",
        "unknown",
      ],
      correlation_status: [
        "matched",
        "pending",
        "unmatched",
        "manually_matched",
      ],
      message_role: ["user", "assistant", "system", "tool"],
      sync_status: ["pending", "running", "completed", "failed"],
    },
  },
} as const
