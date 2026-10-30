"use client";

import { ArrowRight, BarChart3, BriefcaseBusiness, FileText, Mic, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { INTERVIEW_APP_URL, isExternal } from "@/lib/nav";

import { HeroBanner } from "@/components/hero-banner";
import { AdzunaCredit, JobCard } from "@/components/job-card";
import { ApplicationOverview, UpcomingActivities } from "@/components/right-rail";
import { useRecommended } from "@/lib/queries";
import { cn } from "@/lib/utils";

const TOOLS: { title: string; body: string; href: string; icon: LucideIcon; bg: string; ink: string }[] = [
  { title: "Create Resume", body: "Build ATS-friendly resume with AI", href: "/resume-builder", icon: FileText, bg: "bg-tile-blue", ink: "text-tile-blueInk" },
  { title: "Find Jobs", body: "Discover jobs matched to your profile", href: "/jobs", icon: BriefcaseBusiness, bg: "bg-tile-blue", ink: "text-azure" },
  { title: "AI Career Coach", body: "Get personalized guidance", href: "/coach", icon: Sparkles, bg: "bg-tile-lav", ink: "text-tile-lavInk" },
  { title: "Interview Prep", body: "Practice with AI mock interviews", href: INTERVIEW_APP_URL, icon: Mic, bg: "bg-status-red", ink: "text-status-redInk" },
  { title: "Skill Recommendations", body: "Learn in-demand skills", href: "/skills", icon: BarChart3, bg: "bg-tile-teal", ink: "text-tile-tealInk" },
];

function QuickTools() {
  return (
    <section aria-labelledby="tools-title">
      <h2 id="tools-title" className="mb-4 text-lg font-bold text-ink">
        Quick Tools
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {TOOLS.map(({ title, body, href, icon: Icon, bg, ink }) => (
          <Link key={title} href={href} {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="card group p-4 transition hover:border-violet/30 sm:p-5">
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", bg)}>
              <Icon className={cn("h-5 w-5", ink)} aria-hidden />
            </span>
            <span className="mt-4 block text-[15px] font-semibold text-ink">{title}</span>
            <span className="mt-1 block text-[13px] leading-snug text-ink-soft">{body}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecommendedJobs() {
  const { data, isLoading, isError, refetch } = useRecommended();
  return (
    <section aria-labelledby="rec-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="rec-title" className="text-lg font-bold text-ink">
          Recommended Jobs for You
        </h2>
        <Link href="/jobs" className="inline-flex items-center gap-1 text-sm font-semibold text-azure-ink hover:underline">
          View all <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      {isError ? (
        <div className="card flex items-center justify-between p-5 text-sm text-ink-soft">
          Recommendations didn&apos;t load.
          <button onClick={() => refetch()} className="font-semibold text-azure-ink hover:underline">
            Try again
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {isLoading
            ? [0, 1, 2].map((i) => <div key={i} className="card h-[164px] animate-pulse" />)
            : data!.map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      )}
      {data?.some((j) => j.source === "adzuna") && <AdzunaCredit className="mt-3 text-right" />}
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-7">
        <HeroBanner />
        <QuickTools />
        <RecommendedJobs />
      </div>
      <aside className="space-y-6" aria-label="Your activity">
        <ApplicationOverview />
        <UpcomingActivities />
      </aside>
    </div>
  );
}
