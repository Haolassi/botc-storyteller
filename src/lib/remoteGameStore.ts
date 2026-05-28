import type { GameStore } from "@/lib/gameStore";

function notImplemented(): never {
  throw new Error("remoteGameStore is not implemented yet.");
}

export const remoteGameStore: GameStore = {
  async getGame() {
    notImplemented();
  },

  async saveGame() {
    notImplemented();
  },

  async deleteGame() {
    notImplemented();
  },

  async submitAction() {
    notImplemented();
  },
};
