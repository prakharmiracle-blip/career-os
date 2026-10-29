"use client";

import { ArrowLeft, Bookmark, BriefcaseBusiness, CheckCircle2, CircleAlert, IndianRupee, Send, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { CompanyLogo } from "@/components/company-logo";
import { JobRow, MatchBadge } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { useApply, useJob, useSimilar, useToggleSave } from "@/lib/queries";
import { experience, salary, timeAgo } from "@/lib/utils";

export default function JobDetailPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { data: job, isLoading, isError } = useJob(id);
  const similar = useSimilar(id);
  const toggle = useToggleSave();
  const apply = useApply();

  if (isLoading) return <div className="card mx-auto h-96 max-w-5xl animate-pulse" />;
  if (isError || !job)
    return (
      <div className="card mx-auto max-w-5xl p-10 text-center">
        <p className="font-semibold text-ink">This job isn&apos;t available</p>
        <p className="mt-1 text-sm text-ink-soft">It may have been removed by the employer.</p>
        <Link href="/jobs" className="mt-4 inline-block text-sm font-semibold text-azure-ink hover:underline">
          Back to Job Search
        </Link>
      </div>
    );

  const tiles = [
    { icon: IndianRupee, value: salary(job.salary_min_lpa, job.salary_max_lpa), label: "Salary (Estimated)" },
    { icon: BriefcaseBusiness, value: job.job_type, label: "Employment Type" },
    { icon: UserRound, value: experience(job.exp_min, job.exp_max), label: "Experience" },
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <Link href="/jobs" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-violet">
          <ArrowLeft className="h-4 w-4" /> Job Details
        </Link>
        <article className="card p-6 sm:p-7">
          <header className="flex gap-4">
            <CompanyLogo company={job.company} size="lg" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">{job.company.name}</p>
              <h1 className="mt-0.5 text-xl font-bold leading-snug text-ink sm:text-2xl">{job.title}</h1>
              <p className="mt-1 text-sm text-ink-soft">
                {job.location} <span aria-hidden>•</span> {job.work_mode} <span aria-hidden>•</span> Posted {timeAgo(job.posted_at)}
              </p>
            </div>
          </header>

          <div className="mt-6 flex flex-wrap gap-3">
            {job.applied ? (
              <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-status-green px-5 text-sm font-semibold text-status-greenInk">
                <CheckCircle2 className="h-4 w-4" /> Applied
              </span>
            ) : (
              <Button variant="solid" className="min-w-[160px]" loading={apply.isPending} onClick={() => apply.mutate(job.id)}>
                <Send className="h-4 w-4" /> Apply Now
              </Button>
            )}
            <Button variant="outline" className="min-w-[160px]" onClick={() => toggle.mutate({ id: job.id, saved: job.saved })} aria-pressed={job.saved}>
              <Bookmark className="h-4 w-4" fill={job.saved ? "currentColor" : "none"} /> {job.saved ? "Saved" : "Save Job"}
            </Button>
          </div>
          {apply.isError && (
            <p className="mt-2 text-sm text-status-redInk" role="alert">
              {apply.error.message}
            </p>
          )}
          {apply.isSuccess && (
            <p className="mt-2 text-sm text-status-greenInk" role="status">
              Application added to your tracker.{" "}
              <Link href="/applications" className="font-semibold underline">
                View in Applications
              </Link>
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {tiles.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border border-line p-3.5">
                <Icon className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-ink">{value}</p>
                  <p className="text-xs text-ink-muted">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <section className="mt-7">
            <h2 className="text-base font-bold text-ink">Job Description</h2>
            <p className="mt-2 max-w-[72ch] text-[15px] leading-relaxed text-ink-soft">{job.description}</p>
          </section>
          <section className="mt-6">
            <h2 className="text-base font-bold text-ink">Key Responsibilities</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] text-ink-soft marker:text-violet">
              {job.responsibilities.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
          <section className="mt-6">
            <h2 className="text-base font-bold text-ink">Skills</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {job.skills.map((s) => (
                <span key={s} className="pill">
                  {s}
                </span>
              ))}
            </div>
          </section>
        </article>
      </div>

      <aside className="space-y-6 xl:pt-9" aria-label="How you match">
        {job.match && (
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">Why you match</h2>
              <MatchBadge score={job.match.score} />
            </div>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              {job.match.reasons.map((r) => (
                <li key={r} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-greenInk" aria-hidden /> {r}
                </li>
              ))}
              {job.match.matched_skills.length > 0 && (
                <li className="flex flex-wrap gap-1.5 pt-1">
                  {job.match.matched_skills.map((s) => (
                    <span key={s} className="rounded-md bg-status-green px-2 py-0.5 text-xs font-medium text-status-greenInk">
                      {s}
                    </span>
                  ))}
                </li>
              )}
            </ul>
            {job.match.missing_skills.length > 0 && (
              <>
                <h3 className="mt-5 flex items-center gap-1.5 text-sm font-bold text-ink">
                  <CircleAlert className="h-4 w-4 text-status-amberInk" aria-hidden /> Missing skills
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.match.missing_skills.map((s) => (
                    <span key={s} className="rounded-md bg-status-amber px-2 py-0.5 text-xs font-medium text-status-amberInk">
                      {s}
                    </span>
                  ))}
                </div>
              </>
            )}
            <Link
              href="/resume-builder"
              className="mt-5 flex h-10 items-center justify-center gap-2 rounded-full border border-violet/30 text-sm font-semibold text-violet-ink hover:bg-violet-soft"
            >
              <Sparkles className="h-4 w-4" /> Tailor my resume for this job
            </Link>
            <p className="mt-2 text-center text-xs text-ink-muted">AI resume tailoring arrives with the Resume Builder in Phase 2.</p>
          </section>
        )}
        {similar.data && similar.data.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-bold text-ink">Similar jobs</h2>
            <div className="space-y-3">
              {similar.data.map((j) => (
                <JobRow key={j.id} job={j} />
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
