import { getCharacterById } from "@/lib/gameData";
import type {
  Game,
  GameLogCategory,
  GameLogEntry,
  GameLogResult,
  GameLogType,
  GameLogVisibility,
} from "@/types/game";

function createLogId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type StructuredLogInput = {
  type?: GameLogType;
  category?: GameLogCategory;
  visibility?: GameLogVisibility;
  title: string;
  description?: string;
  actorPlayerId?: string;
  targetPlayerIds?: string[];
  characterId?: string;
  shownCharacterId?: string;
  result?: GameLogResult;
  systemReference?: GameLogEntry["systemReference"];
  correction?: GameLogEntry["correction"];
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

const typeCategoryMap: Record<GameLogType, GameLogCategory> = {
  phase_change: "phase",
  player_death: "death",
  player_executed: "execution",
  nomination: "nomination",
  vote: "vote",
  day_action: "ability",
  night_action: "night_action",
  private_info: "info_given",
  status_change: "status_change",
  win_condition: "system",
  manual_note: "manual_note",
};

export function getCategoryForLegacyType(
  type?: GameLogType,
): GameLogCategory {
  return type ? typeCategoryMap[type] : "system";
}

export function createGameLogBase(
  game: Game,
  input: StructuredLogInput,
): GameLogEntry {
  const timestamp = new Date().toISOString();
  const type = input.type ?? "manual_note";
  const category = input.category ?? getCategoryForLegacyType(type);

  return {
    id: createLogId("log"),
    gameId: game.id,
    timestamp,
    day: game.currentDay,
    phase: game.currentPhase,
    subPhase: game.currentDaySubPhase,
    category,
    visibility: input.visibility ?? "storyteller_only",
    type,
    title: input.title,
    description: input.description,
    actorPlayerId: input.actorPlayerId,
    targetPlayerIds: input.targetPlayerIds,
    characterId: input.characterId,
    shownCharacterId: input.shownCharacterId,
    result: input.result,
    systemReference: input.systemReference,
    correction: input.correction,
    metadata: input.metadata,
    payload: input.payload,
    createdAt: timestamp,
  };
}

export function appendGameLog(game: Game, input: StructuredLogInput): Game {
  return {
    ...game,
    logs: [createGameLogBase(game, input), ...game.logs],
    updatedAt: new Date().toISOString(),
  };
}

export function createCorrectionLog(
  game: Game,
  correctedLogId: string,
  reason: string,
  description?: string,
): Game {
  return appendGameLog(game, {
    type: "manual_note",
    category: "correction",
    title: "\u65e5\u5fd7\u7ea0\u9519",
    description,
    correction: {
      correctedLogId,
      reason,
    },
    metadata: {
      correctedLogId,
      reason,
    },
  });
}

export function createManualNoteLog(game: Game, description: string): Game {
  return appendGameLog(game, {
    type: "manual_note",
    category: "manual_note",
    title: "\u624b\u52a8\u5907\u6ce8",
    description,
    metadata: {
      editable: true,
    },
  });
}

function formatResult(result: GameLogResult): string {
  if (result.type === "players") {
    return result.value.join(", ");
  }

  if (result.type === "boolean") {
    return result.value ? "\u662f" : "\u5426";
  }

  return String(result.value);
}

function getPlayerLabel(game: Game, playerId?: string): string | undefined {
  if (!playerId) {
    return undefined;
  }

  const player = game.players.find((candidate) => candidate.id === playerId);

  return player ? player.seatNumber + " \u53f7 " + player.displayName : playerId;
}

function getPlayerLabels(game: Game, playerIds?: string[]): string {
  return (playerIds ?? [])
    .map((playerId) => getPlayerLabel(game, playerId))
    .filter(Boolean)
    .join("\u3001");
}

function getMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const value = metadata?.[key];

  return typeof value === "number" ? value : undefined;
}

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];

  return typeof value === "string" ? value : undefined;
}

function getMetadataBoolean(
  metadata: Record<string, unknown> | undefined,
  key: string,
): boolean | undefined {
  const value = metadata?.[key];

  return typeof value === "boolean" ? value : undefined;
}

