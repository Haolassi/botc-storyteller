"use client";

import Link from "next/link";

export function ScriptBuilder() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Script Builder</h1>
      <p className="mt-2 text-sm text-gray-500">
        This legacy script builder is temporarily disabled. Use the current
        script library and Trouble Brewing script page instead.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/scripts"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Go to script library
        </Link>

        <Link
          href="/scripts/trouble_brewing"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
        >
          Open Trouble Brewing
        </Link>
      </div>
    </div>
  );
}