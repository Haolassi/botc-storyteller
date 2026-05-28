"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";

import type { Character, CharacterType } from "@/types/game";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CharacterPickerProps = {
  characters: Character[];
  selectedIds: string[];
  onToggleCharacter: (characterId: string) => void;
};

const characterTypeOrder: CharacterType[] = [
  "townsfolk",
  "outsider",
  "minion",
  "demon",
];

const characterTypeLabels: Record<CharacterType, string> = {
  townsfolk: "镇民",
  outsider: "外来者",
  minion: "爪牙",
  demon: "恶魔",
};

export function CharacterPicker({
  characters,
  selectedIds,
  onToggleCharacter,
}: CharacterPickerProps) {
  const groupedCharacters = useMemo(
    () =>
      characterTypeOrder.map((type) => ({
        type,
        label: characterTypeLabels[type],
        characters: characters.filter((character) => character.type === type),
      })),
    [characters],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            角色选择器
          </h2>
          <p className="text-sm text-muted-foreground">
            为草稿剧本选择角色。
          </p>
        </div>
        <Badge variant="secondary">已选 {selectedIds.length} 个</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {groupedCharacters.map((group) => (
          <Card key={group.type}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{group.label}</span>
                <Badge variant="outline">{group.characters.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.characters.map((character) => {
                const isSelected = selectedIds.includes(character.id);

                return (
                  <Button
                    key={character.id}
                    type="button"
                    variant={isSelected ? "secondary" : "outline"}
                    className={cn(
                      "h-auto w-full justify-start gap-3 whitespace-normal p-3 text-left",
                      isSelected && "border-primary",
                    )}
                    onClick={() => onToggleCharacter(character.id)}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30",
                      )}
                      aria-hidden="true"
                    >
                      {isSelected ? <Check className="size-3" /> : null}
                    </span>

                    <span className="min-w-0 space-y-1">
                      <span className="block font-medium">
                        {character.nameZh}
                      </span>
                      <span className="block text-xs leading-5 text-muted-foreground">
                        {character.abilitySummaryZh}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
