"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  generateSpeechOrder,
  logOpenDiscussionEnded,
  logOpenDiscussionStarted,
  logPrivateChatEnded,
  logPrivateChatStarted,
  logSpeechOrderGenerated,
  type SpeechDirection,
} from "@/lib/dayTools";
import {
  advanceGamePhase,
  applyWinCondition,
  daySubPhaseLabels,
  endGameManually,
  getAlivePlayerCount,
  getMaxNominations,
  getRequiredVotes,
  phaseLabels,
  retreatGamePhase,
  winningTeamLabels,
} from "@/lib/gameFlow";
import { getCharacterById, getScriptById } from "@/lib/gameData";
import { getLocalGameById, saveLocalGame } from "@/lib/localGames";
import {
  clearExecutionCandidate,
  createNomination,
  getCurrentExecutionCandidate,
  getNominationStatusForPlayer,
  getRemainingNominationCount,
} from "@/lib/nominations";
import {
  getApparentCharacter,
  getRealCharacter,
} from "@/lib/registrationLogic";
import {
  completeCurrentNightStep,
  getActiveNightSteps,
  getCurrentNightStep,
  getNightActorForStep,
  getNightPhaseForGame,
  getNightProgress,
  isPlayerActingAsDrunk,
  resetNightActions,
} from "@/lib/nightActions";
import type { Game, GamePlayer } from "@/types/game";

const alignmentLabels = {
  good: "善良",
  evil: "邪恶",
} as const;

function getSeatPosition(index: number, total: number) {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  const radius = 42;
  const x = 50 + radius * Math.cos(angle);
  const y = 50 + radius * Math.sin(angle);

  return {
    left: `${x}%`,
    top: `${y}%`,
  };
}

