import {
  addGameLog,
  advanceGamePhase,
  applyWinCondition,
  endGameManually,
  retreatGamePhase,
  resetCurrentPhaseActions,
  setDaySubPhase,
} from "@/lib/gameFlow";
import { applyDayAbility } from "@/lib/dayAbilities";
import {
  clearExecutionCandidate,
  createNomination,
} from "@/lib/nominations";
import {
  completeCurrentNightStep,
  resetNightActions,
} from "@/lib/nightActions";
import { resolveNightAction } from "@/lib/nightActionResolver";
import type { Game } from "@/types/game";
import type {
  GameAction,
  ManualNoteAction,
  PlayerStatusAction,
} from "@/types/actions";

function updatePlayerStatus(
  game: Game,
  action: PlayerStatusAction,
): Game {
  const { playerId } = action.payload;
  const previousPlayer = game.players.find((player) => player.id === playerId);

  if (!previousPlayer) {
    return game;
  }

  const updatedPlayers = game.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          isAlive: action.payload.isAlive ?? player.isAlive,
          isDrunk: action.payload.isDrunk ?? player.isDrunk,
          isPoisoned: action.payload.isPoisoned ?? player.isPoisoned,
        }
      : player,
  );
  const nextPlayer = updatedPlayers.find((player) => player.id === playerId);

  let loggedGame: Game = {
    ...game,
    players: updatedPlayers,
    updatedAt: new Date().toISOString(),
  };

  if (nextPlayer && previousPlayer.isAlive !== nextPlayer.isAlive) {
    loggedGame = addGameLog(loggedGame, {
      type: "player_death",
      category: "death",
      title: nextPlayer.isAlive ? "手动设为存活" : "手动设为死亡",
      description: `${nextPlayer.seatNumber}. ${nextPlayer.displayName} 被手动${
        nextPlayer.isAlive ? "设为存活" : "设为死亡"
      }。`,
      targetPlayerIds: [playerId],
      result: {
        type: "boolean",
        value: !nextPlayer.isAlive,
      },
      metadata: {
        playerId,
        field: "isAlive",
        previousValue: previousPlayer.isAlive,
        nextValue: nextPlayer.isAlive,
        source: "manual_toggle",
      },
    });
  }

  if (nextPlayer && previousPlayer.isDrunk !== nextPlayer.isDrunk) {
    loggedGame = addGameLog(loggedGame, {
      type: "status_change",
      category: "status_change",
      title: nextPlayer.isDrunk ? "手动标记醉酒" : "手动取消醉酒",
      description: `${nextPlayer.seatNumber}. ${nextPlayer.displayName} 被手动${
        nextPlayer.isDrunk ? "标记为醉酒" : "取消醉酒"
      }。`,
      targetPlayerIds: [playerId],
      result: {
        type: "boolean",
        value: nextPlayer.isDrunk,
      },
      metadata: {
        playerId,
        field: "isDrunk",
        previousValue: previousPlayer.isDrunk,
        nextValue: nextPlayer.isDrunk,
        source: "manual_toggle",
      },
    });
  }

  if (nextPlayer && previousPlayer.isPoisoned !== nextPlayer.isPoisoned) {
    loggedGame = addGameLog(loggedGame, {
      type: "status_change",
      category: "status_change",
      title: nextPlayer.isPoisoned ? "手动标记中毒" : "手动取消中毒",
      description: `${nextPlayer.seatNumber}. ${nextPlayer.displayName} 被手动${
        nextPlayer.isPoisoned ? "标记为中毒" : "取消中毒"
      }。`,
      targetPlayerIds: [playerId],
      result: {
        type: "boolean",
        value: nextPlayer.isPoisoned,
      },
      metadata: {
        playerId,
        field: "isPoisoned",
        previousValue: previousPlayer.isPoisoned,
        nextValue: nextPlayer.isPoisoned,
        source: "manual_toggle",
      },
    });
  }

  return applyWinCondition(loggedGame);
}

function addManualNote(game: Game, action: ManualNoteAction): Game {
  return addGameLog(game, {
    type: "manual_note",
    category: action.payload.category ?? "manual_note",
    visibility: action.payload.visibility ?? "storyteller_only",
    title: action.payload.title ?? "手动备注",
    description: action.payload.description,
    actorPlayerId: action.payload.actorPlayerId,
    metadata: action.payload.metadata ?? {
      editable: true,
    },
  });
}

export function reduceGameAction(game: Game, action: GameAction): Game {
  switch (action.type) {
    case "ADVANCE_PHASE":
      return advanceGamePhase(game);

    case "RETREAT_PHASE":
      return retreatGamePhase(game);

    case "RESET_PHASE_ACTIONS":
      return resetCurrentPhaseActions(game);

    case "SET_DAY_SUB_PHASE":
      return setDaySubPhase(game, action.payload.subPhase);

    case "END_GAME_MANUALLY":
      return endGameManually(game, action.payload.winningTeam);

    case "RESOLVE_NOMINATION": {
      const result = createNomination({
        game,
        nominatorPlayerId: action.payload.nominatorPlayerId,
        nomineePlayerId: action.payload.nomineePlayerId,
        votePlayerIds: action.payload.votePlayerIds,
      });

      return result.game;
    }

    case "CLEAR_EXECUTION_CANDIDATE":
      return clearExecutionCandidate(game);

    case "UPDATE_PLAYER_STATUS":
      return updatePlayerStatus(game, action);

    case "USE_DAY_ABILITY":
      return applyDayAbility(game, action);

    case "ADD_MANUAL_NOTE":
      return addManualNote(game, action);

    case "COMPLETE_NIGHT_STEP":
      return completeCurrentNightStep(game, action.payload?.note);

    case "APPLY_NIGHT_ACTION": {
      const resolvedAction = resolveNightAction(game, action);

      return completeCurrentNightStep(resolvedAction.game, resolvedAction.note);
    }

    case "RESET_NIGHT_ACTIONS":
      return resetNightActions(game);
  }
}
