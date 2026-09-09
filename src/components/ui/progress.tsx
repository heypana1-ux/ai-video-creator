"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/util/cn";

export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root
      value={clamped}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-ink-700", className)}
    >
      <ProgressPrimitive.Indicator
        className="h-full rounded-full bg-linear-to-r from-violet-brand to-electric transition-[width] duration-300"
        style={{ width: `${clamped}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