export default function GameDetailPage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  const [game, setGame] = useState<Game | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [nominatorPlayerId, setNominatorPlayerId] = useState("");
  const [nomineePlayerId, setNomineePlayerId] = useState("");
  const [votePlayerIds, setVotePlayerIds] = useState<string[]>([]);
  const [nominationError, setNominationError] = useState<string | null>(null);

  const [nightActionNote, setNightActionNote] = useState("");

  const [privateChatMinutes, setPrivateChatMinutes] = useState(5);
  const [privateChatSecondsRemaining, setPrivateChatSecondsRemaining] =
    useState(0);
  const [isPrivateChatTimerRunning, setIsPrivateChatTimerRunning] =
    useState(false);

  const [openDiscussionMinutes, setOpenDiscussionMinutes] = useState(5);
  const [openDiscussionSecondsRemaining, setOpenDiscussionSecondsRemaining] =
    useState(0);
  const [isOpenDiscussionTimerRunning, setIsOpenDiscussionTimerRunning] =
    useState(false);

  const [speechStartPlayerId, setSpeechStartPlayerId] = useState("");
  const [speechDirection, setSpeechDirection] =
    useState<SpeechDirection>("clockwise");
  const [speechOrderPlayerIds, setSpeechOrderPlayerIds] = useState<string[]>(
    [],
  );

  function updateGame(nextGame: Game) {
    setGame(nextGame);
    saveLocalGame(nextGame);
  }

  useEffect(() => {
    if (!gameId) {
      return;
    }

    queueMicrotask(() => {
      const savedGame = getLocalGameById(gameId);

      setGame(savedGame ?? null);
      setHasLoaded(true);
    });
  }, [gameId]);

  useEffect(() => {
    if (!isPrivateChatTimerRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPrivateChatSecondsRemaining((current) => {
        if (current <= 1) {
          setIsPrivateChatTimerRunning(false);

          if (
            game?.currentPhase === "day" &&
            game.currentDaySubPhase === "private_chat"
          ) {
            queueMicrotask(() => {
              updateGame(advanceGamePhase(game));
            });
          }

          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [game, isPrivateChatTimerRunning]);

  useEffect(() => {
    if (!isOpenDiscussionTimerRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setOpenDiscussionSecondsRemaining((current) => {
        if (current <= 1) {
          setIsOpenDiscussionTimerRunning(false);

          if (
            game?.currentPhase === "day" &&
            game.currentDaySubPhase === "open_discussion"
          ) {
            queueMicrotask(() => {
              updateGame(advanceGamePhase(game));
            });
          }

          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [game, isOpenDiscussionTimerRunning]);

  const script = game ? getScriptById(game.scriptId) : undefined;

  const sortedPlayers = useMemo(() => {
    if (!game) {
      return [];
    }

    return [...game.players].sort((a, b) => a.seatNumber - b.seatNumber);
  }, [game]);

  const alivePlayers = useMemo(() => {
    return sortedPlayers.filter((player) => player.isAlive);
  }, [sortedPlayers]);

  function updatePlayer(
    playerId: string,
    updater: (player: GamePlayer) => GamePlayer,
  ) {
    if (!game) {
      return;
    }

    const nextGame = applyWinCondition({
      ...game,
      players: game.players.map((player) =>
        player.id === playerId ? updater(player) : player,
      ),
      updatedAt: new Date().toISOString(),
    });

    updateGame(nextGame);
  }

  function handleAdvancePhase() {
    if (!game) {
      return;
    }

    updateGame(advanceGamePhase(game));
  }

  function handleRetreatPhase() {
    if (!game) {
      return;
    }

    updateGame(retreatGamePhase(game));
  }

  function handleManualWin(winningTeam: "good" | "evil") {
    if (!game) {
      return;
    }

    updateGame(endGameManually(game, winningTeam));
  }

  function toggleVotePlayer(playerId: string) {
    setVotePlayerIds((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId],
    );
  }

  function resetNominationForm() {
    setNominatorPlayerId("");
    setNomineePlayerId("");
    setVotePlayerIds([]);
    setNominationError(null);
  }

  function handleSubmitNomination() {
    if (!game) {
      return;
    }

    setNominationError(null);

    if (!nominatorPlayerId) {
      setNominationError("请选择提名者。");
      return;
    }

    if (!nomineePlayerId) {
      setNominationError("请选择被提名者。");
      return;
    }

    const result = createNomination({
      game,
      nominatorPlayerId,
      nomineePlayerId,
      votePlayerIds,
    });

    if (result.error) {
      setNominationError(result.error);
      return;
    }

    updateGame(result.game);
    resetNominationForm();
  }

  function handleClearExecutionCandidate() {
    if (!game) {
      return;
    }

    updateGame(clearExecutionCandidate(game));
  }

  function handleCompleteNightStep() {
    if (!game) {
      return;
    }

    updateGame(completeCurrentNightStep(game, nightActionNote));
    setNightActionNote("");
  }

  function handleResetNightActions() {
    if (!game) {
      return;
    }

    updateGame(resetNightActions(game));
    setNightActionNote("");
  }

  function formatSeconds(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function handleStartPrivateChatTimer() {
    if (!game) {
      return;
    }

    setPrivateChatSecondsRemaining(privateChatMinutes * 60);
    setIsPrivateChatTimerRunning(true);
    updateGame(logPrivateChatStarted(game, privateChatMinutes));
  }

  function handleEndPrivateChatTimer() {
    if (!game) {
      return;
    }

    setIsPrivateChatTimerRunning(false);
    updateGame(logPrivateChatEnded(game));
  }

  function handleStartOpenDiscussionTimer() {
    if (!game) {
      return;
    }

    setOpenDiscussionSecondsRemaining(openDiscussionMinutes * 60);
    setIsOpenDiscussionTimerRunning(true);
    updateGame(logOpenDiscussionStarted(game, openDiscussionMinutes));
  }

  function handleEndOpenDiscussionTimer() {
    if (!game) {
      return;
    }

    setIsOpenDiscussionTimerRunning(false);
    updateGame(logOpenDiscussionEnded(game));
  }

  function handleGenerateSpeechOrder() {
    if (!game || !speechStartPlayerId) {
      return;
    }

    const order = generateSpeechOrder({
      players: sortedPlayers,
      startPlayerId: speechStartPlayerId,
      direction: speechDirection,
    });

    setSpeechOrderPlayerIds(order.map((player) => player.id));

    updateGame(
      logSpeechOrderGenerated({
        game,
        order,
        startPlayerId: speechStartPlayerId,
        direction: speechDirection,
      }),
    );
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-sm text-gray-500">正在读取对局……</p>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">找不到这局游戏</h1>
          <p className="mt-2 text-sm text-gray-600">
            这局游戏可能没有保存在当前浏览器的 localStorage 中。
          </p>
          <Link
            href="/games/new"
            className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            创建新对局
          </Link>
        </div>
      </main>
    );
  }

  const alivePlayerCount = getAlivePlayerCount(game);
  const requiredVotes = getRequiredVotes(game);
  const maxNominations = getMaxNominations(game);
  const remainingNominations = getRemainingNominationCount(game);
  const executionCandidate = getCurrentExecutionCandidate(game);
  const executionCandidatePlayer = executionCandidate
    ? game.players.find(
        (player) => player.id === executionCandidate.nomineePlayerId,
      )
    : undefined;

  const isNominationPhase =
    game.currentPhase === "day" && game.currentDaySubPhase === "nomination";

  const nightPhase = getNightPhaseForGame(game);
  const nightSteps = getActiveNightSteps(game);
  const currentNightStep = getCurrentNightStep(game);
  const nightProgress = getNightProgress(game);
const currentNightCharacter = currentNightStep?.characterId
  ? getCharacterById(currentNightStep.characterId)
  : undefined;

const currentNightActorPlayer = getNightActorForStep(
  game,
  currentNightStep?.characterId,
);

const currentNightActorIsDrunk = currentNightActorPlayer
  ? isPlayerActingAsDrunk(game, currentNightActorPlayer.id)
  : false;

const currentNightActorRealCharacter = currentNightActorPlayer
  ? getRealCharacter(currentNightActorPlayer)
  : undefined;

const currentNightActorApparentCharacter = currentNightActorPlayer
  ? getApparentCharacter(currentNightActorPlayer)
  : undefined;

  return (
    <main className="min-h-screen w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <div className="mb-8">
        <Link href="/games/new" className="text-sm text-gray-500 hover:underline">
          ← 返回创建对局
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Storyteller View</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              对局控制台
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {script
                ? `${script.nameZh} / ${script.nameEn}`
                : `未知板子：${game.scriptId}`}
            </p>
          </div>

          <div className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700">
            第 {game.currentDay} 天 · {phaseLabels[game.currentPhase]}
            {game.currentDaySubPhase
              ? ` · ${daySubPhaseLabels[game.currentDaySubPhase]}`
              : ""}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_220px] 2xl:grid-cols-[240px_minmax(0,1fr)_240px]">
        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">对局信息</h2>

          <div className="mt-5 space-y-4 text-sm">
            <div>
              <div className="text-gray-500">状态</div>
              <div className="mt-1 font-medium">{game.status}</div>
            </div>

            <div>
              <div className="text-gray-500">阶段</div>
              <div className="mt-1 font-medium">
                {phaseLabels[game.currentPhase]}
              </div>
            </div>

            {game.currentDaySubPhase ? (
              <div>
                <div className="text-gray-500">白天小阶段</div>
                <div className="mt-1 font-medium">
                  {daySubPhaseLabels[game.currentDaySubPhase]}
                </div>
              </div>
            ) : null}

            <div>
              <div className="text-gray-500">当前天数</div>
              <div className="mt-1 font-medium">第 {game.currentDay} 天</div>
            </div>

            <div>
              <div className="text-gray-500">玩家数</div>
              <div className="mt-1 font-medium">{game.players.length} 人</div>
            </div>

            <div>
              <div className="text-gray-500">存活</div>
              <div className="mt-1 font-medium">{alivePlayerCount} 人</div>
            </div>

            <div>
              <div className="text-gray-500">提名上限</div>
              <div className="mt-1 font-medium">{maxNominations} 次</div>
            </div>

            <div>
              <div className="text-gray-500">剩余提名</div>
              <div className="mt-1 font-medium">{remainingNominations} 次</div>
            </div>

            <div>
              <div className="text-gray-500">处决票数门槛</div>
              <div className="mt-1 font-medium">{requiredVotes} 票</div>
            </div>

            {game.winningTeam ? (
              <div className="rounded-xl bg-gray-50 p-3">
                <div className="text-gray-500">胜利方</div>
                <div className="mt-1 font-semibold">
                  {winningTeamLabels[game.winningTeam]}
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="grid min-w-0 gap-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">圆桌座位</h2>
                <p className="mt-1 text-sm text-gray-500">
                  按座位号顺时针排列。当前为说书人视角，可看到所有身份。
                </p>
              </div>
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-3xl rounded-full border border-gray-200 bg-gray-50">
              <div className="absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-center text-sm text-gray-600 shadow-sm">
                Storyteller
                <br />
                Grimoire
              </div>

              {sortedPlayers.map((player, index) => {
                const character = player.characterId
                  ? getCharacterById(player.characterId)
                  : undefined;
                const position = getSeatPosition(index, sortedPlayers.length);

                return (
                  <div
                    key={player.id}
                    className="absolute w-36 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm"
                    style={position}
                  >
                    <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                      {player.seatNumber}
                    </div>
                    <div className="mt-2 truncate text-sm font-semibold">
                      {player.displayName}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {character ? character.nameZh : "未分配角色"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {player.isAlive ? "存活" : "死亡"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {game.currentPhase === "night" ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">夜晚行动</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {nightPhase === "first_night" ? "首夜" : "其他夜晚"} ·
                    已完成 {nightProgress.completed} / {nightProgress.total}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetNightActions}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
                >
                  重置本夜行动
                </button>
              </div>

              {currentNightStep ? (
                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">当前行动</div>
                  <div className="mt-1 text-xl font-semibold">
                    {currentNightStep.labelZh}
                  </div>
                  {currentNightStep.labelEn ? (
                    <div className="mt-1 text-sm text-gray-500">
                      {currentNightStep.labelEn}
                    </div>
                  ) : null}
{currentNightCharacter ? (
  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm">
    <div className="font-medium text-gray-800">
      当前角色：{currentNightCharacter.nameZh} / {currentNightCharacter.nameEn}
    </div>

    {currentNightActorPlayer ? (
      <div className="mt-2 space-y-2 text-xs text-gray-600">
        <div>
          行动玩家：{currentNightActorPlayer.seatNumber}.{" "}
          {currentNightActorPlayer.displayName}
        </div>

        {currentNightActorIsDrunk ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 leading-5 text-amber-800">
            该玩家真实角色是酒鬼，当前按照表面角色{" "}
            {currentNightActorApparentCharacter
              ? `${currentNightActorApparentCharacter.nameZh} / ${currentNightActorApparentCharacter.nameEn}`
              : "未知角色"}{" "}
            行动。其获得的信息不具备规则参考价值，可由说书人任意给出。
          </div>
        ) : null}

        {currentNightActorRealCharacter &&
        currentNightActorApparentCharacter &&
        currentNightActorRealCharacter.id !==
          currentNightActorApparentCharacter.id ? (
          <div>
            真实角色：{currentNightActorRealCharacter.nameZh} /{" "}
            {currentNightActorRealCharacter.nameEn}
          </div>
        ) : null}
      </div>
    ) : (
      <div className="mt-2 text-xs text-red-600">
        未找到当前角色对应的存活玩家。可能是该玩家已死亡，或角色分配已变化。
      </div>
    )}
  </div>
) : null}

                  <textarea
                    value={nightActionNote}
                    onChange={(event) => setNightActionNote(event.target.value)}
                    rows={4}
                    className="mt-4 w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-gray-500"
                    placeholder="说书人备注，例如：投毒者选择了 3 号；洗衣妇看到 2 号/5 号 + 僧侣。"
                  />

                  <button
                    type="button"
                    onClick={handleCompleteNightStep}
                    className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
                  >
                    完成当前行动
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                  本夜行动已全部完成。点击右侧“下一阶段”进入白天。
                </div>
              )}

              <div className="mt-5 grid gap-2 md:grid-cols-2">
                {nightSteps.map((step, index) => {
                  const isCompleted =
                    game.nightActionState.completedStepIds.includes(step.id);
                  const isCurrent = currentNightStep?.id === step.id;

                  return (
                    <div
                      key={step.id}
                      className={`rounded-xl border p-3 text-sm ${
                        isCurrent
                          ? "border-gray-900 bg-white"
                          : isCompleted
                            ? "border-gray-100 bg-gray-50 opacity-60"
                            : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-700">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium">{step.labelZh}</div>
                          {step.labelEn ? (
                            <div className="truncate text-xs text-gray-500">
                              {step.labelEn}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {game.currentPhase === "day" ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">白天工具</h2>
                <p className="mt-1 text-sm text-gray-500">
                  用于控制私聊、顺序发言和大公聊。私聊和大公聊计时结束后会自动进入下一阶段。
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <h3 className="font-semibold">私聊计时器</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    当前小阶段：
                    {game.currentDaySubPhase
                      ? daySubPhaseLabels[game.currentDaySubPhase]
                      : "无"}
                  </p>

                  <label className="mt-4 block text-xs font-medium text-gray-500">
                    分钟数
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={privateChatMinutes}
                    onChange={(event) =>
                      setPrivateChatMinutes(Number(event.target.value))
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />

                  <div className="mt-4 rounded-xl bg-white p-4 text-center text-3xl font-semibold">
                    {formatSeconds(privateChatSecondsRemaining)}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleStartPrivateChatTimer}
                      className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white"
                    >
                      开始
                    </button>

                    <button
                      type="button"
                      onClick={handleEndPrivateChatTimer}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
                    >
                      结束
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <h3 className="font-semibold">顺序发言</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    指定起始玩家和方向，生成发言顺序。
                  </p>

                  <label className="mt-4 block text-xs font-medium text-gray-500">
                    起始玩家
                  </label>
                  <select
                    value={speechStartPlayerId}
                    onChange={(event) =>
                      setSpeechStartPlayerId(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                  >
                    <option value="">请选择</option>
                    {sortedPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.seatNumber}. {player.displayName}
                      </option>
                    ))}
                  </select>

                  <label className="mt-4 block text-xs font-medium text-gray-500">
                    方向
                  </label>
                  <select
                    value={speechDirection}
                    onChange={(event) =>
                      setSpeechDirection(event.target.value as SpeechDirection)
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                  >
                    <option value="clockwise">顺时针</option>
                    <option value="counterclockwise">逆时针</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleGenerateSpeechOrder}
                    className="mt-4 w-full rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    生成发言顺序
                  </button>

                  {speechOrderPlayerIds.length > 0 ? (
                    <ol className="mt-4 space-y-2">
                      {speechOrderPlayerIds.map((playerId, index) => {
                        const player = game.players.find(
                          (candidate) => candidate.id === playerId,
                        );

                        return (
                          <li
                            key={playerId}
                            className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"
                          >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                              {index + 1}
                            </span>
                            <span>
                              {player
                                ? `${player.seatNumber}. ${player.displayName}`
                                : "未知玩家"}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  ) : null}
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <h3 className="font-semibold">大公聊计时器</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    用于自由讨论阶段。
                  </p>

                  <label className="mt-4 block text-xs font-medium text-gray-500">
                    分钟数
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={openDiscussionMinutes}
                    onChange={(event) =>
                      setOpenDiscussionMinutes(Number(event.target.value))
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />

                  <div className="mt-4 rounded-xl bg-white p-4 text-center text-3xl font-semibold">
                    {formatSeconds(openDiscussionSecondsRemaining)}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleStartOpenDiscussionTimer}
                      className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white"
                    >
                      开始
                    </button>

                    <button
                      type="button"
                      onClick={handleEndOpenDiscussionTimer}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
                    >
                      结束
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">提名与投票</h2>
              <p className="mt-1 text-sm text-gray-500">
                当前规则：存活玩家可提名；提名者每天只能提名一次；被提名者每天只能被提名一次。提名阶段结束后，点击“下一阶段”会进入黄昏并自动执行处决。
              </p>
            </div>

            {!isNominationPhase ? (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                请先通过“下一阶段”进入：白天 → 提名阶段。
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      提名者
                    </label>
                    <select
                      value={nominatorPlayerId}
                      onChange={(event) =>
                        setNominatorPlayerId(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                    >
                      <option value="">请选择</option>
                      {alivePlayers.map((player) => {
                        const status = getNominationStatusForPlayer(
                          game,
                          player.id,
                        );

                        return (
                          <option
                            key={player.id}
                            value={player.id}
                            disabled={!status.canNominate}
                          >
                            {player.seatNumber}. {player.displayName}
                            {status.hasNominated ? "（已提名）" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      被提名者
                    </label>
                    <select
                      value={nomineePlayerId}
                      onChange={(event) =>
                        setNomineePlayerId(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                    >
                      <option value="">请选择</option>
                      {alivePlayers.map((player) => {
                        const status = getNominationStatusForPlayer(
                          game,
                          player.id,
                        );

                        return (
                          <option
                            key={player.id}
                            value={player.id}
                            disabled={!status.canBeNominated}
                          >
                            {player.seatNumber}. {player.displayName}
                            {status.hasBeenNominated ? "（已被提名）" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-700">
                      投票者
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {alivePlayers.map((player) => (
                        <label
                          key={player.id}
                          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={votePlayerIds.includes(player.id)}
                            onChange={() => toggleVotePlayer(player.id)}
                          />
                          <span>
                            {player.seatNumber}. {player.displayName}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      当前票数：{votePlayerIds.length} / 门槛：{requiredVotes}
                    </p>
                  </div>

                  {nominationError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {nominationError}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleSubmitNomination}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
                  >
                    记录提名与投票
                  </button>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <h3 className="font-semibold">处决台</h3>

                  {executionCandidate && executionCandidatePlayer ? (
                    <div className="mt-4 rounded-xl bg-white p-4 text-sm">
                      <div className="text-gray-500">当前黄昏将被处决</div>
                      <div className="mt-1 text-lg font-semibold">
                        {executionCandidatePlayer.displayName}
                      </div>
                      <div className="mt-2 text-gray-600">
                        票数：{executionCandidate.voteCount} /{" "}
                        {executionCandidate.requiredVotes}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-gray-500">
                        该玩家会在点击“下一阶段”进入黄昏时立即死亡。若需要取消今日处决，可以点击下方按钮。
                      </p>
                      <button
                        type="button"
                        onClick={handleClearExecutionCandidate}
                        className="mt-4 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
                      >
                        取消今日处决
                      </button>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-gray-500">
                      当前无人上处决台。
                    </p>
                  )}

                  <h3 className="mt-6 font-semibold">今日提名记录</h3>

                  {game.executionState.nominations.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {game.executionState.nominations.map((nomination) => {
                        const nominator = game.players.find(
                          (player) =>
                            player.id === nomination.nominatorPlayerId,
                        );
                        const nominee = game.players.find(
                          (player) => player.id === nomination.nomineePlayerId,
                        );

                        return (
                          <div
                            key={nomination.id}
                            className="rounded-xl bg-white p-3 text-sm"
                          >
                            <div className="font-medium">
                              {nominator?.displayName ?? "未知玩家"} →{" "}
                              {nominee?.displayName ?? "未知玩家"}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {nomination.voteCount} 票 / 门槛{" "}
                              {nomination.requiredVotes} 票
                              {nomination.isOnBlock ? " · 上处决台" : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">暂无提名。</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">玩家列表</h2>
              <p className="mt-1 text-sm text-gray-500">
                玩家卡片中会显示当前是否还能提名或被提名。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {sortedPlayers.map((player) => {
                const character = player.characterId
                  ? getCharacterById(player.characterId)
                  : undefined;
                const nominationStatus = getNominationStatusForPlayer(
                  game,
                  player.id,
                );

                return (
                  <article
                    key={player.id}
                    className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-gray-500">
                          座位 {player.seatNumber}
                        </div>
                        <h3 className="mt-1 text-lg font-semibold">
                          {player.displayName}
                        </h3>
                      </div>

                      <span className="rounded-full bg-white px-2 py-1 text-xs text-gray-500">
                        {player.isAlive ? "存活" : "死亡"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white px-2 py-1 text-gray-600">
                        {nominationStatus.canNominate ? "可提名" : "不可提名"}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-gray-600">
                        {nominationStatus.canBeNominated
                          ? "可被提名"
                          : "不可被提名"}
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl bg-white p-3 text-sm">
                      <div className="text-gray-500">角色</div>
                      <div className="mt-1 font-medium">
                        {character
                          ? `${character.nameZh} / ${character.nameEn}`
                          : "未分配"}
                      </div>

                      <div className="mt-3 text-gray-500">阵营</div>
                      <div className="mt-1 font-medium">
                        {player.alignment
                          ? alignmentLabels[player.alignment]
                          : "未知"}
                      </div>

                      {character ? (
                        <>
                          <div className="mt-3 text-gray-500">能力</div>
                          <p className="mt-1 leading-6 text-gray-700">
                            {character.abilitySummaryZh}
                          </p>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updatePlayer(player.id, (currentPlayer) => ({
                            ...currentPlayer,
                            isAlive: !currentPlayer.isAlive,
                          }))
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
                      >
                        {player.isAlive ? "设为死亡" : "设为存活"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updatePlayer(player.id, (currentPlayer) => ({
                            ...currentPlayer,
                            isDrunk: !currentPlayer.isDrunk,
                          }))
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
                      >
                        {player.isDrunk ? "取消醉酒" : "标记醉酒"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updatePlayer(player.id, (currentPlayer) => ({
                            ...currentPlayer,
                            isPoisoned: !currentPlayer.isPoisoned,
                          }))
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
                      >
                        {player.isPoisoned ? "取消中毒" : "标记中毒"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">操作日志</h2>

            {game.logs.length > 0 ? (
              <div className="mt-4 space-y-3">
                {game.logs.slice(0, 20).map((log) => (
                  <div key={log.id} className="rounded-xl bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{log.title}</div>
                        {log.description ? (
                          <p className="mt-1 text-sm text-gray-600">
                            {log.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-xs text-gray-500">
                        D{log.day} · {phaseLabels[log.phase]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">暂无日志。</p>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">阶段控制</h2>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleAdvancePhase}
              disabled={game.currentPhase === "ended"}
              className="w-full rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              下一阶段
            </button>

            <button
              type="button"
              onClick={handleRetreatPhase}
              disabled={game.currentPhase === "ended"}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-40"
            >
              回退阶段
            </button>

            <div className="rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600">
              <div className="font-medium text-gray-700">当前流程</div>
              <div className="mt-1">
                第 {game.currentDay} 天 · {phaseLabels[game.currentPhase]}
                {game.currentDaySubPhase
                  ? ` · ${daySubPhaseLabels[game.currentDaySubPhase]}`
                  : ""}
              </div>
              <div className="mt-2">
                私聊和大公聊计时结束后会自动进入下一阶段；也可以手动点击“下一阶段”。
              </div>
            </div>

            <div className="my-4 border-t border-gray-200" />

            <button
              type="button"
              onClick={() => handleManualWin("good")}
              disabled={game.currentPhase === "ended"}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-40"
            >
              手动判定蓝方胜利
            </button>

            <button
              type="button"
              onClick={() => handleManualWin("evil")}
              disabled={game.currentPhase === "ended"}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-40"
            >
              手动判定红方胜利
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}