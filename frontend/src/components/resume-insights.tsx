"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export interface ResumeAnalysis {
  current_title: string;
  years_experience: number | null;
  skills: string[];
  education: string[];
  summary: string;
  ats_score: number;
  strengths: string[];
  issues: string[];
  bullet_rewrites: { original: string; improved: string }[];
}

function band(score: number) {
  if (score >= 75) return { label: "Strong", ink: "text-status-greenInk", ring: "stroke-[#14894A]" };
  if (score >= 55) return { label: "Needs a few fixes", ink: "text-status-amberInk", ring: "stroke-[#E88A00]" };
  return { label: "Needs work", ink: "text-status-redInk", ring: "stroke-[#C62B2B]" };
}

export function AtsRing({ score }: { score: number }) {
  const b = band(score);
  const c = 2 * Math.PI * 26;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" role="img" aria-label={`ATS score ${score} out of 100`}>
        <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" className="stroke-line" />
        <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" strokeLinecap="round" className={b.ring} strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <div>
        <p className="text-2xl font-extrabold text-ink">
          {score}
          <span className="text-sm font-medium text-ink-muted">/100</span>
        </p>
        <p className={cn("text-sm font-semibold", b.ink)}>ATS score: {b.label}</p>
      </div>
    </div>
  );
}

/** The AI review of a resume: score, what to fix, and rewritten bullets. */
export function ResumeInsights({ analysis, defaultOpen = false }: { analysis: ResumeAnalysis; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-line p-4">
      <AtsRing score={analysis.ats_score} />
      {analysis.summary && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{analysis.summary}</p>}
      {analysis.issues.length > 0 && (
        <>
          <p className="mt-4 text-sm font-semibold text-ink">Fix these first</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-ink-soft marker:font-semibold marker:text-ink">
            {analysis.issues.slice(0, open ? 5 : 2).map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ol>
        </>
      )}
      {open && analysis.bullet_rewrites.length > 0 && (
        <>
          <p className="mt-4 text-sm font-semibold text-ink">Stronger bullet points</p>
          <ul className="mt-2 space-y-2.5">
            {analysis.bullet_rewrites.map((b) => (
              <li key={b.original} className="rounded-lg bg-canvas p-3 text-sm">
                <p className="text-ink-muted line-through decoration-ink-muted/50">{b.original}</p>
                <p className="mt-1 font-medium text-ink">{b.improved}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      {open && analysis.strengths.length > 0 && (
        <>
          <p className="mt-4 text-sm font-semibold text-ink">What&apos;s working</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {analysis.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {(analysis.issues.length > 2 || analysis.bullet_rewrites.length > 0 || analysis.strengths.length > 0) && (
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-azure-ink hover:underline">
          {open ? "Show less" : "See the full review"} <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
