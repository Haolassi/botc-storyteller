import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { mapOnlineRoom } from "@/lib/online/roomMapping";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getVisibleGameState, type VisibleGameState } from "@/lib/visibility";
import type { Game } from "@/types/game";
import type { OnlineRoom } from "@/types/online";
import { OnlineGameClient } from "./OnlineGameClient";

type OnlineGamePageProps = {
  params: Promise<{
    gameId: string;
  }>;
};

type OnlineGameResult =
  | {
      game: VisibleGameState;
      room: OnlineRoom;
      version: number;
    }
  | {
      error: string;
    };

async function getOnlineGame(gameId: string): Promise<OnlineGameResult> {
  const supabase = createServiceSupabaseClient();
  const { data: gameStateRow, error: gameStateError } = await supabase
    .from("game_states")
    .select()
    .eq("game_id", gameId)
    .single();

  if (gameStateError || !gameStateRow) {
    return { error: gameStateError?.message ?? "联机游戏不存在。" };
  }

  const { data: roomRow, error: roomError } = await supabase
    .from("online_rooms")
    .select()
    .eq("id", gameStateRow.room_id)
    .single();

  if (roomError || !roomRow) {
    return { error: roomError?.message ?? "联机房间不存在。" };
  }

  return {
    game: getVisibleGameState(gameStateRow.state_json as unknown as Game, {
      type: "spectator",
    }),
    room: mapOnlineRoom(roomRow),
    version: gameStateRow.version,
  };
}

export default async function OnlineGamePage({ params }: OnlineGamePageProps) {
  const { gameId } = await params;
  const result = await getOnlineGame(gameId);

  if ("error" in result) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="联机游戏"
          title="读取联机游戏失败"
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
    <OnlineGameClient
      initialGame={result.game}
      initialRoom={result.room}
      initialVersion={result.version}
    />
  );
}
