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
  addGameLog,
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
  getChefRegisteredEvilPairs,
  getEmpathRegisteredEvilNeighborCount,
  getFortuneTellerCorrectResult,
  getRealCharacter,
  getRegisteredAlignment,
  getRegisteredCharacter,
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
import {
  killPlayerAtNight,
  setPlayerPoisoned,
} from "@/lib/abilityResolution";
import type { Alignment, Character, Game, GamePlayer } from "@/types/game";

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

function NumberAdjuster({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-white p-3">
      <div className="text-xs font-medium text-blue-900">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-lg font-semibold text-blue-950"
        >
          -
        </button>
        <div className="min-w-12 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1 text-center text-sm font-semibold text-blue-950">
          {value}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-lg font-semibold text-blue-950"
        >
          +
        </button>
      </div>
    </div>
  );
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
const [nightTargetPlayerId, setNightTargetPlayerId] = useState("");
const [nightSecondTargetPlayerId, setNightSecondTargetPlayerId] =
  useState("");
const [nightSelectedCharacterId, setNightSelectedCharacterId] = useState("");
const [nightInfoNoRoleInPlay, setNightInfoNoRoleInPlay] = useState(false);
const [nightReferenceNumber, setNightReferenceNumber] = useState(0);
const [nightProtectedPlayerId, setNightProtectedPlayerId] = useState("");
const [nightYesNoAnswer, setNightYesNoAnswer] = useState<"yes" | "no">("no");
const [nightMayorRedirectPlayerId, setNightMayorRedirectPlayerId] =
  useState("");
const [slayerTargetPlayerId, setSlayerTargetPlayerId] = useState("");
const [nightRegistrationOverrides, setNightRegistrationOverrides] = useState<
  Record<string, { alignment?: Alignment; characterId?: string }>
>({});

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
    if (!game) {
      return;
    }

    const player = game.players.find((candidate) => candidate.id === playerId);
    const character = player ? getRealCharacter(player) : undefined;
    const butlerMasterId = game.setupState.butlerMasterPlayerIds?.[playerId];

    setVotePlayerIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => {
          if (id === playerId) {
            return false;
          }

          return game.setupState.butlerMasterPlayerIds?.[id] !== playerId;
        });
      }

      if (
        character?.id === "butler" &&
        butlerMasterId &&
        !current.includes(butlerMasterId)
      ) {
        return current;
      }

      return [...current, playerId];
    });
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

  function handleUseSlayer(slayerPlayer: GamePlayer) {
    if (!game || !slayerTargetPlayerId) {
      return;
    }

    const usedSlayerPlayerIds = game.setupState.usedSlayerPlayerIds ?? [];

    if (usedSlayerPlayerIds.includes(slayerPlayer.id)) {
      return;
    }

    const targetPlayer = game.players.find(
      (player) => player.id === slayerTargetPlayerId,
    );

    if (!targetPlayer) {
      return;
    }

    const targetCharacter = getRealCharacter(targetPlayer);
    const slayerFails = slayerPlayer.isPoisoned || slayerPlayer.isDrunk;
    const shouldKillTarget =
      !slayerFails && targetCharacter?.type === "demon" && targetPlayer.isAlive;

    let nextGame: Game = {
      ...game,
      players: game.players.map((player) =>
        player.id === targetPlayer.id && shouldKillTarget
          ? {
              ...player,
              isAlive: false,
            }
          : player,
      ),
      setupState: {
        ...game.setupState,
        usedSlayerPlayerIds: [...usedSlayerPlayerIds, slayerPlayer.id],
      },
      updatedAt: new Date().toISOString(),
    };

    nextGame = addGameLog(nextGame, {
      type: shouldKillTarget ? "player_death" : "day_action",
      title: "猎手发动技能",
      description: shouldKillTarget
        ? `${slayerPlayer.displayName} 选择 ${targetPlayer.displayName}，目标是真实恶魔并死亡。`
        : slayerFails
          ? `${slayerPlayer.displayName} 选择 ${targetPlayer.displayName}，但猎手醉酒或中毒，技能失败。`
          : `${slayerPlayer.displayName} 选择 ${targetPlayer.displayName}，目标不是真实恶魔，未造成死亡。`,
      payload: {
        slayerPlayerId: slayerPlayer.id,
        targetPlayerId: targetPlayer.id,
        slayerFails,
      },
    });

    updateGame(applyWinCondition(nextGame));
    setSlayerTargetPlayerId("");
  }

  function handleCompleteNightStep() {
    if (!game) {
      return;
    }

    let generatedNote = nightActionNote.trim();
    const currentNightActionFails = Boolean(currentNightActorPlayer?.isPoisoned);

    if (currentNightActionFails) {
      const failureNote = "中毒判定：该行动玩家当前被标记为中毒，本次技能发动失败。";

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${failureNote}`
        : failureNote;
    }

    if (isTwoPlayerInfoCharacter && firstNightInfoPlayer && secondNightInfoPlayer) {
      const shownCharacter = nightSelectedCharacterId
        ? getCharacterById(nightSelectedCharacterId)
        : undefined;
      const matchingPlayers = matchingNightInfoPlayers
        .map((entry) => `${entry?.player.seatNumber}. ${entry?.player.displayName}`)
        .join(", ");
      const referenceNote = [
        `${currentNightCharacter?.nameZh ?? "信息角色"}规则参考：`,
        `候选玩家：${firstNightInfoPlayer.player.seatNumber}. ${firstNightInfoPlayer.player.displayName}、${secondNightInfoPlayer.player.seatNumber}. ${secondNightInfoPlayer.player.displayName}`,
        nightInfoNoRoleInPlay
          ? "展示信息：场上不存在对应类型角色。"
          : `展示角色：${shownCharacter ? `${shownCharacter.nameZh} / ${shownCharacter.nameEn}` : "未选择"}`,
        matchingPlayers
          ? `两名候选中登记类型匹配的玩家：${matchingPlayers}`
          : "两名候选中没有登记类型匹配的玩家。",
        "最终给出的信息仍由说书人决定。",
      ].join("\n");

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${referenceNote}`
        : referenceNote;
    }

    if (currentNightCharacter?.id === "chef") {
      const pairs = getChefRegisteredEvilPairs(game);
      const pairText =
        pairs.length > 0
          ? pairs
              .map(
                ({ first, second }) =>
                  `${first.seatNumber}. ${first.displayName} + ${second.seatNumber}. ${second.displayName}`,
              )
              .join("; ")
          : "没有登记为邪恶且相邻的玩家对。";
      const referenceNote = [
        "厨师规则参考：",
        `相邻邪恶对数：${pairs.length}`,
        `说书人记录数字：${nightReferenceNumber}`,
        `相邻邪恶玩家对：${pairText}`,
        "该结果基于当前 registeredAlignment；最终给出的数字仍由说书人决定。",
      ].join("\n");

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${referenceNote}`
        : referenceNote;
    }

    if (currentNightCharacter?.id === "empath" && currentNightActorPlayer) {
      const empathReference = getEmpathRegisteredEvilNeighborCount(
        game,
        currentNightActorPlayer.id,
      );
      const neighborText = [empathReference.left, empathReference.right]
        .filter((player): player is GamePlayer => Boolean(player))
        .map((player) => `${player.seatNumber}. ${player.displayName}`)
        .join(", ");
      const referenceNote = [
        "共情者规则参考：",
        `最近存活邻座：${neighborText || "未找到足够的存活邻座"}`,
        `系统计算邪恶人数：${empathReference.count}`,
        `说书人记录数字：${nightReferenceNumber}`,
        "该结果基于当前 registeredAlignment；最终给出的数字仍由说书人决定。",
      ].join("\n");

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${referenceNote}`
        : referenceNote;
    }

    if (
      currentNightCharacter?.id === "fortune_teller" &&
      nightTargetPlayerId &&
      nightSecondTargetPlayerId
    ) {
      const fortuneTellerReference = getFortuneTellerCorrectResult({
        game,
        firstPlayerId: nightTargetPlayerId,
        secondPlayerId: nightSecondTargetPlayerId,
      });
      const firstTarget = game.players.find(
        (player) => player.id === nightTargetPlayerId,
      );
      const secondTarget = game.players.find(
        (player) => player.id === nightSecondTargetPlayerId,
      );
      const referenceNote = [
        "占卜师规则参考：",
        `选择目标：${firstTarget ? `${firstTarget.seatNumber}. ${firstTarget.displayName}` : "未知"}、${secondTarget ? `${secondTarget.seatNumber}. ${secondTarget.displayName}` : "未知"}`,
        `系统参考结果：${fortuneTellerReference.hasDemonSignal ? "是" : "否"}`,
        `原因：${fortuneTellerReference.reasons.join("；")}`,
        "该结果基于当前登记恶魔与红鲱鱼；最终给出的答案仍由说书人决定。",
      ].join("\n");

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${referenceNote}`
        : referenceNote;
    }

    if (currentNightCharacter?.id === "fortune_teller") {
      const answerNote = `占卜师说书人答案：${nightYesNoAnswer === "yes" ? "是" : "否"}`;

      generatedNote = generatedNote
        ? `${generatedNote}\n${answerNote}`
        : answerNote;
    }

    if (currentNightCharacter?.id === "undertaker") {
      const executedPlayer = game.executionState.executedPlayerId
        ? game.players.find(
            (player) => player.id === game.executionState.executedPlayerId,
          )
        : undefined;
      const executedCharacter = executedPlayer
        ? getRealCharacter(executedPlayer)
        : undefined;
      const referenceNote = [
        "送葬者规则参考：",
        executedPlayer
          ? `今日白天被处决玩家：${executedPlayer.seatNumber}. ${executedPlayer.displayName}`
          : "今日白天没有记录到被处决玩家。",
        executedCharacter
          ? `真实角色：${executedCharacter.nameZh} / ${executedCharacter.nameEn}`
          : "真实角色：无",
        "若该信息受醉酒、中毒或说书人决定影响，最终告知内容由说书人决定。",
      ].join("\n");

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${referenceNote}`
        : referenceNote;
    }

    let nextGame = game;

    if (
      currentNightCharacter?.id === "poisoner" &&
      nightTargetPlayerId &&
      !currentNightActionFails
    ) {
      nextGame = setPlayerPoisoned(nextGame, nightTargetPlayerId, true);

      const target = game.players.find(
        (player) => player.id === nightTargetPlayerId,
      );
      const referenceNote = [
        "投毒者行动：",
        `目标：${target ? `${target.seatNumber}. ${target.displayName}` : "未知玩家"}`,
        "系统已将该玩家标记为中毒。此标记用于说书人参考，不自动裁定所有技能结果。",
      ].join("\n");

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${referenceNote}`
        : referenceNote;
    }

    if (
      currentNightCharacter?.id === "monk" &&
      nightTargetPlayerId &&
      !currentNightActionFails
    ) {
      setNightProtectedPlayerId(nightTargetPlayerId);

      const target = game.players.find(
        (player) => player.id === nightTargetPlayerId,
      );
      const referenceNote = [
        "僧侣行动：",
        `保护目标：${target ? `${target.seatNumber}. ${target.displayName}` : "未知玩家"}`,
        "若小恶魔本夜攻击该目标，系统会提示说书人该攻击被保护影响。",
      ].join("\n");

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${referenceNote}`
        : referenceNote;
    }

    if (
      currentNightCharacter?.id === "butler" &&
      nightTargetPlayerId &&
      currentNightActorPlayer &&
      !currentNightActionFails
    ) {
      const target = game.players.find(
        (player) => player.id === nightTargetPlayerId,
      );

      nextGame = {
        ...nextGame,
        setupState: {
          ...nextGame.setupState,
          butlerMasterPlayerIds: {
            ...(nextGame.setupState.butlerMasterPlayerIds ?? {}),
            [currentNightActorPlayer.id]: nightTargetPlayerId,
          },
        },
        updatedAt: new Date().toISOString(),
      };

      const referenceNote = [
        "管家行动：",
        `主人：${target ? `${target.seatNumber}. ${target.displayName}` : "未知玩家"}`,
        "白天投票时，系统会提示并限制管家只能在主人投票时投票。",
      ].join("\n");

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${referenceNote}`
        : referenceNote;
    }

    if (currentNightCharacter?.id === "ravenkeeper" && nightTargetPlayerId) {
      const target = game.players.find(
        (player) => player.id === nightTargetPlayerId,
      );
      const targetCharacter = target ? getRealCharacter(target) : undefined;
      const referenceNote = [
        "守鸦人规则参考：",
        `选择目标：${target ? `${target.seatNumber}. ${target.displayName}` : "未知玩家"}`,
        targetCharacter
          ? `真实角色：${targetCharacter.nameZh} / ${targetCharacter.nameEn}`
          : "真实角色：未知",
        currentNightActionFails
          ? "守鸦人中毒，本次信息失败。"
          : "最终告知内容仍由说书人决定。",
      ].join("\n");

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${referenceNote}`
        : referenceNote;
    }

    if (
      currentNightCharacter?.id === "imp" &&
      nightTargetPlayerId &&
      currentNightActionFails
    ) {
      const target = game.players.find(
        (player) => player.id === nightTargetPlayerId,
      );

      nextGame = addGameLog(nextGame, {
        type: "night_action",
        title: "小恶魔中毒，攻击失败",
        description: target
          ? `${target.seatNumber}. ${target.displayName} 被选择为攻击目标，但小恶魔中毒，系统未造成死亡。`
          : "小恶魔中毒，系统未造成死亡。",
        payload: {
          targetPlayerId: nightTargetPlayerId,
          actorPlayerId: currentNightActorPlayer?.id,
        },
      });
    }

    if (
      currentNightCharacter?.id === "imp" &&
      nightTargetPlayerId &&
      !currentNightActionFails
    ) {
      const target = game.players.find(
        (player) => player.id === nightTargetPlayerId,
      );
      const targetCharacter = target ? getRealCharacter(target) : undefined;

      if (nightTargetPlayerId === nightProtectedPlayerId) {
        nextGame = addGameLog(nextGame, {
          type: "night_action",
          title: "小恶魔攻击被保护",
          description: target
            ? `${target.seatNumber}. ${target.displayName} 被僧侣保护，系统未将其标记死亡。`
            : "小恶魔攻击目标被僧侣保护，系统未标记死亡。",
          payload: {
            targetPlayerId: nightTargetPlayerId,
            protectedPlayerId: nightProtectedPlayerId,
          },
        });
      } else if (targetCharacter?.id === "soldier" && !target?.isPoisoned) {
        nextGame = addGameLog(nextGame, {
          type: "night_action",
          title: "士兵免疫恶魔攻击",
          description: target
            ? `${target.seatNumber}. ${target.displayName} 是未中毒士兵，系统未造成死亡。`
            : "小恶魔攻击士兵，系统未造成死亡。",
          payload: {
            targetPlayerId: nightTargetPlayerId,
          },
        });
      } else if (
        targetCharacter?.id === "mayor" &&
        !target?.isPoisoned &&
        nightMayorRedirectPlayerId
      ) {
        const redirectTarget = game.players.find(
          (player) => player.id === nightMayorRedirectPlayerId,
        );
        const redirectCharacter = redirectTarget
          ? getRealCharacter(redirectTarget)
          : undefined;

        if (redirectCharacter?.id === "soldier" && !redirectTarget?.isPoisoned) {
          nextGame = addGameLog(nextGame, {
            type: "night_action",
            title: "镇长攻击转移到士兵",
            description: redirectTarget
              ? `说书人将小恶魔攻击从镇长转移到 ${redirectTarget.seatNumber}. ${redirectTarget.displayName}，但目标是未中毒士兵，系统未造成死亡。`
              : "镇长攻击转移到士兵，系统未造成死亡。",
            payload: {
              mayorPlayerId: nightTargetPlayerId,
              redirectPlayerId: nightMayorRedirectPlayerId,
            },
          });
        } else {
          nextGame = killPlayerAtNight(
            nextGame,
            nightMayorRedirectPlayerId,
            "imp",
          );
          nextGame = addGameLog(nextGame, {
            type: "night_action",
            title: "镇长攻击转移",
            description: redirectTarget
              ? `说书人将小恶魔攻击从镇长转移到 ${redirectTarget.seatNumber}. ${redirectTarget.displayName}。`
              : "说书人将小恶魔攻击从镇长转移到另一名玩家。",
            payload: {
              mayorPlayerId: nightTargetPlayerId,
              redirectPlayerId: nightMayorRedirectPlayerId,
            },
          });
        }
      } else if (currentNightActorPlayer?.id === nightTargetPlayerId) {
        const replacementMinion = nextGame.players.find((player) => {
          const character = getRealCharacter(player);

          return (
            player.isAlive &&
            player.id !== currentNightActorPlayer.id &&
            character?.type === "minion"
          );
        });

        nextGame = {
          ...nextGame,
          players: nextGame.players.map((player) =>
            player.id === nightTargetPlayerId
              ? {
                  ...player,
                  isAlive: false,
                }
              : player,
          ),
          updatedAt: new Date().toISOString(),
        };

        if (replacementMinion) {
          nextGame = {
            ...nextGame,
            players: nextGame.players.map((player) =>
              player.id === replacementMinion.id
                ? {
                    ...player,
                    characterId: "imp",
                    alignment: "evil",
                    registeredAlignment: "evil",
                    registeredCharacterId: "imp",
                  }
                : player,
            ),
            updatedAt: new Date().toISOString(),
          };
        }

        nextGame = addGameLog(nextGame, {
          type: "night_action",
          title: "小恶魔选择自杀",
          description:
            "小恶魔选择了自己。系统仅记录替换恶魔提示，爪牙变恶魔需要说书人手动处理。",
          payload: {
            targetPlayerId: nightTargetPlayerId,
            actorPlayerId: currentNightActorPlayer.id,
            replacementPlayerId: replacementMinion?.id,
          },
        });
      } else {
        nextGame = killPlayerAtNight(nextGame, nightTargetPlayerId, "imp");
      }

      const referenceNote = [
        "小恶魔行动：",
        `攻击目标：${target ? `${target.seatNumber}. ${target.displayName}` : "未知玩家"}`,
        nightTargetPlayerId === nightProtectedPlayerId
          ? "结果参考：目标受到僧侣保护，系统未标记死亡。"
          : currentNightActorPlayer?.id === nightTargetPlayerId
            ? "结果参考：小恶魔选择自己，可能触发爪牙变成恶魔；系统不自动改角色。"
            : "结果参考：系统已将目标标记为夜晚死亡。",
      ].join("\n");

      generatedNote = generatedNote
        ? `${generatedNote}\n\n${referenceNote}`
        : referenceNote;

      setNightProtectedPlayerId("");
    }

updateGame(completeCurrentNightStep(nextGame, generatedNote));
setNightActionNote("");
setNightTargetPlayerId("");
setNightSecondTargetPlayerId("");
setNightSelectedCharacterId("");
setNightInfoNoRoleInPlay(false);
setNightReferenceNumber(0);
setNightYesNoAnswer("no");
setNightMayorRedirectPlayerId("");
setNightRegistrationOverrides({});
  }

  function handleResetNightActions() {
    if (!game) {
      return;
    }

updateGame(resetNightActions(game));
setNightActionNote("");
setNightTargetPlayerId("");
setNightSecondTargetPlayerId("");
setNightSelectedCharacterId("");
setNightInfoNoRoleInPlay(false);
setNightReferenceNumber(0);
setNightProtectedPlayerId("");
setNightYesNoAnswer("no");
setNightMayorRedirectPlayerId("");
setNightRegistrationOverrides({});
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

const isTwoPlayerInfoCharacter =
  currentNightCharacter?.id === "washerwoman" ||
  currentNightCharacter?.id === "librarian" ||
  currentNightCharacter?.id === "investigator";

const currentNightInfoCharacters = (() => {
  if (!script) {
    return [];
  }

  const characters = script.characterIds
    .map((characterId) => getCharacterById(characterId))
    .filter((character): character is Character => Boolean(character));

  if (currentNightCharacter?.id === "washerwoman") {
    return characters.filter((character) => character.type === "townsfolk");
  }

  if (currentNightCharacter?.id === "librarian") {
    return characters.filter((character) => character.type === "outsider");
  }

  if (currentNightCharacter?.id === "investigator") {
    return characters.filter((character) => character.type === "minion");
  }

  return characters;
})();

const allScriptCharacters = script
  ? script.characterIds
      .map((characterId) => getCharacterById(characterId))
      .filter((character): character is Character => Boolean(character))
  : [];

const canMarkNoRoleInPlay =
  currentNightCharacter?.id === "librarian" ||
  currentNightCharacter?.id === "investigator";

function getSelectedPlayerInfo(currentGame: Game, playerId: string) {
  const player = currentGame.players.find(
    (candidate) => candidate.id === playerId,
  );

  if (!player) {
    return null;
  }

  const registrationOverride = nightRegistrationOverrides[player.id];

  return {
    player,
    realCharacter: getRealCharacter(player),
    registeredCharacter: registrationOverride?.characterId
      ? getCharacterById(registrationOverride.characterId)
      : getRegisteredCharacter(player),
    registeredAlignment:
      registrationOverride?.alignment ?? getRegisteredAlignment(player),
  };
}

function getSpecialRegistrationHint(player: GamePlayer): string | null {
  const realCharacter = getRealCharacter(player);

  if (realCharacter?.id === "recluse") {
    return "特殊登记提示：陌客被信息角色选中时，说书人可以让其登记为邪恶、爪牙或恶魔。";
  }

  if (realCharacter?.id === "spy") {
    return "特殊登记提示：间谍被信息角色选中时，说书人可以让其登记为善良角色或镇民。";
  }

  if (realCharacter?.id === "drunk") {
    return "特殊登记提示：酒鬼真实角色是酒鬼，但会按表面镇民进入夜晚流程；其能力信息无效。";
  }

  return null;
}

const firstNightInfoPlayer = nightTargetPlayerId
  ? getSelectedPlayerInfo(game, nightTargetPlayerId)
  : null;

const secondNightInfoPlayer = nightSecondTargetPlayerId
  ? getSelectedPlayerInfo(game, nightSecondTargetPlayerId)
  : null;

const requiredInfoType =
  currentNightCharacter?.id === "washerwoman"
    ? "townsfolk"
    : currentNightCharacter?.id === "librarian"
      ? "outsider"
      : currentNightCharacter?.id === "investigator"
        ? "minion"
        : null;

const matchingNightInfoPlayers = [
  firstNightInfoPlayer,
  secondNightInfoPlayer,
].filter((entry) => {
  if (!entry || !requiredInfoType) {
    return false;
  }

  return entry.registeredCharacter?.type === requiredInfoType;
});

const chefRegisteredEvilPairs =
  currentNightCharacter?.id === "chef" ? getChefRegisteredEvilPairs(game) : [];

const empathReference =
  currentNightCharacter?.id === "empath" && currentNightActorPlayer
    ? getEmpathRegisteredEvilNeighborCount(game, currentNightActorPlayer.id)
    : null;

const fortuneTellerReference =
  currentNightCharacter?.id === "fortune_teller" &&
  nightTargetPlayerId &&
  nightSecondTargetPlayerId
    ? getFortuneTellerCorrectResult({
        game,
        firstPlayerId: nightTargetPlayerId,
        secondPlayerId: nightSecondTargetPlayerId,
      })
    : null;

const undertakerExecutedPlayer = game.executionState.executedPlayerId
  ? game.players.find(
      (player) => player.id === game.executionState.executedPlayerId,
    )
  : undefined;

const undertakerExecutedCharacter = undertakerExecutedPlayer
  ? getRealCharacter(undertakerExecutedPlayer)
  : undefined;

const nightProtectedPlayer = nightProtectedPlayerId
  ? game.players.find((player) => player.id === nightProtectedPlayerId)
  : undefined;

const isSingleTargetNightCharacter =
  currentNightCharacter?.id === "poisoner" ||
  currentNightCharacter?.id === "monk" ||
  currentNightCharacter?.id === "imp" ||
  currentNightCharacter?.id === "butler" ||
  currentNightCharacter?.id === "ravenkeeper";

const nightTargetPlayer = nightTargetPlayerId
  ? game.players.find((player) => player.id === nightTargetPlayerId)
  : undefined;

const nightTargetCharacter = nightTargetPlayer
  ? getRealCharacter(nightTargetPlayer)
  : undefined;

const suitableNightInfoPlayers = requiredInfoType
  ? sortedPlayers
      .map((player) => getSelectedPlayerInfo(game, player.id))
      .filter((entry) => entry?.registeredCharacter?.type === requiredInfoType)
  : [];

function renderTemporaryRegistrationControls(entry: NonNullable<typeof firstNightInfoPlayer>) {
  const realCharacter = entry.realCharacter;

  if (realCharacter?.id !== "recluse" && realCharacter?.id !== "spy") {
    return null;
  }

  const override = nightRegistrationOverrides[entry.player.id] ?? {};

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
      <div className="font-medium">本次判定登记</div>
      <p className="mt-1 text-xs leading-5">
        只影响当前信息技能的系统参考，不会修改该玩家本身角色或长期登记。
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <select
          value={override.alignment ?? ""}
          onChange={(event) =>
            setNightRegistrationOverrides((current) => ({
              ...current,
              [entry.player.id]: {
                ...current[entry.player.id],
                alignment: event.target.value
                  ? (event.target.value as Alignment)
                  : undefined,
              },
            }))
          }
          className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-500"
        >
          <option value="">默认阵营</option>
          <option value="good">登记为善良</option>
          <option value="evil">登记为邪恶</option>
        </select>
        <select
          value={override.characterId ?? ""}
          onChange={(event) =>
            setNightRegistrationOverrides((current) => ({
              ...current,
              [entry.player.id]: {
                ...current[entry.player.id],
                characterId: event.target.value || undefined,
              },
            }))
          }
          className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-500"
        >
          <option value="">默认角色</option>
          {allScriptCharacters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.nameZh} / {character.nameEn}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

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
                    className={`absolute w-36 -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-3 text-center shadow-sm ${
                      player.isPoisoned
                        ? "border-purple-300 ring-2 ring-purple-100"
                        : "border-gray-200"
                    }`}
                    style={position}
                  >
                    <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                      {player.seatNumber}
                    </div>
                    <div className="mt-2 truncate text-sm font-semibold">
                      {player.displayName}
                    </div>
                    {player.isPoisoned ? (
                      <div className="mt-1 text-xs font-medium text-purple-700">
                        中毒
                      </div>
                    ) : null}
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

        {currentNightActorPlayer.isPoisoned ? (
          <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 leading-5 text-purple-800">
            中毒标记：该行动玩家当前处于中毒状态。系统参考仍会显示，但说书人决定实际给出的信息。
          </div>
        ) : null}

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

{isTwoPlayerInfoCharacter ? (
  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <div className="text-sm font-semibold text-blue-950">
      信息角色辅助
    </div>
    <p className="mt-1 text-xs leading-5 text-blue-800">
      选择两名玩家后，系统会标注他们的真实角色、登记角色与登记阵营。说书人仍然决定最终给出什么信息。
    </p>

    {requiredInfoType ? (
      <div className="mt-4 rounded-xl bg-white p-3 text-xs leading-5 text-blue-950">
        <div className="font-semibold">适合作为正确信息目标的玩家</div>
        {suitableNightInfoPlayers.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {suitableNightInfoPlayers.map((entry) =>
              entry ? (
                <li key={entry.player.id}>
                  {entry.player.seatNumber}. {entry.player.displayName}：登记角色{" "}
                  {entry.registeredCharacter
                    ? `${entry.registeredCharacter.nameZh} / ${entry.registeredCharacter.nameEn}`
                    : "未知"}
                </li>
              ) : null,
            )}
          </ul>
        ) : (
          <div className="mt-2">
            当前没有登记为该类型的玩家。说书人可以考虑给出“不存在该类型”，或调整登记信息后再给。
          </div>
        )}
      </div>
    ) : null}

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div>
        <label className="block text-xs font-medium text-blue-900">
          第一名玩家
        </label>
        <select
          value={nightTargetPlayerId}
          onChange={(event) => setNightTargetPlayerId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="">请选择</option>
          {sortedPlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.seatNumber}. {player.displayName}
              {player.isAlive ? "" : "（死亡）"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-blue-900">
          第二名玩家
        </label>
        <select
          value={nightSecondTargetPlayerId}
          onChange={(event) =>
            setNightSecondTargetPlayerId(event.target.value)
          }
          className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="">请选择</option>
          {sortedPlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.seatNumber}. {player.displayName}
              {player.isAlive ? "" : "（死亡）"}
            </option>
          ))}
        </select>
      </div>
    </div>

    {firstNightInfoPlayer && secondNightInfoPlayer ? (
      <div className="mt-4 rounded-xl bg-white p-3 text-xs leading-5 text-blue-950">
        <div className="font-semibold">系统参考信息</div>

        <div className="mt-2">
          第一名玩家：{firstNightInfoPlayer.player.seatNumber}.{" "}
          {firstNightInfoPlayer.player.displayName} / 真实角色：
          {firstNightInfoPlayer.realCharacter
            ? `${firstNightInfoPlayer.realCharacter.nameZh} / ${firstNightInfoPlayer.realCharacter.nameEn}`
            : "未知"}{" "}
          / 登记角色：
          {firstNightInfoPlayer.registeredCharacter
            ? `${firstNightInfoPlayer.registeredCharacter.nameZh} / ${firstNightInfoPlayer.registeredCharacter.nameEn}`
            : "未知"}{" "}
          / 登记阵营：
          {firstNightInfoPlayer.registeredAlignment === "evil"
            ? "邪恶"
            : firstNightInfoPlayer.registeredAlignment === "good"
              ? "善良"
              : "未知"}
        </div>

        {getSpecialRegistrationHint(firstNightInfoPlayer.player) ? (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800">
            {getSpecialRegistrationHint(firstNightInfoPlayer.player)}
          </div>
        ) : null}

        {renderTemporaryRegistrationControls(firstNightInfoPlayer)}

        <div className="mt-1">
          第二名玩家：{secondNightInfoPlayer.player.seatNumber}.{" "}
          {secondNightInfoPlayer.player.displayName} / 真实角色：
          {secondNightInfoPlayer.realCharacter
            ? `${secondNightInfoPlayer.realCharacter.nameZh} / ${secondNightInfoPlayer.realCharacter.nameEn}`
            : "未知"}{" "}
          / 登记角色：
          {secondNightInfoPlayer.registeredCharacter
            ? `${secondNightInfoPlayer.registeredCharacter.nameZh} / ${secondNightInfoPlayer.registeredCharacter.nameEn}`
            : "未知"}{" "}
          / 登记阵营：
          {secondNightInfoPlayer.registeredAlignment === "evil"
            ? "邪恶"
            : secondNightInfoPlayer.registeredAlignment === "good"
              ? "善良"
              : "未知"}
        </div>

        {getSpecialRegistrationHint(secondNightInfoPlayer.player) ? (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800">
            {getSpecialRegistrationHint(secondNightInfoPlayer.player)}
          </div>
        ) : null}

        {renderTemporaryRegistrationControls(secondNightInfoPlayer)}

        <div className="mt-2 rounded-lg bg-blue-50 p-2">
          {matchingNightInfoPlayers.length > 0 ? (
            <>
              这两名玩家中符合当前角色信息类型的玩家：
              {matchingNightInfoPlayers
                .map(
                  (entry) =>
                    ` ${entry?.player.seatNumber}. ${entry?.player.displayName}（${entry?.registeredCharacter?.nameZh}）`,
                )
                .join("，")}
              。
            </>
          ) : (
            <>
              这两名玩家中没有符合当前信息类型的登记角色。若角色未醉酒/中毒，通常不应给出这组作为正确信息。
            </>
          )}
        </div>
      </div>
    ) : null}

    <div className="mt-4">
      <label className="block text-xs font-medium text-blue-900">
        展示角色
      </label>
      {canMarkNoRoleInPlay ? (
        <label className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-blue-950">
          <input
            type="checkbox"
            checked={nightInfoNoRoleInPlay}
            onChange={(event) => {
              setNightInfoNoRoleInPlay(event.target.checked);
              if (event.target.checked) {
                setNightSelectedCharacterId("");
              }
            }}
          />
          {currentNightCharacter?.id === "librarian"
            ? "记录为：场上不存在外来者"
            : "记录为：场上不存在爪牙"}
        </label>
      ) : null}
      <select
        value={nightSelectedCharacterId}
        onChange={(event) =>
          setNightSelectedCharacterId(event.target.value)
        }
        disabled={nightInfoNoRoleInPlay}
        className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        <option value="">请选择</option>
        {currentNightInfoCharacters.map((character) => (
          <option key={character.id} value={character.id}>
            {character.nameZh} / {character.nameEn}
          </option>
        ))}
      </select>

      <p className="mt-2 text-xs leading-5 text-blue-800">
        {currentNightCharacter?.id === "washerwoman"
          ? "洗衣妇展示角色列表已限制为镇民。"
          : currentNightCharacter?.id === "librarian"
            ? "图书管理员展示角色列表已限制为外来者。若要给出“没有外来者”，可直接写在备注里。"
            : "调查员展示角色列表已限制为爪牙。"}
      </p>
    </div>
  </div>
) : null}

