import type { Database } from "@/lib/supabase/database.types";
import type { OnlineRoom, RoomMember } from "@/types/online";

type OnlineRoomRow = Database["public"]["Tables"]["online_rooms"]["Row"];
type RoomMemberRow = Database["public"]["Tables"]["room_members"]["Row"];

export function mapOnlineRoom(row: OnlineRoomRow): OnlineRoom {
  return {
    id: row.id,
    roomCode: row.room_code,
    gameId: row.game_id ?? undefined,
    storytellerUserId: row.storyteller_user_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRoomMember(row: RoomMemberRow): RoomMember {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    playerId: row.player_id ?? undefined,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at ?? undefined,
  };
}
