"use client";

import { Flame, TriangleAlert } from "lucide-react";
import type { DayHabit } from "@/lib/types";
import { useCompleteMutation } from "@/lib/use-complete";
import { HabitIcon } from "@/components/habit-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function HabitRow({ habit, date }: { habit: DayHabit; date: string }) {
  const mutate = useCompleteMutation(date);

  const handleToggle = () => {
    if (mutate.isPending) return;
    mutate.mutate({ habitId: habit.id, done: habit.done });
  };

  const targetLabel =
    habit.target > 1 ? `${habit.target}${habit.unit ? ` ${habit.unit}` : ""}` : null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border border-border px-3 py-2.5 transition-colors",
        habit.done && "bg-primary/5",
      )}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${habit.color ?? "#eab308"}22` }}
      >
        <HabitIcon icon={habit.icon} className={cn(habit.color ?? "text-foreground")} />
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", habit.done && "text-muted-foreground")}>
          {habit.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {habit.goalTitle && (
            <span className="truncate text-[11px] text-muted-foreground">
              → {habit.goalTitle}
            </span>
          )}
          {targetLabel && (
            <span className="text-[11px] text-muted-foreground">{targetLabel}</span>
          )}
        </div>
      </div>

      {habit.atRisk && !habit.done && (
        <Badge variant="danger" title="Do this today to protect your streak">
          <TriangleAlert size={11} /> streak at risk
        </Badge>
      )}
      {habit.currentStreak > 0 && (
        <span className="flex items-center gap-0.5 text-xs font-medium text-warning tabular-nums">
          <Flame size={12} /> {habit.currentStreak}
        </span>
      )}

      <Button
        size="sm"
        variant={habit.done ? "outline" : "default"}
        disabled={mutate.isPending}
        onClick={handleToggle}
        className="w-[74px] shrink-0"
      >
        {habit.done ? "Undo" : "Done"}
      </Button>
    </div>
  );
}
