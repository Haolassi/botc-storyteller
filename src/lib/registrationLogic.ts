import { getCharacterById } from "@/lib/gameData";
import type { Alignment, Character, Game, GamePlayer } from "@/types/game";

export function getRealCharacter(player: GamePlayer): Character | undefined {
  return player.characterId ? getCharacterById(player.characterId) : undefined;
}

export function getApparentCharacter(player: GamePlayer): Character | undefined {
  return player.apparentCharacterId
    ? getCharacterById(player.apparentCharacterId)
    : undefined;
}

export function getEffectiveActionCharacter(
  player: GamePlayer,
): Character | undefined {
  return getApparentCharacter(player) ?? getRealCharacter(player);
}

export function getRegisteredCharacter(
  player: GamePlayer,
): Character | undefined {
  if (player.registeredCharacterId) {
    return getCharacterById(player.registeredCharacterId);
  }

  return getRealCharacter(player);
}

export function getRegisteredAlignment(player: GamePlayer): Alignment | undefined {
  if (player.registeredAlignment) {
    return player.registeredAlignment;
  }

  return player.alignment;
}

export function isRegisteredEvil(player: GamePlayer): boolean {
  return getRegisteredAlignment(player) === "evil";
}

export function isRegisteredDemon(player: GamePlayer): boolean {
  const registeredCharacter = getRegisteredCharacter(player);

  return registeredCharacter?.type === "demon";
}

export function isRegisteredMinion(player: GamePlayer): boolean {
  const registeredCharacter = getRegisteredCharacter(player);

  return registeredCharacter?.type === "minion";
}

export function isRegisteredOutsider(player: GamePlayer): boolean {
  const registeredCharacter = getRegisteredCharacter(player);

  return registeredCharacter?.type === "outsider";
}

export function isRegisteredTownsfolk(player: GamePlayer): boolean {
  const registeredCharacter = getRegisteredCharacter(player);

  return registeredCharacter?.type === "townsfolk";
}

export function getPlayerRulesLabel(player: GamePlayer): string {
  const realCharacter = getRealCharacter(player);
  const apparentCharacter = getApparentCharacter(player);
  const registeredCharacter = getRegisteredCharacter(player);
  const registeredAlignment = getRegisteredAlignment(player);

  const parts = [
    `${player.seatNumber}. ${player.displayName}`,
    realCharacter ? `真实：${realCharacter.nameZh}` : "真实：未知",
  ];

  if (apparentCharacter) {
    parts.push(`表面：${apparentCharacter.nameZh}`);
  }

  if (
    registeredCharacter &&
    realCharacter &&
    registeredCharacter.id !== realCharacter.id
  ) {
    parts.push(`登记角色：${registeredCharacter.nameZh}`);
  }

  if (registeredAlignment && registeredAlignment !== player.alignment) {
    parts.push(`登记阵营：${registeredAlignment === "evil" ? "邪恶" : "善良"}`);
  }

  return parts.join(" / ");
}

export function getAliveNeighbors(game: Game, playerId: string): {
  left?: GamePlayer;
  right?: GamePlayer;
} {
  const alivePlayers = [...game.players]
    .filter((player) => player.isAlive)
    .sort((a, b) => a.seatNumber - b.seatNumber);

  const index = alivePlayers.findIndex((player) => player.id === playerId);

  if (index < 0 || alivePlayers.length <= 1) {
    return {};
  }

  return {
    left: alivePlayers[(index - 1 + alivePlayers.length) % alivePlayers.length],
    right: alivePlayers[(index + 1) % alivePlayers.length],
  };
}

export function getChefRegisteredEvilPairs(game: Game): Array<{
  first: GamePlayer;
  second: GamePlayer;
}> {
  const seatedPlayers = [...game.players].sort(
    (a, b) => a.seatNumber - b.seatNumber,
  );

  if (seatedPlayers.length < 2) {
    return [];
  }

  const pairs: Array<{
    first: GamePlayer;
    second: GamePlayer;
  }> = [];

  for (let index = 0; index < seatedPlayers.length; index += 1) {
    const first = seatedPlayers[index];
    const second = seatedPlayers[(index + 1) % seatedPlayers.length];

    if (isRegisteredEvil(first) && isRegisteredEvil(second)) {
      pairs.push({ first, second });
    }
  }

  return pairs;
}

export function getEmpathRegisteredEvilNeighborCount(
  game: Game,
  empathPlayerId: string,
): {
  count: number;
  left?: GamePlayer;
  right?: GamePlayer;
} {
  const neighbors = getAliveNeighbors(game, empathPlayerId);
  const count = [neighbors.left, neighbors.right].filter(
    (player): player is GamePlayer => Boolean(player),
  ).filter((player) => isRegisteredEvil(player)).length;

  return {
    ...neighbors,
    count,
  };
}

export function getFortuneTellerCorrectResult(input: {
  game: Game;
  firstPlayerId: string;
  secondPlayerId: string;
}): {
  hasDemonSignal: boolean;
  reasons: string[];
} {
  const { game, firstPlayerId, secondPlayerId } = input;
  const selectedPlayers = game.players.filter(
    (player) => player.id === firstPlayerId || player.id === secondPlayerId,
  );

  const reasons: string[] = [];
  let hasDemonSignal = false;

  for (const player of selectedPlayers) {
    if (isRegisteredDemon(player)) {
      hasDemonSignal = true;
      reasons.push(`${player.seatNumber}. ${player.displayName} 登记为恶魔。`);
    }

    if (player.id === game.setupState.fortuneTellerRedHerringPlayerId) {
      hasDemonSignal = true;
      reasons.push(
        `${player.seatNumber}. ${player.displayName} 是占卜师红鲱鱼。`,
      );
    }
  }

  if (!hasDemonSignal) {
    reasons.push("两名目标中没有登记恶魔，也没有红鲱鱼。");
  }

  return {
    hasDemonSignal,
    reasons,
  };
}