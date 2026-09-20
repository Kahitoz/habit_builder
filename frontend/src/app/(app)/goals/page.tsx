"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Target } from "lucide-react";
import { fetchGoals, deleteGoal } from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import type { Goal } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalFormDialog } from "@/components/goals/goal-form";

type Filter = "all" | "active" | "paused" | "completed";

export default function GoalsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [filter, setFilter] = React.useState<Filter>("all");
  const [formOpen, setFormOpen] = React.useState(searchParams.get("new") === "1");
  const [editing, setEditing] = React.useState<Goal | null>(null);
  const [deleting, setDeleting] = React.useState<Goal | null>(null);

  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      setFormOpen(true);
      router.replace("/goals");
    }
  }, [searchParams, router]);

  const { data: goals = [], isLoading } = useQuery({
    queryKey: queryKeys.goals.list(filter === "all" ? undefined : filter),
    queryFn: () => fetchGoals(filter === "all" ? undefined : filter),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => {
      toast.success("Goal deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard("today") });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.overview() });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all() });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not delete the goal."),
  });

  return (
    <div>
      <PageHeader
        title="Goals"
        description="Life goals — milestones keep them moving."
        actions={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> New goal
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        items={[
          { value: "active", label: "Active" },
          { value: "paused", label: "Paused" },
          { value: "completed", label: "Completed" },
          { value: "all", label: "All" },
        ]}
        value={filter}
        onValueChange={(v) => setFilter(v as Filter)}
      />

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!isLoading && goals.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Target size={20} className="text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium">No goals here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Set a life goal, break it into milestones, and attach habits.
            </p>
          </div>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Create goal
          </Button>
        </div>
      )}

      {!isLoading && goals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => setEditing(goal)}
              onDelete={() => setDeleting(goal)}
            />
          ))}
        </div>
      )}

      <GoalFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <GoalFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={editing}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogTitle>Delete “{deleting?.title}”?</DialogTitle>
        <DialogDescription>
          This removes the goal and its milestones. Habits attached to it stay
          (they become unlinked). XP you already earned is kept.
        </DialogDescription>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleting && deleteMutation.mutate(deleting.id)}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
