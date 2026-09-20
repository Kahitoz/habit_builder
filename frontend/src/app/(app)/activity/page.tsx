"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  CheckCircle2,
  ClipboardList,
  Flag,
  Flame,
  KeyRound,
  Pencil,
  Plus,
  PartyPopper,
  Target,
  Trash2,
  Trophy,
  Undo2,
  User,
  UserPlus,
} from "lucide-react";
import { fetchActivity } from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import { relativeTime } from "@/lib/format";
import type { ActivityItem } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  habit_completed: CheckCircle2,
  habit_uncompleted: Undo2,
  habit_created: Plus,
  habit_updated: Pencil,
  habit_deleted: Trash2,
  streak_bonus: Flame,
  perfect_day: PartyPopper,
  goal_created: Target,
  goal_completed: Trophy,
  goal_deleted: Trash2,
  milestone_created: Flag,
  milestone_completed: Flag,
  review_created: ClipboardList,
  review_updated: ClipboardList,
  account_created: UserPlus,
  profile_updated: User,
  password_changed: KeyRound,
};

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

function describe(item: ActivityItem): string {
  const p = item.payload as Record<string, unknown>;
  switch (item.type) {
    case "habit_completed":
      return `Completed ${s(p.habitTitle)}`;
    case "habit_uncompleted":
      return `Undid ${s(p.habitTitle)}`;
    case "habit_created":
      return `Created habit ${s(p.title)}`;
    case "habit_updated":
      return `Updated habit ${s(p.title)}`;
    case "habit_deleted":
      return `Deleted habit ${s(p.title)}`;
    case "streak_bonus":
      return `${s(p.streak)}-day streak bonus on ${s(p.habitTitle)} (+${s(p.xp)} XP)`;
    case "perfect_day":
      return `Perfect day on ${s(p.date)} (+${s(p.xp)} XP)`;
    case "goal_created":
      return `Created goal ${s(p.title)}`;
    case "goal_completed":
      return `Completed goal ${s(p.title)} (+1000 XP)`;
    case "goal_deleted":
      return `Deleted goal ${s(p.title)}`;
    case "milestone_created":
      return `Added milestone ${s(p.title)} to ${s(p.goalTitle)}`;
    case "milestone_completed":
      return `Completed milestone ${s(p.title)} on ${s(p.goalTitle)} (+${s(p.xp)} XP)`;
    case "review_created":
      return `Wrote the weekly review`;
    case "review_updated":
      return `Updated the weekly review`;
    case "account_created":
      return `Welcome, ${s(p.displayName)}!`;
    case "profile_updated":
      return `Profile updated`;
    case "password_changed":
      return `Password changed`;
    default:
      return item.type.replace(/_/g, " ");
  }
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = ICONS[item.type] ?? ActivityIcon;
  const link = item.habitId
    ? { href: `/habits/${item.habitId}`, label: "View habit" }
    : item.goalId
      ? { href: `/goals/${item.goalId}`, label: "View goal" }
      : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
        <Icon size={15} className="text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{describe(item)}</p>
        <p className="text-[11px] text-muted-foreground">{relativeTime(item.createdAt)}</p>
      </div>
      {link && (
        <Link href={link.href} className="shrink-0 text-xs text-primary hover:underline">
          {link.label}
        </Link>
      )}
    </div>
  );
}

export default function ActivityPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.activity(),
    queryFn: () => fetchActivity(30),
  });

  const [extra, setExtra] = React.useState<ActivityItem[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(data?.nextCursor ?? null);
  const [loadingMore, setLoadingMore] = React.useState(false);

  React.useEffect(() => {
    setExtra([]);
    setCursor(data?.nextCursor ?? null);
  }, [data?.nextCursor]);

  const items = [...(data?.items ?? []), ...extra];

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchActivity(30, cursor);
      setExtra((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <PageHeader title="Activity" description="Everything that happened, in order." />

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="divide-y divide-border">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-1/4" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No activity yet — complete a habit to get started.
            </p>
          )}

          {!isLoading && items.length > 0 && (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          )}

          {cursor && (
            <div className="border-t border-border p-3">
              <Button variant="outline" size="sm" className="w-full" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
