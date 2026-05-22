"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { scripts } from "@/data/scripts";
import { getCharactersByScriptId, getScriptById } from "@/lib/gameData";
import {
  createInitialGameState,
  createLocalId,
  saveLocalGame,
} from "@/lib/localGames";
import type { Alignment, Character, GamePlayer } from "@/types/game";

type SeatAssignmentMode = "manual" | "random";

const playerCounts = Array.from({ length: 11 }, (_, index) => index + 5);

const baseTroubleBrewingRoleCounts: Record<
  number,
  {
    townsfolk: number;
    outsider: number;
    minion: number;
    demon: number;
  }
> = {
  5: { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
  6: { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
  7: { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
  8: { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
  9: { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
  10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
  11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
  12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
  13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
  14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
  15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 },
};

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index],
    ];
  }

  return result;
}

function getRoleCountsWithBaron(
  playerCount: number,
  hasBaron: boolean,
): {
  townsfolk: number;
  outsider: number;
  minion: number;
  demon: number;
} {
  const base = baseTroubleBrewingRoleCounts[playerCount];

  if (!base) {
    return {
      townsfolk: 0,
      outsider: 0,
      minion: 0,
      demon: 0,
    };
  }

  if (!hasBaron) {
    return base;
  }

  return {
    ...base,
    townsfolk: Math.max(0, base.townsfolk - 2),
    outsider: base.outsider + 2,
  };
}

function getCharacterTypeLabel(type: Character["type"]) {
  if (type === "townsfolk") {
    return "镇民";
  }

  if (type === "outsider") {
    return "外来者";
  }

  if (type === "minion") {
    return "爪牙";
  }

  return "恶魔";
}

function getAlignmentLabel(alignment: Alignment) {
  return alignment === "evil" ? "邪恶" : "善良";
}

