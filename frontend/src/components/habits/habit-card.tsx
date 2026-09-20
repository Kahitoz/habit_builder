"use client";

import Link from "next/link";
import { Flame, Trash2, Pencil } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Habit } from "@/lib/types";
import { fetchGoals, updateHabit } from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import { frequencyLabel, targetLabel } from "@/lib/format";
import { HabitIcon } from "@/components/habit-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function HabitCard({
  habit,
  onEdit,
  onDelete,
}: {
  habit: Habit;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data: goals = [] } = useQuery({
    queryKey: queryKeys.goals.all(),
    queryFn: () => fetchGoals(),
  });
  const queryClient = useQueryClient();
  const goal = habit.goalId ? goals.find((g) => g.id === habit.goalId) : null;

  const toggleActive = useMutation({
    mutationFn: () => updateHabit(habit.id, { active: !habit.active }),
    onSuccess: () => {
      toast.success(habit.active ? "Habit paused" : "Habit resumed");
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.list(true) });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.list(false) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard("today") });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update habit."),
  });

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3",
        !habit.active && "opacity-60",
      )}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${habit.color ?? "#eab308"}22` }}
      >
        <HabitIcon icon={habit.icon} size={18} className={habit.color ?? "text-foreground"} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/habits/${habit.id}`}
            className="truncate text-sm font-medium hover:text-primary"
          >
            {habit.title}
          </Link>
          {habit.atRisk && (
            <Badge variant="danger" className="shrink-0">
              at risk
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{frequencyLabel(habit)}</span>
          <Badge variant="outline" className="capitalize">
            {habit.difficulty}
          </Badge>
          {habit.target > 1 && (
            <span>{targetLabel(habit.target, habit.unit)}</span>
          )}
          {goal && (
            <span className="truncate" title={goal.title}>
              → {goal.title}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-warning">
            <Flame size={12} /> {habit.currentStreak}
          </span>
          <span className="text-muted-foreground tabular-nums">
            best {habit.longestStreak}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {habit.completions30d} last 30d
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Switch
          checked={habit.active}
          onCheckedChange={() => toggleActive.mutate()}
          label={`Toggle ${habit.title} active`}
        />
        <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
          <Pencil size={14} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} title="Delete">
          <Trash2 size={14} className="text-danger" />
        </Button>
      </div>
    </div>
  );
}
