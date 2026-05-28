import {
  deleteLocalGame,
  getLocalGameById,
  readLocalGames,
  saveLocalGame,
} from "@/lib/localGames";
import {
  submitLocalGameAction,
  type GameStore,
} from "@/lib/gameStore";
import type { GameAction } from "@/types/actions";
import type { Game } from "@/types/game";

export const localGameStore: GameStore = {
  async getGame(gameId: string) {
    return getLocalGameById(gameId) ?? null;
  },

  async saveGame(game: Game) {
    saveLocalGame(game);
  },

  async deleteGame(gameId: string) {
    deleteLocalGame(gameId);
  },

  async listGames() {
    return readLocalGames();
  },

  async createGame(game: Game) {
    saveLocalGame(game);

    return game;
  },

  async submitAction(gameId: string, action: GameAction) {
    const game = getLocalGameById(gameId);

    if (!game) {
      throw new Error("Game not found.");
    }

    const result = submitLocalGameAction(game, action);

    if (!result.validation.ok) {
      throw new Error(result.validation.reason);
    }

    saveLocalGame(result.game);

    return result.game;
  },
};
