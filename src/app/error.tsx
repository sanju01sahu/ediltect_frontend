"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-3 w-fit rounded-full bg-rose-100 p-3 dark:bg-rose-950/50">
          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-300" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Something went wrong</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          An unexpected error occurred while rendering this page.
        </p>
        <Button className="mt-4" onClick={reset}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </main>
  );
}

