"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { FormEvent } from "react";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  clearOnlineRoomIdentity,
  getOnlineMemberId,
  subscribeOnlineIdentityChange,
  updateOnlineIdentity,
} from "@/lib/online/browserIdentity";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Game } from "@/types/game";
import type { OnlineRoom, RoomMember } from "@/types/online";

type RoomWaitingClientProps = {
  initialRoom: OnlineRoom;
  initialMembers: RoomMember[];
};

type RoomResponse =
  | {
      room: OnlineRoom;
      members: RoomMember[];
    }
  | {
      error: string;
    };

type StartGameResponse =
  | {
      room: OnlineRoom;
      game: Game;
    }
  | {
      error: string;
    };

type PlaceholderMemberResponse =
  | {
      member: RoomMember;
    }
  | {
      error: string;
    };

type DeletePlaceholderMemberResponse =
  | {
      ok: true;
    }
  | {
      error: string;
    };

type LeaveRoomResponse =
  | {
      ok: true;
    }
  | {
      error: string;
    };

type RealtimeStatus = "connecting" | "connected" | "error" | "disconnected";

const roleLabels: Record<RoomMember["role"], string> = {
  storyteller: "说书人",
  player: "玩家",
  spectator: "观战者",
};

const statusLabels: Record<OnlineRoom["status"], string> = {
  waiting: "等待中",
  playing: "游戏中",
  ended: "已结束",
};

const realtimeStatusLabels: Record<RealtimeStatus, string> = {
  connecting: "连接中，自动刷新已启用",
  connected: "实时连接正常",
  error: "实时连接异常，已启用自动刷新",
  disconnected: "已断开，已启用自动刷新",
};

function getOnlineMemberIdSnapshot() {
  return getOnlineMemberId();
}

function getServerOnlineMemberIdSnapshot() {
  return null;
}

function isPlaceholderMember(member: RoomMember) {
  return member.userId.startsWith("placeholder:");
}

