import * as React from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
            LF
          </span>
          <h1 className="text-lg font-bold">LifeForge</h1>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
        {footer ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">{footer}</p>
        ) : null}
      </div>
    </div>
  );
}
