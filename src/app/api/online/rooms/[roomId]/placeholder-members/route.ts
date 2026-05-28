import { NextResponse } from "next/server";

import { mapRoomMember } from "@/lib/online/roomMapping";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type PlaceholderMembersRouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

type CreatePlaceholderMemberBody = {
  memberId?: unknown;
  displayName?: unknown;
};

type DeletePlaceholderMemberBody = {
  memberId?: unknown;
  placeholderMemberId?: unknown;
};

export async function POST(
  request: Request,
  context: PlaceholderMembersRouteContext,
) {
  const { roomId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as CreatePlaceholderMemberBody;
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";

  if (!memberId) {
    return NextResponse.json({ error: "缺少成员身份。" }, { status: 400 });
  }

  if (!displayName) {
    return NextResponse.json({ error: "请输入占位玩家名称。" }, { status: 400 });
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
      { error: "房间不在等待状态，无法添加占位玩家。" },
      { status: 400 },
    );
  }

  const { data: actorMember, error: memberError } = await supabase
    .from("room_members")
    .select()
    .eq("id", memberId)
    .eq("room_id", roomId)
    .single();

  if (memberError || !actorMember) {
    return NextResponse.json({ error: "成员不属于当前房间。" }, { status: 403 });
  }

  if (actorMember.role !== "storyteller") {
    return NextResponse.json(
      { error: "只有说书人可以添加占位玩家。" },
      { status: 403 },
    );
  }

  const { data: placeholderMember, error: insertError } = await supabase
    .from("room_members")
    .insert({
      room_id: roomId,
      user_id: `placeholder:${crypto.randomUUID()}`,
      display_name: displayName,
      role: "player",
      player_id: null,
    })
    .select()
    .single();

  if (insertError || !placeholderMember) {
    return NextResponse.json(
      { error: insertError?.message ?? "添加占位玩家失败。" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    member: mapRoomMember(placeholderMember),
  });
}

export async function DELETE(
  request: Request,
  context: PlaceholderMembersRouteContext,
) {
  const { roomId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as DeletePlaceholderMemberBody;
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const placeholderMemberId =
    typeof body.placeholderMemberId === "string"
      ? body.placeholderMemberId.trim()
      : "";

  if (!memberId) {
    return NextResponse.json({ error: "缺少成员身份。" }, { status: 400 });
  }

  if (!placeholderMemberId) {
    return NextResponse.json({ error: "缺少占位玩家身份。" }, { status: 400 });
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
      { error: "房间不在等待状态，无法删除占位玩家。" },
      { status: 400 },
    );
  }

  const { data: actorMember, error: memberError } = await supabase
    .from("room_members")
    .select()
    .eq("id", memberId)
    .eq("room_id", roomId)
    .single();

  if (memberError || !actorMember) {
    return NextResponse.json({ error: "成员不属于当前房间。" }, { status: 403 });
  }

  if (actorMember.role !== "storyteller") {
    return NextResponse.json(
      { error: "只有说书人可以删除占位玩家。" },
      { status: 403 },
    );
  }

  const { data: placeholderMember, error: placeholderMemberError } =
    await supabase
      .from("room_members")
      .select()
      .eq("id", placeholderMemberId)
      .eq("room_id", roomId)
      .single();

  if (placeholderMemberError || !placeholderMember) {
    return NextResponse.json({ error: "占位玩家不存在。" }, { status: 404 });
  }

  if (!placeholderMember.user_id.startsWith("placeholder:")) {
    return NextResponse.json(
      { error: "不能删除真实玩家。" },
      { status: 403 },
    );
  }

  const { error: deleteError } = await supabase
    .from("room_members")
    .delete()
    .eq("id", placeholderMember.id)
    .eq("room_id", roomId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
