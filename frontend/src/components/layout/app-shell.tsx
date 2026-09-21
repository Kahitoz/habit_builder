"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Command, Menu, Search } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useCommandPalette } from "@/lib/palette-store";
import { CommandPalette } from "@/components/layout/command-palette";
import { MobileNavDrawer } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { setOpen } = useCommandPalette();

  // The persisted auth state rehydrates around client bootstrap. During the
  // React hydration commit, useSyncExternalStore deliberately serves the
  // server snapshot (the initial, unauthenticated state), so an auth
  // decision made in that first render would bounce a valid session to
  // /login on every hard reload. We therefore never decide while `hydrated`
  // is false: it starts false and is flipped in an effect, i.e. only after
  // the commit that may still be serving the server snapshot. By the next
  // render the hook values come from the rehydrated client state.
  const [hydrated, setHydrated] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Close the mobile drawer if the viewport grows to the desktop breakpoint.
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    // If storage was unavailable when the store was created, the persist
    // API does not exist; the in-memory state is already the truth.
    const persistApi = useAuthStore.persist;
    if (!persistApi || persistApi.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persistApi.onFinishHydration(() => setHydrated(true));
  }, []);

  // Auth guard: redirect unauthenticated users to the login page.
  React.useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace("/login");
    }
  }, [accessToken, hydrated, router]);

  // Cmd/Ctrl+K opens the command palette.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // While the persisted auth state is still loading, or the user isn't
  // authenticated, show a neutral shell (no page content or layout chrome).
  if (!hydrated || !accessToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
        <Sidebar fluid onNavigate={() => setMobileNavOpen(false)} />
      </MobileNavDrawer>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar: hamburger, brand, quick-actions search */}
        <header className="flex items-center justify-between border-b border-border px-3 py-2.5 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="-ml-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Menu size={20} />
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-bold tracking-tight"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-black">
              LF
            </span>
            LifeForge
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Quick actions"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Search size={18} />
          </button>
        </header>

        {/* Desktop top bar */}
        <div className="hidden items-center justify-between border-b border-border px-6 py-2 md:flex">
          <p className="text-xs text-muted-foreground">{todayLabel}</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Quick actions
            <span className="flex items-center gap-0.5 rounded border border-border px-1 py-0.5 text-[10px]">
              <Command size={10} /> K
            </span>
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
