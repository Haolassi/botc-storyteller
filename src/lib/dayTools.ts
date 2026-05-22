import { addGameLog } from "@/lib/gameFlow";
import type { Game, GamePlayer } from "@/types/game";

export type SpeechDirection = "clockwise" | "counterclockwise";

export function generateSpeechOrder(input: {
  players: GamePlayer[];
  startPlayerId: string;
  direction: SpeechDirection;
}): GamePlayer[] {
  const sortedPlayers = [...input.players].sort(
    (a, b) => a.seatNumber - b.seatNumber,
  );

  const startIndex = sortedPlayers.findIndex(
    (player) => player.id === input.startPlayerId,
  );

  if (startIndex < 0) {
    return sortedPlayers;
  }

  if (input.direction === "clockwise") {
    return [
      ...sortedPlayers.slice(startIndex),
      ...sortedPlayers.slice(0, startIndex),
    ];
  }

  const result: GamePlayer[] = [];

  for (let offset = 0; offset < sortedPlayers.length; offset += 1) {
    const index =
      (startIndex - offset + sortedPlayers.length) % sortedPlayers.length;

    result.push(sortedPlayers[index]);
  }

  return result;
}

export function logPrivateChatStarted(game: Game, minutes: number): Game {
  return addGameLog(game, {
    type: "manual_note",
    title: "私聊开始",
    description: `说书人开始了 ${minutes} 分钟私聊。`,
    payload: {
      minutes,
    },
  });
}

export function logPrivateChatEnded(game: Game): Game {
  return addGameLog(game, {
    type: "manual_note",
    title: "私聊结束",
    description: "说书人结束了私聊阶段。",
  });
}

export function logOpenDiscussionStarted(game: Game, minutes: number): Game {
  return addGameLog(game, {
    type: "manual_note",
    title: "大公聊开始",
    description: `说书人开始了 ${minutes} 分钟大公聊。`,
    payload: {
      minutes,
    },
  });
}

export function logOpenDiscussionEnded(game: Game): Game {
  return addGameLog(game, {
    type: "manual_note",
    title: "大公聊结束",
    description: "说书人结束了大公聊阶段。",
  });
}

export function logSpeechOrderGenerated(input: {
  game: Game;
  order: GamePlayer[];
  startPlayerId: string;
  direction: SpeechDirection;
}): Game {
  const startPlayer = input.game.players.find(
    (player) => player.id === input.startPlayerId,
  );

  return addGameLog(input.game, {
    type: "manual_note",
    title: "生成顺序发言",
    description: `从 ${startPlayer?.displayName ?? "未知玩家"} 开始，按${
      input.direction === "clockwise" ? "顺时针" : "逆时针"
    }方向发言。`,
    payload: {
      startPlayerId: input.startPlayerId,
      direction: input.direction,
      speechOrderPlayerIds: input.order.map((player) => player.id),
      speechOrderNames: input.order.map((player) => player.displayName),
    },
  });
}