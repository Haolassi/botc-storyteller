import { NextResponse } from "next/server";

import { mapOnlineRoom, mapRoomMember } from "@/lib/online/roomMapping";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type RoomRouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

export async function GET(_request: Request, context: RoomRouteContext) {
  const { roomId } = await context.params;
  const supabase = createServiceSupabaseClient();

  const { data: roomRow, error: roomError } = await supabase
    .from("online_rooms")
    .select()
    .eq("id", roomId)
    .single();

  if (roomError) {
    return NextResponse.json(
      { error: roomError.message },
      { status: roomError.code === "PGRST116" ? 404 : 500 },
    );
  }

  const { data: memberRows, error: membersError } = await supabase
    .from("room_members")
    .select()
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  if (membersError) {
    return NextResponse.json(
      { error: membersError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    room: mapOnlineRoom(roomRow),
    members: (memberRows ?? []).map(mapRoomMember),
  });
}
