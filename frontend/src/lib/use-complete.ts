"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { completeHabit, uncompleteHabit } from "@/lib/fetchers";
import { queryKeys } from "@/lib/queries";

/**
 * Completes/undoes a habit for a given day and refreshes everything that
 * depends on completions (dashboard, habit lists, goals, analytics).
 */
export function useCompleteMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { habitId: string; done: boolean }) => {
      if (args.done) return uncompleteHabit(args.habitId, date);
      return completeHabit(args.habitId);
    },
    onMutate: () => {},
    onSuccess: () => {
      toast.success("Logged!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not update this habit.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.list(true) });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.list(false) });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.overview() });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.consistency(90) });
    },
  });
}
