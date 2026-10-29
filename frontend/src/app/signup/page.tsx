"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthShell, FieldError, GoogleButton } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { api, ApiError, type User } from "@/lib/api";
import { keys } from "@/lib/queries";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/\d/, "Include at least one number"),
  role_type: z.enum(["student", "fresher", "experienced"], { message: "Choose where you are in your career" }),
});
type Form = z.infer<typeof schema>;

const ROLES = [
  { v: "student", l: "Student", d: "Still studying" },
  { v: "fresher", l: "Fresher", d: "0–1 years" },
  { v: "experienced", l: "Experienced", d: "1+ years" },
] as const;

export default function SignupPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, watch, setError: setFieldError } = useForm<Form>({ resolver: zodResolver(schema) });
  const { errors, isSubmitting } = formState;
  const role = watch("role_type");

  const onSubmit = async (values: Form) => {
    setError(null);
    try {
      const user = await api<User>("/api/auth/signup", { method: "POST", json: values });
      qc.setQueryData(keys.me, user);
      router.replace("/onboarding");
    } catch (e) {
      const err = e as ApiError;
      for (const [k, m] of Object.entries(err.fieldErrors ?? {})) {
        if (k in schema.shape) setFieldError(k as keyof Form, { message: m });
      }
      setError(err.message);
    }
  };

  return (
    <AuthShell>
      <div className="card p-7 sm:p-8">
        <h1 className="text-2xl font-bold text-ink">Create your account</h1>
        <p className="mt-1.5 text-sm text-ink-soft">It&apos;s free. Set up your profile in two minutes.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
          {error && (
            <div role="alert" className="rounded-xl bg-status-red px-4 py-3 text-sm font-medium text-status-redInk">
              {error}{" "}
              {error.includes("already exists") && (
                <Link href="/login" className="underline">
                  Log in
                </Link>
              )}
            </div>
          )}
          <div>
            <label htmlFor="name" className="label">Full name</label>
            <input id="name" autoComplete="name" className="input" aria-invalid={!!errors.name} aria-describedby="name-err" {...register("name")} />
            <FieldError id="name-err" msg={errors.name?.message} />
          </div>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" autoComplete="email" className="input" aria-invalid={!!errors.email} aria-describedby="email-err" {...register("email")} />
            <FieldError id="email-err" msg={errors.email?.message} />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <div className="relative">
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                className="input pr-11"
                aria-invalid={!!errors.password}
                aria-describedby="password-err password-hint"
                {...register("password")}
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password ? (
              <FieldError id="password-err" msg={errors.password.message} />
            ) : (
              <p id="password-hint" className="mt-1.5 text-xs text-ink-muted">8+ characters with a letter and a number.</p>
            )}
          </div>
          <fieldset>
            <legend className="label">I am a</legend>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <label
                  key={r.v}
                  className={cn(
                    "cursor-pointer rounded-xl border px-2 py-2.5 text-center transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet",
                    role === r.v ? "border-violet bg-violet-soft" : "border-line bg-white hover:border-violet/40",
                  )}
                >
                  <input type="radio" value={r.v} className="sr-only" {...register("role_type")} />
                  <span className="block text-sm font-semibold text-ink">{r.l}</span>
                  <span className="block text-[11px] text-ink-muted">{r.d}</span>
                </label>
              ))}
            </div>
            <FieldError id="role-err" msg={errors.role_type?.message} />
          </fieldset>
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
            Create account
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>
        <GoogleButton />
        <p className="mt-6 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-azure-ink hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
