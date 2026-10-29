"use client";

import { BarChart3, BriefcaseBusiness, FileText, Mic } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";

const QUOTES = [
  "See exactly why you match a job, and what's missing.",
  "Track every application from applied to offer.",
  "One profile powers your jobs, resume and interview prep.",
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-hero-gradient p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-violet/30 blur-3xl" aria-hidden />
        <Link href="/" aria-label="CareerOS home">
          <Logo />
        </Link>
        <div className="relative my-auto">
          <h2 className="text-[40px] font-extrabold leading-[1.1] tracking-tight">
            Your Career.
            <br />
            Simplified with AI.
          </h2>
          <p className="mt-5 min-h-[3.5rem] max-w-sm text-lg leading-relaxed text-white/80" aria-live="polite">
            {QUOTES[i]}
          </p>
          <div className="mt-10 flex max-w-md flex-wrap gap-3" aria-hidden>
            {[
              { l: "Resume", I: FileText },
              { l: "Jobs", I: BriefcaseBusiness },
              { l: "Interview Prep", I: Mic },
              { l: "Skill Growth", I: BarChart3 },
            ].map(({ l, I }) => (
              <span key={l} className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm font-semibold backdrop-blur">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-azure/90">
                  <I className="h-4 w-4" />
                </span>
                {l}
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-sm text-white/50">© {new Date().getFullYear()} CareerOS</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <Logo tone="dark" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-status-redInk">
      {msg}
    </p>
  );
}

export function GoogleButton() {
  const [note, setNote] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setNote(true)}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white text-sm font-semibold text-ink hover:bg-canvas"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.7 14a6.6 6.6 0 0 1 0-4.2V7H2a11 11 0 0 0 0 9.9z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7l3.7 2.9C6.6 7.3 9.1 5.4 12 5.4z" />
        </svg>
        Continue with Google
      </button>
      {note && (
        <p className="mt-2 text-center text-xs text-ink-muted" role="status">
          Google sign-in is coming soon. Use email for now.
        </p>
      )}
    </div>
  );
}
