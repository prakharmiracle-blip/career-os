"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { JobRow } from "@/components/job-card";
import { useSavedJobs } from "@/lib/queries";

export default function SavedJobsPage() {
  const { data, isLoading, isError, refetch } = useSavedJobs();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-ink">Saved Jobs</h1>
      <p className="mt-1 text-sm text-ink-soft">Jobs you bookmarked to come back to.</p>
      <div className="mt-6 space-y-3">
        {isError ? (
          <div className="card flex items-center justify-between p-5 text-sm text-ink-soft">
            Saved jobs didn&apos;t load.
            <button onClick={() => refetch()} className="font-semibold text-azure-ink hover:underline">
              Try again
            </button>
          </div>
        ) : isLoading ? (
          [0, 1, 2].map((i) => <div key={i} className="card h-[104px] animate-pulse" />)
        ) : !data?.length ? (
          <div className="card p-10 text-center">
            <p className="font-semibold text-ink">No saved jobs</p>
            <p className="mt-1 text-sm text-ink-soft">Tap the bookmark on any job to keep it here.</p>
            <Link href="/jobs" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-azure-ink hover:underline">
              Browse jobs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          data.map((job) => <JobRow key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}
