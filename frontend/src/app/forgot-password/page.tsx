"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthShell, FieldError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { api, type User } from "@/lib/api";
import { keys } from "@/lib/queries";

const emailSchema = z.object({ email: z.string().trim().email("Enter a valid email address") });
const resetSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/\d/, "Include at least one number"),
});

export default function ForgotPasswordPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const step1 = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
  const step2 = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  const sendCode = async ({ email: addr }: { email: string }) => {
    setError(null);
    try {
      const r = await api<{ message: string }>("/api/auth/forgot", { method: "POST", json: { email: addr } });
      setNotice(r.message);
      setEmail(addr);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const reset = async (v: z.infer<typeof resetSchema>) => {
    setError(null);
    try {
      const user = await api<User>("/api/auth/reset", { method: "POST", json: { email, code: v.code, password: v.password } });
      qc.setQueryData(keys.me, user);
      router.replace(user.onboarded ? "/home" : "/onboarding");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <AuthShell>
      <div className="card p-7 sm:p-8">
        <Link href="/login" className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to log in
        </Link>
        {error && (
          <div role="alert" className="mb-4 rounded-xl bg-status-red px-4 py-3 text-sm font-medium text-status-redInk">
            {error}
          </div>
        )}

        {!email ? (
          <>
            <h1 className="text-2xl font-bold text-ink">Reset your password</h1>
            <p className="mt-1.5 text-sm text-ink-soft">Enter your account email and we&apos;ll send you a 6-digit code.</p>
            <form onSubmit={step1.handleSubmit(sendCode)} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input id="email" type="email" autoComplete="email" className="input" aria-describedby="email-err" {...step1.register("email")} />
                <FieldError id="email-err" msg={step1.formState.errors.email?.message} />
              </div>
              <Button type="submit" size="lg" className="w-full" loading={step1.formState.isSubmitting}>
                Send code
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink">Check your email</h1>
            <p className="mt-2 flex gap-2 rounded-xl bg-canvas px-3.5 py-3 text-sm text-ink-soft" role="status">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet" /> {notice}
            </p>
            <form onSubmit={step2.handleSubmit(reset)} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="code" className="label">6-digit code</label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="input text-lg tracking-[0.4em]"
                  aria-describedby="code-err"
                  {...step2.register("code")}
                />
                <FieldError id="code-err" msg={step2.formState.errors.code?.message} />
              </div>
              <div>
                <label htmlFor="password" className="label">New password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    className="input pr-11"
                    aria-describedby="password-err"
                    {...step2.register("password")}
                  />
                  <button type="button" onClick={() => setShow((x) => !x)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {step2.formState.errors.password ? (
                  <FieldError id="password-err" msg={step2.formState.errors.password.message} />
                ) : (
                  <p className="mt-1.5 text-xs text-ink-muted">8+ characters with a letter and a number. This signs you out on other devices.</p>
                )}
              </div>
              <Button type="submit" size="lg" className="w-full" loading={step2.formState.isSubmitting}>
                Set new password
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-ink-soft">
              No email after a few minutes? Check spam, or{" "}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  sendCode({ email: email! });
                }}
                className="font-semibold text-azure-ink hover:underline"
              >
                send a new code
              </button>
              .
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
