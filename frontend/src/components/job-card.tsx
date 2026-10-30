"use client";

import { Bookmark, MapPin } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company-logo";
import type { Job } from "@/lib/api";
import { useToggleSave } from "@/lib/queries";
import { cn, placeLine, salary, timeAgo } from "@/lib/utils";

export function SaveButton({ job, className }: { job: Job; className?: string }) {
  const toggle = useToggleSave();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({ id: job.id, saved: job.saved });
      }}
      aria-pressed={job.saved}
      aria-label={job.saved ? `Remove ${job.title} at ${job.company.name} from saved jobs` : `Save ${job.title} at ${job.company.name}`}
      className={cn("rounded-lg p-1.5 text-ink-soft transition hover:bg-violet-soft hover:text-violet", job.saved && "text-violet", className)}
    >
      <Bookmark className="h-[18px] w-[18px]" fill={job.saved ? "currentColor" : "none"} strokeWidth={1.8} />
    </button>
  );
}

function SalaryPill({ job }: { job: Job }) {
  const text = salary(job.salary_min_lpa, job.salary_max_lpa, job.salary_estimated);
  return text ? <span className="pill">{text}</span> : <span className="pill bg-canvas text-ink-muted">Salary not disclosed</span>;
}

/** Adzuna's terms require crediting them wherever their jobs are shown. */
export function AdzunaCredit({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-ink-muted", className)}>
      <a href="https://www.adzuna.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink-soft hover:underline">
        Jobs by Adzuna
      </a>
    </p>
  );
}

export function MatchBadge({ score }: { score: number }) {
  const tone = score >= 70 ? "bg-status-green text-status-greenInk" : score >= 45 ? "bg-status-amber text-status-amberInk" : "bg-canvas text-ink-soft";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", tone)}>{score}% match</span>;
}

/** Card used on Home ("Recommended Jobs for You"). */
export function JobCard({ job }: { job: Job }) {
  return (
    <article className="card relative flex flex-col p-5 transition hover:border-violet/30">
      <div className="flex items-start gap-3.5">
        <CompanyLogo company={job.company} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-ink">
            <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0 after:rounded-card">
              {job.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-sm text-ink-soft">{job.company.name}</p>
          <p className="mt-1 truncate text-sm text-ink-soft">{placeLine(job.location, job.work_mode)}</p>
        </div>
        <SaveButton job={job} className="relative z-10 -mr-1 -mt-1" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 pl-[58px]">
        <SalaryPill job={job} />
        {job.job_type && <span className="pill">{job.job_type}</span>}
        {job.match && <MatchBadge score={job.match.score} />}
      </div>
      <p className="mt-3 pl-[58px] text-sm text-ink-muted">{timeAgo(job.posted_at)}</p>
    </article>
  );
}

/** Compact row used in Job Search and Saved Jobs lists. */
export function JobRow({ job }: { job: Job }) {
  return (
    <article className="card relative flex gap-4 p-4 transition hover:border-violet/30 sm:p-5">
      <CompanyLogo company={job.company} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-ink">
              <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0 after:rounded-card">
                {job.title}
              </Link>
            </h3>
            <p className="text-sm text-ink-soft">{job.company.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SalaryPill job={job} />
            {job.job_type && <span className="pill">{job.job_type}</span>}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-soft">
          <span>
            <MapPin className="mr-1 inline h-3.5 w-3.5 -translate-y-px" aria-hidden />
            {placeLine(job.location, job.work_mode)}
          </span>
          <span className="text-ink-muted">{timeAgo(job.posted_at)}</span>
          {job.applied && <span className="rounded-full bg-status-green px-2 py-0.5 text-xs font-semibold text-status-greenInk">Applied</span>}
          {job.match && (
            <span className="group relative z-10">
              <MatchBadge score={job.match.score} />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-xl bg-navy-900 p-3 text-xs leading-relaxed text-white shadow-xl group-hover:block"
              >
                {job.match.reasons.length ? job.match.reasons.join(". ") + "." : "Add skills to your profile to improve matching."}
              </span>
            </span>
          )}
        </div>
      </div>
      <SaveButton job={job} className="relative z-10 self-start" />
    </article>
  );
}
