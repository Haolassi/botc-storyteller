import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ResourceCardProps = {
  href: string;
  title: string;
  description: string;
  meta?: string;
};

export function ResourceCard({
  href,
  title,
  description,
  meta,
}: ResourceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Link
            href={href}
            className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Open ${title}`}
          >
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
      {meta ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{meta}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
