"use client";

import * as React from "react";
import { addDays, format, formatISO, parseISO, startOfWeek } from "date-fns";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { fetchReview, saveReview } from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

function todayIso(): string {
  return formatISO(new Date(), { representation: "date" });
}

export default function ReviewPage() {
  const queryClient = useQueryClient();
  const today = todayIso();

  const [weekStart, setWeekStart] = React.useState(
    formatISO(startOfWeek(parseISO(today), { weekStartsOn: 1 }), { representation: "date" }),
  );
  const [wentWell, setWentWell] = React.useState("");
  const [toChange, setToChange] = React.useState("");
  const [dirty, setDirty] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.review(weekStart),
    queryFn: () => fetchReview(weekStart),
  });

  React.useEffect(() => {
    if (data) {
      setWentWell(data.wentWell ?? "");
      setToChange(data.toChange ?? "");
      setDirty(false);
    }
  }, [data]);

  const weekEnd = addDays(parseISO(weekStart), 6);
  const isFuture = parseISO(weekStart) > parseISO(today);
  const isCurrent = weekStart === formatISO(startOfWeek(parseISO(today), { weekStartsOn: 1 }), { representation: "date" });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveReview({
        weekStart,
        ...(wentWell ? { wentWell } : {}),
        ...(toChange ? { toChange } : {}),
      }),
    onSuccess: () => {
      toast.success("Review saved");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.review(weekStart) });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save the review."),
  });

  const stats = data?.stats;

  return (
    <div>
      <PageHeader title="Weekly review" description="Five honest minutes, every week." />

      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekStart(formatISO(addDays(parseISO(weekStart), -7), { representation: "date" }))}
          title="Previous week"
        >
          <ChevronLeft size={15} />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {format(parseISO(weekStart), "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {isCurrent ? "This week" : isFuture ? "Future week" : "Past week"}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          disabled={isFuture}
          onClick={() => setWeekStart(formatISO(addDays(parseISO(weekStart), 7), { representation: "date" }))}
          title="Next week"
        >
          <ChevronRight size={15} />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {isFuture && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              You can’t review a week that hasn’t happened yet.
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>How was the week?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="went-well">Went well</Label>
                <Textarea
                  id="went-well"
                  rows={5}
                  placeholder="What went well this week? Wins, momentum, things that surprised you…"
                  value={wentWell}
                  disabled={isFuture}
                  onChange={(e) => {
                    setWentWell(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to-change">To change</Label>
                <Textarea
                  id="to-change"
                  rows={5}
                  placeholder="What should change next week? One friction to remove, one thing to try…"
                  value={toChange}
                  disabled={isFuture}
                  onChange={(e) => {
                    setToChange(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  disabled={isFuture || saveMutation.isPending || (!dirty && !data)}
                  onClick={() => saveMutation.mutate()}
                >
                  <Save size={14} />
                  {saveMutation.isPending ? "Saving…" : data ? "Save changes" : "Save review"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Week in numbers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && (
              <>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </>
            )}
            {!isLoading && (
              <>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Completions</span>
                    <span className="tabular-nums">
                      {stats?.completed ?? 0}/{stats?.scheduled ?? 0}
                    </span>
                  </div>
                  <Progress value={stats?.rate ?? 0} />
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {stats?.rate ?? 0}% completion
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                  <div>
                    <p className="text-lg font-bold tabular-nums">{stats?.xp ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">XP earned</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums">{stats?.perfectDays ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">Perfect days</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
