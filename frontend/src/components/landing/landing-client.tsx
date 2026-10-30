"use client";

import { CheckCircle2, ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useJoinWaitlist, useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#plans", label: "Plans" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  const { data: me, isSuccess } = useMe();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-900/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="CareerOS home">
          <Logo />
        </Link>
        <nav aria-label="Page sections" className="ml-6 hidden gap-6 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-white/75 hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-3 md:flex">
          {isSuccess && me ? (
            <Link href="/home" className="inline-flex h-10 items-center rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white shadow-glow">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-white/85 hover:text-white">
                Log in
              </Link>
              <Link href="/signup" className="inline-flex h-10 items-center rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white shadow-glow">
                Get started free
              </Link>
            </>
          )}
        </div>
        <button className="ml-auto rounded-lg p-2 text-white md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 px-4 pb-4 md:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-sm font-medium text-white/85">
              {l.label}
            </a>
          ))}
          <div className="mt-2 flex gap-3">
            {isSuccess && me ? (
              <Link href="/home" className="flex h-10 flex-1 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="flex h-10 flex-1 items-center justify-center rounded-full border border-white/25 text-sm font-semibold text-white">
                  Log in
                </Link>
                <Link href="/signup" className="flex h-10 flex-1 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/** Anonymous-friendly waitlist: asks for an email when the visitor isn't logged in. */
export function WaitlistButton({ plan, label }: { plan: "premium" | "prime"; label: string }) {
  const { data: me } = useMe();
  const join = useJoinWaitlist();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <p className="flex items-center justify-center gap-1.5 rounded-full bg-status-green py-2.5 text-sm font-semibold text-status-greenInk" role="status">
        <CheckCircle2 className="h-4 w-4" /> {done}
      </p>
    );
  }
  const submit = (addr?: string) =>
    join.mutate(
      { plan, source: "landing", ...(addr ? { email: addr } : {}) },
      { onSuccess: (r) => setDone(r.already_joined ? "Already on the list" : "You're on the list") },
    );

  if (!open) {
    return (
      <Button variant="outline" className="w-full rounded-full" onClick={() => (me ? submit() : setOpen(true))} loading={join.isPending}>
        {label}
      </Button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(email.trim());
      }}
      className="space-y-2"
    >
      <label htmlFor={`wl-${plan}`} className="sr-only">
        Email for the {plan} waitlist
      </label>
      <input id={`wl-${plan}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input h-10 rounded-full" />
      <Button type="submit" className="w-full" loading={join.isPending}>
        Join waitlist
      </Button>
      {join.isError && (
        <p className="text-center text-xs text-status-redInk" role="alert">
          {join.error.message}
        </p>
      )}
    </form>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-white">
      {items.map((it, i) => (
        <li key={it.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-ink"
          >
            {it.q}
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-muted transition", open === i && "rotate-180")} />
          </button>
          {open === i && <p className="max-w-[70ch] px-5 pb-5 text-sm leading-relaxed text-ink-soft">{it.a}</p>}
        </li>
      ))}
    </ul>
  );
}
