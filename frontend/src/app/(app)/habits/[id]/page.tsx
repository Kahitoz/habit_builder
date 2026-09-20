"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Flame, Pencil, Trash2, Trophy } from "lucide-react";
import {
  completeHabit,
  deleteHabit,
  fetchGoals,
  fetchHabit,
  fetchHabitHistory,
  fetchHabitStats,
  uncompleteHabit,
} from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import { frequencyLabel, targetLabel } from "@/lib/format";
import { HabitIcon } from "@/components/habit-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { HabitFormDialog } from "@/components/habits/habit-form";
import { HeatmapStrip } from "@/components/habits/heatmap-strip";
import { cn } from "@/lib/utils";

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export default function HabitDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: habit, isLoading } = useQuery({
    queryKey: queryKeys.habits.detail(id),
    queryFn: () => fetchHabit(id),
  });
  const { data: stats } = useQuery({
    queryKey: queryKeys.habits.stats(id, 90),
    queryFn: () => fetchHabitStats(id),
  });
  const { data: history } = useQuery({
    queryKey: queryKeys.habits.history(id),
    queryFn: () => fetchHabitHistory(id),
  });
  const { data: goals = [] } = useQuery({
    queryKey: queryKeys.goals.all(),
    queryFn: () => fetchGoals(),
  });

  const today = todayISO();
  const doneToday = habit?.completedToday ?? false;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.habits.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.habits.detail(id) });
    queryClient.invalidateQueries({ queryKey: ["habits", id, "stats"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.habits.history(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard("today") });
    queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
  };

  const completeMutation = useMutation({
    mutationFn: () =>
      doneToday ? uncompleteHabit(id, today) : completeHabit(id, { date: today }),
    onSuccess: () => {
      toast.success(doneToday ? "Removed today's completion" : "Logged!");
      invalidateAll();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update the habit."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteHabit(id),
    onSuccess: () => {
      toast.success("Habit deleted");
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all() });
      router.push("/habits");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not delete the habit."),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!habit) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Habit not found.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push("/habits")}>
          <ArrowLeft size={14} /> Back to habits
        </Button>
      </div>
    );
  }

  const historyDates = new Set((history?.completions ?? []).map((c) => c.date));
  const goal = habit.goalId ? goals.find((g) => g.id === habit.goalId) : null;
  const goalTitle = goal?.title ?? null;

  return (
    <div>
      <button
        onClick={() => router.push("/habits")}
        className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={13} /> All habits
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${habit.color ?? "#eab308"}22` }}
          >
            <HabitIcon icon={habit.icon} size={22} className={habit.color ?? "text-foreground"} />
          </span>
          <div>
            <h1 className="text-lg font-semibold">{habit.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{frequencyLabel(habit)}</span>
              <Badge variant="outline" className="capitalize">
                {habit.difficulty}
              </Badge>
              {habit.target > 1 && <span>{targetLabel(habit.target, habit.unit)}</span>}
              {goalTitle && <span>→ {goalTitle}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={doneToday ? "outline" : "default"}
            disabled={completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
          >
            {doneToday ? "Undo today" : "Done today"}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} title="Edit">
            <Pencil size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)} title="Delete">
            <Trash2 size={15} className="text-danger" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Current streak</CardTitle>
            <Flame size={15} className="text-warning" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{habit.currentStreak}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {habit.atRisk ? "at risk — complete today to keep it" : "consecutive days"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Longest streak</CardTitle>
            <Trophy size={15} className="text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{habit.longestStreak}</p>
            <p className="mt-1 text-xs text-muted-foreground">best run ever</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{habit.completions30d}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              completions{stats ? ` · ${stats.totalCompletions} all-time` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {habit.description && (
        <Card className="mt-4">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            {habit.description}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Consistency (last 90 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <HeatmapStrip dates={historyDates} days={90} end={today} />
        </CardContent>
      </Card>

      {(history?.completions.length ?? 0) > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Recent completions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {history!.completions.slice(0, 24).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {format(parseISO(c.date), "MMM d")}
                  </span>
                  <span className={cn("font-medium tabular-nums")}>
                    {c.value >= habit.target ? "✓" : c.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <HabitFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={habit}
        onSaved={invalidateAll}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTitle>Delete “{habit.title}”?</DialogTitle>
        <DialogDescription>
          This removes the habit and its completions from analytics. XP you already
          earned is kept. This cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
