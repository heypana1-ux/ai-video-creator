import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
        <Link href="/">
          <ArrowLeft className="size-4" /> Zur Startseite
        </Link>
      </Button>
      <article className="space-y-4 text-sm leading-relaxed text-chalk-dim [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-chalk [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-chalk [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </article>
    </div>
  );
}
