import { NextResponse } from "next/server";

import {
  createInitialGameState,
  createLocalId,
  createPlayersFromNames,
} from "@/lib/localGames";
import { mapOnlineRoom } from "@/lib/online/roomMapping";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/json";

type StartOnlineRoomRouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

type StartOnlineRoomBody = {
  memberId?: unknown;
};

const DEFAULT_ONLINE_SCRIPT_ID = "trouble_brewing";

export async function POST(
  request: Request,
  context: StartOnlineRoomRouteContext,
) {
  const { roomId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as StartOnlineRoomBody;
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";

  if (!memberId) {
    return NextResponse.json({ error: "缺少成员身份。" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: roomRow, error: roomError } = await supabase
    .from("online_rooms")
    .select()
    .eq("id", roomId)
    .single();

  if (roomError || !roomRow) {
    return NextResponse.json({ error: "房间不存在。" }, { status: 404 });
  }

  const room = mapOnlineRoom(roomRow);

  if (room.status !== "waiting") {
    return NextResponse.json(
      { error: "房间不在等待状态，无法开始游戏。" },
      { status: 400 },
    );
  }

  const { data: memberRows, error: membersError } = await supabase
    .from("room_members")
    .select()
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  if (membersError || !memberRows) {
    return NextResponse.json(
      { error: membersError?.message ?? "读取房间成员失败。" },
      { status: 500 },
    );
  }

  const actorMember = memberRows.find((member) => member.id === memberId);

  if (!actorMember) {
    return NextResponse.json({ error: "成员不属于当前房间。" }, { status: 403 });
  }

  if (actorMember.role !== "storyteller") {
    return NextResponse.json(
      { error: "只有说书人可以开始联机游戏。" },
      { status: 403 },
    );
  }

  const participatingMembers = memberRows.filter(
    (member) => member.role !== "spectator" && member.display_name.trim(),
  );

  if (participatingMembers.length === 0) {
    return NextResponse.json(
      { error: "房间内没有可加入游戏的成员。" },
      { status: 400 },
    );
  }

  const gameId = createLocalId("game");
  const players = createPlayersFromNames(
    gameId,
    participatingMembers.map((member) => member.display_name),
  );
  const game = createInitialGameState({
    id: gameId,
    scriptId: DEFAULT_ONLINE_SCRIPT_ID,
    players,
  });

  if (game.players.length !== participatingMembers.length) {
    return NextResponse.json(
      { error: "玩家数量和房间成员数量不一致，无法开始游戏。" },
      { status: 500 },
    );
  }

  const { error: gameStateError } = await supabase.from("game_states").insert({
    game_id: game.id,
    room_id: room.id,
    state_json: game as unknown as Json,
    version: 1,
  });

  if (gameStateError) {
    return NextResponse.json(
      { error: gameStateError.message },
      { status: 500 },
    );
  }

  const memberPlayerBindingResults = await Promise.all(
    participatingMembers.map((member, index) =>
      supabase
        .from("room_members")
        .update({
          player_id: game.players[index].id,
        })
        .eq("id", member.id)
        .eq("room_id", room.id),
    ),
  );
  const memberPlayerBindingError = memberPlayerBindingResults.find(
    (result) => result.error,
  )?.error;

  if (memberPlayerBindingError) {
    return NextResponse.json(
      { error: memberPlayerBindingError.message },
      { status: 500 },
    );
  }

  const { data: updatedRoomRow, error: updateRoomError } = await supabase
    .from("online_rooms")
    .update({
      game_id: game.id,
      status: "playing",
    })
    .eq("id", room.id)
    .select()
    .single();

  if (updateRoomError || !updatedRoomRow) {
    return NextResponse.json(
      { error: updateRoomError?.message ?? "更新房间状态失败。" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    room: mapOnlineRoom(updatedRoomRow),
    game,
  });
}
