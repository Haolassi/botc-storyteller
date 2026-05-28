"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { FormEvent } from "react";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentNightStep, getNightActorForStep } from "@/lib/nightActions";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { VisibleGameState } from "@/lib/visibility";
import type { GameAction } from "@/types/actions";
import type {
  DaySubPhase,
  Game,
  GamePhase,
  GameStatus,
} from "@/types/game";
import type { OnlineRoom, OnlineRoomRole, RoomMember } from "@/types/online";

type OnlineClientGame = Game | VisibleGameState;

type OnlineGameClientProps = {
  initialGame: VisibleGameState;
  initialRoom: OnlineRoom;
  initialVersion: number;
};

type OnlineGameResponse =
  | {
      game: OnlineClientGame;
      room: OnlineRoom;
      version: number;
      viewerRole: OnlineRoomRole;
      member?: RoomMember;
    }
  | {
      error: string;
    };

type SubmitActionResponse =
  | {
      game: Game;
      version: number;
    }
  | {
      error: string;
      currentVersion?: number;
    };

type RealtimeStatus = "connecting" | "connected" | "error" | "disconnected";

const daySubPhases: DaySubPhase[] = [
  "private_chat",
  "speeches",
  "open_discussion",
  "nomination",
];

const phaseLabels: Record<GamePhase, string> = {
  dusk: "黄昏",
  night: "夜晚",
  day: "白天",
  ended: "已结束",
};

const gameStatusLabels: Record<GameStatus, string> = {
  setup: "设置中",
  running: "进行中",
  finished: "已结束",
};

const daySubPhaseLabels: Record<DaySubPhase, string> = {
  private_chat: "私聊",
  speeches: "发言",
  open_discussion: "公开讨论",
  nomination: "提名",
};

const realtimeStatusLabels: Record<RealtimeStatus, string> = {
  connecting: "连接中",
  connected: "已连接",
  error: "连接异常",
  disconnected: "已断开",
};

function subscribeOnlineMemberId(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
  };
}

function getOnlineMemberIdSnapshot() {
  return window.localStorage.getItem("onlineMemberId");
}

function getServerOnlineMemberIdSnapshot() {
  return null;
}

function isFullGame(game: OnlineClientGame): game is Game {
  return (
    "setupState" in game &&
    "nightActionState" in game &&
    "history" in game &&
    Array.isArray(game.history)
  );
}

function buildGameUrl(gameId: string, memberId: string | null) {
  if (!memberId) {
    return `/api/online/games/${gameId}`;
  }

  return `/api/online/games/${gameId}?memberId=${encodeURIComponent(memberId)}`;
}

