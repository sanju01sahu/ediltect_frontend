import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Page not found</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
