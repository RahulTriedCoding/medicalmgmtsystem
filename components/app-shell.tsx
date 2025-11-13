"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Calendar, FileText, Receipt, Package, Settings, UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserMenu from "@/components/auth/user-menu"; // 👈 add

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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh grid grid-cols-[260px_1fr]">
      <aside className="flex min-h-dvh flex-col border-r bg-background">
        <div className="p-4 font-semibold text-lg">Medical MMS</div>

        <nav className="px-2 space-y-1 flex-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
                  active && "bg-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 👇 shows email/role + Sign out */}
        <div className="px-2 pb-4">
          <UserMenu />
        </div>
      </aside>

      <main className="p-6">{children}</main>
    </div>
  );
}
