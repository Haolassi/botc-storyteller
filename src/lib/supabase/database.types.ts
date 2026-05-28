import type { Json } from "@/lib/supabase/json";

export type Database = {
  public: {
    Tables: {
      online_rooms: {
        Row: {
          id: string;
          room_code: string;
          game_id: string | null;
          storyteller_user_id: string;
          status: "waiting" | "playing" | "ended";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_code: string;
          game_id?: string | null;
          storyteller_user_id: string;
          status?: "waiting" | "playing" | "ended";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_code?: string;
          game_id?: string | null;
          storyteller_user_id?: string;
          status?: "waiting" | "playing" | "ended";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      room_members: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          display_name: string;
          role: "storyteller" | "player" | "spectator";
          player_id: string | null;
          joined_at: string;
          last_seen_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          display_name: string;
          role: "storyteller" | "player" | "spectator";
          player_id?: string | null;
          joined_at?: string;
          last_seen_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          display_name?: string;
          role?: "storyteller" | "player" | "spectator";
          player_id?: string | null;
          joined_at?: string;
          last_seen_at?: string | null;
        };
        Relationships: [];
      };
      game_states: {
        Row: {
          game_id: string;
          room_id: string;
          state_json: Json;
          version: number;
          updated_at: string;
        };
        Insert: {
          game_id: string;
          room_id: string;
          state_json: Json;
          version?: number;
          updated_at?: string;
        };
        Update: {
          game_id?: string;
          room_id?: string;
          state_json?: Json;
          version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      game_actions: {
        Row: {
          id: string;
          room_id: string;
          game_id: string;
          actor_user_id: string;
          actor_member_id: string | null;
          action_type: string;
          payload: Json;
          client_action_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          game_id: string;
          actor_user_id: string;
          actor_member_id?: string | null;
          action_type: string;
          payload: Json;
          client_action_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          game_id?: string;
          actor_user_id?: string;
          actor_member_id?: string | null;
          action_type?: string;
          payload?: Json;
          client_action_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      submit_game_action: {
        Args: {
          p_room_id: string;
          p_game_id: string;
          p_actor_user_id: string;
          p_actor_member_id: string | null;
          p_action_type: string;
          p_payload: Json;
          p_client_action_id: string | null;
          p_expected_version: number | null;
          p_next_state_json: Json;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
