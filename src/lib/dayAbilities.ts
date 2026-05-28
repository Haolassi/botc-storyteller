import { addGameLog, applyWinCondition } from "@/lib/gameFlow";
import { getRealCharacter } from "@/lib/registrationLogic";
import type { DayAbilityAction } from "@/types/actions";
import type { Game } from "@/types/game";

export function applyDayAbility(game: Game, action: DayAbilityAction): Game {
  if (action.payload.characterId !== "slayer") {
    return game;
  }

  const slayerPlayer = game.players.find(
    (player) => player.id === action.payload.actorPlayerId,
  );
  const targetPlayer = game.players.find(
    (player) => player.id === action.payload.targetPlayerId,
  );

  if (!slayerPlayer || !targetPlayer) {
    return game;
  }

  const usedSlayerPlayerIds = game.setupState.usedSlayerPlayerIds ?? [];

  if (usedSlayerPlayerIds.includes(slayerPlayer.id)) {
    return game;
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

  return applyWinCondition(nextGame);
}
