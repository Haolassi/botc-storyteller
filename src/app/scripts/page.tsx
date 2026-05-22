import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ResourceCard } from "@/components/shared/resource-card";
import { Button } from "@/components/ui/button";
import {
  getCharacterCountByType,
  getCharactersByScriptId,
} from "@/lib/gameData";
import { scripts } from "@/data/scripts";

export default function ScriptsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Scripts"
        title="Script library"
        description="Browse built-in and custom social deduction scripts. Built-in scripts reference the shared character library."
        actions={
          <Button asChild>
            <Link href="/scripts/new">
              <Plus aria-hidden="true" />
              New Script
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        {scripts.map((script) => {
          const scriptCharacters = getCharactersByScriptId(script.id);
          const counts = getCharacterCountByType(scriptCharacters);

          return (
            <ResourceCard
              key={script.id}
              href={`/scripts/${script.id}`}
              title={`${script.nameZh} / ${script.nameEn}`}
              description={`镇民 ${counts.townsfolk} · 外来者 ${counts.outsider} · 爪牙 ${counts.minion} · 恶魔 ${counts.demon}`}
              meta={`${script.minPlayers}-${script.maxPlayers} players`}
            />
          );
        })}
      </section>
    </div>
  );
}
