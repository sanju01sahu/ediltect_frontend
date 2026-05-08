"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { useGetSessionQuery } from "@/store/services/pvApi";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isLoading } = useGetSessionQuery();

  useEffect(() => {
    if (!isLoading && !session?.user) {
      router.replace("/login");
    }
  }, [isLoading, router, session]);

  if (isLoading || !session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <Spinner />
          Loading workspace...
        </div>
      </div>
    );
  }

  return <AppShell session={session.user}>{children}</AppShell>;
}
