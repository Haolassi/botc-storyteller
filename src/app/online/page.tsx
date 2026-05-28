import Link from "next/link";
import { ArrowLeft, LogIn, PlusCircle } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ResourceCard } from "@/components/shared/resource-card";
import { Button } from "@/components/ui/button";

export default function OnlinePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="联机游玩"
        title="联机游玩"
        description="联机房间、远端同步和数据库存储还未接入。这里先保留独立入口，避免影响本地游玩流程。"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft aria-hidden="true" />
                返回首页
              </Link>
            </Button>
            <Button asChild>
              <Link href="/online/create">
                <PlusCircle aria-hidden="true" />
                创建联机房间
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/online/join">
                <LogIn aria-hidden="true" />
                加入联机房间
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <ResourceCard
          href="/online/create"
          title="创建联机房间"
          description="后续会在这里创建远端房间，并分发房间码。"
          meta="待接入远端对局存储"
        />
        <ResourceCard
          href="/online/join"
          title="加入联机房间"
          description="后续会在这里通过房间码进入远端对局。"
          meta="当前仅占位"
        />
      </section>
    </div>
  );
}