function getMetadataStringArray(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string[] | undefined {
  const value = metadata?.[key];

  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

export function buildReadableLogText(game: Game, log: GameLogEntry): string {
  const actor = getPlayerLabel(game, log.actorPlayerId);
  const targets = getPlayerLabels(game, log.targetPlayerIds);
  const character = log.characterId ? getCharacterById(log.characterId) : undefined;
  const metadata = log.metadata ?? log.payload;

  if (log.category === "nomination") {
    const nomineeId = getMetadataString(metadata, "nomineePlayerId");
    const nominee = getPlayerLabel(game, nomineeId) ?? targets;
    const voteCount = getMetadataNumber(metadata, "voteCount");
    const requiredVotes = getMetadataNumber(metadata, "requiredVotes");
    const isCurrentExecutionCandidate = getMetadataBoolean(
      metadata,
      "isCurrentExecutionCandidate",
    );
    const reachedThreshold = getMetadataBoolean(metadata, "reachedThreshold");

    if (actor && nominee && voteCount !== undefined && requiredVotes !== undefined) {
      const resultText = reachedThreshold
        ? isCurrentExecutionCandidate
          ? "\u8fdb\u5165\u5f53\u524d\u5904\u51b3\u53f0"
          : "\u8fbe\u5230\u95e8\u69db\uff0c\u4f46\u6ca1\u6709\u6210\u4e3a\u552f\u4e00\u5904\u51b3\u5019\u9009"
        : "\u6ca1\u6709\u8fbe\u5230\u5904\u51b3\u95e8\u69db";

      return actor + " \u63d0\u540d\u4e86 " + nominee + "\uff0c\u83b7\u5f97 " + voteCount + " \u7968\uff0c\u95e8\u69db\u662f " + requiredVotes + " \u7968\uff0c" + resultText + "\u3002";
    }
  }

  if (log.category === "vote") {
    const nomineeId = getMetadataString(metadata, "nomineePlayerId");
    const nominee = getPlayerLabel(game, nomineeId) ?? targets;
    const voterIds = getMetadataStringArray(metadata, "votePlayerIds");
    const voters = getPlayerLabels(game, voterIds);
    const voteCount = getMetadataNumber(metadata, "voteCount");
    const requiredVotes = getMetadataNumber(metadata, "requiredVotes");

    if (nominee && voteCount !== undefined && requiredVotes !== undefined) {
      return nominee + " \u672c\u6b21\u83b7\u5f97 " + voteCount + " \u7968\uff0c\u5904\u51b3\u95e8\u69db\u662f " + requiredVotes + " \u7968\u3002" + (voters ? "\u6295\u7968\u73a9\u5bb6\uff1a" + voters + "\u3002" : "\u6ca1\u6709\u73a9\u5bb6\u6295\u7968\u3002");
    }
  }

  if (log.category === "night_action") {
    const roleName = character
      ? character.nameZh + " / " + character.nameEn
      : log.characterId;
    const who = actor ? actor + " \u7684" : "";
    const targetText = targets ? "\u76ee\u6807\u662f " + targets + "\u3002" : "";
    const note = log.description ? " " + log.description : "";

    return (who + (roleName ?? "\u591c\u665a\u89d2\u8272") + "\u884c\u52a8\u5df2\u5b8c\u6210\u3002" + targetText + note).trim();
  }

  if (log.category === "execution") {
    const executedPlayerId =
      getMetadataString(metadata, "executedPlayerId") ?? log.targetPlayerIds?.[0];
    const executedPlayer = getPlayerLabel(game, executedPlayerId);
    const voteCount = getMetadataNumber(metadata, "voteCount");
    const requiredVotes = getMetadataNumber(metadata, "requiredVotes");

    if (executedPlayer) {
      return executedPlayer + " \u5728\u9ec4\u660f\u88ab\u5904\u51b3\u3002" + (voteCount !== undefined && requiredVotes !== undefined ? "\u7968\u6570 " + voteCount + "/" + requiredVotes + "\u3002" : "");
    }
  }

  if (log.category === "death") {
    const player = getPlayerLabel(
      game,
      getMetadataString(metadata, "playerId") ?? log.targetPlayerIds?.[0],
    );
    const nextValue = getMetadataBoolean(metadata, "nextValue");

    if (player && nextValue !== undefined) {
      return nextValue ? player + " \u88ab\u8bbe\u4e3a\u5b58\u6d3b\u3002" : player + " \u88ab\u6807\u8bb0\u4e3a\u6b7b\u4ea1\u3002";
    }
  }

  if (log.category === "status_change") {
    const player = getPlayerLabel(
      game,
      getMetadataString(metadata, "playerId") ?? log.targetPlayerIds?.[0],
    );
    const field = getMetadataString(metadata, "field");
    const nextValue = getMetadataBoolean(metadata, "nextValue");
    const label =
      field === "isPoisoned" ? "\u4e2d\u6bd2" : field === "isDrunk" ? "\u9189\u9152" : "\u72b6\u6001";

    if (player && nextValue !== undefined) {
      return player + " " + (nextValue ? "\u88ab\u6807\u8bb0\u4e3a" + label : "\u53d6\u6d88" + label + "\u6807\u8bb0") + "\u3002";
    }
  }

  if (log.category === "phase") {
    return log.description ?? log.title;
  }

  if (log.category === "manual_note") {
    return log.description ? "\u8bf4\u4e66\u4eba\u5907\u6ce8\uff1a" + log.description : "\u8bf4\u4e66\u4eba\u6dfb\u52a0\u4e86\u4e00\u6761\u5907\u6ce8\u3002";
  }

  if (log.category === "correction") {
    return "\u7ea0\u9519\uff1a" + (log.correction?.reason ?? log.description ?? "\u672a\u586b\u5199\u539f\u56e0") + "\u3002";
  }

  if (log.category === "system" || log.type === "win_condition") {
    return log.description ?? log.title;
  }

  const parts = [log.description, actor ? "\u884c\u52a8\u8005\uff1a" + actor : undefined];

  if (targets) {
    parts.push("\u76ee\u6807\uff1a" + targets);
  }

  if (character) {
    parts.push("\u89d2\u8272\uff1a" + character.nameZh + " / " + character.nameEn);
  }

  if (log.result) {
    parts.push("\u7ed3\u679c\uff1a" + formatResult(log.result));
  }

  return parts.filter(Boolean).join("\n") || log.title;
}

export function normalizeGameLog(
  game: Pick<Game, "id" | "currentDay" | "currentPhase" | "currentDaySubPhase" | "updatedAt">,
  rawLog: Partial<GameLogEntry>,
): GameLogEntry {
  const timestamp =
    rawLog.timestamp ?? rawLog.createdAt ?? game.updatedAt ?? new Date().toISOString();
  const type = rawLog.type ?? "manual_note";

  return {
    id: rawLog.id ?? createLogId("log"),
    gameId: rawLog.gameId ?? game.id,
    timestamp,
    day: rawLog.day ?? game.currentDay,
    phase: rawLog.phase ?? game.currentPhase,
    subPhase: rawLog.subPhase ?? game.currentDaySubPhase ?? null,
    category: rawLog.category ?? getCategoryForLegacyType(type),
    visibility: rawLog.visibility ?? "storyteller_only",
    type,
    title: rawLog.title ?? "\u65e7\u65e5\u5fd7",
    description: rawLog.description,
    actorPlayerId: rawLog.actorPlayerId,
    targetPlayerIds: rawLog.targetPlayerIds,
    characterId: rawLog.characterId,
    shownCharacterId: rawLog.shownCharacterId,
    result: rawLog.result,
    systemReference: rawLog.systemReference,
    correction: rawLog.correction,
    metadata: rawLog.metadata ?? rawLog.payload,
    payload: rawLog.payload,
    createdAt: rawLog.createdAt ?? timestamp,
  };
}
