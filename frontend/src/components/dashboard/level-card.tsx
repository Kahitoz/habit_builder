"use client";

import { Zap } from "lucide-react";
import type { LevelInfo } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function LevelCard({ level }: { level: LevelInfo }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <Zap size={14} className="text-primary" />
          Level {level.level}
        </CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {level.totalXp} XP total
        </span>
      </CardHeader>
      <CardContent>
        <Progress value={level.progress} />
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            {level.currentLevelXp} / {level.xpForNextLevel} XP
          </span>
          <span>
            {level.nextLevelXp - level.totalXp} XP to level {level.level + 1}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
