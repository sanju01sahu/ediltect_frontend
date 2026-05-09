"use client";

import { LogOut, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getAllowedNavItems } from "@/lib/navigation";
import { showToast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useGetUsersQuery, useLogoutMutation } from "@/store/services/pvApi";
import { AuthSession } from "@/types/api";
import { ThemeToggle } from "../theme-toggle";
import { Button } from "../ui/button";
import { PageTransition } from "./page-transition";

function roleLabel(role: AuthSession["role"]) {
  if (role === "ADMIN") return "Administrator";
  if (role === "AREA_MANAGER") return "Area Manager";
  return "Agent";
}

export function AppShell({
  session,
  children,
}: {
  session: AuthSession;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logout, { isLoading }] = useLogoutMutation();
  const { data: usersResponse } = useGetUsersQuery({ page: 1, limit: 100 });
  const users = usersResponse?.items ?? [];
  const currentUser = users.find((user) => user.id === session.userId);

  const scopedNav = getAllowedNavItems(session.role);

  const handleLogout = async () => {
    try {
      await logout().unwrap();
      showToast({
        type: "success",
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
      router.replace("/login");
    } catch (error) {
      showToast({
        type: "error",
        title: "Sign out failed",
        description: getErrorMessage(error, "Unable to sign out right now. Please try again."),
      });
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_-20%,theme(colors.sky.200/.45),transparent_40%),radial-gradient(circle_at_100%_0%,theme(colors.amber.200/.35),transparent_35%)] dark:bg-[radial-gradient(circle_at_10%_-20%,theme(colors.sky.800/.25),transparent_40%),radial-gradient(circle_at_100%_0%,theme(colors.amber.900/.2),transparent_35%)]">
      <div className="flex w-full">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white/95 p-5 backdrop-blur transition-transform duration-300 dark:border-slate-800 dark:bg-slate-950/95 lg:static lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-6 flex items-center justify-between lg:justify-start">
            <Link href="/" className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Image src="/solar.png" alt="Photovoltaic logo" width={28} height={28} className="rounded-md" />
              <span className="text-sm font-semibold leading-tight tracking-tight">
                Photovoltaic Sales Network Management Platform
              </span>
            </Link>
            <Button className="lg:hidden" variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{roleLabel(session.role)}</p>
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{currentUser?.name ?? session.userId}</p>
            {currentUser?.email ? (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{currentUser.email}</p>
            ) : null}
          </div>

          <nav className="space-y-1">
            {scopedNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {mobileOpen ? (
          <button
            className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar backdrop"
          />
        ) : null}

        <div className="min-h-screen flex-1 lg:pl-0">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 md:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setMobileOpen(true)}>
                  <Menu className="h-4 w-4" />
                </Button>
                <p className="text-sm text-slate-600 dark:text-slate-300">Operational dashboard</p>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button variant="secondary" size="sm" onClick={handleLogout} disabled={isLoading}>
                  <LogOut className="h-4 w-4" />
                  {isLoading ? "Signing out..." : "Sign out"}
                </Button>
              </div>
            </div>
          </header>

          <main className="p-4 md:p-6">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </div>
  );
}
