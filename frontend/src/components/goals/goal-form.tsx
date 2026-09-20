"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { createGoal, updateGoal } from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import { GOAL_CATEGORIES, type Goal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = [
  "health",
  "mind",
  "career",
  "finance",
  "relationships",
  "creative",
  "other",
] as const;

const milestoneSchema = z.object({
  title: z.string().min(1, "Milestone needs a title").max(200),
  targetDate: z.string().optional(),
});

const goalSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  category: z.enum(CATEGORIES),
  targetDate: z.string().optional().or(z.literal("")),
  milestones: z.array(milestoneSchema),
});

type FormValues = z.infer<typeof goalSchema>;

const DEFAULTS: FormValues = {
  title: "",
  description: "",
  category: "health",
  targetDate: "",
  milestones: [],
};

export interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Goal | null;
  /** Only used when creating: milestone rows are seeded from the goal. */
  onSaved?: (goalId: string) => void;
}

export function GoalFormDialog({
  open,
  onOpenChange,
  initial = null,
  onSaved,
}: GoalFormDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: DEFAULTS,
  });

  const milestones = watch("milestones");

  React.useEffect(() => {
    if (!open) return;
    if (initial) {
      reset({
        title: initial.title,
        description: initial.description ?? "",
        category: initial.category,
        targetDate: initial.targetDate ?? "",
        milestones: initial.milestones.map((m) => ({
          title: m.title,
          targetDate: m.targetDate ?? "",
        })),
      });
    } else {
      reset(DEFAULTS);
    }
  }, [open, initial, reset]);

  const setMilestone = (index: number, field: "title" | "targetDate", value: string) => {
    const next = milestones.map((m, i) => (i === index ? { ...m, [field]: value } : m));
    setValue("milestones", next, { shouldValidate: true });
  };

  const addMilestone = () => {
    setValue("milestones", [...(milestones ?? []), { title: "", targetDate: "" }], {
      shouldValidate: true,
    });
  };

  const removeMilestone = (index: number) => {
    setValue(
      "milestones",
      (milestones ?? []).filter((_, i) => i !== index),
      { shouldValidate: true },
    );
  };

  const onSubmit = handleSubmit(async (values) => {
    const cleanMilestones = values.milestones
      .filter((m) => m.title.trim().length > 0)
      .map((m, i) => ({
        title: m.title.trim(),
        targetDate: m.targetDate || undefined,
        sortOrder: i,
      }));
    try {
      if (initial) {
        await updateGoal(initial.id, {
          title: values.title.trim(),
          description: values.description?.trim() || undefined,
          category: values.category,
          targetDate: values.targetDate || undefined,
        });
        toast.success("Goal updated");
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(initial.id) });
        onOpenChange(false);
        onSaved?.(initial.id);
      } else {
        const saved = await createGoal({
          title: values.title.trim(),
          description: values.description?.trim() || undefined,
          category: values.category,
          targetDate: values.targetDate || undefined,
          milestones: cleanMilestones,
        });
        toast.success("Goal created");
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
        onOpenChange(false);
        onSaved?.(saved.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the goal.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle>{initial ? "Edit goal" : "New goal"}</DialogTitle>
      <DialogDescription>
        A life goal organizes your habits and milestones. Completing it earns 1000 XP.
      </DialogDescription>

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="goal-title">Title</Label>
          <Input id="goal-title" placeholder="Run a half marathon" {...register("title")} />
          {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="goal-desc">Description (optional)</Label>
          <Textarea id="goal-desc" rows={2} placeholder="Why this goal matters" {...register("description")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="goal-category">Category</Label>
            <Select id="goal-category" {...register("category")}>
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-date">Target date</Label>
            <Input id="goal-date" type="date" {...register("targetDate")} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Milestones</Label>
            <Button type="button" variant="ghost" size="sm" onClick={addMilestone}>
              <Plus size={13} /> Add
            </Button>
          </div>
          {(milestones ?? []).map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={`Milestone ${i + 1}`}
                className="flex-1"
                value={m.title}
                onChange={(e) => setMilestone(i, "title", e.target.value)}
                onBlur={() => errors.milestones?.[i]}
              />
              <Input
                type="date"
                className="w-36"
                value={m.targetDate}
                onChange={(e) => setMilestone(i, "targetDate", e.target.value)}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeMilestone(i)} title="Remove">
                <Trash2 size={13} className="text-danger" />
              </Button>
            </div>
          ))}
          {errors.milestones && (
            <p className="text-xs text-danger">
              {errors.milestones[0]?.title?.message ?? "Fix milestone rows."}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : initial ? "Save changes" : "Create goal"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
