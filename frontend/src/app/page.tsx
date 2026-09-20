"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Flag,
  ListTodo,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";

const CORE_LOOP = [
  {
    icon: Target,
    title: "Life goal",
    text: "Name the outcome that matters — a body, a business, a year well spent.",
  },
  {
    icon: Flag,
    title: "Milestones",
    text: "Split it into measurable checkpoints so progress is always visible.",
  },
  {
    icon: ListTodo,
    title: "Habits",
    text: "Attach daily or weekly habits that move each milestone forward.",
  },
  {
    icon: CheckCircle2,
    title: "Daily actions",
    text: "Complete habits in the time window that fits your real day.",
  },
  {
    icon: Flame,
    title: "Streaks",
    text: "Every completion extends a streak the app derives from your history.",
  },
  {
    icon: Zap,
    title: "XP",
    text: "Earn XP for completions, milestones and perfect days. Level up.",
  },
];

const FEATURES = [
  {
    icon: Target,
    title: "Goals that become systems",
    text: "A goal is more than a wish. LifeForge turns it into milestones and daily habits with a clear progress line back to the outcome.",
  },
  {
    icon: Flame,
    title: "Streaks that actually mean something",
    text: "Current and best streaks, at-risk warnings and undo-safe completion history — derived from what you really did, not what you claimed.",
  },
  {
    icon: TrendingUp,
    title: "See your momentum",
    text: "A 0–100 momentum score, completion heatmap, XP curve and weekly reviews show your life compounding instead of just checking boxes.",
  },
  {
    icon: Sparkles,
    title: "Build consistency, not guilt",
    text: "Falling behind is a state, not a failure. The day view shows you how to recover, and perfect days are celebrated when they happen.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const go = (path: string) => {
    if (path === "/register") router.replace(accessToken ? "/dashboard" : "/register");
    else router.replace(path);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">
            LF
          </span>
          LifeForge
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => go("/login")}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </button>
          <Link
            href={accessToken ? "/dashboard" : "/register"}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start Building
          </Link>
        </nav>
      </header>

      {/* 1. Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center">
        <p className="mx-auto mb-4 w-fit rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          Habit tracking that compounds into a life
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Build the person you want to become.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Turn your biggest goals into daily systems.
          <br />
          Build streaks. Track momentum. Watch your life compound.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href={accessToken ? "/dashboard" : "/register"}
            className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start Building
            <ArrowRight size={15} />
          </Link>
          <a
            href="#how-it-works"
            className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            See How It Works
          </a>
        </div>
      </section>

      {/* 2. Product demo (stylized) */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="text-xs text-muted-foreground">Friday, Sep 18</p>
              <p className="mt-0.5 text-sm font-semibold">On track — 3 of 4 done</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
              <Flame size={12} />
              41-day streak
            </span>
          </div>
          <div className="divide-y divide-border">
            {[
              { name: "Drink 2L of water", meta: "Every day · 2L", done: true, streak: 41 },
              { name: "Read 20 pages", meta: "5× / week", done: true, streak: 12 },
              { name: "Morning run 5k", meta: "Mon, Wed, Fri", done: true, streak: 8 },
              { name: "Journal", meta: "Every day · 5 min", done: false, streak: 15 },
            ].map((row) => (
              <div key={row.name} className="flex items-center gap-3 py-3">
                <span
                  className={
                    row.done
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : "flex h-6 w-6 items-center justify-center rounded-full border-2 border-border"
                  }
                >
                  {row.done && <CheckCircle2 size={14} />}
                </span>
                <div className="flex-1">
                  <p
                    className={
                      row.done
                        ? "text-sm text-muted-foreground line-through"
                        : "text-sm font-medium"
                    }
                  >
                    {row.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{row.meta}</p>
                </div>
                <span className="flex items-center gap-1 text-xs text-warning">
                  <Flame size={12} /> {row.streak}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Level 3 · 740 / 1,200 XP
            </p>
            <p className="text-xs font-medium text-primary">+150 XP today</p>
          </div>
        </div>
      </section>

      {/* 3. Core loop */}
      <section id="how-it-works" className="border-y border-border bg-card/40 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            The core loop
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
            Every layer feeds the next. Daily actions compound into streaks,
            streaks into XP, XP into levels.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_LOOP.map((step, i) => (
              <div key={step.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <step.icon size={16} />
                  </span>
                  {i < CORE_LOOP.length - 1 && (
                    <span className="mt-1 hidden h-8 w-px bg-border lg:block" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight">
          Built for the long game
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
                <f.icon size={16} />
              </span>
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. CTA */}
      <section className="border-t border-border py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Your future self is watching.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with one goal and one habit. The system does the rest.
          </p>
          <Link
            href={accessToken ? "/dashboard" : "/register"}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start Building
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          LifeForge — turn goals into daily systems.
        </p>
      </footer>
    </div>
  );
}
