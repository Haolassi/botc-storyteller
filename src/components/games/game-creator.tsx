"use client";

import Link from "next/link";

export function GameCreator() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">对局创建器</h1>
      <p className="mt-2 text-sm text-gray-500">
        旧版对局创建器暂时停用。请使用当前本地对局创建流程。
      </p>

      <Link
        href="/games/new"
        className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        前往新建本地对局
      </Link>
    </div>
  );
}