export function RoomWaitingClient({
  initialRoom,
  initialMembers,
}: RoomWaitingClientProps) {
  const router = useRouter();
  const hasNavigatedRef = useRef(false);
  const isMountedRef = useRef(false);
  const isRefreshingRoomRef = useRef(false);
  const [room, setRoom] = useState(initialRoom);
  const [members, setMembers] = useState(initialMembers);
  const onlineMemberId = useSyncExternalStore(
    subscribeOnlineIdentityChange,
    getOnlineMemberIdSnapshot,
    getServerOnlineMemberIdSnapshot,
  );
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [placeholderName, setPlaceholderName] = useState("");
  const [isAddingPlaceholder, setIsAddingPlaceholder] = useState(false);
  const [deletingPlaceholderMemberId, setDeletingPlaceholderMemberId] =
    useState<string | null>(null);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((first, second) =>
        first.joinedAt.localeCompare(second.joinedAt),
      ),
    [members],
  );

  const currentMember = useMemo(
    () => members.find((member) => member.id === onlineMemberId),
    [members, onlineMemberId],
  );
  const isStoryteller = currentMember?.role === "storyteller";
  const canManageWaitingRoom = isStoryteller && room.status === "waiting";
  const canLeaveWaitingRoom =
    currentMember?.role === "player" &&
    !isPlaceholderMember(currentMember) &&
    room.status === "waiting";

  const navigateToGameOnce = useCallback(
    (gameId: string) => {
      if (hasNavigatedRef.current) {
        return;
      }

      hasNavigatedRef.current = true;
      updateOnlineIdentity({ gameId });
      router.push(`/online/games/${gameId}`);
    },
    [router],
  );

  const refreshRoom = useCallback(async () => {
    if (isRefreshingRoomRef.current) {
      return;
    }

    isRefreshingRoomRef.current = true;

    try {
      const response = await fetch(`/api/online/rooms/${room.id}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as RoomResponse;

      if (!response.ok || "error" in result) {
        if (!isMountedRef.current) {
          return;
        }

        setError("error" in result ? result.error : "刷新房间信息失败。");
        return;
      }

      if (!isMountedRef.current) {
        return;
      }

      setRoom(result.room);
      setMembers(result.members);
      setError(null);

      if (result.room.status === "playing" && result.room.gameId) {
        navigateToGameOnce(result.room.gameId);
      }
    } catch (caughtError) {
      if (!isMountedRef.current) {
        return;
      }

      setError(
        caughtError instanceof Error ? caughtError.message : "刷新房间信息失败。",
      );
    } finally {
      isRefreshingRoomRef.current = false;
    }
  }, [navigateToGameOnce, room.id]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (room.status === "playing" && room.gameId) {
      navigateToGameOnce(room.gameId);
    }
  }, [navigateToGameOnce, room.gameId, room.status]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshRoom();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshRoom]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`room-waiting:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          void refreshRoom();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "online_rooms",
          filter: `id=eq.${room.id}`,
        },
        () => {
          void refreshRoom();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("error");
          return;
        }

        if (status === "CLOSED") {
          setRealtimeStatus("disconnected");
        }
      });

    return () => {
      setRealtimeStatus("disconnected");
      void supabase.removeChannel(channel);
    };
  }, [refreshRoom, room.id]);

  const handleAddPlaceholderMember = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!onlineMemberId) {
      setError("缺少当前成员身份，请重新进入房间。");
      return;
    }

    const displayName = placeholderName.trim();

    if (!displayName) {
      setError("请输入占位玩家名称。");
      return;
    }

    setIsAddingPlaceholder(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/online/rooms/${room.id}/placeholder-members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId: onlineMemberId,
            displayName,
          }),
        },
      );
      const result = (await response.json()) as PlaceholderMemberResponse;

      if (!response.ok || "error" in result) {
        setError("error" in result ? result.error : "添加占位玩家失败。");
        return;
      }

      setPlaceholderName("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "添加占位玩家失败。",
      );
    } finally {
      setIsAddingPlaceholder(false);
    }
  };

  const handleDeletePlaceholderMember = async (targetMember: RoomMember) => {
    if (!onlineMemberId) {
      setError("缺少当前成员身份，请重新进入房间。");
      return;
    }

    setDeletingPlaceholderMemberId(targetMember.id);
    setError(null);

    try {
      const response = await fetch(
        `/api/online/rooms/${room.id}/placeholder-members`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            memberId: onlineMemberId,
            placeholderMemberId: targetMember.id,
          }),
        },
      );
      const result = (await response.json()) as DeletePlaceholderMemberResponse;

      if (!response.ok || "error" in result) {
        setError("error" in result ? result.error : "删除占位玩家失败。");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "删除占位玩家失败。",
      );
    } finally {
      setDeletingPlaceholderMemberId(null);
    }
  };

  const handleLeaveRoom = async () => {
    if (!onlineMemberId) {
      setError("缺少当前成员身份，请重新进入房间。");
      return;
    }

    setIsLeavingRoom(true);
    setError(null);

    try {
      const response = await fetch(`/api/online/rooms/${room.id}/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: onlineMemberId,
        }),
      });
      const result = (await response.json()) as LeaveRoomResponse;

      if (!response.ok || "error" in result) {
        setError("error" in result ? result.error : "离开房间失败。");
        return;
      }

      clearOnlineRoomIdentity();
      router.push("/online");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "离开房间失败。",
      );
    } finally {
      setIsLeavingRoom(false);
    }
  };

  const handleStartGame = async () => {
    if (!onlineMemberId) {
      setError("缺少当前成员身份，请重新进入房间。");
      return;
    }

    setIsStartingGame(true);
    setError(null);

    try {
      const response = await fetch(`/api/online/rooms/${room.id}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: onlineMemberId,
        }),
      });
      const result = (await response.json()) as StartGameResponse;

      if (!response.ok || "error" in result) {
        setError("error" in result ? result.error : "开始联机游戏失败。");
        return;
      }

      navigateToGameOnce(result.game.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "开始联机游戏失败。",
      );
    } finally {
      setIsStartingGame(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="联机房间"
        title={`房间 ${room.roomCode}`}
        description="成员列表和房间状态已启用实时同步。"
        actions={
          <Button asChild variant="outline">
            <Link href="/online">
              <ArrowLeft aria-hidden="true" />
              返回联机入口
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-950">房间信息</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">房间码</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-widest">
                {room.roomCode}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">状态</dt>
              <dd className="mt-1 font-medium">{statusLabels[room.status]}</dd>
            </div>
            <div>
              <dt className="text-gray-500">实时同步</dt>
              <dd className="mt-1 font-medium">
                {realtimeStatusLabels[realtimeStatus]}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">当前成员数</dt>
              <dd className="mt-1 font-medium">{members.length}</dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-gray-100 pt-4">
            {room.status === "playing" && room.gameId ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">游戏已开始，正在跳转。</p>
                <Button asChild>
                  <Link href={`/online/games/${room.gameId}`}>进入联机游戏</Link>
                </Button>
              </div>
            ) : canManageWaitingRoom ? (
              <Button onClick={handleStartGame} disabled={isStartingGame}>
                {isStartingGame ? "正在开始..." : "开始联机游戏"}
              </Button>
            ) : room.status === "waiting" ? (
              <p className="text-sm text-gray-500">等待说书人开始游戏。</p>
            ) : (
              <p className="text-sm text-gray-500">房间已不在等待状态。</p>
            )}
          </div>

          {canLeaveWaitingRoom ? (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleLeaveRoom}
                disabled={isLeavingRoom}
              >
                {isLeavingRoom ? "离开中..." : "离开房间"}
              </Button>
            </div>
          ) : isStoryteller && room.status === "waiting" ? (
            <p className="mt-4 text-sm text-gray-500">
              说书人暂不支持离开房间。
            </p>
          ) : null}

          {canManageWaitingRoom ? (
            <form
              className="mt-6 space-y-3 border-t border-gray-100 pt-4"
              onSubmit={handleAddPlaceholderMember}
            >
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="placeholder-name"
              >
                添加占位玩家
              </label>
              <div className="flex gap-2">
                <input
                  id="placeholder-name"
                  value={placeholderName}
                  onChange={(event) => setPlaceholderName(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="输入玩家名称"
                  disabled={isAddingPlaceholder}
                />
                <Button type="submit" disabled={isAddingPlaceholder}>
                  {isAddingPlaceholder ? "添加中..." : "添加"}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                占位玩家没有真实用户连接，但会参与本房间开局。
              </p>
            </form>
          ) : null}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-950">成员列表</h2>
          <div className="mt-4 space-y-2">
            {sortedMembers.map((member) => {
              const isPlaceholder = isPlaceholderMember(member);
              const canDeletePlaceholder =
                canManageWaitingRoom && isPlaceholder;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{member.displayName}</span>
                  <span className="flex items-center gap-2 text-gray-500">
                    {isPlaceholder ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        占位
                      </span>
                    ) : null}
                    {roleLabels[member.role]}
                    {canDeletePlaceholder ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletingPlaceholderMemberId === member.id}
                        onClick={() => handleDeletePlaceholderMember(member)}
                      >
                        {deletingPlaceholderMemberId === member.id
                          ? "删除中..."
                          : "删除"}
                      </Button>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          {error ? (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              新成员加入或游戏开始后会自动同步。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
