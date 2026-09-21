"use client";

import * as React from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Flame,
  ListTodo,
  PartyPopper,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import {
  fetchCategories,
  fetchConsistency,
  fetchHeatmap,
  fetchOverview,
  fetchXp,
} from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import type { CategoryStat } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CompletionHeatmap } from "@/components/analytics/completion-heatmap";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
          <Icon size={16} className="text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight tabular-nums">{value}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {label}
            {hint ? ` · ${hint}` : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
} as const;

export default function AnalyticsPage() {
  const { data: overview } = useQuery({
    queryKey: queryKeys.analytics.overview(),
    queryFn: fetchOverview,
  });
  const { data: consistency = [], isLoading: cLoading } = useQuery({
    queryKey: queryKeys.analytics.consistency(90),
    queryFn: () => fetchConsistency(90),
  });
  const { data: xp = [], isLoading: xLoading } = useQuery({
    queryKey: queryKeys.analytics.xp(90),
    queryFn: () => fetchXp(90),
  });
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.analytics.categories(),
    queryFn: fetchCategories,
  });
  const { data: heatmap = [], isLoading: hLoading } = useQuery({
    queryKey: queryKeys.analytics.heatmap(3),
    queryFn: () => fetchHeatmap(3),
  });

  return (
    <div>
      <PageHeader title="Analytics" description="Your progress, quantified." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ListTodo} label="Total completions" value={overview ? String(overview.totalCompletions) : "–"} />
        <StatCard
          icon={Flame}
          label="Best current streak"
          value={overview ? `${overview.bestCurrentStreak}` : "–"}
        />
        <StatCard
          icon={Target}
          label="Active goals"
          value={overview ? `${overview.activeGoals}` : "–"}
          hint={`${overview?.completedGoals ?? 0} done`}
        />
        <StatCard
          icon={PartyPopper}
          label="Perfect days (90d)"
          value={overview ? String(overview.perfectDays90d) : "–"}
        />
        <StatCard
          icon={Zap}
          label="Total XP"
          value={overview ? String(overview.totalXp) : "–"}
        />
        <StatCard
          icon={ListTodo}
          label="Active habits"
          value={overview ? `${overview.activeHabits}` : "–"}
          hint={`${overview?.totalHabits ?? 0} total`}
        />
        <StatCard icon={Trophy} label="Goals completed" value={overview ? String(overview.completedGoals) : "–"} />
        <StatCard icon={TrendingUp} label="Habits" value={overview ? String(overview.totalHabits) : "–"} hint="all time" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completion rate — last 90 days</CardTitle>
          </CardHeader>
          <CardContent>
            {cLoading && <Skeleton className="h-56 w-full" />}
            {!cLoading && consistency.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">No data yet.</p>
            )}
            {!cLoading && consistency.length > 0 && (
              <ResponsiveContainer width="100%" height={224}>
                <ComposedChart data={consistency} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => format(parseISO(d), "d MMM")}
                    tick={AXIS}
                    interval={13}
                    minTickGap={24}
                  />
                  <YAxis domain={[0, 100]} tick={AXIS} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(d) => format(parseISO(String(d)), "d MMM yyyy")}
                    formatter={(value) => [`${value ?? 0}%`, "rate"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.15)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>XP earned — last 90 days</CardTitle>
          </CardHeader>
          <CardContent>
            {xLoading && <Skeleton className="h-56 w-full" />}
            {!xLoading && xp.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">No data yet.</p>
            )}
            {!xLoading && xp.length > 0 && (
              <ResponsiveContainer width="100%" height={224}>
                <ComposedChart data={xp} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => format(parseISO(d), "d MMM")}
                    tick={AXIS}
                    interval={13}
                    minTickGap={24}
                  />
                  <YAxis yAxisId="xp" tick={AXIS} />
                  <YAxis yAxisId="cum" orientation="right" tick={AXIS} width={40} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(d) => format(parseISO(String(d)), "d MMM yyyy")}
                  />
                  <Bar yAxisId="xp" dataKey="xp" fill="hsl(var(--primary) / 0.5)" isAnimationActive={false} />
                  <Line
                    yAxisId="cum"
                    type="monotone"
                    dataKey="cumulative"
                    stroke="hsl(var(--info))"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Completion heatmap — last 3 months</CardTitle>
        </CardHeader>
        <CardContent>
          {hLoading && <Skeleton className="h-32 w-full" />}
          {!hLoading && heatmap.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No scheduled days yet.</p>
          )}
          {!hLoading && heatmap.length > 0 && <CompletionHeatmap cells={heatmap} />}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">Nothing to show yet.</p>
          )}
          <div className="space-y-3">
            {categories.map((c: CategoryStat) => (
              <div key={c.category}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium capitalize">{c.category}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {c.goals} goal{c.goals === 1 ? "" : "s"} · {c.habits} habit
                    {c.habits === 1 ? "" : "s"} · {c.completions30d} done (30d)
                  </span>
                </div>
                <Progress value={c.avgGoalProgress} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
