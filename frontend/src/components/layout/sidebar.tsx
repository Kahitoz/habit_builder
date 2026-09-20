"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Settings,
  Target,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { logout } from "@/lib/fetchers";
import { useAuthStore } from "@/lib/store";
import { queryKeys } from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/habits", label: "Habits", icon: ListTodo },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/review", label: "Weekly Review", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const { data: freshUser } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => import("@/lib/fetchers").then((m) => m.fetchMe()),
  });
  const displayName = freshUser?.displayName ?? user?.displayName ?? "You";
  const initials = displayName.trim().slice(0, 2).toUpperCase() || "?";

  const handleLogout = async () => {
    try {
      await logout(refreshToken);
    } catch {
      // Best effort — clear the session regardless.
    }
    clearAuth();
    router.replace("/login");
  };

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-card">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-4 py-4 text-sm font-bold tracking-tight"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-black">
          LF
        </span>
        LifeForge
      </Link>

      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email ?? ""}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
