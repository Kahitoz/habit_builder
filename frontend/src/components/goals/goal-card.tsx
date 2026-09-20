"use client";

import Link from "next/link";
import { Calendar, Flag, ListTodo, Pencil, Trash2 } from "lucide-react";
import type { Goal } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const STATUS_STYLES: Record<Goal["status"], "success" | "warning" | "info" | "secondary"> = {
  active: "success",
  paused: "warning",
  completed: "info",
  archived: "secondary",
};

export function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = goal.milestones.filter((m) => m.completed).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/goals/${goal.id}`}
          className="min-w-0 truncate text-sm font-semibold hover:text-primary"
        >
          {goal.title}
        </Link>
        <Badge variant={STATUS_STYLES[goal.status]} className="capitalize">
          {goal.status}
        </Badge>
      </div>

      <Progress value={goal.progress} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="capitalize">
          {goal.category}
        </Badge>
        <span className="tabular-nums">{goal.progress}%</span>
        {goal.milestones.length > 0 && (
          <span className="flex items-center gap-1">
            <Flag size={11} />
            {done}/{goal.milestones.length}
          </span>
        )}
        {goal.habitCount > 0 && (
          <span className="flex items-center gap-1">
            <ListTodo size={11} />
            {goal.habitCount}
          </span>
        )}
        {goal.targetDate && (
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {formatDate(goal.targetDate)}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-end gap-1 border-t border-border pt-2">
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
