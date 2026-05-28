import { reduceGameAction } from "@/lib/gameReducer";
import {
  validateGameAction,
  type GameActionValidationResult,
} from "@/lib/gameValidation";
import type { GameAction } from "@/types/actions";
import type { Game } from "@/types/game";

export interface GameStore {
  getGame(gameId: string): Promise<Game | null>;
  saveGame(game: Game): Promise<void>;
  deleteGame?(gameId: string): Promise<void>;
  submitAction?(gameId: string, action: GameAction): Promise<Game>;
  listGames?(): Promise<Game[]>;
  createGame?(game: Game): Promise<Game>;
}

export type SubmitLocalGameActionResult = {
  game: Game;
  validation: GameActionValidationResult;
};

export function submitLocalGameAction(
  game: Game,
  action: GameAction,
): SubmitLocalGameActionResult {
  const validation = validateGameAction(game, action);

  if (!validation.ok) {
    return {
      game,
      validation,
    };
  }

  return {
    game: reduceGameAction(game, action),
    validation,
  };
}
