"use client";

import type { DayState } from "@/lib/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DAY_STATE_CONFIG: Record<
  DayState,
  { label: string; variant: BadgeProps["variant"]; hint: string }
> = {
  fresh: { label: "Fresh start", variant: "info", hint: "The day is just beginning." },
  on_track: { label: "On track", variant: "success", hint: "You are moving at a good pace." },
  ahead: { label: "Ahead of schedule", variant: "success", hint: "Everything is done early — nice." },
  falling_behind: { label: "Falling behind", variant: "warning", hint: "Catch up on today's habits." },
  at_risk: { label: "Streak at risk", variant: "danger", hint: "A streak will break if you stop now." },
  recovery: { label: "Recovery mode", variant: "warning", hint: "One done today keeps things alive." },
  perfect: { label: "Perfect day", variant: "default", hint: "Everything scheduled is done. +50 XP." },
  closed: { label: "Day closed", variant: "secondary", hint: "This day is in the past." },
};

export function dayStateConfig(state: DayState) {
  return DAY_STATE_CONFIG[state] ?? DAY_STATE_CONFIG.fresh;
}

export function DayStateBadge({ state, className }: { state: DayState; className?: string }) {
  const cfg = dayStateConfig(state);
  return (
    <Badge variant={cfg.variant} className={cn(className)} title={cfg.hint}>
      {cfg.label}
    </Badge>
  );
}

export function Ring({
  value,
  size = 92,
  stroke = 9,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        className="stroke-secondary"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        className="stroke-primary transition-all duration-500"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped / 100)}
        strokeLinecap="round"
      />
    </svg>
  );
}
