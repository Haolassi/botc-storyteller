import { NextResponse } from "next/server";

import { reduceGameAction } from "@/lib/gameReducer";
import { validateGameAction } from "@/lib/gameValidation";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/json";
import type { GameAction } from "@/types/actions";
import type { Game } from "@/types/game";

type RemoteActionsRouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

type SubmitRemoteActionBody = {
  memberId?: unknown;
  action?: unknown;
  clientActionId?: unknown;
  expectedVersion?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDuplicateActionError(errorCode?: string) {
  return errorCode === "23505";
}

function isVersionConflictError(message?: string) {
  return Boolean(message?.toLowerCase().includes("version_conflict"));
}

function isMissingGameError(message?: string) {
  return Boolean(message?.toLowerCase().includes("missing_game"));
}

export async function POST(
  request: Request,
  context: RemoteActionsRouteContext,
) {
  const { gameId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as SubmitRemoteActionBody;
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const action = isRecord(body.action) ? (body.action as GameAction) : null;
  const clientActionId =
    typeof body.clientActionId === "string" && body.clientActionId.trim()
      ? body.clientActionId.trim()
      : null;
  const expectedVersion =
    typeof body.expectedVersion === "number" ? body.expectedVersion : null;

  if (!memberId) {
    return NextResponse.json({ error: "缺少成员身份。" }, { status: 400 });
  }

  if (!action || typeof action.type !== "string") {
    return NextResponse.json({ error: "缺少有效的游戏 action。" }, { status: 400 });
  }

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

  if (expectedVersion !== null && expectedVersion !== gameStateRow.version) {
    return NextResponse.json(
      {
        error: "游戏版本已变化，请刷新后重试。",
        currentVersion: gameStateRow.version,
      },
      { status: 409 },
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

  const { data: memberRow, error: memberError } = await supabase
    .from("room_members")
    .select()
    .eq("id", memberId)
    .eq("room_id", roomRow.id)
    .single();

  if (memberError || !memberRow) {
    return NextResponse.json({ error: "成员不属于当前房间。" }, { status: 403 });
  }

  if (memberRow.role !== "storyteller") {
    return NextResponse.json(
      { error: "只有说书人可以提交远端游戏操作。" },
      { status: 403 },
    );
  }

  const currentGame = gameStateRow.state_json as unknown as Game;
  const validation = validateGameAction(currentGame, action);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const nextGame = reduceGameAction(currentGame, action);
  const { data: nextVersion, error: submitError } = await supabase.rpc(
    "submit_game_action",
    {
      p_room_id: roomRow.id,
      p_game_id: gameId,
      p_actor_user_id: memberRow.user_id,
      p_actor_member_id: memberRow.id,
      p_action_type: action.type,
      p_payload: action as unknown as Json,
      p_client_action_id: clientActionId,
      p_expected_version: expectedVersion,
      p_next_state_json: nextGame as unknown as Json,
    },
  );

  if (submitError) {
    if (isDuplicateActionError(submitError.code)) {
      return NextResponse.json(
        { error: "重复提交的 action。" },
        { status: 409 },
      );
    }

    if (isVersionConflictError(submitError.message)) {
      return NextResponse.json(
        { error: "游戏版本已变化，请刷新后重试。" },
        { status: 409 },
      );
    }

    if (isMissingGameError(submitError.message)) {
      return NextResponse.json({ error: "联机游戏不存在。" }, { status: 404 });
    }

    return NextResponse.json({ error: submitError.message }, { status: 500 });
  }

  return NextResponse.json({
    game: nextGame,
    version: nextVersion,
  });
}
