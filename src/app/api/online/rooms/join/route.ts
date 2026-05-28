import { NextResponse } from "next/server";

import { mapOnlineRoom, mapRoomMember } from "@/lib/online/roomMapping";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type JoinRoomRequestBody = {
  roomCode?: unknown;
  displayName?: unknown;
  userId?: unknown;
};

export async function POST(request: Request) {
  let body: JoinRoomRequestBody;

  try {
    body = (await request.json()) as JoinRoomRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const roomCode =
    typeof body.roomCode === "string" ? body.roomCode.trim().toUpperCase() : "";
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";

  if (!roomCode) {
    return NextResponse.json(
      { error: "Room code is required." },
      { status: 400 },
    );
  }

  if (!displayName) {
    return NextResponse.json(
      { error: "Display name is required." },
      { status: 400 },
    );
  }

  const supabase = createServiceSupabaseClient();
  const { data: roomRow, error: roomError } = await supabase
    .from("online_rooms")
    .select()
    .eq("room_code", roomCode)
    .maybeSingle();

  if (roomError) {
    return NextResponse.json({ error: roomError.message }, { status: 500 });
  }

  if (!roomRow) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  if (roomRow.status !== "waiting") {
    return NextResponse.json(
      { error: "Room is not waiting for members." },
      { status: 400 },
    );
  }

  const userId =
    typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : crypto.randomUUID();

  const { data: existingMemberRow, error: existingMemberError } = await supabase
    .from("room_members")
    .select()
    .eq("room_id", roomRow.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMemberError) {
    return NextResponse.json(
      { error: existingMemberError.message },
      { status: 500 },
    );
  }

  if (existingMemberRow) {
    const { data: updatedMemberRow, error: updateError } = await supabase
      .from("room_members")
      .update({
        display_name: displayName,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existingMemberRow.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      room: mapOnlineRoom(roomRow),
      member: mapRoomMember(updatedMemberRow),
    });
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("room_members")
    .insert({
      room_id: roomRow.id,
      user_id: userId,
      display_name: displayName,
      role: "player",
    })
    .select()
    .single();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({
    room: mapOnlineRoom(roomRow),
    member: mapRoomMember(memberRow),
  });
}
