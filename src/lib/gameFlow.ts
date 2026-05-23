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

function applyScarletWomanReplacement(game: Game): Game {
  const alivePlayers = game.players.filter((player) => player.isAlive);
  const aliveDemonExists = alivePlayers.some((player) => {
    const character = player.characterId
      ? getCharacterById(player.characterId)
      : undefined;

    return character?.type === "demon";
  });

  if (aliveDemonExists || alivePlayers.length < 5) {
    return game;
  }

  const scarletWoman = alivePlayers.find((player) => {
    const character = player.characterId
      ? getCharacterById(player.characterId)
      : undefined;

    return character?.id === "scarlet_woman" && !player.isPoisoned;
  });

  if (!scarletWoman) {
    return game;
  }

  const nextGame: Game = {
    ...game,
    players: game.players.map((player) =>
      player.id === scarletWoman.id
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

  return addGameLog(nextGame, {
    type: "night_action",
    title: "红唇女郎变成小恶魔",
    description:
      "恶魔死亡且场上仍有至少五名存活玩家，系统将存活且未中毒的红唇女郎改为小恶魔。",
    payload: {
      replacementPlayerId: scarletWoman.id,
    },
  });
}

function clearPoisonedPlayers(game: Game): Game {
  if (!game.players.some((player) => player.isPoisoned)) {
    return game;
  }

  return {
    ...game,
    players: game.players.map((player) => ({
      ...player,
      isPoisoned: false,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function applyWinCondition(game: Game): Game {
  const replacementGame = applyScarletWomanReplacement(game);
  const winningTeam = evaluateWinCondition(replacementGame);

  if (!winningTeam) {
    return replacementGame;
  }

  const nextGame: Game = {
    ...replacementGame,
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

export function executeCurrentExecutionCandidate(game: Game): Game {
  const pendingDeathPlayerId = game.executionState.pendingDeathPlayerId;

  if (!pendingDeathPlayerId) {
    return game;
  }

  if (game.executionState.executedPlayerId === pendingDeathPlayerId) {
    return {
      ...game,
      executionState: {
        ...game.executionState,
        pendingDeathPlayerId: undefined,
      },
      updatedAt: new Date().toISOString(),
    };
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
    title: "黄昏处决",
    description: targetPlayer
      ? `${targetPlayer.displayName} 被处决并死亡。`
      : "一名待处决玩家被处决并死亡。",
    payload: {
      playerId: pendingDeathPlayerId,
      playerName: targetPlayer?.displayName,
    },
  });

  const targetCharacter = targetPlayer?.characterId
    ? getCharacterById(targetPlayer.characterId)
    : undefined;

  if (targetCharacter?.id === "saint" && !targetPlayer?.isPoisoned) {
    return addGameLog(
      {
        ...nextGame,
        status: "finished",
        currentPhase: "ended",
        currentDaySubPhase: null,
        winningTeam: "evil",
        updatedAt: new Date().toISOString(),
      },
      {
        type: "win_condition",
        title: "邪恶方胜利",
        description: "圣徒被处决，邪恶阵营获胜。",
        payload: {
          winningTeam: "evil",
          playerId: pendingDeathPlayerId,
        },
      },
    );
  }

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
    description:
      game.currentDay === 0
        ? "第 0 天黄昏不会发生处决死亡。"
        : "黄昏开始，若有人在处决台上，将立即死亡。",
  });

  if (game.currentDay === 0) {
    return clearPoisonedPlayers(nextGame);
  }

  const alivePlayers = nextGame.players.filter((player) => player.isAlive);
  const aliveMayor = alivePlayers.find((player) => {
    const character = player.characterId
      ? getCharacterById(player.characterId)
      : undefined;

    return character?.id === "mayor" && !player.isPoisoned;
  });

  if (!nextGame.executionState.pendingDeathPlayerId && aliveMayor && alivePlayers.length === 3) {
    return addGameLog(
      {
        ...nextGame,
        status: "finished",
        currentPhase: "ended",
        currentDaySubPhase: null,
        winningTeam: "good",
        updatedAt: new Date().toISOString(),
      },
      {
        type: "win_condition",
        title: "善良方胜利",
        description: "仅剩三名存活玩家且白天无人被处决，镇长条件触发。",
        payload: {
          winningTeam: "good",
          mayorPlayerId: aliveMayor.id,
        },
      },
    );
  }

  const executedGame = executeCurrentExecutionCandidate(nextGame);

  return executedGame.currentPhase === "ended"
    ? executedGame
    : clearPoisonedPlayers(executedGame);
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
  const nextDay =
    game.currentPhase === "night" ? game.currentDay + 1 : Math.max(1, game.currentDay);

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

export function advanceGamePhase(game: Game): Game {
  if (game.currentPhase === "ended") {
    return game;
  }

  if (game.currentPhase === "dusk") {
    return enterNight(game);
  }

  if (game.currentPhase === "night") {
    return enterDay(game);
  }

  if (game.currentPhase === "day") {
    if (game.currentDaySubPhase === "private_chat") {
      return setDaySubPhase(game, "speeches");
    }

    if (game.currentDaySubPhase === "speeches") {
      return setDaySubPhase(game, "open_discussion");
    }

    if (game.currentDaySubPhase === "open_discussion") {
      return setDaySubPhase(game, "nomination");
    }

    if (game.currentDaySubPhase === "nomination") {
      return enterDusk(game);
    }

    return setDaySubPhase(game, "private_chat");
  }

  return game;
}

export function retreatGamePhase(game: Game): Game {
  if (game.currentPhase === "ended") {
    return game;
  }

  const now = new Date().toISOString();

  if (game.currentPhase === "day") {
    if (game.currentDaySubPhase === "private_chat") {
      return addGameLog(
        {
          ...game,
          currentPhase: "night",
          currentDaySubPhase: null,
          executionState: {
            day: game.currentDay,
            nominations: [],
            usedNominatorPlayerIds: [],
            usedNomineePlayerIds: [],
          },
          updatedAt: now,
        },
        {
          type: "manual_note",
          title: "回退阶段",
          description: "从私聊阶段回退到夜晚，并清空本日提名状态。",
        },
      );
    }

    if (game.currentDaySubPhase === "speeches") {
      return addGameLog(
        {
          ...game,
          currentDaySubPhase: "private_chat",
          updatedAt: now,
        },
        {
          type: "manual_note",
          title: "回退阶段",
          description: "从顺序发言回退到私聊。",
        },
      );
    }

    if (game.currentDaySubPhase === "open_discussion") {
      return addGameLog(
        {
          ...game,
          currentDaySubPhase: "speeches",
          updatedAt: now,
        },
        {
          type: "manual_note",
          title: "回退阶段",
          description: "从大公聊回退到顺序发言。",
        },
      );
    }

    if (game.currentDaySubPhase === "nomination") {
      return addGameLog(
        {
          ...game,
          currentDaySubPhase: "open_discussion",
          executionState: {
            day: game.currentDay,
            nominations: [],
            usedNominatorPlayerIds: [],
            usedNomineePlayerIds: [],
          },
          updatedAt: now,
        },
        {
          type: "manual_note",
          title: "回退阶段",
          description: "从提名阶段回退到大公聊，并清空本日提名状态。",
        },
      );
    }
  }

  if (game.currentPhase === "night") {
    return addGameLog(
      {
        ...game,
        currentPhase: "dusk",
        currentDaySubPhase: null,
        nightActionState: {
          day: game.currentDay,
          currentStepIndex: 0,
          completedStepIds: [],
        },
        updatedAt: now,
      },
      {
        type: "manual_note",
        title: "回退阶段",
        description: "从夜晚回退到黄昏，并清空本夜行动状态。",
      },
    );
  }

  if (game.currentPhase === "dusk") {
    if (game.currentDay <= 0) {
      return game;
    }

    return addGameLog(
      {
        ...game,
        currentPhase: "day",
        currentDaySubPhase: "nomination",
        updatedAt: now,
      },
      {
        type: "manual_note",
        title: "回退阶段",
        description:
          "从黄昏回退到提名阶段。已发生的死亡状态不会被自动撤销。",
      },
    );
  }

  return game;
}

export function finishDayAndEnterDusk(game: Game): Game {
  return enterDusk({
    ...game,
    currentDaySubPhase: null,
    updatedAt: new Date().toISOString(),
  });
}

export function endGameManually(
  game: Game,
  winningTeam: Exclude<WinningTeam, null>,
): Game {
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
