import { addGameLog, applyWinCondition } from "@/lib/gameFlow";
import { getCharacterById } from "@/lib/gameData";
import { createLocalId } from "@/lib/localGames";
import type { Game, PrivateInfo } from "@/types/game";

type PrivateInfoInput = {
  recipientPlayerId: string;
  sourceCharacterId: string;
  title: string;
  content: string;
  payload?: Record<string, unknown>;
};

export function addPrivateInfoToGame(
  game: Game,
  input: PrivateInfoInput,
): Game {
  const now = new Date().toISOString();

  const privateInfo: PrivateInfo = {
    id: createLocalId("private_info"),
    gameId: game.id,
    recipientPlayerId: input.recipientPlayerId,
    sourceCharacterId: input.sourceCharacterId,
    title: input.title,
    content: input.content,
    payload: input.payload ?? {},
    createdBy: "storyteller",
    createdAt: now,
    isRevealedToPlayer: true,
  };

  const nextGame: Game = {
    ...game,
    privateInfos: [privateInfo, ...(game.privateInfos ?? [])],
    updatedAt: now,
  };

  return addGameLog(nextGame, {
    type: "private_info",
    title: "记录私密信息",
    description: input.content,
    payload: {
      privateInfoId: privateInfo.id,
      recipientPlayerId: input.recipientPlayerId,
      sourceCharacterId: input.sourceCharacterId,
      ...input.payload,
    },
  });
}

export function setPlayerPoisoned(
  game: Game,
  playerId: string,
  isPoisoned: boolean,
): Game {
  const targetPlayer = game.players.find((player) => player.id === playerId);

  const nextGame: Game = {
    ...game,
    players: game.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            isPoisoned,
          }
        : player,
    ),
    updatedAt: new Date().toISOString(),
  };

  return addGameLog(nextGame, {
    type: "status_change",
    category: "status_change",
    title: isPoisoned ? "标记中毒" : "取消中毒",
    description: targetPlayer
      ? `${targetPlayer.displayName} ${isPoisoned ? "被标记为中毒。" : "不再被标记为中毒。"}`
      : "更新了一名玩家的中毒状态。",
    targetPlayerIds: [playerId],
    result: {
      type: "boolean",
      value: isPoisoned,
    },
    metadata: {
      playerId,
      field: "isPoisoned",
      previousValue: targetPlayer?.isPoisoned,
      nextValue: isPoisoned,
      source: "ability_or_manual",
    },
    payload: {
      playerId,
      isPoisoned,
    },
  });
}

export function setPlayerDrunk(
  game: Game,
  playerId: string,
  isDrunk: boolean,
): Game {
  const targetPlayer = game.players.find((player) => player.id === playerId);

  const nextGame: Game = {
    ...game,
    players: game.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            isDrunk,
          }
        : player,
    ),
    updatedAt: new Date().toISOString(),
  };

  return addGameLog(nextGame, {
    type: "status_change",
    category: "status_change",
    title: isDrunk ? "标记醉酒" : "取消醉酒",
    description: targetPlayer
      ? `${targetPlayer.displayName} ${isDrunk ? "被标记为醉酒。" : "不再被标记为醉酒。"}`
      : "更新了一名玩家的醉酒状态。",
    targetPlayerIds: [playerId],
    result: {
      type: "boolean",
      value: isDrunk,
    },
    metadata: {
      playerId,
      field: "isDrunk",
      previousValue: targetPlayer?.isDrunk,
      nextValue: isDrunk,
      source: "ability_or_manual",
    },
    payload: {
      playerId,
      isDrunk,
    },
  });
}

export function killPlayerAtNight(
  game: Game,
  playerId: string,
  sourceCharacterId: string,
): Game {
  const targetPlayer = game.players.find((player) => player.id === playerId);
  const sourceCharacter = getCharacterById(sourceCharacterId);

  const nextGame: Game = {
    ...game,
    players: game.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            isAlive: false,
          }
        : player,
    ),
    updatedAt: new Date().toISOString(),
  };

  return applyWinCondition(
    addGameLog(nextGame, {
      type: "player_death",
      category: "death",
      title: "夜晚死亡",
      description: targetPlayer
        ? `${targetPlayer.displayName} 在夜晚死亡。`
        : "一名玩家在夜晚死亡。",
      targetPlayerIds: [playerId],
      characterId: sourceCharacterId,
      result: {
        type: "boolean",
        value: true,
      },
      metadata: {
        playerId,
        sourceCharacterId,
        died: true,
      },
      payload: {
        playerId,
        sourceCharacterId,
        sourceCharacterName: sourceCharacter?.nameZh,
      },
    }),
  );
}

export function recordStorytellerNightAction(input: {
  game: Game;
  sourceCharacterId: string;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
}): Game {
  const sourceCharacter = getCharacterById(input.sourceCharacterId);

  return addGameLog(input.game, {
    type: "night_action",
    title: input.title,
    description: input.description,
    payload: {
      sourceCharacterId: input.sourceCharacterId,
      sourceCharacterName: sourceCharacter?.nameZh,
      ...input.payload,
    },
  });
}

export function getPlayerLabel(game: Game, playerId: string): string {
  const player = game.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    return "未知玩家";
  }

  return `${player.seatNumber}. ${player.displayName}`;
}

export function getCharacterLabel(characterId: string): string {
  const character = getCharacterById(characterId);

  if (!character) {
    return "未知角色";
  }

  return `${character.nameZh} / ${character.nameEn}`;
}
