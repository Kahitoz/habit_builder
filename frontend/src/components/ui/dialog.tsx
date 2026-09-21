"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/** Controlled modal dialog with backdrop + Escape-to-close. */
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-lg border border-b-0 border-border bg-card p-4 shadow-xl sm:max-h-[85vh] sm:max-w-lg sm:rounded-lg sm:border-b sm:p-5"
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-base font-semibold", className)} {...props} />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-xs text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-4 flex justify-end gap-2", className)} {...props} />
  );
}
