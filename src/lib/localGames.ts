import type { Game, GamePlayer } from "@/types/game";

const LOCAL_GAMES_KEY = "storyteller-notes:games";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeGame(rawGame: Partial<Game>): Game {
  const now = new Date().toISOString();
  const currentDay = rawGame.currentDay ?? 0;

  return {
    id: rawGame.id ?? createLocalId("game"),
    scriptId: rawGame.scriptId ?? "trouble_brewing",
    status: rawGame.status ?? "setup",
    storytellerId: rawGame.storytellerId,
    players: rawGame.players ?? [],
    currentDay,
    currentPhase: rawGame.currentPhase ?? "dusk",
    currentDaySubPhase: rawGame.currentDaySubPhase ?? null,
    winningTeam: rawGame.winningTeam ?? null,
    setupState: {
      fortuneTellerRedHerringPlayerId:
        rawGame.setupState?.fortuneTellerRedHerringPlayerId,
      usedSlayerPlayerIds: rawGame.setupState?.usedSlayerPlayerIds ?? [],
      butlerMasterPlayerIds: rawGame.setupState?.butlerMasterPlayerIds ?? {},
      triggeredVirginPlayerIds:
        rawGame.setupState?.triggeredVirginPlayerIds ?? [],
      usedDeadVotePlayerIds: rawGame.setupState?.usedDeadVotePlayerIds ?? [],
    },
    executionState: rawGame.executionState ?? {
      day: currentDay,
      nominations: [],
      usedNominatorPlayerIds: [],
      usedNomineePlayerIds: [],
    },
    nightActionState: rawGame.nightActionState ?? {
      day: currentDay,
      currentStepIndex: 0,
      completedStepIds: [],
    },
    privateInfos: rawGame.privateInfos ?? [],
    logs: rawGame.logs ?? [],
    createdAt: rawGame.createdAt ?? now,
    updatedAt: rawGame.updatedAt ?? rawGame.createdAt ?? now,
  };
}

export function readLocalGames(): Game[] {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(LOCAL_GAMES_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((game) => normalizeGame(game));
  } catch {
    return [];
  }
}

export function writeLocalGames(games: Game[]): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    LOCAL_GAMES_KEY,
    JSON.stringify(games.map((game) => normalizeGame(game))),
  );
}

export function saveLocalGame(game: Game): void {
  const games = readLocalGames();
  const normalizedGame = normalizeGame(game);
  const existingIndex = games.findIndex(
    (existingGame) => existingGame.id === normalizedGame.id,
  );

  if (existingIndex >= 0) {
    games[existingIndex] = normalizedGame;
  } else {
    games.push(normalizedGame);
  }

  writeLocalGames(games);
}

export function getLocalGameById(id: string): Game | undefined {
  const game = readLocalGames().find((savedGame) => savedGame.id === id);

  return game ? normalizeGame(game) : undefined;
}

export function deleteLocalGame(id: string): void {
  const games = readLocalGames().filter((game) => game.id !== id);
  writeLocalGames(games);
}

export function createPlayersFromNames(
  gameId: string,
  names: string[],
): GamePlayer[] {
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((displayName, index) => ({
      id: createLocalId("player"),
      gameId,
      seatNumber: index + 1,
      displayName,
      isAlive: true,
      isDrunk: false,
      isPoisoned: false,
    }));
}

export function createInitialGameState(input: {
  id: string;
  scriptId: string;
  players: GamePlayer[];
  createdAt?: string;
}): Game {
  const now = input.createdAt ?? new Date().toISOString();

  return normalizeGame({
    id: input.id,
    scriptId: input.scriptId,
    status: "setup",
    players: input.players,
    currentDay: 0,
    currentPhase: "dusk",
    currentDaySubPhase: null,
    winningTeam: null,
    setupState: {},
    executionState: {
      day: 0,
      nominations: [],
      usedNominatorPlayerIds: [],
      usedNomineePlayerIds: [],
    },
    nightActionState: {
      day: 0,
      currentStepIndex: 0,
      completedStepIds: [],
    },
    privateInfos: [],
    logs: [],
    createdAt: now,
    updatedAt: now,
  });
}

export function createLocalGame(input: {
  scriptId: string;
  playerNames: string[];
}): Game {
  const now = new Date().toISOString();
  const gameId = createLocalId("game");
  const players = createPlayersFromNames(gameId, input.playerNames);

  return createInitialGameState({
    id: gameId,
    scriptId: input.scriptId,
    players,
    createdAt: now,
  });
}
