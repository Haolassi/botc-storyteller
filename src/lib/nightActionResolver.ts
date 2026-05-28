import { getCharacterById } from "@/lib/gameData";
import { getCurrentNightStep, getNightActorForStep } from "@/lib/nightActions";
import {
  getChefRegisteredEvilPairs,
  getEmpathRegisteredEvilNeighborCount,
  getFortuneTellerCorrectResult,
  getRealCharacter,
  getRegisteredAlignment,
  getRegisteredCharacter,
} from "@/lib/registrationLogic";
import { setPlayerPoisoned } from "@/lib/abilityResolution";
import type { ApplyNightAction } from "@/types/actions";
import type { Alignment, CharacterType, Game, GamePlayer } from "@/types/game";

type RegistrationOverrides = Record<
  string,
  {
    alignment?: Alignment;
    characterId?: string;
  }
>;

export interface ResolvedNightAction {
  game: Game;
  note?: string;
}

function appendNote(currentNote: string, nextNote: string): string {
  return currentNote ? `${currentNote}\n\n${nextNote}` : nextNote;
}

function getSelectedPlayerInfo(
  game: Game,
  playerId: string,
  registrationOverrides: RegistrationOverrides,
) {
  const player = game.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    return null;
  }

  const registrationOverride = registrationOverrides[player.id];

  return {
    player,
    realCharacter: getRealCharacter(player),
    registeredCharacter: registrationOverride?.characterId
      ? getCharacterById(registrationOverride.characterId)
      : getRegisteredCharacter(player),
    registeredAlignment:
      registrationOverride?.alignment ?? getRegisteredAlignment(player),
  };
}

function getRequiredInfoType(characterId?: string): CharacterType | null {
  if (characterId === "washerwoman") {
    return "townsfolk";
  }

  if (characterId === "librarian") {
    return "outsider";
  }

  if (characterId === "investigator") {
    return "minion";
  }

  return null;
}

