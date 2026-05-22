"use client";

import Link from "next/link";

export function GameCreator() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Game Creator</h1>
      <p className="mt-2 text-sm text-gray-500">
        This legacy game creator is temporarily disabled. Use the current game
        creation flow instead.
      </p>

      <Link
        href="/games/new"
        className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        Go to new game creator
      </Link>
    </div>
  );
}