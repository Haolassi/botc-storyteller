import type { Character, CharacterType, Script } from "../types/game";
import { abilityTemplates } from "../data/abilityTemplates";
import { characters } from "../data/characters";
import { scripts } from "../data/scripts";

export const characterTypeLabels: Record<CharacterType, string> = {
  townsfolk: "镇民",
  outsider: "外来者",
  minion: "爪牙",
  demon: "恶魔",
};

export const characterTypeOrder: CharacterType[] = [
  "townsfolk",
  "outsider",
  "minion",
  "demon",
];

export function getCharacterById(id: string): Character | undefined {
  return characters.find((character) => character.id === id);
}

export function getScriptById(id: string): Script | undefined {
  return scripts.find((script) => script.id === id);
}

export function getCharactersByIds(ids: string[]): Character[] {
  return ids
    .map((id) => getCharacterById(id))
    .filter((character): character is Character => Boolean(character));
}

export function getCharactersByScriptId(scriptId: string): Character[] {
  const script = getScriptById(scriptId);

  if (!script) {
    return [];
  }

  return getCharactersByIds(script.characterIds);
}

export function groupCharactersByType(
  inputCharacters: Character[],
): Record<CharacterType, Character[]> {
  return {
    townsfolk: inputCharacters.filter(
      (character) => character.type === "townsfolk",
    ),
    outsider: inputCharacters.filter(
      (character) => character.type === "outsider",
    ),
    minion: inputCharacters.filter((character) => character.type === "minion"),
    demon: inputCharacters.filter((character) => character.type === "demon"),
  };
}

export function getCharactersGroupedByScriptId(
  scriptId: string,
): Record<CharacterType, Character[]> {
  return groupCharactersByType(getCharactersByScriptId(scriptId));
}

export function getAbilityTemplateByCode(abilityCode: string) {
  return abilityTemplates[abilityCode];
}

export function getCharacterCountByType(
  inputCharacters: Character[],
): Record<CharacterType, number> {
  const grouped = groupCharactersByType(inputCharacters);

  return {
    townsfolk: grouped.townsfolk.length,
    outsider: grouped.outsider.length,
    minion: grouped.minion.length,
    demon: grouped.demon.length,
  };
}

export function validateScriptData(scriptId: string): string[] {
  const errors: string[] = [];
  const script = getScriptById(scriptId);

  if (!script) {
    return [`Script not found: ${scriptId}`];
  }

  const seenCharacterIds = new Set<string>();

  for (const characterId of script.characterIds) {
    if (seenCharacterIds.has(characterId)) {
      errors.push(`Duplicate character id in script: ${characterId}`);
    }

    seenCharacterIds.add(characterId);

    const character = getCharacterById(characterId);

    if (!character) {
      errors.push(`Missing character for id: ${characterId}`);
      continue;
    }

    if (!getAbilityTemplateByCode(character.abilityCode)) {
      errors.push(
        `Missing ability template for ${character.nameEn}: ${character.abilityCode}`,
      );
    }
  }

  return errors;
}