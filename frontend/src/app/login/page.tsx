"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthShell, FieldError, GoogleButton } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { api, type User } from "@/lib/api";
import { keys } from "@/lib/queries";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
});
type Form = z.infer<typeof schema>;

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/home";
}

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const { register, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = async (values: Form) => {
    setError(null);
    try {
      const user = await api<User>("/api/auth/login", { method: "POST", json: values });
      qc.setQueryData(keys.me, user);
      router.replace(user.onboarded ? next : "/onboarding");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <AuthShell>
      <div className="card p-7 sm:p-8">
        <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
        <p className="mt-1.5 text-sm text-ink-soft">Log in to continue your job search.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
          {error && (
            <div role="alert" className="rounded-xl bg-status-red px-4 py-3 text-sm font-medium text-status-redInk">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" autoComplete="email" className="input" aria-invalid={!!errors.email} aria-describedby="email-err" {...register("email")} />
            <FieldError id="email-err" msg={errors.email?.message} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="label">Password</label>
              <button type="button" onClick={() => setForgot(true)} className="mb-1.5 text-xs font-semibold text-azure-ink hover:underline">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                className="input pr-11"
                aria-invalid={!!errors.password}
                aria-describedby="password-err"
                {...register("password")}
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError id="password-err" msg={errors.password?.message} />
            {forgot && (
              <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-soft" role="status">
                Password reset by email code is coming soon. Until then, contact support to reset your password.
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" className="h-4 w-4 rounded accent-violet" {...register("remember")} /> Remember me
          </label>
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
            Log in
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>
        <GoogleButton />
        <p className="mt-6 text-center text-sm text-ink-soft">
          New to CareerOS?{" "}
          <Link href="/signup" className="font-semibold text-azure-ink hover:underline">
            Create an account
          </Link>
        </p>
      </div>
      <p className="mt-4 text-center text-xs text-ink-muted">
        Demo account: demo@careeros.app / Demo@1234
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
