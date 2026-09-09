import { cn } from "@/lib/util/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-shimmer rounded-lg bg-ink-700", className)}
    />
  );
}
