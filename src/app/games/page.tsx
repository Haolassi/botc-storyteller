import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ResourceCard } from "@/components/shared/resource-card";
import { Button } from "@/components/ui/button";

const games = [
  {
    id: "example-friday-night",
    title: "周五夜晚示例桌",
    description: "用于展示对局入口的示例占位。",
    meta: "计划十二个座位",
  },
  {
    id: "example-convention-demo",
    title: "教学演示示例",
    description: "用于教学局记录与提醒的示例占位。",
    meta: "入门局",
  },
];

export default function GamesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="对局"
        title="对局列表"
        description="查看示例对局入口，或创建新的本地对局。"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft aria-hidden="true" />
                返回首页
              </Link>
            </Button>
            <Button asChild>
              <Link href="/games/new">
                <Plus aria-hidden="true" />
                新建本地对局
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        {games.map((game) => (
          <ResourceCard
            key={game.id}
            href={`/games/${game.id}`}
            title={game.title}
            description={game.description}
            meta={game.meta}
          />
        ))}
      </section>
    </div>
  );
}
