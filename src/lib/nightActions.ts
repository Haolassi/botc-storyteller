import { getNightOrderSteps } from "@/data/nightOrder";
import { addGameLog } from "@/lib/gameFlow";
import {
  getEffectiveActionCharacter,
  getRealCharacter,
} from "@/lib/registrationLogic";
import type { Game } from "@/types/game";

function wasRavenkeeperKilledTonight(game: Game): boolean {
  return game.logs.some(
    (log) =>
      log.type === "player_death" &&
      log.phase === "night" &&
      log.day === game.currentDay &&
      game.players.some((player) => {
        const character = getRealCharacter(player);

        return (
          player.id === log.payload?.playerId &&
          character?.id === "ravenkeeper"
        );
      }),
  );
}

export function getNightPhaseForGame(game: Game) {
  return game.currentDay === 0 ? "first_night" : "other_night";
}

export function getActiveNightSteps(game: Game) {
  const phase = getNightPhaseForGame(game);
  const allSteps = getNightOrderSteps(game.scriptId, phase);

  return allSteps.filter((step) => {
    if (step.type === "system") {
      return true;
    }

    if (!step.characterId) {
      return false;
    }

    return game.players.some((player) => {
      const effectiveCharacter = getEffectiveActionCharacter(player);

      if (step.characterId === "ravenkeeper") {
        const realCharacter = getRealCharacter(player);

        return realCharacter?.id === "ravenkeeper" && wasRavenkeeperKilledTonight(game);
      }

      return player.isAlive && effectiveCharacter?.id === step.characterId;
    });
  });
}

export function getCurrentNightStep(game: Game) {
  const steps = getActiveNightSteps(game);
  const completedStepIds = game.nightActionState.completedStepIds;

  return steps.find((step) => !completedStepIds.includes(step.id));
}

export function getNightProgress(game: Game) {
  const steps = getActiveNightSteps(game);
  const completedCount = steps.filter((step) =>
    game.nightActionState.completedStepIds.includes(step.id),
  ).length;

  return {
    total: steps.length,
    completed: completedCount,
    remaining: Math.max(0, steps.length - completedCount),
  };
}

export function getNightActorForStep(game: Game, characterId?: string) {
  if (!characterId) {
    return undefined;
  }

  return game.players.find((player) => {
    const effectiveCharacter = getEffectiveActionCharacter(player);

    if (characterId === "ravenkeeper") {
      const realCharacter = getRealCharacter(player);

      if (realCharacter?.id === "ravenkeeper" && wasRavenkeeperKilledTonight(game)) {
        return true;
      }
    }

    return player.isAlive && effectiveCharacter?.id === characterId;
  });
}

export function isPlayerActingAsDrunk(game: Game, playerId: string): boolean {
  const player = game.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    return false;
  }

  const realCharacter = getRealCharacter(player);

  return realCharacter?.id === "drunk" && Boolean(player.apparentCharacterId);
}

export function completeCurrentNightStep(
  game: Game,
  note?: string,
): Game {
  if (game.currentPhase !== "night") {
    return game;
  }

  const currentStep = getCurrentNightStep(game);

  if (!currentStep) {
    return addGameLog(game, {
      type: "night_action",
      title: "夜晚行动已全部完成",
      description: "当前夜晚没有剩余行动步骤。",
    });
  }

  const actor = getNightActorForStep(game, currentStep.characterId);
  const isDrunkActing =
    actor && currentStep.characterId
      ? isPlayerActingAsDrunk(game, actor.id)
      : false;

  const nextGame: Game = {
    ...game,
    nightActionState: {
      ...game.nightActionState,
      completedStepIds: [
        ...game.nightActionState.completedStepIds,
        currentStep.id,
      ],
      currentStepIndex: game.nightActionState.currentStepIndex + 1,
    },
    updatedAt: new Date().toISOString(),
  };

  return addGameLog(nextGame, {
    type: "night_action",
    category: "night_action",
    title: `完成夜晚行动：${currentStep.labelZh}`,
    description: note?.trim()
      ? note.trim()
      : currentStep.type === "system"
        ? "说书人完成了该系统夜晚步骤。"
        : isDrunkActing
          ? "该行动由酒鬼的表面角色触发；其获得的信息不具备规则参考价值。"
          : "说书人完成了该角色的夜晚行动处理。",
    actorPlayerId: actor?.id,
    characterId: currentStep.characterId,
    systemReference: {
      summary: isDrunkActing
        ? "该行动由酒鬼的表面角色触发，规则参考可能无效。"
        : "说书人完成当前夜晚行动，具体裁定以说书人记录为准。",
      isAffectedByDrunkOrPoison: isDrunkActing || Boolean(actor?.isPoisoned),
      relatedPlayerIds: actor ? [actor.id] : undefined,
      relatedCharacterIds: currentStep.characterId ? [currentStep.characterId] : undefined,
      notes: note?.trim() ? [note.trim()] : undefined,
    },
    metadata: {
      nightPhase: getNightPhaseForGame(game),
      stepId: currentStep.id,
      stepLabelZh: currentStep.labelZh,
      stepLabelEn: currentStep.labelEn,
      stepType: currentStep.type,
      phase: currentStep.phase,
      actorPlayerId: actor?.id,
      isDrunkActing,
    },
    payload: {
      stepId: currentStep.id,
      characterId: currentStep.characterId,
      stepType: currentStep.type,
      phase: currentStep.phase,
      actorPlayerId: actor?.id,
      isDrunkActing,
    },
  });
}

export function resetNightActions(game: Game): Game {
  const nextGame: Game = {
    ...game,
    nightActionState: {
      day: game.currentDay,
      currentStepIndex: 0,
      completedStepIds: [],
    },
    updatedAt: new Date().toISOString(),
  };

  return addGameLog(nextGame, {
    type: "night_action",
    title: "重置夜晚行动",
    description: "本夜行动进度已被重置。",
  });
}

export function isNightComplete(game: Game): boolean {
  const progress = getNightProgress(game);
  return progress.total > 0 && progress.remaining === 0;
}
