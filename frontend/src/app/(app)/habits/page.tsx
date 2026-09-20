"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ListTodo } from "lucide-react";
import { fetchHabits, deleteHabit } from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import type { Habit } from "@/lib/types";
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
import { HabitCard } from "@/components/habits/habit-card";
import { HabitFormDialog } from "@/components/habits/habit-form";

export default function HabitsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [filter, setFilter] = React.useState<"active" | "all">("active");
  const [formOpen, setFormOpen] = React.useState(searchParams.get("new") === "1");
  const [editing, setEditing] = React.useState<Habit | null>(null);
  const [deleting, setDeleting] = React.useState<Habit | null>(null);

  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      setFormOpen(true);
      router.replace("/habits");
    }
  }, [searchParams, router]);

  const { data: habits = [], isLoading } = useQuery({
    queryKey: queryKeys.habits.list(filter === "active"),
    queryFn: () => fetchHabits(filter === "active"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHabit(id),
    onSuccess: () => {
      toast.success("Habit deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.list(true) });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.list(false) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard("today") });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.overview() });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not delete the habit."),
  });

  return (
    <div>
      <PageHeader
        title="Habits"
        description="Your daily actions — every completion earns XP."
        actions={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> New habit
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        items={[
          { value: "active", label: "Active" },
          { value: "all", label: "All" },
        ]}
        value={filter}
        onValueChange={(v) => setFilter(v as "active" | "all")}
      />

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!isLoading && habits.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <ListTodo size={20} className="text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {filter === "active" ? "No active habits" : "No habits yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a habit and start building streaks.
            </p>
          </div>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Create habit
          </Button>
        </div>
      )}

      {!isLoading && habits.length > 0 && (
        <div className="space-y-2">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onEdit={() => setEditing(habit)}
              onDelete={() => setDeleting(habit)}
            />
          ))}
        </div>
      )}

      <HabitFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <HabitFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={editing}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogTitle>Delete “{deleting?.title}”?</DialogTitle>
        <DialogDescription>
          This removes the habit and its completions from analytics. XP you already
          earned is kept. This cannot be undone.
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