export function resolveNightAction(
  game: Game,
  action: ApplyNightAction,
): ResolvedNightAction {
  const currentStep = getCurrentNightStep(game);
  const characterId = action.payload.characterId ?? currentStep?.characterId;
  const actor =
    action.payload.actorPlayerId
      ? game.players.find((player) => player.id === action.payload.actorPlayerId)
      : getNightActorForStep(game, characterId);
  const targetPlayerId = action.payload.targetPlayerIds?.[0] ?? "";
  const secondTargetPlayerId = action.payload.targetPlayerIds?.[1] ?? "";
  const registrationOverrides = action.payload.registrationOverrides ?? {};
  const selectedCharacterId = action.payload.selectedCharacterId;
  const referenceNumber = action.payload.referenceNumber ?? 0;
  const yesNoAnswer = action.payload.yesNoAnswer ?? "no";
  const currentNightActionFails = Boolean(actor?.isPoisoned);
  let generatedNote = action.payload.note?.trim() ?? "";
  let nextGame = game;

  if (currentNightActionFails) {
    const failureNote =
      "中毒判定：该行动玩家当前被标记为中毒，本次技能发动失败。";

    generatedNote = appendNote(generatedNote, failureNote);
  }

  const requiredInfoType = getRequiredInfoType(characterId);
  const firstNightInfoPlayer = targetPlayerId
    ? getSelectedPlayerInfo(game, targetPlayerId, registrationOverrides)
    : null;
  const secondNightInfoPlayer = secondTargetPlayerId
    ? getSelectedPlayerInfo(game, secondTargetPlayerId, registrationOverrides)
    : null;

  if (
    requiredInfoType &&
    firstNightInfoPlayer &&
    secondNightInfoPlayer
  ) {
    const shownCharacter = selectedCharacterId
      ? getCharacterById(selectedCharacterId)
      : undefined;
    const matchingPlayers = [firstNightInfoPlayer, secondNightInfoPlayer]
      .filter((entry) => entry.registeredCharacter?.type === requiredInfoType)
      .map((entry) => `${entry.player.seatNumber}. ${entry.player.displayName}`)
      .join(", ");
    const currentNightCharacter = characterId
      ? getCharacterById(characterId)
      : undefined;
    const referenceNote = [
      `${currentNightCharacter?.nameZh ?? "信息角色"}规则参考：`,
      `候选玩家：${firstNightInfoPlayer.player.seatNumber}. ${firstNightInfoPlayer.player.displayName}、${secondNightInfoPlayer.player.seatNumber}. ${secondNightInfoPlayer.player.displayName}`,
      action.payload.infoNoRoleInPlay
        ? "展示信息：场上不存在对应类型角色。"
        : `展示角色：${shownCharacter ? `${shownCharacter.nameZh} / ${shownCharacter.nameEn}` : "未选择"}`,
      matchingPlayers
        ? `两名候选中登记类型匹配的玩家：${matchingPlayers}`
        : "两名候选中没有登记类型匹配的玩家。",
      "最终给出的信息仍由说书人决定。",
    ].join("\n");

    generatedNote = appendNote(generatedNote, referenceNote);
  }

  if (characterId === "chef") {
    const pairs = getChefRegisteredEvilPairs(game);
    const pairText =
      pairs.length > 0
        ? pairs
            .map(
              ({ first, second }) =>
                `${first.seatNumber}. ${first.displayName} + ${second.seatNumber}. ${second.displayName}`,
            )
            .join("; ")
        : "没有登记为邪恶且相邻的玩家对。";
    const referenceNote = [
      "厨师规则参考：",
      `相邻邪恶对数：${pairs.length}`,
      `说书人记录数字：${referenceNumber}`,
      `相邻邪恶玩家对：${pairText}`,
      "该结果基于当前 registeredAlignment；最终给出的数字仍由说书人决定。",
    ].join("\n");

    generatedNote = appendNote(generatedNote, referenceNote);
  }

  if (characterId === "empath" && actor) {
    const empathReference = getEmpathRegisteredEvilNeighborCount(
      game,
      actor.id,
    );
    const neighborText = [empathReference.left, empathReference.right]
      .filter((player): player is GamePlayer => Boolean(player))
      .map((player) => `${player.seatNumber}. ${player.displayName}`)
      .join(", ");
    const referenceNote = [
      "共情者规则参考：",
      `最近存活邻座：${neighborText || "未找到足够的存活邻座"}`,
      `系统计算邪恶人数：${empathReference.count}`,
      `说书人记录数字：${referenceNumber}`,
      "该结果基于当前 registeredAlignment；最终给出的数字仍由说书人决定。",
    ].join("\n");

    generatedNote = appendNote(generatedNote, referenceNote);
  }

  if (
    characterId === "fortune_teller" &&
    targetPlayerId &&
    secondTargetPlayerId
  ) {
    const fortuneTellerReference = getFortuneTellerCorrectResult({
      game,
      firstPlayerId: targetPlayerId,
      secondPlayerId: secondTargetPlayerId,
    });
    const firstTarget = game.players.find(
      (player) => player.id === targetPlayerId,
    );
    const secondTarget = game.players.find(
      (player) => player.id === secondTargetPlayerId,
    );
    const referenceNote = [
      "占卜师规则参考：",
      `选择目标：${firstTarget ? `${firstTarget.seatNumber}. ${firstTarget.displayName}` : "未知"}、${secondTarget ? `${secondTarget.seatNumber}. ${secondTarget.displayName}` : "未知"}`,
      `系统参考结果：${fortuneTellerReference.hasDemonSignal ? "是" : "否"}`,
      `原因：${fortuneTellerReference.reasons.join("；")}`,
      "该结果基于当前登记恶魔与红鲱鱼；最终给出的答案仍由说书人决定。",
    ].join("\n");

    generatedNote = appendNote(generatedNote, referenceNote);
  }

  if (characterId === "fortune_teller") {
    const answerNote = `占卜师说书人答案：${yesNoAnswer === "yes" ? "是" : "否"}`;

    generatedNote = generatedNote
      ? `${generatedNote}\n${answerNote}`
      : answerNote;
  }

  if (characterId === "undertaker") {
    const executedPlayer = game.executionState.executedPlayerId
      ? game.players.find(
          (player) => player.id === game.executionState.executedPlayerId,
        )
      : undefined;
    const executedCharacter = executedPlayer
      ? getRealCharacter(executedPlayer)
      : undefined;
    const referenceNote = [
      "送葬者规则参考：",
      executedPlayer
        ? `今日白天被处决玩家：${executedPlayer.seatNumber}. ${executedPlayer.displayName}`
        : "今日白天没有记录到被处决玩家。",
      executedCharacter
        ? `真实角色：${executedCharacter.nameZh} / ${executedCharacter.nameEn}`
        : "真实角色：无",
      "若该信息受醉酒、中毒或说书人决定影响，最终告知内容由说书人决定。",
    ].join("\n");

    generatedNote = appendNote(generatedNote, referenceNote);
  }

  if (characterId === "poisoner" && targetPlayerId && !currentNightActionFails) {
    nextGame = setPlayerPoisoned(nextGame, targetPlayerId, true);

    const target = game.players.find((player) => player.id === targetPlayerId);
    const referenceNote = [
      "投毒者行动：",
      `目标：${target ? `${target.seatNumber}. ${target.displayName}` : "未知玩家"}`,
      "系统已将该玩家标记为中毒。此标记用于说书人参考，不自动裁定所有技能结果。",
    ].join("\n");

    generatedNote = appendNote(generatedNote, referenceNote);
  }

  if (characterId === "monk" && targetPlayerId && !currentNightActionFails) {
    const target = game.players.find((player) => player.id === targetPlayerId);

    nextGame = {
      ...nextGame,
      setupState: {
        ...nextGame.setupState,
        monkProtectedPlayerId: targetPlayerId,
      },
      updatedAt: new Date().toISOString(),
    };

    const referenceNote = [
      "僧侣行动：",
      `保护目标：${target ? `${target.seatNumber}. ${target.displayName}` : "未知玩家"}`,
      "若小恶魔本夜攻击该目标，系统会提示说书人该攻击被保护影响。",
    ].join("\n");

    generatedNote = appendNote(generatedNote, referenceNote);
  }

  if (
    characterId === "butler" &&
    targetPlayerId &&
    actor &&
    !currentNightActionFails
  ) {
    const target = game.players.find((player) => player.id === targetPlayerId);

    nextGame = {
      ...nextGame,
      setupState: {
        ...nextGame.setupState,
        butlerMasterPlayerIds: {
          ...(nextGame.setupState.butlerMasterPlayerIds ?? {}),
          [actor.id]: targetPlayerId,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    const referenceNote = [
      "管家行动：",
      `主人：${target ? `${target.seatNumber}. ${target.displayName}` : "未知玩家"}`,
      "白天投票时，系统会提示并限制管家只能在主人投票时投票。",
    ].join("\n");

    generatedNote = appendNote(generatedNote, referenceNote);
  }

  if (characterId === "ravenkeeper" && targetPlayerId) {
    const target = game.players.find((player) => player.id === targetPlayerId);
    const targetCharacter = target ? getRealCharacter(target) : undefined;
    const referenceNote = [
      "守鸦人规则参考：",
      `选择目标：${target ? `${target.seatNumber}. ${target.displayName}` : "未知玩家"}`,
      targetCharacter
        ? `真实角色：${targetCharacter.nameZh} / ${targetCharacter.nameEn}`
        : "真实角色：未知",
      currentNightActionFails
        ? "守鸦人中毒，本次信息失败。"
        : "最终告知内容仍由说书人决定。",
    ].join("\n");

    generatedNote = appendNote(generatedNote, referenceNote);
  }

  if (characterId === "imp" && targetPlayerId && currentNightActionFails) {
    const target = game.players.find((player) => player.id === targetPlayerId);
    const failureNote = target
      ? `Imp was poisoned; attack on ${target.seatNumber}. ${target.displayName} failed and no death was marked.`
      : "Imp was poisoned; no death was marked.";

    generatedNote = appendNote(generatedNote, failureNote);
  }

  if (characterId === "imp" && targetPlayerId && !currentNightActionFails) {
    const target = game.players.find((player) => player.id === targetPlayerId);
    const targetCharacter = target ? getRealCharacter(target) : undefined;
    const protectedPlayerId =
      action.payload.protectedPlayerId ?? game.setupState.monkProtectedPlayerId;
    let impResultNote = target
      ? `System marked ${target.seatNumber}. ${target.displayName} dead from the Imp attack.`
      : "System marked the Imp attack target dead.";

    if (targetPlayerId === protectedPlayerId) {
      impResultNote = target
        ? `${target.seatNumber}. ${target.displayName} was protected by the Monk; no death was marked.`
        : "The Imp attack target was protected by the Monk; no death was marked.";
    } else if (targetCharacter?.id === "soldier" && !target?.isPoisoned) {
      impResultNote = target
        ? `${target.seatNumber}. ${target.displayName} is an unpoisoned Soldier; no death was marked.`
        : "The Imp attacked a Soldier; no death was marked.";
    } else if (
      targetCharacter?.id === "mayor" &&
      !target?.isPoisoned &&
      action.payload.mayorRedirectPlayerId
    ) {
      const redirectTarget = game.players.find(
        (player) => player.id === action.payload.mayorRedirectPlayerId,
      );
      const redirectCharacter = redirectTarget
        ? getRealCharacter(redirectTarget)
        : undefined;

      if (redirectCharacter?.id === "soldier" && !redirectTarget?.isPoisoned) {
        impResultNote = redirectTarget
          ? `The Mayor redirect target was ${redirectTarget.seatNumber}. ${redirectTarget.displayName}, an unpoisoned Soldier; no death was marked.`
          : "The Mayor attack redirected to a Soldier; no death was marked.";
      } else {
        nextGame = {
          ...nextGame,
          players: nextGame.players.map((player) =>
            player.id === action.payload.mayorRedirectPlayerId
              ? {
                  ...player,
                  isAlive: false,
                }
              : player,
          ),
          updatedAt: new Date().toISOString(),
        };

        impResultNote = redirectTarget
          ? `The Storyteller redirected the Imp attack from the Mayor to ${redirectTarget.seatNumber}. ${redirectTarget.displayName}; the redirected target was marked dead.`
          : "The Storyteller redirected the Imp attack from the Mayor; the redirected target was marked dead.";
      }
    } else if (actor?.id === targetPlayerId) {
      const replacementMinion = nextGame.players.find((player) => {
        const character = getRealCharacter(player);

        return (
          player.isAlive &&
          player.id !== actor.id &&
          character?.type === "minion"
        );
      });

      nextGame = {
        ...nextGame,
        players: nextGame.players.map((player) =>
          player.id === targetPlayerId
            ? {
                ...player,
                isAlive: false,
              }
            : player,
        ),
        updatedAt: new Date().toISOString(),
      };

      if (replacementMinion) {
        nextGame = {
          ...nextGame,
          players: nextGame.players.map((player) =>
            player.id === replacementMinion.id
              ? {
                  ...player,
                  characterId: "imp",
                  alignment: "evil",
                  registeredAlignment: "evil",
                  registeredCharacterId: "imp",
                }
              : player,
          ),
          updatedAt: new Date().toISOString(),
        };
      }

      impResultNote = replacementMinion
        ? `Imp chose themself; ${replacementMinion.seatNumber}. ${replacementMinion.displayName} became the new Imp.`
        : "Imp chose themself; no living Minion was available for replacement.";
    } else {
      nextGame = {
        ...nextGame,
        players: nextGame.players.map((player) =>
          player.id === targetPlayerId
            ? {
                ...player,
                isAlive: false,
              }
            : player,
        ),
        updatedAt: new Date().toISOString(),
      };
    }

    nextGame = {
      ...nextGame,
      setupState: {
        ...nextGame.setupState,
        monkProtectedPlayerId: undefined,
      },
    };

    const referenceNote = [
      "Imp action:",
      `Attack target: ${target ? `${target.seatNumber}. ${target.displayName}` : "unknown player"}`,
      `Result reference: ${impResultNote}`,
    ].join("\n");

    generatedNote = appendNote(generatedNote, referenceNote);
  }

  return {
    game: nextGame,
    note: generatedNote,
  };
}
