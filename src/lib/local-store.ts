import type { Game, Script } from "@/types/game";

export const SCRIPT_DRAFT_STORAGE_KEY = "deduction-desk:script-builder-draft";
export const SAVED_SCRIPTS_STORAGE_KEY = "deduction-desk:scripts";
export const GAMES_STORAGE_KEY = "deduction-desk:games";

export function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readCollection<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCollection<T>(key: string, values: T[]) {
  window.localStorage.setItem(key, JSON.stringify(values));
}

export function readSavedScripts() {
  return readCollection<Script>(SAVED_SCRIPTS_STORAGE_KEY);
}

export function writeSavedScripts(scripts: Script[]) {
  writeCollection(SAVED_SCRIPTS_STORAGE_KEY, scripts);
}

export function readSavedGames() {
  return readCollection<Game>(GAMES_STORAGE_KEY);
}

export function writeSavedGames(games: Game[]) {
  writeCollection(GAMES_STORAGE_KEY, games);
}

export function upsertSavedGame(game: Game) {
  const games = readSavedGames();
  const nextGames = games.some((savedGame) => savedGame.id === game.id)
    ? games.map((savedGame) => (savedGame.id === game.id ? game : savedGame))
    : [...games, game];

  writeSavedGames(nextGames);
}
