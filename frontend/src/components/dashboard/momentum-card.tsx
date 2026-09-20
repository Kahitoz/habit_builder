"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Momentum } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function MomentumCard({ momentum }: { momentum: Momentum }) {
  const TrendIcon =
    momentum.trend === "up"
      ? ArrowUpRight
      : momentum.trend === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Momentum</CardTitle>
        <span
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            momentum.trend === "up" && "text-success",
            momentum.trend === "down" && "text-danger",
            momentum.trend === "flat" && "text-muted-foreground",
          )}
        >
          <TrendIcon size={13} />
          {momentum.change > 0 ? `+${momentum.change}` : momentum.change}
        </span>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-end gap-2">
          <span className="text-3xl font-bold tabular-nums">{momentum.score}</span>
          <span className="pb-1 text-xs text-muted-foreground">/ 100</span>
        </div>
        <Progress value={momentum.score} />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-secondary px-2 py-1.5">
            <p className="text-sm font-semibold tabular-nums">{momentum.factors.consistency7d}%</p>
            <p className="text-[10px] text-muted-foreground">7-day rate</p>
          </div>
          <div className="rounded-md bg-secondary px-2 py-1.5">
            <p className="text-sm font-semibold tabular-nums">{momentum.factors.bestStreak}</p>
            <p className="text-[10px] text-muted-foreground">best streak</p>
          </div>
          <div className="rounded-md bg-secondary px-2 py-1.5">
            <p className="text-sm font-semibold tabular-nums">{momentum.factors.goalProgress}%</p>
            <p className="text-[10px] text-muted-foreground">goals</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
