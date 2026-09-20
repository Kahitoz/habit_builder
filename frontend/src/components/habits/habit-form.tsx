"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import {
  createHabit,
  fetchGoals,
  updateHabit,
} from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";
import {
  DIFFICULTIES,
  FREQUENCY_TYPES,
  HABIT_COLORS,
  HABIT_ICONS,
  WEEK_DAYS,
  type Habit,
  type HabitCreatePayload,
} from "@/lib/types";
import { HabitIcon } from "@/components/habit-icon";
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
import { cn } from "@/lib/utils";

const habitSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000).optional().or(z.literal("")),
    icon: z.string(),
    color: z.string(),
    goalId: z.string().optional().or(z.literal("")),
    frequencyType: z.enum(["daily", "custom_days", "times_per_week"]),
    frequencyDays: z.array(z.number().min(1).max(7)),
    frequencyTarget: z.number().int().min(1).max(7),
    target: z
      .number({ message: "Enter a number" })
      .positive("Must be positive")
      .max(10000, "Max 10000"),
    unit: z.string().max(24).optional().or(z.literal("")),
    difficulty: z.enum(["easy", "medium", "hard"]),
  })
  .superRefine((value, ctx) => {
    if (value.frequencyType === "custom_days" && value.frequencyDays.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["frequencyDays"],
        message: "Pick at least one weekday",
      });
    }
  });

type FormValues = z.infer<typeof habitSchema>;

const DEFAULTS: FormValues = {
  title: "",
  description: "",
  icon: "droplets",
  color: HABIT_COLORS[0],
  goalId: "",
  frequencyType: "daily",
  frequencyDays: [],
  frequencyTarget: 3,
  target: 1,
  unit: "",
  difficulty: "medium",
};

export interface HabitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set the dialog edits this habit; otherwise it creates a new one. */
  initial?: Habit | null;
  onSaved?: (habitId: string) => void;
}

export function HabitFormDialog({
  open,
  onOpenChange,
  initial = null,
  onSaved,
}: HabitFormDialogProps) {
  const queryClient = useQueryClient();
  const { data: goals = [] } = useQuery({
    queryKey: queryKeys.goals.all(),
    queryFn: () => fetchGoals(),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(habitSchema),
    defaultValues: DEFAULTS,
  });

  const frequencyType = watch("frequencyType");
  const frequencyDays = watch("frequencyDays");
  const color = watch("color");
  const icon = watch("icon");

  React.useEffect(() => {
    if (!open) return;
    if (initial) {
      reset({
        title: initial.title,
        description: initial.description ?? "",
        icon: initial.icon ?? "droplets",
        color: initial.color ?? HABIT_COLORS[0],
        goalId: initial.goalId ?? "",
        frequencyType: initial.frequencyType,
        frequencyDays: initial.frequencyDays ?? [],
        frequencyTarget: initial.frequencyTarget ?? 3,
        target: initial.target,
        unit: initial.unit ?? "",
        difficulty: initial.difficulty,
      });
    } else {
      reset(DEFAULTS);
    }
  }, [open, initial, reset]);

  const toggleDay = (day: number) => {
    const current = watch("frequencyDays") ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    setValue("frequencyDays", next, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    const payload: HabitCreatePayload = {
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      icon: values.icon,
      color: values.color,
      goalId: values.goalId || null,
      frequencyType: values.frequencyType,
      frequencyDays: values.frequencyType === "custom_days" ? values.frequencyDays : undefined,
      frequencyTarget:
        values.frequencyType === "times_per_week" ? values.frequencyTarget : undefined,
      target: values.target,
      unit: values.unit?.trim() || undefined,
      difficulty: values.difficulty,
    };
    try {
      const saved = initial
        ? await updateHabit(initial.id, payload)
        : await createHabit(payload);
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.list(true) });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.list(false) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard("today") });
      if (payload.goalId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      }
      toast.success(initial ? "Habit updated" : "Habit created");
      onOpenChange(false);
      onSaved?.(saved.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save the habit.",
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle>{initial ? "Edit habit" : "New habit"}</DialogTitle>
      <DialogDescription>
        {initial
          ? "Changes apply to the habit's schedule, XP value and streaks."
          : "Habits earn XP every time you complete them and build streaks."}
      </DialogDescription>

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="habit-title">Title</Label>
          <Input id="habit-title" placeholder="Drink water" {...register("title")} />
          {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="habit-desc">Notes (optional)</Label>
          <Textarea
            id="habit-desc"
            rows={2}
            placeholder="Why it matters"
            {...register("description")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-1">
              {HABIT_ICONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setValue("icon", name)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded border transition-colors",
                    icon === name
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border hover:bg-accent",
                  )}
                  title={name}
                >
                  <HabitIcon icon={name} size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue("color", c)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    color === c ? "scale-110 border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="habit-goal">Goal</Label>
            <Select id="habit-goal" {...register("goalId")}>
              <option value="">None</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="habit-frequency">Frequency</Label>
            <Select
              id="habit-frequency"
              {...register("frequencyType")}
            >
              {FREQUENCY_TYPES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {frequencyType === "custom_days" && (
          <div className="space-y-1.5">
            <Label>Weekdays</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEK_DAYS.map((d) => {
                const active = frequencyDays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={cn(
                      "h-8 w-10 rounded-md border text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
            {errors.frequencyDays && (
              <p className="text-xs text-danger">{errors.frequencyDays.message}</p>
            )}
          </div>
        )}

        {frequencyType === "times_per_week" && (
          <div className="space-y-1.5">
            <Label htmlFor="habit-count">Times per week</Label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue("frequencyTarget", n)}
                  className={cn(
                    "h-8 w-8 rounded-md border text-xs font-medium transition-colors",
                    watch("frequencyTarget") === n
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="habit-target">Target</Label>
            <Input id="habit-target" type="number" min={0} step="any" {...register("target", { valueAsNumber: true })} />
            {errors.target && <p className="text-xs text-danger">{errors.target.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="habit-unit">Unit (optional)</Label>
            <Input id="habit-unit" placeholder="e.g. min, pages, ml" {...register("unit")} />
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setValue("difficulty", d.value)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                    watch("difficulty") === d.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                  title={`${d.xp} XP per completion`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : initial ? "Save changes" : "Create habit"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
