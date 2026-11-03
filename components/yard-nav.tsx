"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, LogOut, Plus, Truck } from "lucide-react";
import { logout } from "@/app/actions";
import { cn } from "cn";

const links = [
  { href: "/", label: "Board", icon: LayoutDashboard },
  { href: "/units", label: "Units", icon: Truck },
  { href: "/units/new", label: "Add", icon: Plus },
  { href: "/import-log", label: "Sheet log", icon: ClipboardList },
];

export function YardShell({
  user,
  showPasswordWarning,
  children,
}: {
  user: string;
  showPasswordWarning: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden border-r border-white/10 bg-[#1e2a24] text-[#f6f1e7] md:flex md:min-h-dvh md:flex-col">
        <div className="px-5 pt-6 pb-4">
          <Wordmark />
          <p className="mt-3 text-sm leading-5 text-[#d7cbb6]">Rig Runner · Terminal 331 · Jourdanton</p>
          <p className="mt-2 text-sm text-[#d7cbb6]">Signed in as {user}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => (
            <NavLink key={link.href} {...link} active={isActive(pathname, link.href)} />
          ))}
        </nav>
        <form action={logout} className="p-3">
          <button
            type="submit"
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-[#f6f1e7] hover:bg-white/10"
          >
            <LogOut className="size-5" />
            Sign out
          </button>
        </form>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-[#1e2a24] px-4 py-3 text-[#f6f1e7] md:hidden">
          <Wordmark compact />
          <form action={logout}>
            <button type="submit" className="min-h-12 rounded-xl px-3 text-sm font-semibold">
              Sign out
            </button>
          </form>
        </header>
        {showPasswordWarning ? (
          <p className="bg-[#e25b12] px-4 py-2 text-sm font-medium text-white">
            This copy still uses a default password or session secret. Set APP_PASSWORD and AUTH_SECRET before anyone outside the terminal can open it.
          </p>
        ) : null}
        <main className="px-4 py-4 pb-28 md:px-8 md:py-6 md:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#1e2a24] pb-[env(safe-area-inset-bottom)] text-[#f6f1e7] md:hidden">
        <ul className="grid grid-cols-4">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                    active ? "text-[#ffb088]" : "text-[#d7cbb6]",
                  )}
                >
                  <Icon className="size-6" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Truck;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold",
        active ? "bg-[#e25b12] text-white" : "text-[#f6f1e7] hover:bg-white/10",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="block">
      <span className={cn("font-heading block leading-none font-bold tracking-wide", compact ? "text-3xl" : "text-5xl")}>
        331
      </span>
      <span className="text-xs font-semibold tracking-[0.18em] text-[#ffb088] uppercase">
        Certs · Rig Runner
      </span>
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/units") return pathname === "/units";
  return pathname === href || pathname.startsWith(`${href}/`);
}
