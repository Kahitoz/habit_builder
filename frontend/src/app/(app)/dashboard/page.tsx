"use client";

import { useQuery } from "@tanstack/react-query";
import { PartyPopper, Plus, Target } from "lucide-react";
import { fetchToday } from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Ring, DayStateBadge } from "@/components/dashboard/day-summary";
import { MomentumCard } from "@/components/dashboard/momentum-card";
import { LevelCard } from "@/components/dashboard/level-card";
import { HabitRow } from "@/components/dashboard/habit-row";
import { GoalProgressCard } from "@/components/dashboard/goal-progress";
import { useState } from "react";
import Link from "next/link";
import { HabitFormDialog } from "@/components/habits/habit-form";
import { useAuthStore } from "@/lib/store";

function SummaryCard() {
  const { data } = useQuery({
    queryKey: queryKeys.dashboard("today"),
    queryFn: fetchToday,
  });
  if (!data) {
    return (
      <Card>
        <CardContent className="flex h-full items-center gap-4 p-4">
          <Skeleton className="h-[92px] w-[92px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, perfectDay, consistency } = data;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="relative shrink-0">
          <Ring value={summary.completionRate} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums">{summary.completionRate}%</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {summary.completed} of {summary.scheduled} done
          </p>
          {perfectDay.achieved ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-primary">
              <PartyPopper size={13} /> Perfect day — +{perfectDay.bonus} XP
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {perfectDay.remaining} more for a perfect day (+{perfectDay.bonus} XP)
            </p>
          )}
          <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
            <span title="Today">
              today {consistency.today.completed}/{consistency.today.scheduled}
            </span>
            <span title="This week">
              week {consistency.week.completed}/{consistency.week.scheduled}
            </span>
            <span title="This month">
              month {consistency.month.completed}/{consistency.month.scheduled}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Target size={20} className="text-muted-foreground" />
      </span>
      <div>
        <p className="text-sm font-medium">No habits yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create your first habit to start earning XP and building streaks.
        </p>
      </div>
      <Button size="sm" onClick={onCreate}>
        <Plus size={14} /> Create habit
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard("today"),
    queryFn: fetchToday,
  });

  if (isError) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-danger">
              {error instanceof ApiError ? error.message : "Failed to load the dashboard."}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Good day, ${user?.displayName ?? "traveler"}`}
        description={
          data
            ? new Date(`${data.date}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : undefined
        }
        actions={
          <>
            {data && <DayStateBadge state={data.dayState} />}
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus size={14} /> New habit
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard />
        {data ? (
          <MomentumCard momentum={data.momentum} />
        ) : (
          <Card>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        )}
        {data ? (
          <LevelCard level={data.level} />
        ) : (
          <Card>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Today&apos;s habits</CardTitle>
          {data && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {data.summary.completed}/{data.summary.scheduled}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}
          {data && data.habits.length === 0 && <EmptyState onCreate={() => setFormOpen(true)} />}
          {data && data.habits.length > 0 && (
            <div className="space-y-2">
              {data.habits.map((habit) => (
                <HabitRow key={habit.id} habit={habit} date={data.date} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Goals</CardTitle>
          <Link
            href="/goals"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}
          {data && data.goals.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No goals yet. Set a life goal and break it into milestones.
              </p>
              <Link
                href="/goals?new=1"
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-accent"
              >
                Create a goal
              </Link>
            </div>
          )}
          {data && data.goals.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.goals.map((goal) => (
                <GoalProgressCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <HabitFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
