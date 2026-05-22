import Link from "next/link";
import { CalendarPlus, ScrollText } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ResourceCard } from "@/components/shared/resource-card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Game Utility"
        title="Run cleaner social deduction nights."
        description="Draft character scripts, prepare sessions, and keep future game tools organized without authentication or persistence yet."
        actions={
          <>
            <Button asChild>
              <Link href="/scripts/new">
                <ScrollText aria-hidden="true" />
                New Script
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/games/new">
                <CalendarPlus aria-hidden="true" />
                New Game
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <ResourceCard
          href="/scripts"
          title="Scripts"
          description="Create and review character lists for social deduction scenarios."
          meta="Static placeholders now; storage can be added later."
        />
        <ResourceCard
          href="/games"
          title="Games"
          description="Set up sessions, notes, and player-facing run sheets."
          meta="Ready for future game state and player management."
        />
      </section>
    </div>
  );
}
