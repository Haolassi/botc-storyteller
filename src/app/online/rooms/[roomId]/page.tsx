import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { mapOnlineRoom, mapRoomMember } from "@/lib/online/roomMapping";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { OnlineRoom, RoomMember } from "@/types/online";
import { RoomWaitingClient } from "./RoomWaitingClient";

type OnlineRoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

type RoomResponse =
  | {
      room: OnlineRoom;
      members: RoomMember[];
    }
  | {
      error: string;
    };

async function getRoom(roomId: string): Promise<RoomResponse> {
  const supabase = createServiceSupabaseClient();
  const { data: roomRow, error: roomError } = await supabase
    .from("online_rooms")
    .select()
    .eq("id", roomId)
    .single();

  if (roomError) {
    return { error: roomError.message };
  }

  const { data: memberRows, error: membersError } = await supabase
    .from("room_members")
    .select()
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  if (membersError) {
    return { error: membersError.message };
  }

  return {
    room: mapOnlineRoom(roomRow),
    members: (memberRows ?? []).map(mapRoomMember),
  };
}

export default async function OnlineRoomPage({ params }: OnlineRoomPageProps) {
  const { roomId } = await params;
  const result = await getRoom(roomId);

  if ("error" in result) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="联机房间"
          title="读取房间失败"
          description={result.error}
          actions={
            <Button asChild variant="outline">
              <Link href="/online">
                <ArrowLeft aria-hidden="true" />
                返回联机入口
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <RoomWaitingClient
      initialRoom={result.room}
      initialMembers={result.members}
    />
  );
}
