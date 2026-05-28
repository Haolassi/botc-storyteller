import { NextResponse } from "next/server";

import { mapOnlineRoom, mapRoomMember } from "@/lib/online/roomMapping";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  getVisibleGameState,
  type GameViewer,
} from "@/lib/visibility";
import type { Game } from "@/types/game";
import type { OnlineRoomRole } from "@/types/online";

type OnlineGameRouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

function toGameViewer(member: {
  user_id: string;
  role: OnlineRoomRole;
  player_id: string | null;
}): GameViewer {
  if (member.role === "storyteller") {
    return {
      type: "storyteller",
      userId: member.user_id,
      playerId: member.player_id ?? undefined,
    };
  }

  if (member.role === "player" && member.player_id) {
    return {
      type: "player",
      userId: member.user_id,
      playerId: member.player_id,
    };
  }

  return {
    type: "spectator",
    userId: member.user_id,
  };
}

export async function GET(request: Request, context: OnlineGameRouteContext) {
  const { gameId } = await context.params;
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId")?.trim() ?? "";
  const supabase = createServiceSupabaseClient();
  const { data: gameStateRow, error: gameStateError } = await supabase
    .from("game_states")
    .select()
    .eq("game_id", gameId)
    .single();

  if (gameStateError || !gameStateRow) {
    return NextResponse.json(
      { error: gameStateError?.message ?? "联机游戏不存在。" },
      { status: gameStateError?.code === "PGRST116" ? 404 : 500 },
    );
  }

  const { data: roomRow, error: roomError } = await supabase
    .from("online_rooms")
    .select()
    .eq("id", gameStateRow.room_id)
    .single();

  if (roomError || !roomRow) {
    return NextResponse.json(
      { error: roomError?.message ?? "联机房间不存在。" },
      { status: roomError?.code === "PGRST116" ? 404 : 500 },
    );
  }

  const game = gameStateRow.state_json as unknown as Game;

  if (!memberId) {
    return NextResponse.json({
      game: getVisibleGameState(game, { type: "spectator" }),
      room: mapOnlineRoom(roomRow),
      version: gameStateRow.version,
      viewerRole: "spectator",
    });
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("room_members")
    .select()
    .eq("id", memberId)
    .eq("room_id", roomRow.id)
    .single();

  if (memberError || !memberRow) {
    return NextResponse.json(
      { error: "成员不属于当前房间。" },
      { status: 403 },
    );
  }

  const viewer = toGameViewer(memberRow);
  const isStoryteller = memberRow.role === "storyteller";

  return NextResponse.json({
    game: isStoryteller ? game : getVisibleGameState(game, viewer),
    room: mapOnlineRoom(roomRow),
    version: gameStateRow.version,
    viewerRole: memberRow.role,
    member: mapRoomMember(memberRow),
  });
}
