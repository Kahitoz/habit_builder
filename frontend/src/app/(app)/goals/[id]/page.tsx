"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Flag,
  ListTodo,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  completeGoal,
  createMilestone,
  deleteGoal,
  deleteMilestone,
  fetchGoal,
  updateGoal,
  updateMilestone,
} from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import type { Goal, Milestone } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalFormDialog } from "@/components/goals/goal-form";
import { cn } from "@/lib/utils";

function MilestoneEditDialog({
  open,
  onOpenChange,
  milestone,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: Milestone | null;
  onSave: (title: string, targetDate: string) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [targetDate, setTargetDate] = React.useState("");

  React.useEffect(() => {
    if (open && milestone) {
      setTitle(milestone.title);
      setTargetDate(milestone.targetDate ?? "");
    }
  }, [open, milestone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle>Edit milestone</DialogTitle>
      <DialogDescription>Update the title and target date.</DialogDescription>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) onSave(title.trim(), targetDate);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ms-title">Title</Label>
          <Input id="ms-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ms-date">Target date</Label>
          <Input id="ms-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit">{milestone?.completed ? "Save" : "Save"}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export default function GoalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [newMsOpen, setNewMsOpen] = React.useState(false);
  const [newMsTitle, setNewMsTitle] = React.useState("");
  const [newMsDate, setNewMsDate] = React.useState("");
  const [editingMs, setEditingMs] = React.useState<Milestone | null>(null);
  const [deletingMs, setDeletingMs] = React.useState<Milestone | null>(null);

  const { data: goal, isLoading } = useQuery({
    queryKey: queryKeys.goals.detail(id),
    queryFn: () => fetchGoal(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard("today") });
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.overview() });
  };

  const statusMutation = useMutation({
    mutationFn: (status: Goal["status"]) => updateGoal(id, { status }),
    onSuccess: () => {
      toast.success("Goal updated");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update the goal."),
  });

  const completeMutation = useMutation({
    mutationFn: () => completeGoal(id),
    onSuccess: () => {
      toast.success("Goal complete! +1000 XP");
      setCompleteOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not complete the goal."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGoal(id),
    onSuccess: () => {
      toast.success("Goal deleted");
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      router.push("/goals");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete the goal."),
  });

  const addMilestoneMutation = useMutation({
    mutationFn: () =>
      createMilestone(id, { title: newMsTitle.trim(), targetDate: newMsDate || undefined }),
    onSuccess: () => {
      toast.success("Milestone added");
      setNewMsOpen(false);
      setNewMsTitle("");
      setNewMsDate("");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add the milestone."),
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: (m: Milestone) => updateMilestone(m.id, { completed: !m.completed }),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update the milestone."),
  });

  const editMilestoneMutation = useMutation({
    mutationFn: ({ milestone, title, targetDate }: { milestone: Milestone; title: string; targetDate: string }) =>
      updateMilestone(milestone.id, { title, targetDate: targetDate || undefined }),
    onSuccess: () => {
      toast.success("Milestone updated");
      setEditingMs(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update the milestone."),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: (mid: string) => deleteMilestone(mid),
    onSuccess: () => {
      toast.success("Milestone removed");
      setDeletingMs(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove the milestone."),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Goal not found.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push("/goals")}>
          <ArrowLeft size={14} /> Back to goals
        </Button>
      </div>
    );
  }

  const doneCount = goal.milestones.filter((m) => m.completed).length;
  const isCompleted = goal.status === "completed";

  return (
    <div>
      <button
        onClick={() => router.push("/goals")}
        className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={13} /> All goals
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{goal.title}</h1>
            {!isCompleted && (
              <Select
                value={goal.status}
                onChange={(e) => statusMutation.mutate(e.target.value as Goal["status"])}
                disabled={statusMutation.isPending}
                className="w-28"
                aria-label="Goal status"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </Select>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="capitalize">
              {goal.category}
            </Badge>
            <Badge
              variant={
                goal.status === "active"
                  ? "success"
                  : goal.status === "completed"
                    ? "info"
                    : goal.status === "paused"
                      ? "warning"
                      : "secondary"
              }
              className="capitalize"
            >
              {goal.status}
            </Badge>
            {goal.targetDate && <span>target {formatDate(goal.targetDate)}</span>}
            {goal.habitCount > 0 && (
              <span className="flex items-center gap-1">
                <ListTodo size={11} /> {goal.habitCount} habit{goal.habitCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {goal.status !== "archived" && goal.status !== "completed" && (
            <Button size="sm" variant="outline" onClick={() => setCompleteOpen(true)}>
              <CheckCircle2 size={14} /> Mark complete
            </Button>
          )}
          {isCompleted && (
            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("active")}>
              <RotateCcw size={14} /> Reopen
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} title="Edit">
            <Pencil size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)} title="Delete">
            <Trash2 size={15} className="text-danger" />
          </Button>
        </div>
      </div>

      {goal.description && (
        <p className="mt-3 text-sm text-muted-foreground">{goal.description}</p>
      )}

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Progress</CardTitle>
          <span className="text-sm font-semibold tabular-nums">{goal.progress}%</span>
        </CardHeader>
        <CardContent>
          <Progress value={goal.progress} />
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{doneCount} of {goal.milestones.length} milestones</span>
            {goal.targetDate && (
              <span>{format(parseISO(goal.targetDate), "MMM yyyy")}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Milestones</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setNewMsOpen(true)}>
            <Plus size={13} /> Add
          </Button>
        </CardHeader>
        <CardContent>
          {goal.milestones.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No milestones yet — break the goal into steps.
            </p>
          )}
          <div className="space-y-2">
            {goal.milestones.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border border-border px-3 py-2.5",
                  m.completed && "bg-primary/5",
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  title={m.completed ? "Mark incomplete" : "Mark complete"}
                  disabled={toggleMilestoneMutation.isPending}
                  onClick={() => toggleMilestoneMutation.mutate(m)}
                >
                  <CheckCircle2
                    size={17}
                    className={m.completed ? "text-success" : "text-muted-foreground"}
                  />
                </Button>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      m.completed && "text-muted-foreground",
                    )}
                  >
                    {m.title}
                  </p>
                  {m.targetDate && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(m.targetDate)}
                      {m.completed && m.completedAt && (
                        <span> · done {format(parseISO(m.completedAt), "MMM d")}</span>
                      )}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditingMs(m)}>
                  <Pencil size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete"
                  onClick={() => setDeletingMs(m)}
                >
                  <Trash2 size={13} className="text-danger" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <GoalFormDialog open={editOpen} onOpenChange={setEditOpen} initial={goal} />

      <Dialog open={newMsOpen} onOpenChange={setNewMsOpen}>
        <DialogTitle>New milestone</DialogTitle>
        <DialogDescription>
          A checkpoint along the way. Completing it earns 200 XP.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newMsTitle.trim()) addMilestoneMutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="nms-title">Title</Label>
            <Input
              id="nms-title"
              placeholder="First 5k"
              value={newMsTitle}
              onChange={(e) => setNewMsTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nms-date">Target date (optional)</Label>
            <Input
              id="nms-date"
              type="date"
              value={newMsDate}
              onChange={(e) => setNewMsDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewMsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMilestoneMutation.isPending || !newMsTitle.trim()}>
              {addMilestoneMutation.isPending ? "Adding…" : "Add milestone"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <MilestoneEditDialog
        open={editingMs !== null}
        onOpenChange={(open) => !open && setEditingMs(null)}
        milestone={editingMs}
        onSave={(title, targetDate) =>
          editingMs && editMilestoneMutation.mutate({ milestone: editingMs, title, targetDate })
        }
      />

      <Dialog
        open={deletingMs !== null}
        onOpenChange={(open) => !open && setDeletingMs(null)}
      >
        <DialogTitle>Remove “{deletingMs?.title}”?</DialogTitle>
        <DialogDescription>
          {deletingMs?.completed
            ? "This milestone is completed — its 200 XP will be reversed."
            : "This cannot be undone."}
        </DialogDescription>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDeletingMs(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMilestoneMutation.isPending}
            onClick={() => deletingMs && deleteMilestoneMutation.mutate(deletingMs.id)}
          >
            {deleteMilestoneMutation.isPending ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogTitle>Complete “{goal.title}”?</DialogTitle>
        <DialogDescription>
          {goal.status === "paused"
            ? "The goal is paused — it will be activated and completed."
            : "This marks every goal work as done."}
          You earn 1000 XP. You can reopen the goal later.
        </DialogDescription>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setCompleteOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
          >
            {completeMutation.isPending ? "Completing…" : "Complete goal"}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTitle>Delete “{goal.title}”?</DialogTitle>
        <DialogDescription>
          This removes the goal and its milestones. Attached habits stay. XP you
          already earned is kept. This cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
