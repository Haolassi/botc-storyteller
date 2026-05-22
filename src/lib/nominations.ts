import { addGameLog, getAlivePlayerCount, getRequiredVotes } from "@/lib/gameFlow";
import { createLocalId } from "@/lib/localGames";
import type { Game, GamePlayer, NominationRecord } from "@/types/game";

export interface NominationResult {
  game: Game;
  error?: string;
}

export function getPlayerById(
  game: Game,
  playerId: string,
): GamePlayer | undefined {
  return game.players.find((player) => player.id === playerId);
}

export function canPlayerNominate(game: Game, playerId: string): boolean {
  const player = getPlayerById(game, playerId);

  if (!player?.isAlive) {
    return false;
  }

  return !game.executionState.usedNominatorPlayerIds.includes(playerId);
}

export function canPlayerBeNominated(game: Game, playerId: string): boolean {
  const player = getPlayerById(game, playerId);

  if (!player?.isAlive) {
    return false;
  }

  return !game.executionState.usedNomineePlayerIds.includes(playerId);
}

export function getMaxNominationsForCurrentDay(game: Game): number {
  return Math.floor(getAlivePlayerCount(game) / 3);
}

export function getRemainingNominationCount(game: Game): number {
  return Math.max(
    0,
    getMaxNominationsForCurrentDay(game) - game.executionState.nominations.length,
  );
}

export function getCurrentExecutionCandidate(
  game: Game,
): NominationRecord | undefined {
  const pendingDeathPlayerId = game.executionState.pendingDeathPlayerId;

  if (!pendingDeathPlayerId) {
    return undefined;
  }

  return game.executionState.nominations.find(
    (nomination) => nomination.nomineePlayerId === pendingDeathPlayerId,
  );
}

export function getHighestOnBlockNomination(
  nominations: NominationRecord[],
): NominationRecord | undefined {
  return nominations
    .filter((nomination) => nomination.isOnBlock)
    .sort((a, b) => b.voteCount - a.voteCount)[0];
}

export function createNomination(input: {
  game: Game;
  nominatorPlayerId: string;
  nomineePlayerId: string;
  votePlayerIds: string[];
}): NominationResult {
  const { game, nominatorPlayerId, nomineePlayerId, votePlayerIds } = input;

  if (
    game.currentPhase !== "day" ||
    game.currentDaySubPhase !== "nomination"
  ) {
    return {
      game,
      error: "当前不在提名阶段。",
    };
  }

  if (getRemainingNominationCount(game) <= 0) {
    return {
      game,
      error: "今日提名次数已用完。",
    };
  }

  const nominator = getPlayerById(game, nominatorPlayerId);
  const nominee = getPlayerById(game, nomineePlayerId);

  if (!nominator) {
    return {
      game,
      error: "找不到提名者。",
    };
  }

  if (!nominee) {
    return {
      game,
      error: "找不到被提名者。",
    };
  }

  if (!canPlayerNominate(game, nominatorPlayerId)) {
    return {
      game,
      error: `${nominator.displayName} 当前不能提名。`,
    };
  }

  if (!canPlayerBeNominated(game, nomineePlayerId)) {
    return {
      game,
      error: `${nominee.displayName} 当前不能被提名。`,
    };
  }

  const uniqueVotePlayerIds = Array.from(new Set(votePlayerIds));

  const invalidVoter = uniqueVotePlayerIds.find((voterId) => {
    const voter = getPlayerById(game, voterId);
    return !voter?.isAlive;
  });

  if (invalidVoter) {
    return {
      game,
      error: "投票者必须是存活玩家。",
    };
  }

  const requiredVotes = getRequiredVotes(game);
  const voteCount = uniqueVotePlayerIds.length;
  const isOnBlock = voteCount >= requiredVotes;

  const nomination: NominationRecord = {
    id: createLocalId("nomination"),
    gameId: game.id,
    day: game.currentDay,
    nominatorPlayerId,
    nomineePlayerId,
    votePlayerIds: uniqueVotePlayerIds,
    voteCount,
    requiredVotes,
    isOnBlock,
    createdAt: new Date().toISOString(),
  };

  const nominations = [...game.executionState.nominations, nomination];

  const currentCandidate = getCurrentExecutionCandidate(game);
  let pendingDeathPlayerId = game.executionState.pendingDeathPlayerId;

  if (isOnBlock) {
    if (!currentCandidate || voteCount > currentCandidate.voteCount) {
      pendingDeathPlayerId = nomineePlayerId;
    }
  }

  let nextGame: Game = {
    ...game,
    executionState: {
      ...game.executionState,
      nominations,
      pendingDeathPlayerId,
      usedNominatorPlayerIds: [
        ...game.executionState.usedNominatorPlayerIds,
        nominatorPlayerId,
      ],
      usedNomineePlayerIds: [
        ...game.executionState.usedNomineePlayerIds,
        nomineePlayerId,
      ],
    },
    updatedAt: new Date().toISOString(),
  };

  const voterNames = uniqueVotePlayerIds
    .map((voterId) => getPlayerById(game, voterId)?.displayName)
    .filter(Boolean)
    .join("、");

  nextGame = addGameLog(nextGame, {
    type: "nomination",
    title: `${nominator.displayName} 提名 ${nominee.displayName}`,
    description: isOnBlock
      ? `${nominee.displayName} 获得 ${voteCount} 票，达到 ${requiredVotes} 票门槛，上处决台。`
      : `${nominee.displayName} 获得 ${voteCount} 票，未达到 ${requiredVotes} 票门槛。`,
    payload: {
      nominationId: nomination.id,
      nominatorPlayerId,
      nomineePlayerId,
      votePlayerIds: uniqueVotePlayerIds,
      voterNames,
      voteCount,
      requiredVotes,
      isOnBlock,
      pendingDeathPlayerId,
    },
  });

  return {
    game: nextGame,
  };
}

export function clearExecutionCandidate(game: Game): Game {
  const candidate = getCurrentExecutionCandidate(game);
  const nominee = candidate
    ? getPlayerById(game, candidate.nomineePlayerId)
    : undefined;

  const nextGame: Game = {
    ...game,
    executionState: {
      ...game.executionState,
      pendingDeathPlayerId: undefined,
    },
    updatedAt: new Date().toISOString(),
  };

  return addGameLog(nextGame, {
    type: "player_executed",
    title: "取消今日处决",
    description: nominee
      ? `${nominee.displayName} 从处决台移除。黄昏不会因处决死亡。`
      : "今日没有玩家会因处决在黄昏死亡。",
    payload: {
      previousPendingDeathPlayerId: nominee?.id,
    },
  });
}

export function getNominationStatusForPlayer(game: Game, playerId: string) {
  return {
    canNominate: canPlayerNominate(game, playerId),
    canBeNominated: canPlayerBeNominated(game, playerId),
    hasNominated: game.executionState.usedNominatorPlayerIds.includes(playerId),
    hasBeenNominated:
      game.executionState.usedNomineePlayerIds.includes(playerId),
  };
}