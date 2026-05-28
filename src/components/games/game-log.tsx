"use client";

import Link from "next/link";

type GameLogProps = {
  gameId: string;
};

export function GameLog({ gameId }: GameLogProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">对局日志</h1>
      <p className="mt-2 text-sm text-gray-500">
        旧版日志视图暂时停用。请使用当前说书人控制台。
      </p>

      <Link
        href={`/games/${gameId}`}
        className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        打开说书人控制台
      </Link>
    </div>
  );
}
