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
import type { GamePlayer } from "@/types/game";

type SeatAssignmentMode = "manual" | "random";

const playerCounts = Array.from({ length: 11 }, (_, index) => index + 5);

const troubleBrewingRoleCounts: Record<
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
  const [error, setError] = useState<string | null>(null);

  const selectedScript = getScriptById(scriptId);
  const scriptCharacters = getCharactersByScriptId(scriptId);
  const roleCounts = troubleBrewingRoleCounts[playerCount];

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

  const selectedRoleCounts = useMemo(() => {
    const selectedCharacters = selectedRoleIds
      .map((roleId) =>
        scriptCharacters.find((character) => character.id === roleId),
      )
      .filter(Boolean);

    return {
      townsfolk: selectedCharacters.filter(
        (character) => character?.type === "townsfolk",
      ).length,
      outsider: selectedCharacters.filter(
        (character) => character?.type === "outsider",
      ).length,
      minion: selectedCharacters.filter(
        (character) => character?.type === "minion",
      ).length,
      demon: selectedCharacters.filter(
        (character) => character?.type === "demon",
      ).length,
    };
  }, [scriptCharacters, selectedRoleIds]);

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

  function handlePlayerCountChange(nextCount: number) {
    setPlayerCount(nextCount);

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
  }

  function handleRoleChange(seatNumber: number, roleId: string) {
    setSeatRoleIds((current) => ({
      ...current,
      [seatNumber]: roleId,
    }));
  }

  function handleManualNameChange(seatNumber: number, name: string) {
    setManualSeatNames((current) => ({
      ...current,
      [seatNumber]: name,
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

    if (!roleCounts) {
      return "当前人数没有可用的角色配置表。";
    }

    if (selectedRoleCounts.townsfolk !== roleCounts.townsfolk) {
      return `镇民数量应为 ${roleCounts.townsfolk}，当前为 ${selectedRoleCounts.townsfolk}。`;
    }

    if (selectedRoleCounts.outsider !== roleCounts.outsider) {
      return `外来者数量应为 ${roleCounts.outsider}，当前为 ${selectedRoleCounts.outsider}。`;
    }

    if (selectedRoleCounts.minion !== roleCounts.minion) {
      return `爪牙数量应为 ${roleCounts.minion}，当前为 ${selectedRoleCounts.minion}。`;
    }

    if (selectedRoleCounts.demon !== roleCounts.demon) {
      return `恶魔数量应为 ${roleCounts.demon}，当前为 ${selectedRoleCounts.demon}。`;
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
        alignment: character?.alignment,
        isAlive: true,
        isDrunk: false,
        isPoisoned: false,
      };
    });

    const game = createInitialGameState({
      id: gameId,
      scriptId,
      players,
      createdAt: now,
    });

    saveLocalGame(game);
    router.push(`/games/${game.id}`);
  }

  return (
    <main className="min-h-screen w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <div className="mb-8">
        <p className="text-sm text-gray-500">Games</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">创建对局</h1>
        <p className="mt-2 text-sm text-gray-600">
          按说书人流程创建对局：选择板子、确定人数、分配角色、分配座位。
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_220px] 2xl:grid-cols-[240px_minmax(0,1fr)_240px]">
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

            {roleCounts ? (
              <div className="rounded-xl bg-gray-50 p-4 text-sm">
                <div className="font-medium">该人数推荐配置</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>镇民：{roleCounts.townsfolk}</div>
                  <div>外来者：{roleCounts.outsider}</div>
                  <div>爪牙：{roleCounts.minion}</div>
                  <div>恶魔：{roleCounts.demon}</div>
                </div>
              </div>
            ) : null}

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
            <h2 className="text-lg font-semibold">2. 座位与角色</h2>
            <p className="mt-1 text-sm text-gray-500">
              系统根据人数生成座位。说书人需要为每个座位分配一个角色。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {seats.map((seatNumber) => (
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
                  分配角色
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
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">3. 玩家分配</h2>

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

          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm">
            <div className="font-medium">当前角色配置</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                镇民：{selectedRoleCounts.townsfolk}/{roleCounts.townsfolk}
              </div>
              <div>
                外来者：{selectedRoleCounts.outsider}/{roleCounts.outsider}
              </div>
              <div>
                爪牙：{selectedRoleCounts.minion}/{roleCounts.minion}
              </div>
              <div>
                恶魔：{selectedRoleCounts.demon}/{roleCounts.demon}
              </div>
            </div>
          </div>

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