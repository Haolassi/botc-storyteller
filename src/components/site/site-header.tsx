import Link from "next/link";
import { ScrollText, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/scripts", label: "剧本" },
  { href: "/games", label: "对局" },
];

export function SiteHeader() {
  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Swords className="size-5" aria-hidden="true" />
          <span>说书人工具</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Button key={item.href} asChild variant="ghost">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          <Button asChild size="sm" className="ml-2">
            <Link href="/scripts/new">
              <ScrollText aria-hidden="true" />
              新建剧本
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