export function OnlineGameClient({
  initialGame,
  initialRoom,
  initialVersion,
}: OnlineGameClientProps) {
  const gameId = initialGame.id;
  const [game, setGame] = useState<OnlineClientGame>(initialGame);
  const [room, setRoom] = useState(initialRoom);
  const [version, setVersion] = useState(initialVersion);
  const [viewerRole, setViewerRole] = useState<OnlineRoomRole>("spectator");
  const [member, setMember] = useState<RoomMember | null>(null);
  const onlineMemberId = useSyncExternalStore(
    subscribeOnlineMemberId,
    getOnlineMemberIdSnapshot,
    getServerOnlineMemberIdSnapshot,
  );
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const [nominatorPlayerId, setNominatorPlayerId] = useState("");
  const [nomineePlayerId, setNomineePlayerId] = useState("");
  const [votePlayerIds, setVotePlayerIds] = useState<string[]>([]);
  const [slayerPlayerId, setSlayerPlayerId] = useState("");
  const [slayerTargetPlayerId, setSlayerTargetPlayerId] = useState("");
  const [nightTargetPlayerIds, setNightTargetPlayerIds] = useState<string[]>([]);
  const [nightSelectedCharacterId, setNightSelectedCharacterId] = useState("");
  const [nightActionNote, setNightActionNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fullGame = isFullGame(game) ? game : null;
  const isStoryteller = viewerRole === "storyteller" && Boolean(fullGame);
  const visiblePrivateInfos = game.privateInfos ?? [];
  const pendingDeathPlayer = game.executionState?.pendingDeathPlayerId
    ? game.players.find(
        (player) => player.id === game.executionState?.pendingDeathPlayerId,
      )
    : undefined;
  const nominations = game.executionState?.nominations ?? [];
  const canResolveNomination =
    isStoryteller &&
    fullGame?.currentPhase === "day" &&
    fullGame.currentDaySubPhase === "nomination";
  const slayerPlayers = fullGame
    ? fullGame.players.filter((player) => player.characterId === "slayer")
    : [];
  const selectedSlayerPlayerId =
    slayerPlayerId || (slayerPlayers.length === 1 ? slayerPlayers[0].id : "");
  const selectedSlayerPlayer = selectedSlayerPlayerId
    ? slayerPlayers.find((player) => player.id === selectedSlayerPlayerId)
    : undefined;
  const usedSlayerPlayerIds = fullGame?.setupState.usedSlayerPlayerIds ?? [];
  const isSelectedSlayerUsed = selectedSlayerPlayer
    ? usedSlayerPlayerIds.includes(selectedSlayerPlayer.id)
    : false;
  const canUseSlayerAbility =
    isStoryteller && fullGame?.currentPhase === "day" && slayerPlayers.length > 0;
  const currentNightStep =
    isStoryteller && fullGame?.currentPhase === "night"
      ? getCurrentNightStep(fullGame)
      : undefined;
  const currentNightActor =
    fullGame && currentNightStep?.characterId
      ? getNightActorForStep(fullGame, currentNightStep.characterId)
      : undefined;

  const getPlayerName = (playerId: string) => {
    const player = game.players.find((candidate) => candidate.id === playerId);

    return player ? `${player.seatNumber}. ${player.displayName}` : "未知玩家";
  };

  const applyGameResponse = useCallback((result: OnlineGameResponse) => {
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setGame(result.game);
    setRoom(result.room);
    setVersion(result.version);
    setViewerRole(result.viewerRole);
    setMember(result.member ?? null);
    setError(null);
  }, []);

  const refreshGame = useCallback(async () => {
    try {
      const response = await fetch(buildGameUrl(gameId, onlineMemberId), {
        cache: "no-store",
      });
      const result = (await response.json()) as OnlineGameResponse;

      if (!response.ok || "error" in result) {
        setError("error" in result ? result.error : "刷新游戏状态失败。");
        return;
      }

      applyGameResponse(result);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "刷新游戏状态失败。",
      );
    }
  }, [applyGameResponse, gameId, onlineMemberId]);

  useEffect(() => {
    let isCancelled = false;

    fetch(buildGameUrl(gameId, onlineMemberId), {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = (await response.json()) as OnlineGameResponse;

        if (isCancelled) {
          return;
        }

        if (!response.ok || "error" in result) {
          setError("error" in result ? result.error : "读取可见游戏状态失败。");
          return;
        }

        applyGameResponse(result);
      })
      .catch((caughtError: unknown) => {
        if (isCancelled) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "读取可见游戏状态失败。",
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [applyGameResponse, gameId, onlineMemberId]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`game-state:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_states",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          void refreshGame();
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
  }, [gameId, refreshGame]);

  const submitRemoteAction = async (action: GameAction): Promise<boolean> => {
    if (!onlineMemberId) {
      setError("缺少当前成员身份，请重新进入房间。");
      return false;
    }

    if (!isStoryteller) {
      setError("只有说书人可以提交游戏操作。");
      return false;
    }

    setIsSubmittingAction(true);
    setError(null);

    try {
      const response = await fetch(`/api/online/games/${gameId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: onlineMemberId,
          action,
          expectedVersion: version,
          clientActionId: crypto.randomUUID(),
        }),
      });
      const result = (await response.json()) as SubmitActionResponse;

      if (!response.ok || "error" in result) {
        setError("error" in result ? result.error : "提交远端操作失败。");
        if (
          "currentVersion" in result &&
          typeof result.currentVersion === "number"
        ) {
          setVersion(result.currentVersion);
        }
        return false;
      }

      setGame(result.game);
      setVersion(result.version);
      return true;
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "提交远端操作失败。",
      );
      return false;
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAdvancePhase = () => {
    void submitRemoteAction({
      type: "ADVANCE_PHASE",
    });
  };

  const handleSetDaySubPhase = (subPhase: DaySubPhase) => {
    void submitRemoteAction({
      type: "SET_DAY_SUB_PHASE",
      payload: {
        subPhase,
      },
    });
  };

  const handleAddManualNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const description = noteDescription.trim();

    if (!description) {
      setError("请输入备注内容。");
      return;
    }

    const ok = await submitRemoteAction({
      type: "ADD_MANUAL_NOTE",
      payload: {
        title: noteTitle.trim() || undefined,
        description,
        createdAt: new Date().toISOString(),
      },
    });

    if (ok) {
      setNoteTitle("");
      setNoteDescription("");
    }
  };

  const handleUpdatePlayerStatus = (
    playerId: string,
    field: "isAlive" | "isDrunk" | "isPoisoned",
    nextValue: boolean,
  ) => {
    void submitRemoteAction({
      type: "UPDATE_PLAYER_STATUS",
      payload: {
        playerId,
        [field]: nextValue,
        createdAt: new Date().toISOString(),
      },
    });
  };

  const handleToggleVotePlayer = (playerId: string) => {
    setVotePlayerIds((currentVotePlayerIds) =>
      currentVotePlayerIds.includes(playerId)
        ? currentVotePlayerIds.filter((id) => id !== playerId)
        : [...currentVotePlayerIds, playerId],
    );
  };

  const handleToggleNightTargetPlayer = (playerId: string) => {
    setNightTargetPlayerIds((currentTargetPlayerIds) =>
      currentTargetPlayerIds.includes(playerId)
        ? currentTargetPlayerIds.filter((id) => id !== playerId)
        : [...currentTargetPlayerIds, playerId],
    );
  };

  const handleResolveNomination = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!nominatorPlayerId || !nomineePlayerId) {
      setError("请选择提名人和被提名人。");
      return;
    }

    const ok = await submitRemoteAction({
      type: "RESOLVE_NOMINATION",
      payload: {
        nominatorPlayerId,
        nomineePlayerId,
        votePlayerIds,
        createdAt: new Date().toISOString(),
      },
    });

    if (ok) {
      setNominatorPlayerId("");
      setNomineePlayerId("");
      setVotePlayerIds([]);
    }
  };

  const handleUseSlayerAbility = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedSlayerPlayerId || !slayerTargetPlayerId) {
      setError("请选择猎手玩家和目标玩家。");
      return;
    }

    if (isSelectedSlayerUsed) {
      setError("该猎手已使用技能。");
      return;
    }

    const ok = await submitRemoteAction({
      type: "USE_DAY_ABILITY",
      payload: {
        characterId: "slayer",
        actorPlayerId: selectedSlayerPlayerId,
        targetPlayerId: slayerTargetPlayerId,
        createdAt: new Date().toISOString(),
      },
    });

    if (ok) {
      setSlayerTargetPlayerId("");
    }
  };

  const handleApplyNightAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const ok = await submitRemoteAction({
      type: "APPLY_NIGHT_ACTION",
      payload: {
        stepId: currentNightStep?.id,
        characterId: currentNightStep?.characterId,
        actorPlayerId: currentNightActor?.id,
        targetPlayerIds: nightTargetPlayerIds,
        selectedCharacterId: nightSelectedCharacterId.trim() || undefined,
        note: nightActionNote.trim() || undefined,
        createdAt: new Date().toISOString(),
      },
    });

    if (ok) {
      setNightTargetPlayerIds([]);
      setNightActionNote("");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="联机游戏"
        title={`房间 ${room.roomCode}`}
        description="游戏状态实时同步已接入；玩家视角已按可见信息过滤。"
        actions={
          <Button asChild variant="outline">
            <Link href={`/online/rooms/${room.id}`}>
              <ArrowLeft aria-hidden="true" />
              返回房间
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-950">游戏信息</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">游戏编号</dt>
                <dd className="mt-1 font-mono text-gray-950">{game.id}</dd>
              </div>
              <div>
                <dt className="text-gray-500">房间码</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-widest">
                  {room.roomCode}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">当前视角</dt>
                <dd className="mt-1 font-medium">
                  {viewerRole === "storyteller"
                    ? "说书人"
                    : viewerRole === "player"
                      ? "玩家"
                      : "观战者"}
                  {member ? `：${member.displayName}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">版本</dt>
                <dd className="mt-1 font-medium">{version}</dd>
              </div>
              <div>
                <dt className="text-gray-500">实时同步</dt>
                <dd className="mt-1 font-medium">
                  {realtimeStatusLabels[realtimeStatus]}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">游戏状态</dt>
                <dd className="mt-1 font-medium">
                  {gameStatusLabels[game.status]}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">当前阶段</dt>
                <dd className="mt-1 font-medium">
                  {phaseLabels[game.currentPhase]}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">白天子阶段</dt>
                <dd className="mt-1 font-medium">
                  {game.currentDaySubPhase
                    ? daySubPhaseLabels[game.currentDaySubPhase]
                    : "无"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">当前天数</dt>
                <dd className="mt-1 font-medium">{game.currentDay}</dd>
              </div>
            </dl>

            {error ? (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            ) : null}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-950">
              提名与处决
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <span className="text-gray-500">当前处决候选：</span>
                <span className="font-medium">
                  {pendingDeathPlayer
                    ? `${pendingDeathPlayer.seatNumber}. ${pendingDeathPlayer.displayName}`
                    : "无"}
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-gray-500">今日提名记录</p>
                {nominations.length > 0 ? (
                  <div className="space-y-2">
                    {nominations.map((nomination) => (
                      <div
                        key={nomination.id}
                        className="rounded-lg bg-gray-50 px-3 py-2"
                      >
                        <div>
                          {getPlayerName(nomination.nominatorPlayerId)} 提名{" "}
                          {getPlayerName(nomination.nomineePlayerId)}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {nomination.voteCount} 票 / 需{" "}
                          {nomination.requiredVotes} 票
                          {nomination.isOnBlock ? "，当前上处决台" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">暂无提名。</p>
                )}
              </div>
            </div>
          </div>

          {visiblePrivateInfos.length > 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-950">
                我的信息
              </h2>
              <div className="mt-4 space-y-2 text-sm">
                {visiblePrivateInfos.map((privateInfo) => (
                  <div
                    key={privateInfo.id}
                    className="rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <div className="font-medium">{privateInfo.title}</div>
                    <div className="mt-1 text-gray-600">
                      {privateInfo.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isStoryteller && fullGame ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-950">
                说书人操作
              </h2>

              <div className="mt-4 space-y-6">
                <div>
                  <Button
                    onClick={handleAdvancePhase}
                    disabled={isSubmittingAction}
                  >
                    {isSubmittingAction ? "提交中..." : "推进阶段"}
                  </Button>
                </div>

                {fullGame.currentPhase === "day" ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      白天子阶段
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {daySubPhases.map((subPhase) => (
                        <Button
                          key={subPhase}
                          type="button"
                          variant={
                            fullGame.currentDaySubPhase === subPhase
                              ? "default"
                              : "outline"
                          }
                          disabled={isSubmittingAction}
                          onClick={() => handleSetDaySubPhase(subPhase)}
                        >
                          {daySubPhaseLabels[subPhase]}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {fullGame.currentPhase === "night" ? (
                  <form
                    className="space-y-4 border-t border-gray-100 pt-4"
                    onSubmit={handleApplyNightAction}
                  >
                    <h3 className="text-sm font-medium text-gray-700">
                      夜晚行动
                    </h3>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-gray-500">当前步骤序号</dt>
                        <dd className="font-medium">
                          {fullGame.nightActionState.currentStepIndex}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">已完成步骤数</dt>
                        <dd className="font-medium">
                          {fullGame.nightActionState.completedStepIds.length}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">当前步骤</dt>
                        <dd className="font-medium">
                          {currentNightStep?.id ?? "当前夜晚步骤"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">当前角色</dt>
                        <dd className="font-medium">
                          {currentNightStep?.characterId ?? "无"}
                        </dd>
                      </div>
                    </dl>

                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium text-gray-700">
                        目标玩家
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {fullGame.players.map((player) => (
                          <label
                            key={player.id}
                            className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={nightTargetPlayerIds.includes(player.id)}
                              onChange={() =>
                                handleToggleNightTargetPlayer(player.id)
                              }
                              disabled={isSubmittingAction}
                            />
                            <span>
                              {player.seatNumber}. {player.displayName}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div>
                      <label
                        className="block text-sm font-medium text-gray-700"
                        htmlFor="night-selected-character"
                      >
                        选择角色
                      </label>
                      <input
                        id="night-selected-character"
                        value={nightSelectedCharacterId}
                        onChange={(event) =>
                          setNightSelectedCharacterId(event.target.value)
                        }
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                        placeholder="可选，填写角色 id"
                        disabled={isSubmittingAction}
                      />
                    </div>

                    <div>
                      <label
                        className="block text-sm font-medium text-gray-700"
                        htmlFor="night-action-note"
                      >
                        备注
                      </label>
                      <textarea
                        id="night-action-note"
                        value={nightActionNote}
                        onChange={(event) => setNightActionNote(event.target.value)}
                        className="mt-1 min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                        placeholder="可选"
                        disabled={isSubmittingAction}
                      />
                    </div>

                    <Button type="submit" disabled={isSubmittingAction}>
                      {isSubmittingAction ? "提交中..." : "完成夜晚行动"}
                    </Button>
                  </form>
                ) : null}

                {canUseSlayerAbility ? (
                  <form
                    className="space-y-4 border-t border-gray-100 pt-4"
                    onSubmit={handleUseSlayerAbility}
                  >
                    <h3 className="text-sm font-medium text-gray-700">
                      白天技能 / 猎手
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          className="block text-sm font-medium text-gray-700"
                          htmlFor="slayer-actor"
                        >
                          猎手玩家
                        </label>
                        <select
                          id="slayer-actor"
                          value={selectedSlayerPlayerId}
                          onChange={(event) =>
                            setSlayerPlayerId(event.target.value)
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          disabled={isSubmittingAction}
                        >
                          <option value="">选择猎手</option>
                          {slayerPlayers.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.seatNumber}. {player.displayName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          className="block text-sm font-medium text-gray-700"
                          htmlFor="slayer-target"
                        >
                          目标玩家
                        </label>
                        <select
                          id="slayer-target"
                          value={slayerTargetPlayerId}
                          onChange={(event) =>
                            setSlayerTargetPlayerId(event.target.value)
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          disabled={isSubmittingAction || isSelectedSlayerUsed}
                        >
                          <option value="">选择目标</option>
                          {fullGame.players.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.seatNumber}. {player.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <p className="text-sm text-gray-500">
                      {selectedSlayerPlayer
                        ? isSelectedSlayerUsed
                          ? "该猎手已使用技能。"
                          : "该猎手尚未使用技能。"
                        : "请选择猎手玩家。"}
                    </p>

                    <Button
                      type="submit"
                      disabled={
                        isSubmittingAction ||
                        !selectedSlayerPlayerId ||
                        !slayerTargetPlayerId ||
                        isSelectedSlayerUsed
                      }
                    >
                      {isSubmittingAction ? "提交中..." : "使用猎手技能"}
                    </Button>
                  </form>
                ) : null}

                {canResolveNomination ? (
                  <form
                    className="space-y-4 border-t border-gray-100 pt-4"
                    onSubmit={handleResolveNomination}
                  >
                    <h3 className="text-sm font-medium text-gray-700">
                      提名 / 投票
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          className="block text-sm font-medium text-gray-700"
                          htmlFor="nomination-nominator"
                        >
                          提名人
                        </label>
                        <select
                          id="nomination-nominator"
                          value={nominatorPlayerId}
                          onChange={(event) =>
                            setNominatorPlayerId(event.target.value)
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          disabled={isSubmittingAction}
                        >
                          <option value="">选择提名人</option>
                          {fullGame.players.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.seatNumber}. {player.displayName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          className="block text-sm font-medium text-gray-700"
                          htmlFor="nomination-nominee"
                        >
                          被提名人
                        </label>
                        <select
                          id="nomination-nominee"
                          value={nomineePlayerId}
                          onChange={(event) =>
                            setNomineePlayerId(event.target.value)
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          disabled={isSubmittingAction}
                        >
                          <option value="">选择被提名人</option>
                          {fullGame.players.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.seatNumber}. {player.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium text-gray-700">
                        投票玩家
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {fullGame.players.map((player) => (
                          <label
                            key={player.id}
                            className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={votePlayerIds.includes(player.id)}
                              onChange={() => handleToggleVotePlayer(player.id)}
                              disabled={isSubmittingAction}
                            />
                            <span>
                              {player.seatNumber}. {player.displayName}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <Button type="submit" disabled={isSubmittingAction}>
                      {isSubmittingAction ? "提交中..." : "提交提名结果"}
                    </Button>
                  </form>
                ) : null}

                <form className="space-y-3" onSubmit={handleAddManualNote}>
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="manual-note-title"
                    >
                      备注标题
                    </label>
                    <input
                      id="manual-note-title"
                      value={noteTitle}
                      onChange={(event) => setNoteTitle(event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                      placeholder="可选"
                      disabled={isSubmittingAction}
                    />
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="manual-note-description"
                    >
                      备注内容
                    </label>
                    <textarea
                      id="manual-note-description"
                      value={noteDescription}
                      onChange={(event) =>
                        setNoteDescription(event.target.value)
                      }
                      className="mt-1 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                      placeholder="输入需要记录的说书人备注"
                      disabled={isSubmittingAction}
                    />
                  </div>

                  <Button type="submit" disabled={isSubmittingAction}>
                    {isSubmittingAction ? "提交中..." : "添加备注"}
                  </Button>
                </form>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-950">玩家列表</h2>
          <div className="mt-4 space-y-3">
            {game.players.map((player) => (
              <div
                key={player.id}
                className="rounded-lg bg-gray-50 px-3 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {player.seatNumber}. {player.displayName}
                  </span>
                  <span className="text-gray-500">
                    {player.isAlive ? "存活" : "死亡"}
                  </span>
                </div>

                {player.characterId || player.alignment ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    {player.characterId ? <span>角色：{player.characterId}</span> : null}
                    {player.alignment ? <span>阵营：{player.alignment}</span> : null}
                  </div>
                ) : null}

                {isStoryteller && fullGame && "isDrunk" in player ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      <span>{player.isDrunk ? "醉酒" : "清醒"}</span>
                      <span>{player.isPoisoned ? "中毒" : "未中毒"}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSubmittingAction}
                        onClick={() =>
                          handleUpdatePlayerStatus(
                            player.id,
                            "isAlive",
                            !player.isAlive,
                          )
                        }
                      >
                        {player.isAlive ? "设为死亡" : "设为存活"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSubmittingAction}
                        onClick={() =>
                          handleUpdatePlayerStatus(
                            player.id,
                            "isDrunk",
                            !player.isDrunk,
                          )
                        }
                      >
                        {player.isDrunk ? "设为清醒" : "设为醉酒"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSubmittingAction}
                        onClick={() =>
                          handleUpdatePlayerStatus(
                            player.id,
                            "isPoisoned",
                            !player.isPoisoned,
                          )
                        }
                      >
                        {player.isPoisoned ? "取消中毒" : "设为中毒"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
