import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ScriptBuilder } from "@/components/scripts/script-builder";
import { Button } from "@/components/ui/button";

export default function NewScriptPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="新建剧本"
        title="创建剧本"
        description="当前自定义剧本编辑器仍是占位功能，可先使用内置剧本库查看角色与夜晚顺序。"
        actions={
          <Button asChild variant="outline">
            <Link href="/scripts">
              <ArrowLeft aria-hidden="true" />
              返回剧本库
            </Link>
          </Button>
        }
      />

      <ScriptBuilder />
    </div>
  );
}
