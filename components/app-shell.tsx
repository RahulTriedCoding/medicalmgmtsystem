"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Calendar, FileText, Receipt, Package, Settings, UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserMenu from "@/components/auth/user-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/prescriptions", label: "Prescriptions", icon: FileText },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/staff", label: "Staff", icon: UserCog },
  { href: "/settings", label: "Settings", icon: Settings },
];

type AppShellProps = {
  children: React.ReactNode;
  clinicName?: string;
};

export default function AppShell({ children, clinicName }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="order-2 flex flex-col border-t border-slate-200 bg-[var(--sidebar)] px-4 py-6 text-[var(--sidebar-foreground)] backdrop-blur dark:border-white/5 dark:bg-[var(--sidebar)]/95 lg:order-1 lg:border-r lg:border-t-0 lg:px-6">
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase tracking-[0.3em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
            {clinicName?.trim() || "Medical MMS"}
          </div>

          <nav className="space-y-1.5 flex-1">
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40",
                    "text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-white/10",
                    active
                      ? "bg-sky-100 text-slate-900 ring-1 ring-sky-200 shadow-[0_12px_30px_rgba(34,196,184,0.18)] dark:bg-white/10 dark:text-white dark:ring-white/15"
                      : "bg-transparent"
                  )}
                >
                  <Icon className="h-4 w-4 text-inherit" />
                  <span>{label}</span>
                  <span
                    className={cn(
                      "ml-auto h-1.5 w-1.5 rounded-full bg-transparent transition",
                      active
                        ? "bg-sky-500 dark:bg-white"
                        : "bg-slate-300 dark:bg-white/20 group-hover:bg-slate-400 dark:group-hover:bg-white/40"
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="mt-6">
            <UserMenu />
          </div>
        </aside>

        <main className="order-1 flex flex-col bg-[var(--background)] dark:bg-gradient-to-b dark:from-[#050505] dark:via-[#090b13] dark:to-[#030303] lg:order-2">
          <div className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-white/5 dark:bg-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/50">Operations</p>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {clinicName?.trim() || "Medical MMS Control Room"}
                </h1>
              </div>
              <ThemeToggle />
            </div>
          </div>
          <div className="flex-1 px-4 py-6 sm:px-8">
            <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
          </div>
          <div className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500 dark:border-white/5 dark:text-white/45">
            © {new Date().getFullYear()} Medical MMS · Precision care management
          </div>
        </main>
      </div>
    </div>
  );
}
