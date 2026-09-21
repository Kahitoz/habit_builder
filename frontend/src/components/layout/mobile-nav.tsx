"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Slide-in navigation drawer for small screens. Renders only while `open`,
 * with a backdrop, escape-to-close, and body scroll lock. Content is the
 * desktop <Sidebar /> so the nav stays a single source of truth.
 */
export function MobileNavDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        style={{ animation: "dsh-fade-in 150ms ease-out" }}
        aria-hidden
      />
      <div
        className={cn(
          "absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col",
          "bg-card shadow-xl",
        )}
        style={{ animation: "dsh-slide-in 200ms ease-out" }}
      >
        {children}
      </div>
    </div>
  );
}
