"use client";

import { addDays, format, parseISO, startOfDay } from "date-fns";

/**
 * GitHub-style completion strip. `dates` is a set of ISO day strings that were
 * completed. Renders the trailing `days` days ending at `end` (default today).
 */
export function HeatmapStrip({
  dates,
  days = 90,
  end,
}: {
  dates: Set<string> | string[];
  days?: number;
  end?: string;
}) {
  const completed = new Set(dates);
  const endDay = startOfDay(end ? parseISO(end) : new Date());
  const cells = Array.from({ length: days }, (_, i) => {
    const day = addDays(endDay, -(days - 1 - i));
    return {
      iso: format(day, "yyyy-MM-dd"),
      done: completed.has(format(day, "yyyy-MM-dd")),
    };
  });

  return (
    <div className="flex flex-wrap gap-[3px]">
      {cells.map((c) => (
        <span
          key={c.iso}
          title={c.iso}
          className={
            "h-3 w-3 rounded-[3px] " +
            (c.done ? "bg-primary/80" : "bg-secondary")
          }
        />
      ))}
    </div>
  );
}
