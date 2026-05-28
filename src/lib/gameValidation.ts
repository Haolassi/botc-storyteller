import {
  canPlayerBeNominated,
  canPlayerNominate,
  getPlayerById,
  getRemainingNominationCount,
} from "@/lib/nominations";
import {
  getActiveNightSteps,
  getCurrentNightStep,
} from "@/lib/nightActions";
import type { Game } from "@/types/game";
import type { GameAction } from "@/types/actions";

export type GameActionValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: string;
    };

export function validateGameAction(
  game: Game,
  action: GameAction,
): GameActionValidationResult {
  if (game.currentPhase === "ended" && action.type !== "END_GAME_MANUALLY") {
    return {
      ok: false,
      reason: "Game has already ended.",
    };
  }

  if (action.type === "SET_DAY_SUB_PHASE" && game.currentPhase !== "day") {
    return {
      ok: false,
      reason: "Day sub phase can only be changed during the day.",
    };
  }

  if (action.type === "END_GAME_MANUALLY" && game.status === "finished") {
    return {
      ok: false,
      reason: "Game has already finished.",
    };
  }

  if (action.type === "RESOLVE_NOMINATION") {
    if (game.status === "finished") {
      return {
        ok: false,
        reason: "Finished games cannot accept nominations.",
      };
    }

    if (game.currentPhase !== "day" || game.currentDaySubPhase !== "nomination") {
      return {
        ok: false,
        reason: "Nominations can only be resolved during the nomination phase.",
      };
    }

    if (getRemainingNominationCount(game) <= 0) {
      return {
        ok: false,
        reason: "No nominations remain today.",
      };
    }

    const { nominatorPlayerId, nomineePlayerId, votePlayerIds } = action.payload;
    const nominator = getPlayerById(game, nominatorPlayerId);

    if (!nominator) {
      return {
        ok: false,
        reason: "Nominator does not exist.",
      };
    }

    const nominee = getPlayerById(game, nomineePlayerId);

    if (!nominee) {
      return {
        ok: false,
        reason: "Nominee does not exist.",
      };
    }

    if (!canPlayerNominate(game, nominatorPlayerId)) {
      return {
        ok: false,
        reason: "Nominator cannot nominate again today.",
      };
    }

    if (!canPlayerBeNominated(game, nomineePlayerId)) {
      return {
        ok: false,
        reason: "Nominee cannot be nominated again today.",
      };
    }

    const usedDeadVotePlayerIds = game.setupState.usedDeadVotePlayerIds ?? [];
    const missingVoter = votePlayerIds.find((voterId) => {
      const voter = getPlayerById(game, voterId);

      return !voter;
    });

    if (missingVoter) {
      return {
        ok: false,
        reason: "Vote list contains an unknown player.",
      };
    }

    const invalidDeadVoter = votePlayerIds.find((voterId) => {
      const voter = getPlayerById(game, voterId);

      return voter && !voter.isAlive && usedDeadVotePlayerIds.includes(voter.id);
    });

    if (invalidDeadVoter) {
      return {
        ok: false,
        reason: "Vote list contains a dead player whose dead vote is already used.",
      };
    }
  }

  if (action.type === "UPDATE_PLAYER_STATUS") {
    if (game.status === "finished") {
      return {
        ok: false,
        reason: "Finished games cannot update player status.",
      };
    }

    if (!getPlayerById(game, action.payload.playerId)) {
      return {
        ok: false,
        reason: "Player does not exist.",
      };
    }

    if (
      action.payload.isAlive === undefined &&
      action.payload.isPoisoned === undefined &&
      action.payload.isDrunk === undefined
    ) {
      return {
        ok: false,
        reason: "At least one player status field must be provided.",
      };
    }
  }

  if (action.type === "USE_DAY_ABILITY") {
    if (game.status === "finished") {
      return {
        ok: false,
        reason: "Finished games cannot use day abilities.",
      };
    }

    if (game.currentPhase !== "day") {
      return {
        ok: false,
        reason: "Day abilities can only be used during the day.",
      };
    }

    const actor = getPlayerById(game, action.payload.actorPlayerId);

    if (!actor) {
      return {
        ok: false,
        reason: "Ability actor does not exist.",
      };
    }

    if (action.payload.characterId !== "slayer") {
      return {
        ok: false,
        reason: "Unsupported day ability.",
      };
    }

    if (actor.characterId !== "slayer") {
      return {
        ok: false,
        reason: "Ability actor is not the Slayer.",
      };
    }

    if (!action.payload.targetPlayerId) {
      return {
        ok: false,
        reason: "Slayer ability requires a target player.",
      };
    }

    if (!getPlayerById(game, action.payload.targetPlayerId)) {
      return {
        ok: false,
        reason: "Ability target does not exist.",
      };
    }

    if ((game.setupState.usedSlayerPlayerIds ?? []).includes(actor.id)) {
      return {
        ok: false,
        reason: "Slayer ability has already been used.",
      };
    }
  }

  if (action.type === "ADD_MANUAL_NOTE") {
    if (!action.payload.description.trim()) {
      return {
        ok: false,
        reason: "Manual note description cannot be empty.",
      };
    }
  }

  if (
    action.type === "COMPLETE_NIGHT_STEP" ||
    action.type === "APPLY_NIGHT_ACTION"
  ) {
    if (game.status === "finished") {
      return {
        ok: false,
        reason: "Finished games cannot complete night steps.",
      };
    }

    if (game.currentPhase !== "night") {
      return {
        ok: false,
        reason: "Night steps can only be completed during the night.",
      };
    }

    if (!game.nightActionState) {
      return {
        ok: false,
        reason: "Night action state is missing.",
      };
    }

    const currentStep = getCurrentNightStep(game);

    if (!currentStep) {
      return {
        ok: false,
        reason: "There is no current night step to complete.",
      };
    }

    const stepId = action.payload?.stepId;

    if (stepId) {
      const activeStepExists = getActiveNightSteps(game).some(
        (step) => step.id === stepId,
      );

      if (!activeStepExists) {
        return {
          ok: false,
          reason: "Night step is not active for the current game.",
        };
      }

      if (currentStep.id !== stepId) {
        return {
          ok: false,
          reason: "Night step does not match the current step.",
        };
      }
    }
  }

  if (action.type === "RESET_NIGHT_ACTIONS") {
    if (game.status === "finished") {
      return {
        ok: false,
        reason: "Finished games cannot reset night actions.",
      };
    }

    if (game.currentPhase !== "night") {
      return {
        ok: false,
        reason: "Night actions can only be reset during the night.",
      };
    }

    if (!game.nightActionState) {
      return {
        ok: false,
        reason: "Night action state is missing.",
      };
    }
  }

  return {
    ok: true,
  };
}
