import Link from "next/link";
import { CalendarPlus, Network, ScrollText } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ResourceCard } from "@/components/shared/resource-card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="游戏工具"
        title="血染钟楼说书人工具"
        description="创建剧本、准备本地对局，并为后续联机房间保留入口。"
        actions={
          <>
            <Button asChild>
              <Link href="/scripts/new">
                <ScrollText aria-hidden="true" />
                新建剧本
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/games/new">
                <CalendarPlus aria-hidden="true" />
                本地游玩
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/online">
                <Network aria-hidden="true" />
                联机游玩
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <ResourceCard
          href="/games/new"
          title="本地游玩"
          description="使用当前浏览器的本地存储保存游戏，适合线下面杀或单机说书人记录。"
          meta="保留现有本地游戏流程"
        />
        <ResourceCard
          href="/online"
          title="联机游玩"
          description="进入联机模式入口。房间、同步和远端存储将在后续接入。"
          meta="占位入口，暂未连接服务器"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ResourceCard
          href="/scripts"
          title="剧本"
          description="查看内置剧本与角色列表，后续也可以扩展自定义剧本。"
          meta="目前主要用于角色与夜晚顺序参考"
        />
        <ResourceCard
          href="/games"
          title="对局"
          description="创建和进入本地对局，管理玩家、阶段、提名、夜晚行动和日志。"
          meta="当前本地对局保存在浏览器本地存储中"
        />
      </section>
    </div>
  );
}
