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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      client_conversations: {
        Row: {
          channel: Database["public"]["Enums"]["conversation_channel"]
          client_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          follow_up_at: string | null
          id: string
          occurred_at: string
          participants: string | null
          project_id: string | null
          subject: string
          summary: string
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["conversation_channel"]
          client_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          follow_up_at?: string | null
          id?: string
          occurred_at?: string
          participants?: string | null
          project_id?: string | null
          subject: string
          summary: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["conversation_channel"]
          client_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          follow_up_at?: string | null
          id?: string
          occurred_at?: string
          participants?: string | null
          project_id?: string | null
          subject?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          slug: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          last_rotated_at: string | null
          notes: string | null
          project_id: string | null
          secret_encrypted: string | null
          secret_nonce: string | null
          system: string | null
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          last_rotated_at?: string | null
          notes?: string | null
          project_id?: string | null
          secret_encrypted?: string | null
          secret_nonce?: string | null
          system?: string | null
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          last_rotated_at?: string | null
          notes?: string | null
          project_id?: string | null
          secret_encrypted?: string | null
          secret_nonce?: string | null
          system?: string | null
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          position: number
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          due_date: string | null
          ends_on: string | null
          id: string
          impl_stage: string | null
          name: string
          next_occurrence_date: string | null
          notes: string | null
          opportunity_value: number | null
          project_type: string | null
          repeat_interval: string
          start_date: string | null
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          due_date?: string | null
          ends_on?: string | null
          id?: string
          impl_stage?: string | null
          name: string
          next_occurrence_date?: string | null
          notes?: string | null
          opportunity_value?: number | null
          project_type?: string | null
          repeat_interval?: string
          start_date?: string | null
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          due_date?: string | null
          ends_on?: string | null
          id?: string
          impl_stage?: string | null
          name?: string
          next_occurrence_date?: string | null
          notes?: string | null
          opportunity_value?: number | null
          project_type?: string | null
          repeat_interval?: string
          start_date?: string | null
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          category: string | null
          client_id: string | null
          content: string
          created_at: string
          description: string | null
          id: string
          project_id: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          client_id?: string | null
          content: string
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          client_id?: string | null
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      wiki_page_links: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          page_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          page_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_page_links_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "wiki_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_page_revisions: {
        Row: {
          content: string
          created_at: string
          edited_by: string | null
          id: string
          page_id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_by?: string | null
          id?: string
          page_id: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          page_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_page_revisions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "wiki_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_pages: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          excerpt: string | null
          id: string
          parent_id: string | null
          position: number
          slug: string
          space_id: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          parent_id?: string | null
          position?: number
          slug: string
          space_id: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          parent_id?: string | null
          position?: number
          slug?: string
          space_id?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wiki_pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_pages_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "wiki_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_spaces: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_first_admin: { Args: never; Returns: boolean }
      credential_reveal: { Args: { _id: string }; Returns: string }
      credential_set_secret: {
        Args: { _id: string; _plain: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
      conversation_channel:
        | "email"
        | "call"
        | "meeting"
        | "whatsapp"
        | "sms"
        | "other"
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
      app_role: ["admin", "member"],
      conversation_channel: [
        "email",
        "call",
        "meeting",
        "whatsapp",
        "sms",
        "other",
      ],
    },
  },
} as const
