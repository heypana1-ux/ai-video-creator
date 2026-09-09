"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CreditCard,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiSend } from "@/lib/client/api";
import { cn } from "@/lib/util/cn";
import { formatCredits } from "@/lib/util/format";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brand-kits", label: "Brand-Kits", icon: Palette },
  { href: "/assets", label: "Asset-Bibliothek", icon: Images },
  { href: "/billing", label: "Credits", icon: CreditCard },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

export interface NavUser {
  displayName: string;
  email: string;
  credits: number;
  workspaceName: string;
  demoMode: boolean;
}

export function AppNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  async function onSignOut() {
    await apiSend("/api/auth/logout", "POST").catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-ink-700 text-chalk"
                : "text-chalk-faint hover:bg-ink-800 hover:text-chalk",
            )}
          >
            <link.icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="font-bold tracking-tight">
          AdReel<span className="text-violet-brand">AI</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {open ? (
        <div
          className="border-b border-ink-800 bg-ink-900 p-4 lg:hidden"
          onClick={() => setOpen(false)}
        >
          {nav}
          <Button variant="ghost" className="mt-2 w-full justify-start" onClick={onSignOut}>
            <LogOut className="size-4" /> Abmelden
          </Button>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900/50 p-4 lg:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2 font-bold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-violet-brand to-magenta-brand text-white">
            <Sparkles className="size-4" />
          </span>
          AdReel<span className="text-violet-brand">AI</span>
        </Link>

        <Button className="mb-5" asChild>
          <Link href="/projects/new">Neues Video erstellen</Link>
        </Button>

        {nav}

        <div className="mt-auto space-y-3 pt-6">
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
            <p className="text-xs uppercase tracking-wider text-chalk-faint">Credits</p>
            <p className="mt-1 text-xl font-bold">{formatCredits(user.credits)}</p>
            {user.demoMode ? (
              <p className="mt-1 text-[11px] text-chalk-faint">
                Demo-Modus – es entstehen keine echten Kosten.
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
            <p className="truncate text-sm font-medium">{user.displayName || user.email}</p>
            <p className="truncate text-xs text-chalk-faint">{user.workspaceName}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start px-2"
              onClick={onSignOut}
            >
              <LogOut className="size-4" /> Abmelden
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