{currentNightCharacter?.id === "chef" ? (
  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <div className="text-sm font-semibold text-blue-950">厨师规则参考</div>
    <p className="mt-1 text-xs leading-5 text-blue-800">
      系统根据当前登记阵营计算相邻邪恶对数。若酒鬼、中毒或说书人选择登记方式影响信息，最终数字仍由说书人决定。
    </p>

    <div className="mt-3 grid gap-3 md:grid-cols-[auto_1fr]">
      <NumberAdjuster
        label="说书人记录数字"
        value={nightReferenceNumber}
        onChange={setNightReferenceNumber}
        min={0}
        max={Math.max(0, game.players.length)}
      />
      <div className="rounded-xl border border-blue-200 bg-white p-3 text-xs leading-5 text-blue-950">
        <div className="font-semibold">系统计算数字</div>
        <div className="mt-2 text-2xl font-semibold text-blue-950">
          {chefRegisteredEvilPairs.length}
        </div>
        <button
          type="button"
          onClick={() => setNightReferenceNumber(chefRegisteredEvilPairs.length)}
          className="mt-2 rounded-lg border border-blue-200 px-3 py-1 text-xs font-medium text-blue-950"
        >
          使用系统数字
        </button>
      </div>
    </div>

    <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-blue-950">
      <div className="font-semibold">
        相邻邪恶对数：{chefRegisteredEvilPairs.length}
      </div>

      {chefRegisteredEvilPairs.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {chefRegisteredEvilPairs.map(({ first, second }) => (
            <li key={`${first.id}-${second.id}`}>
              {first.seatNumber}. {first.displayName} + {second.seatNumber}.{" "}
              {second.displayName}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2">没有登记为邪恶且相邻的玩家对。</div>
      )}
    </div>
  </div>
) : null}

{isSingleTargetNightCharacter ? (
  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
    <div className="text-sm font-semibold text-emerald-950">
      每夜目标选择
    </div>
    <p className="mt-1 text-xs leading-5 text-emerald-800">
      系统会记录本次选择并给出规则参考；最终处理仍由说书人决定。
    </p>

    {currentNightCharacter?.id === "imp" && nightProtectedPlayer ? (
      <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-emerald-950">
        本夜僧侣保护目标：{nightProtectedPlayer.seatNumber}.{" "}
        {nightProtectedPlayer.displayName}
      </div>
    ) : null}

    <label className="mt-4 block text-xs font-medium text-emerald-900">
      选择目标
    </label>
    <select
      value={nightTargetPlayerId}
      onChange={(event) => setNightTargetPlayerId(event.target.value)}
      className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
    >
      <option value="">请选择</option>
      {sortedPlayers.map((player) => (
        <option
          key={player.id}
          value={player.id}
          disabled={
            currentNightCharacter?.id === "monk" &&
            currentNightActorPlayer?.id === player.id
          }
        >
          {player.seatNumber}. {player.displayName}
          {player.isAlive ? "" : "（死亡）"}
          {currentNightCharacter?.id === "monk" &&
          currentNightActorPlayer?.id === player.id
            ? "（不能选择自己）"
            : ""}
        </option>
      ))}
    </select>

    {currentNightCharacter?.id === "imp" &&
    nightTargetCharacter?.id === "mayor" &&
    !nightTargetPlayer?.isPoisoned ? (
      <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-emerald-950">
        <label className="block font-medium text-emerald-900">
          镇长转移目标（可选）
        </label>
        <select
          value={nightMayorRedirectPlayerId}
          onChange={(event) =>
            setNightMayorRedirectPlayerId(event.target.value)
          }
          className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">不转移</option>
          {sortedPlayers
            .filter((player) => player.id !== nightTargetPlayerId)
            .map((player) => (
              <option key={player.id} value={player.id}>
                {player.seatNumber}. {player.displayName}
                {player.isAlive ? "" : "（死亡）"}
              </option>
            ))}
        </select>
      </div>
    ) : null}

    {currentNightCharacter?.id === "poisoner" ? (
      <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-emerald-950">
        完成后系统会把目标的 <code>isPoisoned</code> 标记为 true。该状态用于辅助说书人判断信息是否可靠。
      </div>
    ) : null}

    {currentNightCharacter?.id === "monk" ? (
      <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-emerald-950">
        僧侣保护目标会保留到本夜小恶魔行动；若小恶魔攻击该目标，系统会提示受保护且不自动标记死亡。
      </div>
    ) : null}

    {currentNightCharacter?.id === "imp" ? (
      <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-emerald-950">
        普通攻击会标记目标夜晚死亡；攻击僧侣保护目标时不会标记死亡；选择自己时只记录“可能触发爪牙变恶魔”的提示。
      </div>
    ) : null}
    {currentNightCharacter?.id === "butler" ? (
      <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-emerald-950">
        管家选择主人后，白天投票 UI 会限制管家只能在主人投票时投票。
      </div>
    ) : null}

    {currentNightCharacter?.id === "ravenkeeper" ? (
      <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-emerald-950">
        守鸦人仅在夜晚死亡后进入行动。选择目标后，系统会显示该目标真实角色供说书人参考。
      </div>
    ) : null}
  </div>
) : null}

{currentNightCharacter?.id === "empath" && empathReference ? (
  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <div className="text-sm font-semibold text-blue-950">共情者规则参考</div>
    <p className="mt-1 text-xs leading-5 text-blue-800">
      系统寻找共情者左右最近的存活邻座，并根据当前登记阵营计算邪恶人数。
    </p>

    <div className="mt-3 grid gap-3 md:grid-cols-[auto_1fr]">
      <NumberAdjuster
        label="说书人记录数字"
        value={nightReferenceNumber}
        onChange={setNightReferenceNumber}
        min={0}
        max={2}
      />
      <div className="rounded-xl border border-blue-200 bg-white p-3 text-xs leading-5 text-blue-950">
        <div className="font-semibold">系统计算数字</div>
        <div className="mt-2 text-2xl font-semibold text-blue-950">
          {empathReference.count}
        </div>
        <button
          type="button"
          onClick={() => setNightReferenceNumber(empathReference.count)}
          className="mt-2 rounded-lg border border-blue-200 px-3 py-1 text-xs font-medium text-blue-950"
        >
          使用系统数字
        </button>
      </div>
    </div>

    <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-blue-950">
      <div>
        左邻：
        {empathReference.left
          ? `${empathReference.left.seatNumber}. ${empathReference.left.displayName} / 登记阵营：${getRegisteredAlignment(empathReference.left) === "evil" ? "邪恶" : "善良"}`
          : "无"}
      </div>
      <div className="mt-1">
        右邻：
        {empathReference.right
          ? `${empathReference.right.seatNumber}. ${empathReference.right.displayName} / 登记阵营：${getRegisteredAlignment(empathReference.right) === "evil" ? "邪恶" : "善良"}`
          : "无"}
      </div>
    </div>
  </div>
) : null}

{currentNightCharacter?.id === "fortune_teller" ? (
  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <div className="text-sm font-semibold text-blue-950">占卜师规则参考</div>
    <p className="mt-1 text-xs leading-5 text-blue-800">
      选择两名玩家后，系统会根据登记恶魔和红鲱鱼给出“是/否”参考。
    </p>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div>
        <label className="block text-xs font-medium text-blue-900">
          第一名玩家
        </label>
        <select
          value={nightTargetPlayerId}
          onChange={(event) => setNightTargetPlayerId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="">请选择</option>
          {sortedPlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.seatNumber}. {player.displayName}
              {player.isAlive ? "" : "（死亡）"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-blue-900">
          第二名玩家
        </label>
        <select
          value={nightSecondTargetPlayerId}
          onChange={(event) =>
            setNightSecondTargetPlayerId(event.target.value)
          }
          className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="">请选择</option>
          {sortedPlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.seatNumber}. {player.displayName}
              {player.isAlive ? "" : "（死亡）"}
            </option>
          ))}
        </select>
      </div>
    </div>

    {fortuneTellerReference ? (
      <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-blue-950">
        <div className="font-semibold">
          系统参考结果：{fortuneTellerReference.hasDemonSignal ? "是" : "否"}
        </div>
        <ul className="mt-2 space-y-1">
          {fortuneTellerReference.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    ) : null}

    <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-blue-950">
      <div className="font-semibold">说书人实际给出的答案</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setNightYesNoAnswer("yes")}
          className={`rounded-lg border px-3 py-2 font-medium ${
            nightYesNoAnswer === "yes"
              ? "border-blue-500 bg-blue-100 text-blue-950"
              : "border-blue-200 bg-white text-blue-800"
          }`}
        >
          是
        </button>
        <button
          type="button"
          onClick={() => setNightYesNoAnswer("no")}
          className={`rounded-lg border px-3 py-2 font-medium ${
            nightYesNoAnswer === "no"
              ? "border-blue-500 bg-blue-100 text-blue-950"
              : "border-blue-200 bg-white text-blue-800"
          }`}
        >
          否
        </button>
      </div>
    </div>
  </div>
) : null}

{currentNightCharacter?.id === "undertaker" ? (
  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <div className="text-sm font-semibold text-blue-950">送葬者规则参考</div>
    <p className="mt-1 text-xs leading-5 text-blue-800">
      送葬者只在非首夜行动，参考今日白天死于处决的玩家角色。
    </p>

    <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-blue-950">
      {undertakerExecutedPlayer ? (
        <>
          <div>
            今日处决：{undertakerExecutedPlayer.seatNumber}.{" "}
            {undertakerExecutedPlayer.displayName}
          </div>
          <div className="mt-1">
            真实角色：
            {undertakerExecutedCharacter
              ? `${undertakerExecutedCharacter.nameZh} / ${undertakerExecutedCharacter.nameEn}`
              : "未分配"}
          </div>
        </>
      ) : (
        <div>今日白天没有记录到被处决玩家。</div>
      )}
    </div>
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
                      {sortedPlayers.map((player) => {
                        const character = getRealCharacter(player);
                        const masterId =
                          game.setupState.butlerMasterPlayerIds?.[player.id];
                        const usedDeadVotePlayerIds =
                          game.setupState.usedDeadVotePlayerIds ?? [];
                        const master = masterId
                          ? game.players.find(
                              (candidate) => candidate.id === masterId,
                            )
                          : undefined;
                        const deadVoteUsed =
                          !player.isAlive &&
                          usedDeadVotePlayerIds.includes(player.id);
                        const butlerVoteBlocked =
                          character?.id === "butler" &&
                          player.isAlive &&
                          typeof masterId === "string" &&
                          !votePlayerIds.includes(masterId);

                        return (
                          <label
                            key={player.id}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                              butlerVoteBlocked
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={votePlayerIds.includes(player.id)}
                              disabled={butlerVoteBlocked || deadVoteUsed}
                              onChange={() => toggleVotePlayer(player.id)}
                            />
                            <span>
                              {player.seatNumber}. {player.displayName}
                              {!player.isAlive
                                ? deadVoteUsed
                                  ? "（死亡，死票已用）"
                                  : "（死亡，死票可用）"
                                : ""}
                              {master
                                ? `（管家主人：${master.seatNumber}. ${master.displayName}）`
                                : ""}
                            </span>
                          </label>
                        );
                      })}
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

                    {character?.id === "slayer" ? (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 text-sm">
                        <div className="font-medium text-gray-800">
                          白天技能：猎手
                        </div>
                        <p className="mt-1 text-xs leading-5 text-gray-500">
                          一局一次。选择一名玩家；若目标是真实恶魔且猎手未醉酒/中毒，目标死亡。
                        </p>
                        <select
                          value={slayerTargetPlayerId}
                          onChange={(event) =>
                            setSlayerTargetPlayerId(event.target.value)
                          }
                          disabled={
                            game.currentPhase !== "day" ||
                            (game.setupState.usedSlayerPlayerIds ?? []).includes(
                              player.id,
                            )
                          }
                          className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 disabled:opacity-50"
                        >
                          <option value="">选择目标</option>
                          {sortedPlayers.map((targetPlayer) => (
                            <option
                              key={targetPlayer.id}
                              value={targetPlayer.id}
                            >
                              {targetPlayer.seatNumber}.{" "}
                              {targetPlayer.displayName}
                              {targetPlayer.isAlive ? "" : "（死亡）"}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleUseSlayer(player)}
                          disabled={
                            game.currentPhase !== "day" ||
                            !slayerTargetPlayerId ||
                            (game.setupState.usedSlayerPlayerIds ?? []).includes(
                              player.id,
                            )
                          }
                          className="mt-2 w-full rounded-xl bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
                        >
                          {(game.setupState.usedSlayerPlayerIds ?? []).includes(
                            player.id,
                          )
                            ? "已使用"
                            : "发动技能"}
                        </button>
                      </div>
                    ) : null}
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
