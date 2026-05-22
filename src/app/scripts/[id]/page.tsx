import Link from "next/link";
import { notFound } from "next/navigation";

import { getNightOrderSteps } from "@/data/nightOrder";
import {
  characterTypeLabels,
  characterTypeOrder,
  getCharactersGroupedByScriptId,
  getScriptById,
} from "@/lib/gameData";

interface ScriptDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ScriptDetailPage({
  params,
}: ScriptDetailPageProps) {
  const { id } = await params;
  const script = getScriptById(id);

  if (!script) {
    notFound();
  }

  const groupedCharacters = getCharactersGroupedByScriptId(script.id);
  const firstNightSteps = getNightOrderSteps(script.id, "first_night");
  const otherNightSteps = getNightOrderSteps(script.id, "other_night");

  return (
    <main className="min-h-screen w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <div className="mb-8">
        <Link href="/scripts" className="text-sm text-gray-500 hover:underline">
          ← 返回剧本列表
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {script.nameZh}
            </h1>
            <p className="mt-1 text-gray-500">{script.nameEn}</p>
          </div>

          <div className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700">
            {script.minPlayers}–{script.maxPlayers} 人
          </div>
        </div>
      </div>

      <div className="grid w-full gap-6 xl:grid-cols-[190px_minmax(0,1fr)_190px] 2xl:grid-cols-[210px_minmax(0,1fr)_210px]">
        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4 shadow-sm xl:sticky xl:top-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">首夜顺序</h2>
            <p className="mt-1 text-xs text-gray-500">First night order</p>
          </div>

          <ol className="space-y-2">
            {firstNightSteps.map((step, index) => (
              <li key={step.id} className="rounded-xl bg-gray-50 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-700">
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{step.labelZh}</div>
                    {step.labelEn ? (
                      <div className="truncate text-xs text-gray-500">
                        {step.labelEn}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </aside>

        <div className="grid min-w-0 gap-6">
          {characterTypeOrder.map((type) => {
            const characters = groupedCharacters[type];

            return (
              <section
                key={type}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    {characterTypeLabels[type]}
                  </h2>
                  <span className="text-sm text-gray-500">
                    {characters.length} 个角色
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {characters.map((character) => (
                    <article
                      key={character.id}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{character.nameZh}</h3>
                          <p className="text-sm text-gray-500">
                            {character.nameEn}
                          </p>
                        </div>

                        <span className="rounded-full bg-white px-2 py-1 text-xs text-gray-500">
                          {character.alignment === "good" ? "善良" : "邪恶"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-gray-700">
                        {character.abilitySummaryZh}
                      </p>

                      <div className="mt-3 space-y-1 text-xs text-gray-500">
                        <div>能力代码：{character.abilityCode}</div>
                        <div>触发时机：{character.timing.join(", ")}</div>
                        {character.firstNightOrder ? (
                          <div>首夜顺序：{character.firstNightOrder}</div>
                        ) : null}
                        {character.otherNightOrder ? (
                          <div>其他夜晚顺序：{character.otherNightOrder}</div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">其他夜晚顺序</h2>
            <p className="mt-1 text-xs text-gray-500">Other night order</p>
          </div>

          <ol className="space-y-2">
            {otherNightSteps.map((step, index) => (
              <li key={step.id} className="rounded-xl bg-gray-50 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-700">
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{step.labelZh}</div>
                    {step.labelEn ? (
                      <div className="truncate text-xs text-gray-500">
                        {step.labelEn}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}