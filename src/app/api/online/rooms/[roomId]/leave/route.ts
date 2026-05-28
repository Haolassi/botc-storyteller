import { NextResponse } from "next/server";

import { createServiceSupabaseClient } from "@/lib/supabase/server";

type LeaveRoomRouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

type LeaveRoomBody = {
  memberId?: unknown;
};

export async function POST(request: Request, context: LeaveRoomRouteContext) {
  const { roomId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as LeaveRoomBody;
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

  if (roomRow.status !== "waiting") {
    return NextResponse.json(
      { error: "房间不在等待状态，无法离开。" },
      { status: 400 },
    );
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("room_members")
    .select()
    .eq("id", memberId)
    .eq("room_id", roomId)
    .single();

  if (memberError || !memberRow) {
    return NextResponse.json({ error: "成员不属于当前房间。" }, { status: 403 });
  }

  if (memberRow.role !== "player") {
    return NextResponse.json(
      { error: "本轮只支持普通玩家离开房间。" },
      { status: 403 },
    );
  }

  if (memberRow.user_id.startsWith("placeholder:")) {
    return NextResponse.json(
      { error: "占位玩家不能通过离开房间接口删除。" },
      { status: 403 },
    );
  }

  const { error: deleteError } = await supabase
    .from("room_members")
    .delete()
    .eq("id", memberRow.id)
    .eq("room_id", roomId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
