"use client";

import { ArrowLeft, Check, CircleAlert, Download, FileDown, Loader2, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AtsRing } from "@/components/resume-insights";
import { ResumeEditor } from "@/components/resume/editor";
import { ScaledPreview } from "@/components/resume/preview";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAiStatus } from "@/lib/queries";
import { saveResume, TEMPLATES, useAts, useResumeDoc, type ResumeData, type ResumeDoc, type Template } from "@/lib/resume";
import { cn } from "@/lib/utils";

const STEPS = ["Choose Template", "Edit Details", "AI Suggestions", "Download"] as const;

type SaveState = "saved" | "saving" | "dirty" | "error";

function Builder({ doc }: { doc: ResumeDoc }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<ResumeData>(doc.data);
  const [template, setTemplate] = useState<Template>(doc.template);
  const [title, setTitle] = useState(doc.title);
  const [save, setSave] = useState<SaveState>("saved");
  const [version, setVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ data, template, title });
  latest.current = { data, template, title };
  const ai = useAiStatus();
  const aiOn = !!ai.data?.enabled;
  const ats = useAts(doc.id, version);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSave("saving");
    try {
      await saveResume(doc.id, latest.current);
      setSave("saved");
      setVersion((v) => v + 1);
    } catch {
      setSave("error");
      throw new Error("save failed");
    }
  }, [doc.id]);

  const schedule = useCallback(() => {
    setSave("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush().catch(() => undefined), 900);
  }, [flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (timer.current) {
        e.preventDefault();
        flush().catch(() => undefined);
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (timer.current) flush().catch(() => undefined);
    };
  }, [flush]);

  const set = (fn: (d: ResumeData) => ResumeData) => {
    setData((d) => fn(d));
    schedule();
  };

  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const importUploaded = async () => {
    setImportErr(null);
    setImporting(true);
    try {
      await flush().catch(() => undefined);
      const r = await api<ResumeDoc>(`/api/resumes/${doc.id}/import`, { method: "POST" });
      setData(r.data);
      setVersion((v) => v + 1);
      setStep(1);
    } catch (e) {
      setImportErr((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const [dl, setDl] = useState<"pdf" | "docx" | null>(null);
  const download = async (format: "pdf" | "docx") => {
    setDl(format);
    try {
      await flush();
      const a = document.createElement("a");
      a.href = `/api/resumes/${doc.id}/export?format=${format}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* save state shows the error */
    } finally {
      setTimeout(() => setDl(null), 800);
    }
  };

  const saveLabel = { saved: "All changes saved", saving: "Saving…", dirty: "Unsaved changes", error: "Couldn't save. Retrying when you edit again." }[save];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/resume-builder" className="rounded-lg p-1.5 text-ink-soft hover:bg-white" aria-label="Back to all resumes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <label htmlFor="doc-title" className="sr-only">
            Resume name
          </label>
          <input
            id="doc-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value.slice(0, 120) || "My resume");
              schedule();
            }}
            className="min-w-0 rounded-lg bg-transparent px-2 py-1 text-xl font-bold text-ink hover:bg-white focus:bg-white"
          />
        </div>
        <p className={cn("text-xs", save === "error" ? "text-status-redInk" : "text-ink-muted")} role="status">
          {save === "saving" && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
          {saveLabel}
        </p>
      </div>

      <ol className="mt-4 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              onClick={() => setStep(i)}
              aria-current={step === i ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium",
                step === i ? "border-azure bg-azure text-white" : "border-line bg-white text-ink-soft hover:text-ink",
              )}
            >
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold", step === i ? "bg-white/25" : "bg-canvas")}>{i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="min-w-0">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTemplate(t.id);
                    schedule();
                  }}
                  aria-pressed={template === t.id}
                  className={cn("card overflow-hidden p-3 text-left transition", template === t.id ? "border-azure ring-2 ring-azure/30" : "hover:border-violet/30")}
                >
                  <ScaledPreview data={data} template={t.id} className="pointer-events-none" />
                  <p className="mt-3 flex items-center justify-between text-sm font-semibold text-ink">
                    {t.name} {template === t.id && <Check className="h-4 w-4 text-azure" />}
                  </p>
                  <p className="text-xs text-ink-muted">{t.blurb}</p>
                </button>
              ))}
              <p className="text-sm text-ink-soft sm:col-span-3">
                All three use one column and standard section names, which applicant tracking systems read reliably.
                <button onClick={() => setStep(1)} className="ml-1 font-semibold text-azure-ink hover:underline">
                  Next: edit details
                </button>
              </p>
            </div>
          )}

          {step === 1 && (
            <>
              {aiOn && (
                <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm text-ink-soft">Already uploaded a resume? Fill this one from it in seconds.</p>
                  <Button variant="outline" size="sm" onClick={importUploaded} loading={importing}>
                    <Upload className="h-4 w-4" /> Fill from my uploaded resume
                  </Button>
                  {importErr && (
                    <p className="w-full text-sm text-status-redInk" role="alert">
                      {importErr}
                    </p>
                  )}
                </div>
              )}
              <ResumeEditor data={data} set={set} docId={doc.id} ai={aiOn} />
            </>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <section className="card p-5">
                {ats.data ? (
                  <>
                    <AtsRing score={ats.data.score} />
                    <p className="mt-3 text-sm text-ink-soft">
                      Based on {ats.data.checks.length} checks recruiters and ATS filters care about
                      {ats.data.target_role ? `, against jobs for ${ats.data.target_role}` : ""}. It updates as you edit.
                    </p>
                    <ul className="mt-4 divide-y divide-line">
                      {[...ats.data.checks].sort((a, b) => Number(a.pass) - Number(b.pass) || b.weight - a.weight).map((c) => (
                        <li key={c.id} className="flex gap-3 py-2.5">
                          {c.pass ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-greenInk" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-amberInk" />}
                          <p className={cn("text-sm", c.pass ? "text-ink-soft" : "text-ink")}>{c.message}</p>
                          <span className="ml-auto shrink-0 text-xs text-ink-muted">{c.weight} pts</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="h-48 animate-pulse rounded-xl bg-canvas" />
                )}
              </section>
              {ats.data && (ats.data.keywords_missing.length > 0 || ats.data.keywords_found.length > 0) && (
                <section className="card p-5">
                  <h3 className="text-[15px] font-bold text-ink">Keyword gaps</h3>
                  <p className="mt-1 text-sm text-ink-soft">Skills that open jobs for your role ask for most. Add only the ones you really have.</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ats.data.keywords_found.map((k) => (
                      <span key={k} className="rounded-full bg-status-green px-2.5 py-1 text-xs font-medium text-status-greenInk">
                        <Check className="mr-0.5 inline h-3 w-3" /> {k}
                      </span>
                    ))}
                    {ats.data.keywords_missing.map((k) => (
                      <button
                        key={k}
                        onClick={() => set((d) => (d.skills.includes(k) ? d : { ...d, skills: [...d.skills, k] }))}
                        className="rounded-full border border-status-amberInk/30 bg-status-amber px-2.5 py-1 text-xs font-medium text-status-amberInk hover:border-status-amberInk"
                        title="Add to my skills"
                      >
                        + {k}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="card p-5">
                <h3 className="flex items-center gap-2 text-[15px] font-bold text-ink">
                  <Sparkles className="h-4 w-4 text-violet" /> AI rewrites
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {aiOn
                    ? "In Edit Details, press the sparkle beside any bullet to rewrite it with a strong verb and a measurable result."
                    : "AI rewrites switch on once an AI key is added on the server. The checks above work without it."}
                </p>
                {aiOn && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setStep(1)}>
                    Go to bullets
                  </Button>
                )}
              </section>
            </div>
          )}

          {step === 3 && (
            <section className="card p-6">
              <h2 className="text-lg font-bold text-ink">Download your resume</h2>
              <p className="mt-1 text-sm text-ink-soft">
                PDF is best for applying online. Word (DOCX) is for recruiters who ask for an editable copy. Both contain real text that ATS can read.
              </p>
              {(() => {
                const all = [...data.experience.flatMap((e) => e.bullets), ...data.projects.flatMap((p) => p.bullets), data.basics.summary];
                const left = all.filter((x) => x.includes("[add number]")).length;
                return left > 0 ? (
                  <p className="mt-4 rounded-xl bg-status-red px-4 py-3 text-sm font-medium text-status-redInk" role="alert">
                    {left} bullet{left === 1 ? " still has" : "s still have"} &ldquo;[add number]&rdquo;. Replace it with your real figure in Edit Details before you download.
                  </p>
                ) : null;
              })()}
              {ats.data && ats.data.score < 70 && (
                <p className="mt-4 rounded-xl bg-status-amber px-4 py-3 text-sm text-status-amberInk">
                  Your ATS score is {ats.data.score}. A few fixes in AI Suggestions could lift it before you send this out.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => download("pdf")} loading={dl === "pdf"}>
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button variant="outline" onClick={() => download("docx")} loading={dl === "docx"}>
                  <FileDown className="h-4 w-4" /> Download Word
                </Button>
              </div>
            </section>
          )}

          <div className="mt-5 flex justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            {step < 3 && <Button onClick={() => setStep((s) => s + 1)}>Next: {STEPS[step + 1]}</Button>}
          </div>
        </div>

        {step !== 0 && (
          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start" aria-label="Live preview">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Preview</p>
              <div className="flex gap-1" role="group" aria-label="Template">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTemplate(t.id);
                      schedule();
                    }}
                    aria-pressed={template === t.id}
                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium", template === t.id ? "bg-violet-soft text-violet-ink" : "text-ink-muted hover:text-ink")}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <ScaledPreview data={data} template={template} />
          </aside>
        )}
      </div>
    </div>
  );
}

export default function ResumeBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const doc = useResumeDoc(id);
  if (doc.isLoading) return <div className="card mx-auto h-96 max-w-7xl animate-pulse" />;
  if (doc.isError || !doc.data)
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <p className="font-semibold text-ink">This resume isn&apos;t available</p>
        <Link href="/resume-builder" className="mt-3 inline-block text-sm font-semibold text-azure-ink hover:underline">
          Back to your resumes
        </Link>
      </div>
    );
  return <Builder key={doc.data.id} doc={doc.data} />;
}
