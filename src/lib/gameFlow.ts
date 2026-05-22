import { getCharacterById } from "@/lib/gameData";
import { createLocalId } from "@/lib/localGames";
import type {
  DaySubPhase,
  Game,
  GameLogEntry,
  GameLogType,
  GamePhase,
  WinningTeam,
} from "@/types/game";

export const phaseLabels: Record<GamePhase, string> = {
  dusk: "黄昏",
  night: "夜晚",
  day: "白天",
  ended: "游戏结束",
};

export const daySubPhaseLabels: Record<DaySubPhase, string> = {
  private_chat: "私聊",
  speeches: "顺序发言",
  open_discussion: "大公聊",
  nomination: "提名",
  execution: "处决",
};

export const winningTeamLabels: Record<Exclude<WinningTeam, null>, string> = {
  good: "蓝方 / 善良阵营",
  evil: "红方 / 邪恶阵营",
};

export function createGameLog(input: {
  game: Game;
  type: GameLogType;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
}): GameLogEntry {
  return {
    id: createLocalId("log"),
    gameId: input.game.id,
    day: input.game.currentDay,
    phase: input.game.currentPhase,
    subPhase: input.game.currentDaySubPhase,
    type: input.type,
    title: input.title,
    description: input.description,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };
}

export function addGameLog(
  game: Game,
  input: {
    type: GameLogType;
    title: string;
    description?: string;
    payload?: Record<string, unknown>;
  },
): Game {
  return {
    ...game,
    logs: [
      createGameLog({
        game,
        ...input,
      }),
      ...game.logs,
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function evaluateWinCondition(game: Game): WinningTeam {
  const alivePlayers = game.players.filter((player) => player.isAlive);

  const aliveDemonExists = alivePlayers.some((player) => {
    const character = player.characterId
      ? getCharacterById(player.characterId)
      : undefined;

    return character?.type === "demon";
  });

  if (!aliveDemonExists) {
    return "good";
  }

  if (alivePlayers.length <= 2 && aliveDemonExists) {
    return "evil";
  }

  return null;
}

export function applyWinCondition(game: Game): Game {
  const winningTeam = evaluateWinCondition(game);

  if (!winningTeam) {
    return game;
  }

  const nextGame: Game = {
    ...game,
    status: "finished",
    currentPhase: "ended",
    currentDaySubPhase: null,
    winningTeam,
    updatedAt: new Date().toISOString(),
  };

  return addGameLog(nextGame, {
    type: "win_condition",
    title: winningTeam === "good" ? "蓝方胜利" : "红方胜利",
    description:
      winningTeam === "good"
        ? "场上不存在存活恶魔，善良阵营获胜。"
        : "场上仅剩两名或更少存活玩家，且恶魔仍然存活，邪恶阵营获胜。",
    payload: { winningTeam },
  });
}

export function markPendingExecutionDeathAtDusk(game: Game): Game {
  const pendingDeathPlayerId = game.executionState.pendingDeathPlayerId;

  if (!pendingDeathPlayerId) {
    return addGameLog(game, {
      type: "phase_change",
      title: "黄昏阶段",
      description: "本次黄昏没有待处决死亡的玩家。",
    });
  }

  const targetPlayer = game.players.find(
    (player) => player.id === pendingDeathPlayerId,
  );

  const nextPlayers = game.players.map((player) =>
    player.id === pendingDeathPlayerId
      ? {
          ...player,
          isAlive: false,
        }
      : player,
  );

  let nextGame: Game = {
    ...game,
    players: nextPlayers,
    executionState: {
      ...game.executionState,
      executedPlayerId: pendingDeathPlayerId,
      pendingDeathPlayerId: undefined,
    },
    updatedAt: new Date().toISOString(),
  };

  nextGame = addGameLog(nextGame, {
    type: "player_executed",
    title: "处决生效",
    description: targetPlayer
      ? `${targetPlayer.displayName} 在黄昏死亡。`
      : "一名待处决玩家在黄昏死亡。",
    payload: {
      playerId: pendingDeathPlayerId,
    },
  });

  return applyWinCondition(nextGame);
}

export function enterDusk(game: Game): Game {
  let nextGame: Game = {
    ...game,
    currentPhase: "dusk",
    currentDaySubPhase: null,
    updatedAt: new Date().toISOString(),
  };

  nextGame = addGameLog(nextGame, {
    type: "phase_change",
    title: `进入第 ${game.currentDay} 天黄昏`,
  });

  if (game.currentDay === 0) {
    return addGameLog(nextGame, {
      type: "phase_change",
      title: "第 0 天黄昏",
      description: "第 0 天黄昏不会发生处决死亡。",
    });
  }

  return markPendingExecutionDeathAtDusk(nextGame);
}

export function enterNight(game: Game): Game {
  const nextGame: Game = {
    ...game,
    status: game.status === "setup" ? "running" : game.status,
    currentPhase: "night",
    currentDaySubPhase: null,
    nightActionState: {
      day: game.currentDay,
      currentStepIndex: 0,
      completedStepIds: [],
    },
    updatedAt: new Date().toISOString(),
  };

  return addGameLog(nextGame, {
    type: "phase_change",
    title:
      game.currentDay === 0
        ? "进入首夜"
        : `进入第 ${game.currentDay} 天夜晚`,
  });
}

export function enterDay(game: Game): Game {
  const nextDay = game.currentDay === 0 ? 1 : game.currentDay;

  const nextGame: Game = {
    ...game,
    currentDay: nextDay,
    currentPhase: "day",
    currentDaySubPhase: "private_chat",
    executionState: {
      day: nextDay,
      nominations: [],
      usedNominatorPlayerIds: [],
      usedNomineePlayerIds: [],
    },
    updatedAt: new Date().toISOString(),
  };

  return addGameLog(nextGame, {
    type: "phase_change",
    title: `进入第 ${nextDay} 天白天`,
    description: "白天从私聊阶段开始。",
  });
}

export function setDaySubPhase(game: Game, subPhase: DaySubPhase): Game {
  if (game.currentPhase !== "day") {
    return game;
  }

  const nextGame: Game = {
    ...game,
    currentDaySubPhase: subPhase,
    updatedAt: new Date().toISOString(),
  };

  return addGameLog(nextGame, {
    type: "phase_change",
    title: `进入${daySubPhaseLabels[subPhase]}阶段`,
  });
}

export function finishDayAndEnterDusk(game: Game): Game {
  return enterDusk({
    ...game,
    currentDaySubPhase: null,
    updatedAt: new Date().toISOString(),
  });
}

export function endGameManually(game: Game, winningTeam: Exclude<WinningTeam, null>): Game {
  const nextGame: Game = {
    ...game,
    status: "finished",
    currentPhase: "ended",
    currentDaySubPhase: null,
    winningTeam,
    updatedAt: new Date().toISOString(),
  };

  return addGameLog(nextGame, {
    type: "win_condition",
    title: winningTeam === "good" ? "手动结束：蓝方胜利" : "手动结束：红方胜利",
    payload: { winningTeam },
  });
}

export function getAlivePlayerCount(game: Game): number {
  return game.players.filter((player) => player.isAlive).length;
}

export function getRequiredVotes(game: Game): number {
  return Math.ceil(getAlivePlayerCount(game) / 2);
}

export function getMaxNominations(game: Game): number {
  return Math.floor(getAlivePlayerCount(game) / 3);
}