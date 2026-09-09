import Link from "next/link";
import { Clapperboard } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center px-5 py-12">
      <div className="absolute inset-0 aurora" aria-hidden />
      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 text-lg font-bold tracking-tight"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-violet-brand to-magenta-brand text-white">
            <Clapperboard className="size-4" />
          </span>
          AdReel<span className="text-violet-brand">AI</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
