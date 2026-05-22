import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ResourceCard } from "@/components/shared/resource-card";
import { Button } from "@/components/ui/button";

const games = [
  {
    id: "example-friday-night",
    title: "Friday Night Table",
    description: "Session planning placeholder for an upcoming game.",
    meta: "12 seats planned",
  },
  {
    id: "example-convention-demo",
    title: "Convention Demo",
    description: "A teaching session with quick notes and reminders.",
    meta: "Intro session",
  },
];

export default function GamesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Games"
        title="Game sessions"
        description="Prepare and review sessions without wiring authentication, players, or live game state yet."
        actions={
          <Button asChild>
            <Link href="/games/new">
              <Plus aria-hidden="true" />
              New Game
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        {games.map((game) => (
          <ResourceCard
            key={game.id}
            href={`/games/${game.id}`}
            title={game.title}
            description={game.description}
            meta={game.meta}
          />
        ))}
      </section>
    </div>
  );
}
