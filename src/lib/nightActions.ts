import { getNightOrderSteps } from "@/data/nightOrder";
import { addGameLog } from "@/lib/gameFlow";
import { getCharacterById } from "@/lib/gameData";
import type { Game } from "@/types/game";

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
      const character = player.characterId
        ? getCharacterById(player.characterId)
        : undefined;

      return (
        player.isAlive &&
        character?.id === step.characterId
      );
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
    title: `完成夜晚行动：${currentStep.labelZh}`,
    description: note?.trim()
      ? note.trim()
      : currentStep.type === "system"
        ? "说书人完成了该系统夜晚步骤。"
        : "说书人完成了该角色的夜晚行动处理。",
    payload: {
      stepId: currentStep.id,
      characterId: currentStep.characterId,
      stepType: currentStep.type,
      phase: currentStep.phase,
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