"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, RotateCcw, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { MatchBadge } from "@/components/job-card";
import { ResumeInsights, type ResumeAnalysis } from "@/components/resume-insights";
import { api, type Job, type User } from "@/lib/api";
import { keys } from "@/lib/queries";
import { cn } from "@/lib/utils";

export interface ResumeResult {
  filename: string;
  detected_skills: string[];
  added_skills: string[];
  word_count: number;
  uploaded_at: string;
  user: User;
  analysis: ResumeAnalysis | null;
  ai_enabled: boolean;
  ai_note: string | null;
}

const MAX_BYTES = 4 * 1024 * 1024;

// Each stage is a real step: the upload request, the server's analysis, then a jobs query.
const STAGES = ["Uploading your resume", "Analyzing your resume", "Fetching jobs that match you"] as const;
type Stage = 0 | 1 | 2;

/** Keep each message on screen long enough to read, even when the work is instant. */
const atLeast = <T,>(p: Promise<T>, ms: number) =>
  Promise.all([p, new Promise((r) => setTimeout(r, ms))]).then(([v]) => v);

function clientCheck(file: File): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc")) return "Old .doc files aren't supported. Save it as PDF or DOCX and upload again.";
  if (!name.endsWith(".pdf") && !name.endsWith(".docx")) return "Upload your resume as a PDF or DOCX file.";
  if (file.size > MAX_BYTES) return "The file is larger than 4 MB. Upload a smaller PDF or DOCX.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

export function ResumeUpload({
  onComplete,
  compact = false,
}: {
  onComplete?: (r: ResumeResult, jobs: Job[]) => void;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ r: ResumeResult; jobs: Job[] } | null>(null);
  const [fileName, setFileName] = useState("");

  const run = async (file: File) => {
    setError(null);
    setResult(null);
    const bad = clientCheck(file);
    if (bad) return setError(bad);
    setFileName(file.name);

    try {
      setStage(0);
      const form = new FormData();
      form.append("file", file);
      const upload = api<ResumeResult>("/api/me/resume", { method: "POST", body: form });
      // The upload and the analysis are one request; switch the label once the bytes are likely sent.
      const toAnalyzing = setTimeout(() => setStage((s) => (s === 0 ? 1 : s)), 700);
      const r = await atLeast(upload, 1600);
      clearTimeout(toAnalyzing);
      qc.setQueryData(keys.me, r.user);
      qc.invalidateQueries({ queryKey: ["resume"] });

      setStage(2);
      const jobs = await atLeast(api<Job[]>("/api/jobs/recommended?limit=3"), 900);
      qc.invalidateQueries({ queryKey: ["jobs"] });

      setResult({ r, jobs });
      onComplete?.(r, jobs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStage(null);
      if (input.current) input.current.value = "";
    }
  };

  if (stage !== null) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6" role="status" aria-live="polite">
        <p className="flex items-center gap-2 truncate text-sm text-ink-soft">
          <FileText className="h-4 w-4 shrink-0" aria-hidden /> {fileName}
        </p>
        <ol className="mt-5 space-y-4">
          {STAGES.map((label, i) => {
            const done = i < stage;
            const active = i === stage;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    done && "bg-status-green text-status-greenInk",
                    active && "bg-violet-soft text-violet",
                    !done && !active && "bg-canvas text-ink-muted",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs font-semibold">{i + 1}</span>}
                </span>
                <span className={cn("text-[15px]", active ? "font-semibold text-ink" : done ? "text-ink-soft" : "text-ink-muted")}>
                  {label}
                  {active && "…"}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (result) {
    const { r, jobs } = result;
    return (
      <div className="rounded-2xl border border-line bg-white p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-status-greenInk">
          <Check className="h-4 w-4" /> Resume analyzed
        </p>
        <p className="mt-2 text-[15px] text-ink">
          {r.detected_skills.length
            ? `We found ${r.detected_skills.length} skill${r.detected_skills.length === 1 ? "" : "s"} in your resume${
                r.added_skills.length ? `, and added ${r.added_skills.length} new one${r.added_skills.length === 1 ? "" : "s"} to your profile.` : ". Your profile already had all of them."
              }`
            : "We couldn't spot skills we recognise in this resume, so your profile skills are unchanged. You can add them by hand."}
        </p>
        {r.detected_skills.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills found">
            {r.detected_skills.map((s) => {
              const isNew = r.added_skills.includes(s);
              return (
                <li key={s} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", isNew ? "bg-status-green text-status-greenInk" : "bg-canvas text-ink-soft")}>
                  {isNew && "+ "}
                  {s}
                </li>
              );
            })}
          </ul>
        )}
        {r.analysis && (
          <div className="mt-5">
            <ResumeInsights analysis={r.analysis} />
          </div>
        )}
        {r.ai_note && <p className="mt-3 rounded-lg bg-status-amber px-3 py-2 text-xs text-status-amberInk">{r.ai_note}</p>}
        {!compact && jobs.length > 0 && (
          <>
            <p className="mt-5 text-sm font-semibold text-ink">Your top matches</p>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{j.title}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {j.company.name} <span aria-hidden>•</span> {j.location}
                    </span>
                  </span>
                  {j.match && <MatchBadge score={j.match.score} />}
                </li>
              ))}
            </ul>
          </>
        )}
        <button onClick={() => input.current?.click()} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-azure-ink hover:underline">
          <RotateCcw className="h-3.5 w-3.5" /> Upload a different file
        </button>
        <input ref={input} type="file" accept=".pdf,.docx" className="sr-only" tabIndex={-1} onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
      </div>
    );
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) run(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet",
          compact ? "py-7" : "py-10",
          drag ? "border-violet bg-violet-soft" : "border-line bg-canvas/60 hover:border-violet/50",
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-card">
          <UploadCloud className="h-6 w-6 text-violet" aria-hidden />
        </span>
        <span className="mt-4 text-[15px] font-semibold text-ink">Drop your resume here, or click to choose a file</span>
        <span className="mt-1 text-sm text-ink-muted">PDF or DOCX, up to 4 MB</span>
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          aria-label="Upload resume"
          onChange={(e) => e.target.files?.[0] && run(e.target.files[0])}
        />
      </label>
      {error && (
        <p className="mt-3 rounded-xl bg-status-red px-4 py-3 text-sm font-medium text-status-redInk" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
