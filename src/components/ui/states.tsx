import * as React from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

import { cn } from "@/lib/util/cn";

import { Button } from "./button";

/** Empty state used whenever a list has no rows yet. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col items-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-ink-700 text-violet-brand">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <h3 className="text-base font-semibold text-chalk">{title}</h3>
      <p className="max-w-md text-sm text-chalk-faint">{description}</p>
      {action}
    </div>
  );
}

/** Error state with an optional retry. */
export function ErrorState({
  title = "Da ist etwas schiefgelaufen",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-2xl border border-danger/35 bg-danger/10 p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-danger">
        <AlertTriangle className="size-4" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="text-sm text-chalk-dim">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Erneut versuchen
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = "Wird geladen …" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-chalk-faint">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}
