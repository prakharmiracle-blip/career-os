"use client";

import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";

import { soonModule } from "@/lib/nav";

/** Every sidebar module that isn't built yet lands here, clearly marked. */
export default function ComingSoonPage() {
  const { module } = useParams<{ module: string }>();
  const item = soonModule(module);
  if (!item?.soon) notFound();
  const Icon = item.icon;

  return (
    <div className="mx-auto max-w-2xl pt-6">
      <div className="card p-8 sm:p-10">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-soft">
          <Icon className="h-7 w-7 text-violet" aria-hidden />
        </span>
        <h1 className="mt-6 text-2xl font-bold text-ink">{item.label}</h1>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-status-amber px-3 py-1 text-xs font-semibold text-status-amberInk">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Coming soon · planned for phase {item.soon.phase}
        </p>
        <p className="mt-5 max-w-[60ch] leading-relaxed text-ink-soft">{item.soon.summary}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/jobs" className="inline-flex h-10 items-center rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white shadow-glow">
            Search jobs meanwhile
          </Link>
          <Link href="/home" className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink-soft hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
