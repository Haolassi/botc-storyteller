import type {
  ExecutionState,
  Game,
  GameLogEntry,
  GamePlayer,
  NominationRecord,
  PrivateInfo,
} from "@/types/game";

export type GameViewer =
  | {
      type: "storyteller";
      userId?: string;
      playerId?: string;
    }
  | {
      type: "player";
      userId?: string;
      playerId: string;
    }
  | {
      type: "spectator";
      userId?: string;
    };

export type VisibleGamePlayer = {
  id: string;
  seatNumber: number;
  displayName: string;
  isAlive: boolean;
  characterId?: string;
  apparentCharacterId?: string;
  alignment?: GamePlayer["alignment"];
  registeredAlignment?: GamePlayer["registeredAlignment"];
  registeredCharacterId?: GamePlayer["registeredCharacterId"];
  isDrunk?: boolean;
  isPoisoned?: boolean;
};

export type VisibleExecutionState = Pick<
  ExecutionState,
  "day" | "executedPlayerId" | "pendingDeathPlayerId"
> & {
  nominations: NominationRecord[];
};

export type VisiblePrivateInfo = Pick<
  PrivateInfo,
  | "id"
  | "gameId"
  | "recipientPlayerId"
  | "sourceCharacterId"
  | "title"
  | "content"
  | "createdAt"
> & {
  createdBy?: PrivateInfo["createdBy"];
  isRevealedToPlayer?: boolean;
  payload?: PrivateInfo["payload"];
};

export type VisibleGameLogEntry = GameLogEntry;

export type VisibleGameState = {
  id: string;
  scriptId: string;
  status: Game["status"];
  currentDay: Game["currentDay"];
  currentPhase: Game["currentPhase"];
  currentDaySubPhase: Game["currentDaySubPhase"];
  winningTeam?: Game["winningTeam"];
  players: VisibleGamePlayer[];
  executionState?: VisibleExecutionState;
  logs: VisibleGameLogEntry[];
  privateInfos?: VisiblePrivateInfo[];
};

export function isStorytellerViewer(viewer: GameViewer): boolean {
  return viewer.type === "storyteller";
}

export function isPlayerViewer(viewer: GameViewer): boolean {
  return viewer.type === "player";
}

export function canSeePlayerSecret(
  viewer: GameViewer,
  player: GamePlayer,
): boolean {
  if (viewer.type === "storyteller") {
    return true;
  }

  return viewer.type === "player" && viewer.playerId === player.id;
}

function getVisiblePlayer(
  player: GamePlayer,
  viewer: GameViewer,
): VisibleGamePlayer {
  const visiblePlayer: VisibleGamePlayer = {
    id: player.id,
    seatNumber: player.seatNumber,
    displayName: player.displayName,
    isAlive: player.isAlive,
  };

  if (!canSeePlayerSecret(viewer, player)) {
    return visiblePlayer;
  }

  visiblePlayer.characterId = player.characterId;
  visiblePlayer.apparentCharacterId = player.apparentCharacterId;
  visiblePlayer.alignment = player.alignment;

  if (viewer.type === "storyteller") {
    visiblePlayer.registeredAlignment = player.registeredAlignment;
    visiblePlayer.registeredCharacterId = player.registeredCharacterId;
    visiblePlayer.isDrunk = player.isDrunk;
    visiblePlayer.isPoisoned = player.isPoisoned;
  }

  return visiblePlayer;
}

function getVisibleExecutionState(game: Game): VisibleExecutionState {
  return {
    day: game.executionState.day,
    executedPlayerId: game.executionState.executedPlayerId,
    pendingDeathPlayerId: game.executionState.pendingDeathPlayerId,
    nominations: game.executionState.nominations,
  };
}

function isPublicLog(log: GameLogEntry): boolean {
  return (log.visibility as string) === "public";
}

function getVisibleLogs(
  logs: GameLogEntry[],
  viewer: GameViewer,
): VisibleGameLogEntry[] {
  if (viewer.type === "storyteller") {
    return logs;
  }

  return logs.filter(isPublicLog);
}

function getVisiblePrivateInfo(
  privateInfo: PrivateInfo,
  includeSecretFields: boolean,
): VisiblePrivateInfo {
  const visiblePrivateInfo: VisiblePrivateInfo = {
    id: privateInfo.id,
    gameId: privateInfo.gameId,
    recipientPlayerId: privateInfo.recipientPlayerId,
    sourceCharacterId: privateInfo.sourceCharacterId,
    title: privateInfo.title,
    content: privateInfo.content,
    createdAt: privateInfo.createdAt,
  };

  if (includeSecretFields) {
    visiblePrivateInfo.createdBy = privateInfo.createdBy;
    visiblePrivateInfo.isRevealedToPlayer = privateInfo.isRevealedToPlayer;
    visiblePrivateInfo.payload = privateInfo.payload;
  }

  return visiblePrivateInfo;
}

function getVisiblePrivateInfos(
  privateInfos: PrivateInfo[],
  viewer: GameViewer,
): VisiblePrivateInfo[] | undefined {
  if (viewer.type === "storyteller") {
    return privateInfos.map((privateInfo) =>
      getVisiblePrivateInfo(privateInfo, true),
    );
  }

  if (viewer.type === "player") {
    return privateInfos
      .filter(
        (privateInfo) =>
          privateInfo.recipientPlayerId === viewer.playerId &&
          privateInfo.isRevealedToPlayer,
      )
      .map((privateInfo) => getVisiblePrivateInfo(privateInfo, false));
  }

  return undefined;
}

export function getVisibleGameState(
  game: Game,
  viewer: GameViewer,
): VisibleGameState {
  const visibleGameState: VisibleGameState = {
    id: game.id,
    scriptId: game.scriptId,
    status: game.status,
    currentDay: game.currentDay,
    currentPhase: game.currentPhase,
    currentDaySubPhase: game.currentDaySubPhase,
    players: game.players.map((player) => getVisiblePlayer(player, viewer)),
    executionState: getVisibleExecutionState(game),
    logs: getVisibleLogs(game.logs, viewer),
  };

  if (viewer.type === "storyteller" || game.status === "finished") {
    visibleGameState.winningTeam = game.winningTeam;
  }

  const visiblePrivateInfos = getVisiblePrivateInfos(game.privateInfos, viewer);

  if (visiblePrivateInfos) {
    visibleGameState.privateInfos = visiblePrivateInfos;
  }

  return visibleGameState;
}
