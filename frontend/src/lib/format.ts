import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { WEEK_DAYS, type Habit } from "./types";

export function formatDate(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy");
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy HH:mm");
}

export function relativeTime(iso: string): string {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
}

/** Human-readable schedule label for a habit. */
export function frequencyLabel(habit: Pick<Habit, "frequencyType" | "frequencyDays" | "frequencyTarget">): string {
  switch (habit.frequencyType) {
    case "daily":
      return "Every day";
    case "times_per_week":
      return `${habit.frequencyTarget ?? 0}× / week`;
    case "custom_days": {
      const days = (habit.frequencyDays ?? []).slice().sort((a, b) => a - b);
      if (days.length === 0) return "—";
      if (days.length === 7) return "Every day";
      return days.map((d) => WEEK_DAYS[d - 1]?.short ?? "?").join(" ");
    }
    default:
      return "—";
  }
}

/** "5 min", "1", "1.5 pages" — compact target display. */
export function targetLabel(target: number, unit: string | null): string {
  if (target <= 1) return "";
  const value = Number.isInteger(target) ? String(target) : target.toFixed(1);
  return unit ? `${value} ${unit}` : value;
}
