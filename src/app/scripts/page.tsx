import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

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
        eyebrow="剧本"
        title="剧本库"
        description="查看内置剧本的角色构成、夜晚顺序和角色能力说明。"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft aria-hidden="true" />
                返回首页
              </Link>
            </Button>
            <Button asChild>
              <Link href="/scripts/new">
                <Plus aria-hidden="true" />
                新建剧本
              </Link>
            </Button>
          </>
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
              title={script.nameZh}
              description={`镇民 ${counts.townsfolk} · 外来者 ${counts.outsider} · 爪牙 ${counts.minion} · 恶魔 ${counts.demon}`}
              meta={`${script.minPlayers}-${script.maxPlayers} 人`}
            />
          );
        })}
      </section>
    </div>
  );
}
