"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect } from "react";

import { INTERVIEW_APP_URL } from "@/lib/nav";

/** Old links to /interview-prep land here and continue to Miracle Interview AI. */
export default function InterviewPrepRedirect() {
  useEffect(() => {
    window.location.replace(INTERVIEW_APP_URL);
  }, []);
  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      <p className="text-sm text-ink-soft">Opening Miracle Interview AI…</p>
      <a href={INTERVIEW_APP_URL} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-azure-ink hover:underline">
        Continue to Interview Prep <ArrowUpRight className="h-4 w-4" />
      </a>
    </div>
  );
}
