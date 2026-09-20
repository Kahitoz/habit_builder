"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import type { GoalSummary } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function GoalProgressCard({ goal }: { goal: GoalSummary }) {
  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block rounded-md border border-border p-3 transition-colors hover:bg-accent/50"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{goal.title}</p>
        <Badge variant="outline" className="shrink-0 capitalize">
          {goal.category}
        </Badge>
      </div>
      <Progress value={goal.progress} />
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular-nums">{goal.progress}%</span>
        {goal.nextMilestone ? (
          <span className="flex items-center gap-1 truncate">
            <Flag size={11} />
            <span className="truncate">{goal.nextMilestone.title}</span>
          </span>
        ) : (
          <span>{goal.habitCount} habit{goal.habitCount === 1 ? "" : "s"}</span>
        )}
      </div>
    </Link>
  );
}
