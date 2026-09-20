"use client";

import { parseISO, getDay } from "date-fns";
import type { HeatmapCell } from "@/lib/types";

const LEVEL_CLASSES = [
  "bg-secondary",
  "bg-primary/25",
  "bg-primary/40",
  "bg-primary/60",
  "bg-primary/80",
  "bg-primary",
];

/** GitHub-style month grid. `cells` should be consecutive days (one per day). */
export function CompletionHeatmap({ cells }: { cells: HeatmapCell[] }) {
  if (cells.length === 0) return null;

  // Monday-first offset for the first cell so columns are true weeks.
  const firstWeekday = (getDay(parseISO(cells[0].date)) + 6) % 7;
  const lead = Array.from({ length: firstWeekday }, (_, i) => (
    <span key={`lead-${i}`} className="h-3.5 w-3.5" />
  ));

  return (
    <div className="flex gap-[3px] overflow-x-auto pb-1">
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
        {lead}
        {cells.map((c) => (
          <span
            key={c.date}
            title={`${c.date}: ${c.completed}/${c.scheduled} scheduled`}
            className={`h-3.5 w-3.5 rounded-[3px] ${LEVEL_CLASSES[c.level] ?? LEVEL_CLASSES[0]}`}
          />
        ))}
      </div>
    </div>
  );
}
