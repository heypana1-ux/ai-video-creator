import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/util/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-ink-600 bg-ink-800 text-chalk-dim",
        violet: "border-violet-brand/40 bg-violet-brand/15 text-violet-brand",
        magenta: "border-magenta-brand/40 bg-magenta-brand/15 text-magenta-brand",
        electric: "border-electric/40 bg-electric/15 text-electric",
        mint: "border-mint/40 bg-mint/15 text-mint",
        amber: "border-amber-brand/40 bg-amber-brand/15 text-amber-brand",
        danger: "border-danger/40 bg-danger/15 text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
