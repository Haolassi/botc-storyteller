"use client";

import Link from "next/link";

export function ScriptBuilder() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">剧本编辑器</h1>
      <p className="mt-2 text-sm text-gray-500">
        旧版自定义剧本编辑器暂时停用。请先使用当前剧本库和暗流涌动剧本详情页。
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/scripts"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          前往剧本库
        </Link>

        <Link
          href="/scripts/trouble_brewing"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
        >
          打开暗流涌动
        </Link>
      </div>
    </div>
  );
}
