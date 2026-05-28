import { NextResponse } from "next/server";

import { generateRoomCode } from "@/lib/online/roomCode";
import { mapOnlineRoom, mapRoomMember } from "@/lib/online/roomMapping";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const MAX_ROOM_CODE_ATTEMPTS = 5;

type CreateRoomRequestBody = {
  displayName?: unknown;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

export async function POST(request: Request) {
  let body: CreateRoomRequestBody;

  try {
    body = (await request.json()) as CreateRoomRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";

  if (!displayName) {
    return NextResponse.json(
      { error: "Display name is required." },
      { status: 400 },
    );
  }

  const supabase = createServiceSupabaseClient();
  const userId = crypto.randomUUID();

  for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
    const roomCode = generateRoomCode();
    const { data: roomRow, error: roomError } = await supabase
      .from("online_rooms")
      .insert({
        room_code: roomCode,
        storyteller_user_id: userId,
        status: "waiting",
      })
      .select()
      .single();

    if (roomError) {
      if (roomError.code === "23505" && attempt < MAX_ROOM_CODE_ATTEMPTS - 1) {
        continue;
      }

      return NextResponse.json(
        { error: roomError.message },
        { status: 500 },
      );
    }

    const { data: memberRow, error: memberError } = await supabase
      .from("room_members")
      .insert({
        room_id: roomRow.id,
        user_id: userId,
        display_name: displayName,
        role: "storyteller",
      })
      .select()
      .single();

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      room: mapOnlineRoom(roomRow),
      member: mapRoomMember(memberRow),
    });
  }

  return NextResponse.json(
    { error: getErrorMessage(new Error("Unable to generate a unique room code.")) },
    { status: 500 },
  );
}
