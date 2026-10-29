"use client";

import { ArrowRight, CalendarCheck2, FileText, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useActivities, useOverview } from "@/lib/queries";
import { cn, friendlyWhen } from "@/lib/utils";

const TILES = [
  { key: "applied", label: "Jobs Applied", bg: "bg-tile-blue", ink: "text-tile-blueInk", href: "/applications" },
  { key: "interviews", label: "Interviews", bg: "bg-tile-teal", ink: "text-tile-tealInk", href: "/applications?tab=interviews" },
  { key: "offers", label: "Offers", bg: "bg-tile-lav", ink: "text-tile-lavInk", href: "/applications?tab=offers" },
  { key: "saved", label: "Saved Jobs", bg: "bg-tile-amber", ink: "text-tile-amberInk", href: "/saved" },
] as const;

export function ApplicationOverview() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useOverview(days);
  return (
    <section className="card p-5" aria-labelledby="overview-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="overview-title" className="text-base font-bold text-ink">
          Application Overview
        </h2>
        <label className="sr-only" htmlFor="overview-range">
          Time range
        </label>
        <select
          id="overview-range"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="cursor-pointer rounded-lg bg-transparent py-1 text-xs font-medium text-ink-soft hover:text-ink"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {TILES.map((t) => (
          <Link key={t.key} href={t.href} className={cn("rounded-xl p-4 transition hover:brightness-[0.98]", t.bg)}>
            <span className={cn("block text-2xl font-extrabold", t.ink)}>
              {isLoading ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-white/70" /> : data?.[t.key] ?? 0}
            </span>
            <span className="mt-1 block text-sm text-ink-soft">{t.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const KIND = {
  interview: { icon: CalendarCheck2, bg: "bg-tile-blue", ink: "text-tile-blueInk", href: "/applications?tab=interviews" },
  resume_review: { icon: FileText, bg: "bg-tile-lav", ink: "text-tile-lavInk", href: "/resume-builder" },
  practice: { icon: Target, bg: "bg-status-red", ink: "text-status-redInk", href: "/interview-prep" },
} as const;

export function UpcomingActivities() {
  const { data, isLoading } = useActivities();
  return (
    <section className="card p-5" aria-labelledby="activities-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="activities-title" className="text-base font-bold text-ink">
          Upcoming Activities
        </h2>
        <Link href="/applications" className="inline-flex items-center gap-1 text-xs font-semibold text-azure-ink hover:underline">
          View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-canvas" />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="rounded-xl bg-canvas p-4 text-sm text-ink-soft">
          Nothing scheduled. When you move an application to <span className="font-medium text-ink">Interview Scheduled</span>, prep reminders show up here.
        </div>
      ) : (
        <ul className="space-y-1">
          {data.map((a) => {
            const k = KIND[a.kind as keyof typeof KIND] ?? KIND.interview;
            const Icon = k.icon;
            return (
              <li key={a.id}>
                <Link href={k.href} className="flex gap-3.5 rounded-xl p-2 -mx-2 hover:bg-canvas">
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", k.bg)}>
                    <Icon className={cn("h-5 w-5", k.ink)} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{a.title}</span>
                    <span className="block truncate text-[13px] text-ink-soft">{a.subtitle}</span>
                    <span className="block text-[13px] text-ink-soft">{friendlyWhen(a.starts_at)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
