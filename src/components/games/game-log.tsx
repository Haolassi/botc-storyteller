"use client";

import Link from "next/link";

type GameLogProps = {
  gameId: string;
};

export function GameLog({ gameId }: GameLogProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Game Log</h1>
      <p className="mt-2 text-sm text-gray-500">
        This legacy log view is temporarily disabled. Use the main storyteller
        console instead.
      </p>

      <Link
        href={`/games/${gameId}`}
        className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        Open storyteller console
      </Link>
    </div>
  );
}