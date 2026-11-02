
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "game_events": {
                  Row: {
                    "created_at": string,"game_id": string,"id": number,"payload": NonNullable<Json>,"recipient_user_id": string | null,"seq": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"game_id": string,"id"?: never,"payload": NonNullable<Json>,"recipient_user_id"?: string | null,"seq": number,"version": number
                  }
                  Update: {
                    "created_at"?: string,"game_id"?: string,"id"?: never,"payload"?: NonNullable<Json>,"recipient_user_id"?: string | null,"seq"?: number,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_events_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"game_seats": {
                  Row: {
                    "afk_takeover": boolean,"display_name": string,"game_id": string,"is_npc": boolean,"npc_difficulty": Database["public"]['Enums']["npc_difficulty"] | null,"seat": number,"timeouts": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "afk_takeover"?: boolean,"display_name": string,"game_id": string,"is_npc"?: boolean,"npc_difficulty"?: Database["public"]['Enums']["npc_difficulty"] | null,"seat": number,"timeouts"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "afk_takeover"?: boolean,"display_name"?: string,"game_id"?: string,"is_npc"?: boolean,"npc_difficulty"?: Database["public"]['Enums']["npc_difficulty"] | null,"seat"?: number,"timeouts"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_seats_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "created_at": string,"id": string,"prompt_deadline": string | null,"room_id": string,"state": NonNullable<Json>,"status": string,"updated_at": string,"version": number,"winner": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"prompt_deadline"?: string | null,"room_id": string,"state": NonNullable<Json>,"status"?: string,"updated_at"?: string,"version"?: number,"winner"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"prompt_deadline"?: string | null,"room_id"?: string,"state"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"version"?: number,"winner"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"player_stats": {
                  Row: {
                    "games_played": number,"updated_at": string,"user_id": string,"wins": number,"wins_by_role": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "games_played"?: number,"updated_at"?: string,"user_id": string,"wins"?: number,"wins_by_role"?: NonNullable<Json>
                  }
                  Update: {
                    "games_played"?: number,"updated_at"?: string,"user_id"?: string,"wins"?: number,"wins_by_role"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"player_views": {
                  Row: {
                    "game_id": string,"seat": number,"updated_at": string,"user_id": string,"version": number,"view": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "game_id": string,"seat": number,"updated_at"?: string,"user_id": string,"version": number,"view": NonNullable<Json>
                  }
                  Update: {
                    "game_id"?: string,"seat"?: number,"updated_at"?: string,"user_id"?: string,"version"?: number,"view"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_views_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_key": string | null,"created_at": string,"display_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_key"?: string | null,"created_at"?: string,"display_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_key"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"room_players": {
                  Row: {
                    "display_name": string,"is_npc": boolean,"is_ready": boolean,"joined_at": string,"npc_difficulty": Database["public"]['Enums']["npc_difficulty"] | null,"room_id": string,"slot": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name": string,"is_npc"?: boolean,"is_ready"?: boolean,"joined_at"?: string,"npc_difficulty"?: Database["public"]['Enums']["npc_difficulty"] | null,"room_id": string,"slot": number,"user_id"?: string | null
                  }
                  Update: {
                    "display_name"?: string,"is_npc"?: boolean,"is_ready"?: boolean,"joined_at"?: string,"npc_difficulty"?: Database["public"]['Enums']["npc_difficulty"] | null,"room_id"?: string,"slot"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_players_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "code": string,"created_at": string,"current_game_id": string | null,"host_id": string,"id": string,"settings": NonNullable<Json>,"status": Database["public"]['Enums']["room_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"current_game_id"?: string | null,"host_id": string,"id"?: string,"settings"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["room_status"],"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"current_game_id"?: string | null,"host_id"?: string,"id"?: string,"settings"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["room_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rooms_current_game_fk"
      columns: ["current_game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "commit_game_action":
{ Args: { "p_events": Json,"p_expected_version": number,"p_game_id": string,"p_prompt_deadline": string,"p_seat_updates": Json,"p_state": Json,"p_status": string,"p_views": Json,"p_winner": string }; Returns: number
                           },
"is_game_member":
{ Args: { "p_game": string }; Returns: boolean
                           },
"is_room_member":
{ Args: { "p_room": string }; Returns: boolean
                           }
          }
          Enums: {
            "npc_difficulty": "easy"|"medium"|"hard","room_status": "lobby"|"in_game"|"finished"|"closed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "npc_difficulty": ["easy", "medium", "hard"],"room_status": ["lobby", "in_game", "finished", "closed"]
          }
        }
} as const
