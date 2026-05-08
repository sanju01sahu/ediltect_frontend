"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/utils";
import { useGetSessionQuery, useLoginMutation } from "@/store/services/pvApi";
import { ThemeToggle } from "./theme-toggle";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginValues = z.infer<typeof schema>;

export default function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { data: session, isLoading: sessionLoading } = useGetSessionQuery();
  const [login, loginState] = useLoginMutation();

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "admin@pv.local",
      password: "admin123",
    },
  });

  useEffect(() => {
    if (session?.user) router.replace("/");
  }, [router, session]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values).unwrap();
      router.replace("/");
    } catch (error) {
      form.setError("root", { message: getErrorMessage(error, "Unable to sign in.") });
    }
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_20%,theme(colors.sky.200/.55),transparent_38%),radial-gradient(circle_at_95%_15%,theme(colors.amber.200/.45),transparent_28%),linear-gradient(180deg,#f8fafc,#e2e8f0)] px-4 py-8 dark:bg-[radial-gradient(circle_at_10%_20%,theme(colors.sky.800/.35),transparent_38%),radial-gradient(circle_at_95%_15%,theme(colors.amber.900/.35),transparent_28%),linear-gradient(180deg,#020617,#0f172a)]">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-end">
        <ThemeToggle />
      </div>
      <div className="mx-auto mt-6 grid w-full max-w-6xl items-stretch gap-6 lg:grid-cols-2">
        <Card className="relative overflow-hidden border-0 bg-slate-900 p-8 text-white shadow-2xl dark:bg-slate-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(56,189,248,.35),transparent_30%),radial-gradient(circle_at_15%_80%,rgba(245,158,11,.22),transparent_35%)]" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.22em] text-sky-300">PV Operations Suite</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">Commercial-grade control for solar sales teams</h1>
            <p className="mt-4 max-w-lg text-slate-300">
              Manage users, solutions, contracts, commissions, bonuses, payments, and reports in one premium workspace.
            </p>
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                JWT access + refresh token rotation with direct backend API connectivity.
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Sign in to your workspace</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use your backend credentials to continue.</p>

          {sessionLoading ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register("email")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="pr-24"
                    {...form.register("password")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-2"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showPassword ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>

              {form.formState.errors.root?.message ? (
                <Alert type="error">{form.formState.errors.root.message}</Alert>
              ) : null}

              <Button className="w-full" type="submit" disabled={loginState.isLoading}>
                {loginState.isLoading ? (
                  <>
                    <Spinner />
                    Signing in...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
