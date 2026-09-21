"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  ListTodo,
  Plus,
  Search,
  Settings,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "@/lib/palette-store";

export const PALETTE_ACTIONS = [
  { href: "/dashboard", label: "Go to Dashboard", icon: LayoutDashboard },
  { href: "/habits", label: "Browse Habits", icon: ListTodo },
  { href: "/habits?new=1", label: "Create Habit", icon: Plus },
  { href: "/goals", label: "Browse Goals", icon: Target },
  { href: "/goals?new=1", label: "Create Goal", icon: Plus },
  { href: "/analytics", label: "Open Analytics", icon: BarChart3 },
  { href: "/activity", label: "View Activity Feed", icon: Activity },
  { href: "/review", label: "Weekly Review", icon: ClipboardList },
  { href: "/settings", label: "Open Settings", icon: Settings },
] as const;

export function CommandPalette() {
  const { open, setOpen, filter, setFilter } = useCommandPalette();
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [highlighted, setHighlighted] = React.useState(0);

  React.useEffect(() => {
    if (open) {
      setFilter("");
      setHighlighted(0);
      // Focus after the overlay mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, setFilter]);

  if (!open) return null;

  const q = filter.trim().toLowerCase();
  const visible = PALETTE_ACTIONS.filter((a) => a.label.toLowerCase().includes(q));

  const run = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, visible.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    }
    if (e.key === "Enter" && visible[highlighted]) run(visible[highlighted].href);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[6vh] sm:p-4 sm:pt-[15vh]">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={15} className="text-muted-foreground" />
          <input
            ref={inputRef}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={onKey}
            placeholder="Jump to…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-1">
          {visible.map((action, i) => (
            <li key={action.href + action.label}>
              <button
                type="button"
                onClick={() => run(action.href)}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm",
                  i === highlighted ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <action.icon size={15} className="text-muted-foreground" />
                {action.label}
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              No actions match “{filter}”
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
