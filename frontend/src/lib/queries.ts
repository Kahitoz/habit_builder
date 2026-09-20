/** TanStack Query key factory — keeps cache keys consistent. */

export const queryKeys = {
  me: () => ["me"] as const,
  dashboard: (day: string) => ["dashboard", day] as const,
  habits: {
    all: () => ["habits"] as const,
    list: (activeOnly: boolean) =>
      ["habits", activeOnly ? "active" : "all"] as const,
    detail: (id: string) => ["habits", id] as const,
    history: (id: string) => ["habits", id, "history"] as const,
    stats: (id: string, windowDays: number) =>
      ["habits", id, "stats", windowDays] as const,
  },
  goals: {
    all: () => ["goals"] as const,
    list: (status?: string) => ["goals", status ?? "all"] as const,
    detail: (id: string) => ["goals", id] as const,
  },
  review: (weekStart?: string) => ["reviews", weekStart ?? "current"] as const,
  activity: () => ["activity"] as const,
  analytics: {
    overview: () => ["analytics", "overview"] as const,
    consistency: (days: number) => ["analytics", "consistency", days] as const,
    xp: (days: number) => ["analytics", "xp", days] as const,
    categories: () => ["analytics", "categories"] as const,
    heatmap: (months: number) => ["analytics", "heatmap", months] as const,
  },
};

/** Invalidation helpers: complete a habit or change a day's completions. */
export const completeKeys = [
  queryKeys.dashboard("today"),
  queryKeys.habits.all(),
  queryKeys.goals.all(),
  queryKeys.analytics.overview(),
] as const;