export default function NewGamePage() {
  const router = useRouter();

  const [scriptId, setScriptId] = useState("trouble_brewing");
  const [playerCount, setPlayerCount] = useState(7);
  const [seatAssignmentMode, setSeatAssignmentMode] =
    useState<SeatAssignmentMode>("manual");
  const [playerNamesText, setPlayerNamesText] = useState(
    "Alice\nBob\nCharlie\nDiana\nEthan\nFiona\nGrace",
  );
  const [seatRoleIds, setSeatRoleIds] = useState<Record<number, string>>({});
  const [manualSeatNames, setManualSeatNames] = useState<Record<number, string>>(
    {},
  );

  const [drunkApparentCharacterIds, setDrunkApparentCharacterIds] = useState<
    Record<number, string>
  >({});
  const [recluseRegisteredAlignments, setRecluseRegisteredAlignments] =
    useState<Record<number, Alignment>>({});
  const [recluseRegisteredCharacterIds, setRecluseRegisteredCharacterIds] =
    useState<Record<number, string>>({});
  const [fortuneTellerRedHerringSeat, setFortuneTellerRedHerringSeat] =
    useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  const selectedScript = getScriptById(scriptId);
  const scriptCharacters = getCharactersByScriptId(scriptId);

  const seats = useMemo(() => {
    return Array.from({ length: playerCount }, (_, index) => index + 1);
  }, [playerCount]);

  const playerNames = useMemo(() => {
    return playerNamesText
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);
  }, [playerNamesText]);

  const selectedRoleIds = useMemo(() => {
    return seats.map((seatNumber) => seatRoleIds[seatNumber]).filter(Boolean);
  }, [seats, seatRoleIds]);

  const selectedCharacters = useMemo(() => {
    return selectedRoleIds
      .map((roleId) =>
        scriptCharacters.find((character) => character.id === roleId),
      )
      .filter((character): character is Character => Boolean(character));
  }, [scriptCharacters, selectedRoleIds]);

  const hasBaron = selectedCharacters.some(
    (character) => character.id === "baron",
  );
  const hasFortuneTeller = selectedCharacters.some(
    (character) => character.id === "fortune_teller",
  );

  const recommendedRoleCounts = getRoleCountsWithBaron(playerCount, hasBaron);

  const selectedRoleCounts = useMemo(() => {
    return {
      townsfolk: selectedCharacters.filter(
        (character) => character.type === "townsfolk",
      ).length,
      outsider: selectedCharacters.filter(
        (character) => character.type === "outsider",
      ).length,
      minion: selectedCharacters.filter(
        (character) => character.type === "minion",
      ).length,
      demon: selectedCharacters.filter(
        (character) => character.type === "demon",
      ).length,
    };
  }, [selectedCharacters]);

  const groupedCharacters = useMemo(() => {
    return {
      townsfolk: scriptCharacters.filter(
        (character) => character.type === "townsfolk",
      ),
      outsider: scriptCharacters.filter(
        (character) => character.type === "outsider",
      ),
      minion: scriptCharacters.filter(
        (character) => character.type === "minion",
      ),
      demon: scriptCharacters.filter((character) => character.type === "demon"),
    };
  }, [scriptCharacters]);

  const townsfolkCharacters = groupedCharacters.townsfolk;

  const roleCountWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (selectedRoleCounts.townsfolk !== recommendedRoleCounts.townsfolk) {
      warnings.push(
        `镇民推荐 ${recommendedRoleCounts.townsfolk}，当前 ${selectedRoleCounts.townsfolk}。`,
      );
    }

    if (selectedRoleCounts.outsider !== recommendedRoleCounts.outsider) {
      warnings.push(
        `外来者推荐 ${recommendedRoleCounts.outsider}，当前 ${selectedRoleCounts.outsider}。`,
      );
    }

    if (selectedRoleCounts.minion !== recommendedRoleCounts.minion) {
      warnings.push(
        `爪牙推荐 ${recommendedRoleCounts.minion}，当前 ${selectedRoleCounts.minion}。`,
      );
    }

    if (selectedRoleCounts.demon !== recommendedRoleCounts.demon) {
      warnings.push(
        `恶魔推荐 ${recommendedRoleCounts.demon}，当前 ${selectedRoleCounts.demon}。`,
      );
    }

    return warnings;
  }, [recommendedRoleCounts, selectedRoleCounts]);

  function getRoleForSeat(seatNumber: number): Character | undefined {
    const roleId = seatRoleIds[seatNumber];

    return scriptCharacters.find((character) => character.id === roleId);
  }

  function handlePlayerCountChange(nextCount: number) {
    setPlayerCount(nextCount);
    setFortuneTellerRedHerringSeat((current) =>
      current && current <= nextCount ? current : null,
    );

    setSeatRoleIds((current) => {
      const next: Record<number, string> = {};

      for (let seatNumber = 1; seatNumber <= nextCount; seatNumber += 1) {
        if (current[seatNumber]) {
          next[seatNumber] = current[seatNumber];
        }
      }

      return next;
    });

    setManualSeatNames((current) => {
      const next: Record<number, string> = {};

      for (let seatNumber = 1; seatNumber <= nextCount; seatNumber += 1) {
        if (current[seatNumber]) {
          next[seatNumber] = current[seatNumber];
        }
      }

      return next;
    });

    setDrunkApparentCharacterIds((current) => {
      const next: Record<number, string> = {};

      for (let seatNumber = 1; seatNumber <= nextCount; seatNumber += 1) {
        if (current[seatNumber]) {
          next[seatNumber] = current[seatNumber];
        }
      }

      return next;
    });

    setRecluseRegisteredAlignments((current) => {
      const next: Record<number, Alignment> = {};

      for (let seatNumber = 1; seatNumber <= nextCount; seatNumber += 1) {
        if (current[seatNumber]) {
          next[seatNumber] = current[seatNumber];
        }
      }

      return next;
    });

    setRecluseRegisteredCharacterIds((current) => {
      const next: Record<number, string> = {};

      for (let seatNumber = 1; seatNumber <= nextCount; seatNumber += 1) {
        if (current[seatNumber]) {
          next[seatNumber] = current[seatNumber];
        }
      }

      return next;
    });
  }

  function handleRoleChange(seatNumber: number, roleId: string) {
    setSeatRoleIds((current) => ({
      ...current,
      [seatNumber]: roleId,
    }));

    const nextRole = scriptCharacters.find((character) => character.id === roleId);

    if (nextRole?.id !== "drunk") {
      setDrunkApparentCharacterIds((current) => {
        const next = { ...current };
        delete next[seatNumber];
        return next;
      });
    }

    if (nextRole?.id !== "recluse") {
      setRecluseRegisteredAlignments((current) => {
        const next = { ...current };
        delete next[seatNumber];
        return next;
      });

      setRecluseRegisteredCharacterIds((current) => {
        const next = { ...current };
        delete next[seatNumber];
        return next;
      });
    }
  }

  function handleManualNameChange(seatNumber: number, name: string) {
    setManualSeatNames((current) => ({
      ...current,
      [seatNumber]: name,
    }));
  }

  function handleDrunkApparentCharacterChange(
    seatNumber: number,
    characterId: string,
  ) {
    setDrunkApparentCharacterIds((current) => ({
      ...current,
      [seatNumber]: characterId,
    }));
  }

  function handleRecluseRegisteredAlignmentChange(
    seatNumber: number,
    alignment: Alignment,
  ) {
    setRecluseRegisteredAlignments((current) => ({
      ...current,
      [seatNumber]: alignment,
    }));
  }

  function handleRecluseRegisteredCharacterChange(
    seatNumber: number,
    characterId: string,
  ) {
    setRecluseRegisteredCharacterIds((current) => ({
      ...current,
      [seatNumber]: characterId,
    }));
  }

  function validateRoleSetup(): string | null {
    if (selectedRoleIds.length !== playerCount) {
      return `请为所有 ${playerCount} 个座位分配角色。`;
    }

    const uniqueRoleIds = new Set(selectedRoleIds);

    if (uniqueRoleIds.size !== selectedRoleIds.length) {
      return "同一角色不能被分配给多个座位。";
    }

    for (const seatNumber of seats) {
      const role = getRoleForSeat(seatNumber);

      if (role?.id === "drunk" && !drunkApparentCharacterIds[seatNumber]) {
        return `座位 ${seatNumber} 是酒鬼，请为其选择一个表面镇民角色。`;
      }

      if (role?.id === "recluse") {
        if (!recluseRegisteredAlignments[seatNumber]) {
          return `座位 ${seatNumber} 是陌客，请选择其登记阵营。`;
        }

        if (!recluseRegisteredCharacterIds[seatNumber]) {
          return `座位 ${seatNumber} 是陌客，请选择其登记角色。`;
        }
      }
    }

    if (hasFortuneTeller && !fortuneTellerRedHerringSeat) {
      return "场上有占卜师，请选择红鲱鱼玩家。";
    }

    return null;
  }

  function buildSeatNames(): Record<number, string> {
    if (seatAssignmentMode === "manual") {
      return Object.fromEntries(
        seats.map((seatNumber) => [
          seatNumber,
          manualSeatNames[seatNumber]?.trim() ?? "",
        ]),
      );
    }

    const shuffledNames = shuffleArray(playerNames);

    return Object.fromEntries(
      seats.map((seatNumber, index) => [
        seatNumber,
        shuffledNames[index] ?? "",
      ]),
    );
  }

  function handleCreateGame() {
    setError(null);

    if (!selectedScript) {
      setError("请选择一个有效的板子。");
      return;
    }

    const roleError = validateRoleSetup();

    if (roleError) {
      setError(roleError);
      return;
    }

    if (seatAssignmentMode === "random") {
      if (playerNames.length !== playerCount) {
        setError(`随机分配需要正好 ${playerCount} 名玩家。`);
        return;
      }

      const duplicateNames = playerNames.filter(
        (name, index) => playerNames.indexOf(name) !== index,
      );

      if (duplicateNames.length > 0) {
        setError(
          `玩家名字不能重复：${Array.from(new Set(duplicateNames)).join(", ")}`,
        );
        return;
      }
    }

    const seatNames = buildSeatNames();
    const missingSeatNames = seats.filter(
      (seatNumber) => !seatNames[seatNumber]?.trim(),
    );

    if (missingSeatNames.length > 0) {
      setError(`以下座位还没有分配玩家：${missingSeatNames.join(", ")}`);
      return;
    }

    const assignedNames = seats.map((seatNumber) => seatNames[seatNumber]);
    const duplicateAssignedNames = assignedNames.filter(
      (name, index) => assignedNames.indexOf(name) !== index,
    );

    if (duplicateAssignedNames.length > 0) {
      setError(
        `玩家名字不能重复：${Array.from(new Set(duplicateAssignedNames)).join(
          ", ",
        )}`,
      );
      return;
    }

    const now = new Date().toISOString();
    const gameId = createLocalId("game");

    const players: GamePlayer[] = seats.map((seatNumber) => {
      const characterId = seatRoleIds[seatNumber];
      const character = scriptCharacters.find(
        (candidate) => candidate.id === characterId,
      );

      return {
        id: createLocalId("player"),
        gameId,
        seatNumber,
        displayName: seatNames[seatNumber],
        characterId,
        apparentCharacterId:
          characterId === "drunk"
            ? drunkApparentCharacterIds[seatNumber]
            : undefined,
        alignment: character?.alignment,
        registeredAlignment:
          characterId === "recluse"
            ? recluseRegisteredAlignments[seatNumber]
            : undefined,
        registeredCharacterId:
          characterId === "recluse"
            ? recluseRegisteredCharacterIds[seatNumber]
            : undefined,
        isAlive: true,
        isDrunk: false,
        isPoisoned: false,
      };
    });

    const redHerringPlayer =
      fortuneTellerRedHerringSeat === null
        ? undefined
        : players.find(
            (player) => player.seatNumber === fortuneTellerRedHerringSeat,
          );

    const game = createInitialGameState({
      id: gameId,
      scriptId,
      players,
      createdAt: now,
    });

    const gameWithSetup = {
      ...game,
      setupState: {
        ...game.setupState,
        fortuneTellerRedHerringPlayerId: redHerringPlayer?.id,
      },
      updatedAt: now,
    };

    saveLocalGame(gameWithSetup);
    router.push(`/games/${gameWithSetup.id}`);
  }

  return (
    <main className="min-h-screen w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <div className="mb-8">
        <p className="text-sm text-gray-500">Games</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">创建对局</h1>
        <p className="mt-2 text-sm text-gray-600">
          按说书人流程创建对局：选择板子、确定人数、分配角色、分配座位，并设置酒鬼、陌客、占卜师红鲱鱼等开局信息。
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_260px] 2xl:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">1. 基本设置</h2>

          <div className="mt-5 space-y-5">
            <div>
              <label
                htmlFor="script"
                className="block text-sm font-medium text-gray-700"
              >
                选择板子
              </label>

              <select
                id="script"
                value={scriptId}
                onChange={(event) => setScriptId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
              >
                {scripts.map((script) => (
                  <option key={script.id} value={script.id}>
                    {script.nameZh} / {script.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="player-count"
                className="block text-sm font-medium text-gray-700"
              >
                选择人数
              </label>

              <select
                id="player-count"
                value={playerCount}
                onChange={(event) =>
                  handlePlayerCountChange(Number(event.target.value))
                }
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
              >
                {playerCounts.map((count) => (
                  <option key={count} value={count}>
                    {count} 人
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-gray-50 p-4 text-sm">
              <div className="font-medium">推荐配置</div>
              {hasBaron ? (
                <div className="mt-2 rounded-lg bg-white p-2 text-xs text-gray-600">
                  男爵在场：推荐配置已按外来者 +2、镇民 -2 修正。
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>镇民：{recommendedRoleCounts.townsfolk}</div>
                <div>外来者：{recommendedRoleCounts.outsider}</div>
                <div>爪牙：{recommendedRoleCounts.minion}</div>
                <div>恶魔：{recommendedRoleCounts.demon}</div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700">
                玩家分配方式
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSeatAssignmentMode("manual")}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    seatAssignmentMode === "manual"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  指定分配
                </button>

                <button
                  type="button"
                  onClick={() => setSeatAssignmentMode("random")}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    seatAssignmentMode === "random"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  随机分配
                </button>
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">2. 座位、角色与开局登记</h2>
            <p className="mt-1 text-sm text-gray-500">
              系统根据人数生成座位。说书人需要为每个座位分配一个真实角色，并为特殊角色设置开局登记信息。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {seats.map((seatNumber) => {
              const role = getRoleForSeat(seatNumber);

              return (
                <div
                  key={seatNumber}
                  className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-gray-700">
                        {seatNumber}
                      </span>
                      <div className="font-medium">座位 {seatNumber}</div>
                    </div>
                  </div>

                  <label className="block text-xs font-medium text-gray-500">
                    真实角色
                  </label>
                  <select
                    value={seatRoleIds[seatNumber] ?? ""}
                    onChange={(event) =>
                      handleRoleChange(seatNumber, event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                  >
                    <option value="">未分配</option>

                    <optgroup label="镇民">
                      {groupedCharacters.townsfolk.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.nameZh} / {character.nameEn}
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="外来者">
                      {groupedCharacters.outsider.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.nameZh} / {character.nameEn}
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="爪牙">
                      {groupedCharacters.minion.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.nameZh} / {character.nameEn}
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="恶魔">
                      {groupedCharacters.demon.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.nameZh} / {character.nameEn}
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  {role ? (
                    <div className="mt-2 text-xs text-gray-500">
                      {getCharacterTypeLabel(role.type)} ·{" "}
                      {getAlignmentLabel(role.alignment)}
                    </div>
                  ) : null}

                  {role?.id === "drunk" ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <label className="block text-xs font-medium text-amber-800">
                        酒鬼表面角色
                      </label>
                      <p className="mt-1 text-xs leading-5 text-amber-700">
                        酒鬼真实角色仍为酒鬼，但游戏过程中会按照此镇民角色被唤醒并获得信息。
                      </p>
                      <select
                        value={drunkApparentCharacterIds[seatNumber] ?? ""}
                        onChange={(event) =>
                          handleDrunkApparentCharacterChange(
                            seatNumber,
                            event.target.value,
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                      >
                        <option value="">请选择表面镇民</option>
                        {townsfolkCharacters.map((character) => (
                          <option key={character.id} value={character.id}>
                            {character.nameZh} / {character.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {role?.id === "recluse" ? (
                    <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-3">
                      <div className="text-xs font-medium text-purple-800">
                        陌客登记设置
                      </div>
                      <p className="mt-1 text-xs leading-5 text-purple-700">
                        陌客可以被登记为邪恶阵营、爪牙或恶魔。该设置在开局确定，中途不应修改。
                      </p>

                      <label className="mt-3 block text-xs font-medium text-purple-800">
                        登记阵营
                      </label>
                      <select
                        value={recluseRegisteredAlignments[seatNumber] ?? ""}
                        onChange={(event) =>
                          handleRecluseRegisteredAlignmentChange(
                            seatNumber,
                            event.target.value as Alignment,
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500"
                      >
                        <option value="">请选择登记阵营</option>
                        <option value="good">善良</option>
                        <option value="evil">邪恶</option>
                      </select>

                      <label className="mt-3 block text-xs font-medium text-purple-800">
                        登记角色
                      </label>
                      <select
                        value={recluseRegisteredCharacterIds[seatNumber] ?? ""}
                        onChange={(event) =>
                          handleRecluseRegisteredCharacterChange(
                            seatNumber,
                            event.target.value,
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500"
                      >
                        <option value="">请选择登记角色</option>
                        {scriptCharacters.map((character) => (
                          <option key={character.id} value={character.id}>
                            {character.nameZh} / {character.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {seatAssignmentMode === "manual" ? (
                    <>
                      <label className="mt-4 block text-xs font-medium text-gray-500">
                        指定玩家
                      </label>
                      <input
                        value={manualSeatNames[seatNumber] ?? ""}
                        onChange={(event) =>
                          handleManualNameChange(seatNumber, event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                        placeholder="玩家名"
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">3. 玩家与校验</h2>

          {seatAssignmentMode === "random" ? (
            <div className="mt-5">
              <label
                htmlFor="players"
                className="block text-sm font-medium text-gray-700"
              >
                玩家名单
              </label>
              <p className="mt-1 text-xs text-gray-500">
                一行一个玩家名。创建时会随机分配到座位。
              </p>

              <textarea
                id="players"
                value={playerNamesText}
                onChange={(event) => setPlayerNamesText(event.target.value)}
                rows={10}
                className="mt-2 w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-gray-500"
              />
            </div>
          ) : (
            <p className="mt-5 text-sm text-gray-500">
              当前为指定分配模式。请在中间的座位卡片中直接填写每个座位对应的玩家。
            </p>
          )}

          {hasFortuneTeller ? (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <label className="block text-sm font-medium text-blue-900">
                占卜师红鲱鱼
              </label>
              <p className="mt-1 text-xs leading-5 text-blue-700">
                占卜师的红鲱鱼在游戏开始前决定，游戏中途不应修改。
              </p>
              <select
                value={fortuneTellerRedHerringSeat ?? ""}
                onChange={(event) =>
                  setFortuneTellerRedHerringSeat(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">请选择红鲱鱼玩家</option>
                {seats.map((seatNumber) => (
                  <option key={seatNumber} value={seatNumber}>
                    座位 {seatNumber}
                    {manualSeatNames[seatNumber]
                      ? ` · ${manualSeatNames[seatNumber]}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm">
            <div className="font-medium">当前实际配置</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                镇民：{selectedRoleCounts.townsfolk}/
                {recommendedRoleCounts.townsfolk}
              </div>
              <div>
                外来者：{selectedRoleCounts.outsider}/
                {recommendedRoleCounts.outsider}
              </div>
              <div>
                爪牙：{selectedRoleCounts.minion}/{recommendedRoleCounts.minion}
              </div>
              <div>
                恶魔：{selectedRoleCounts.demon}/{recommendedRoleCounts.demon}
              </div>
            </div>
          </div>

          {roleCountWarnings.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-medium">配置提示</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {roleCountWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-5">
                这是推荐配置提示，不会阻止创建对局。说书人可以自由设置板子配置。
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleCreateGame}
            className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
          >
            创建对局
          </button>
        </aside>
      </div>
    </main>
  );
}