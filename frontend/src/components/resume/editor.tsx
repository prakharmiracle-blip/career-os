"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useId, useState } from "react";

import { SkillsInput } from "@/components/skills-input";
import { api } from "@/lib/api";
import { emptyEducation, emptyExperience, emptyProject, type ResumeData } from "@/lib/resume";
import { cn } from "@/lib/utils";

type Set = (fn: (d: ResumeData) => ResumeData) => void;

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  const fid = useId();
  return (
    <div className={className}>
      <label htmlFor={fid} className="mb-1 block text-xs font-medium text-ink-soft">
        {label}
      </label>
      <input id={fid} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input h-10" />
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/** Bullet list with add/remove and an optional AI "Improve" per bullet. */
function BulletList({ items, onChange, docId, ai }: { items: string[]; onChange: (v: string[]) => void; docId: string; ai: boolean }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const improve = async (i: number) => {
    setErr(null);
    setBusy(i);
    try {
      const r = await api<{ improved: string }>(`/api/resumes/${docId}/improve`, { method: "POST", json: { bullet: items[i] } });
      onChange(items.map((x, k) => (k === i ? r.improved : x)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink-soft">Bullet points</p>
      <ul className="space-y-2">
        {items.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" aria-hidden />
            <textarea
              value={b}
              onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
              rows={2}
              aria-label={`Bullet ${i + 1}`}
              placeholder="Start with an action verb and add a number: Built…, Reduced…, Led…"
              className="input h-auto flex-1 resize-y py-2 text-[13px]"
            />
            <div className="flex flex-col gap-1">
              {ai && b.trim().length > 3 && (
                <button
                  type="button"
                  onClick={() => improve(i)}
                  disabled={busy !== null}
                  className="rounded-lg p-1.5 text-violet hover:bg-violet-soft disabled:opacity-50"
                  aria-label={`Improve bullet ${i + 1} with AI`}
                  title="Improve with AI"
                >
                  {busy === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </button>
              )}
              <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} className="rounded-lg p-1.5 text-ink-muted hover:bg-status-red hover:text-status-redInk" aria-label={`Remove bullet ${i + 1}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {err && (
        <p className="mt-1 text-xs text-status-redInk" role="alert">
          {err}
        </p>
      )}
      {items.length < 10 && (
        <button type="button" onClick={() => onChange([...items, ""])} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-azure-ink hover:underline">
          <Plus className="h-3.5 w-3.5" /> Add bullet
        </button>
      )}
      {ai && <p className="mt-1 text-[11px] text-ink-muted">AI never invents numbers: it writes [add number] where you should put the real figure.</p>}
    </div>
  );
}

function ItemControls({ i, n, onMove, onRemove, label }: { i: number; n: number; onMove: (d: -1 | 1) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onMove(-1)} disabled={i === 0} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas disabled:opacity-30" aria-label={`Move ${label} up`}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => onMove(1)} disabled={i === n - 1} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas disabled:opacity-30" aria-label={`Move ${label} down`}>
        <ArrowDown className="h-4 w-4" />
      </button>
      <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-ink-muted hover:bg-status-red hover:text-status-redInk" aria-label={`Remove ${label}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ResumeEditor({ data, set, docId, ai }: { data: ResumeData; set: Set; docId: string; ai: boolean }) {
  const b = data.basics;
  const basic = (k: keyof typeof b) => (v: string) => set((d) => ({ ...d, basics: { ...d.basics, [k]: v } }));
  const words = b.summary.trim() ? b.summary.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-4">
      <Section title="Contact details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={b.name} onChange={basic("name")} />
          <Field label="Headline" value={b.title} onChange={basic("title")} placeholder="Data Analyst" />
          <Field label="Email" type="email" value={b.email} onChange={basic("email")} />
          <Field label="Phone" value={b.phone} onChange={basic("phone")} placeholder="+91 98765 43210" />
          <Field label="City" value={b.location} onChange={basic("location")} placeholder="Pune, India" />
          <Field label="LinkedIn" value={b.linkedin} onChange={basic("linkedin")} placeholder="linkedin.com/in/yourname" />
          <Field label="Portfolio or GitHub" value={b.website} onChange={basic("website")} className="sm:col-span-2" />
        </div>
      </Section>

      <Section title="Summary">
        <label htmlFor="summary" className="sr-only">
          Summary
        </label>
        <textarea
          id="summary"
          value={b.summary}
          onChange={(e) => basic("summary")(e.target.value)}
          rows={4}
          placeholder="2–4 sentences: who you are, what you're good at, and the role you want."
          className="input h-auto py-2.5 text-[13px]"
        />
        <p className={cn("mt-1 text-right text-[11px]", words && (words < 25 || words > 90) ? "text-status-amberInk" : "text-ink-muted")}>{words} words (aim for 25–90)</p>
      </Section>

      <Section
        title="Experience"
        action={
          data.experience.length < 12 && (
            <button type="button" onClick={() => set((d) => ({ ...d, experience: [...d.experience, emptyExperience()] }))} className="inline-flex items-center gap-1 text-sm font-semibold text-azure-ink hover:underline">
              <Plus className="h-4 w-4" /> Add job
            </button>
          )
        }
      >
        {data.experience.length === 0 && <p className="text-sm text-ink-muted">No jobs yet. Freshers can skip this and add projects or internships instead.</p>}
        <div className="space-y-5">
          {data.experience.map((x, i) => {
            const up = (patch: Partial<typeof x>) => set((d) => ({ ...d, experience: d.experience.map((e, k) => (k === i ? { ...e, ...patch } : e)) }));
            return (
              <div key={i} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{x.role || x.company || `Job ${i + 1}`}</p>
                  <ItemControls
                    i={i}
                    n={data.experience.length}
                    label={`job ${i + 1}`}
                    onMove={(dir) => set((d) => ({ ...d, experience: move(d.experience, i, dir) }))}
                    onRemove={() => set((d) => ({ ...d, experience: d.experience.filter((_, k) => k !== i) }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Job title" value={x.role} onChange={(v) => up({ role: v })} />
                  <Field label="Company" value={x.company} onChange={(v) => up({ company: v })} />
                  <Field label="Start" value={x.start} onChange={(v) => up({ start: v })} placeholder="Jan 2024" />
                  <Field label="End" value={x.end} onChange={(v) => up({ end: v })} placeholder="Present" />
                  <Field label="Location" value={x.location} onChange={(v) => up({ location: v })} className="sm:col-span-2" />
                </div>
                <div className="mt-3">
                  <BulletList items={x.bullets} onChange={(v) => up({ bullets: v })} docId={docId} ai={ai} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Projects"
        action={
          data.projects.length < 10 && (
            <button type="button" onClick={() => set((d) => ({ ...d, projects: [...d.projects, emptyProject()] }))} className="inline-flex items-center gap-1 text-sm font-semibold text-azure-ink hover:underline">
              <Plus className="h-4 w-4" /> Add project
            </button>
          )
        }
      >
        {data.projects.length === 0 && <p className="text-sm text-ink-muted">College, personal or freelance projects all count.</p>}
        <div className="space-y-5">
          {data.projects.map((p, i) => {
            const up = (patch: Partial<typeof p>) => set((d) => ({ ...d, projects: d.projects.map((e, k) => (k === i ? { ...e, ...patch } : e)) }));
            return (
              <div key={i} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{p.name || `Project ${i + 1}`}</p>
                  <ItemControls
                    i={i}
                    n={data.projects.length}
                    label={`project ${i + 1}`}
                    onMove={(dir) => set((d) => ({ ...d, projects: move(d.projects, i, dir) }))}
                    onRemove={() => set((d) => ({ ...d, projects: d.projects.filter((_, k) => k !== i) }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Project name" value={p.name} onChange={(v) => up({ name: v })} />
                  <Field label="Link" value={p.link} onChange={(v) => up({ link: v })} placeholder="github.com/you/project" />
                </div>
                <div className="mt-3">
                  <BulletList items={p.bullets} onChange={(v) => up({ bullets: v })} docId={docId} ai={ai} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Education"
        action={
          data.education.length < 6 && (
            <button type="button" onClick={() => set((d) => ({ ...d, education: [...d.education, emptyEducation()] }))} className="inline-flex items-center gap-1 text-sm font-semibold text-azure-ink hover:underline">
              <Plus className="h-4 w-4" /> Add education
            </button>
          )
        }
      >
        <div className="space-y-4">
          {data.education.map((e, i) => {
            const up = (patch: Partial<typeof e>) => set((d) => ({ ...d, education: d.education.map((x, k) => (k === i ? { ...x, ...patch } : x)) }));
            return (
              <div key={i} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{e.degree || `Education ${i + 1}`}</p>
                  <ItemControls
                    i={i}
                    n={data.education.length}
                    label={`education ${i + 1}`}
                    onMove={(dir) => set((d) => ({ ...d, education: move(d.education, i, dir) }))}
                    onRemove={() => set((d) => ({ ...d, education: d.education.filter((_, k) => k !== i) }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Degree" value={e.degree} onChange={(v) => up({ degree: v })} placeholder="B.Tech, Computer Science" />
                  <Field label="College or university" value={e.school} onChange={(v) => up({ school: v })} />
                  <Field label="Start" value={e.start} onChange={(v) => up({ start: v })} placeholder="2020" />
                  <Field label="End" value={e.end} onChange={(v) => up({ end: v })} placeholder="2024" />
                  <Field label="Score (optional)" value={e.score} onChange={(v) => up({ score: v })} placeholder="8.2 CGPA" className="sm:col-span-2" />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Skills">
        <SkillsInput id="resume-skills" value={data.skills} onChange={(v) => set((d) => ({ ...d, skills: v.slice(0, 60) }))} />
      </Section>

      <Section title="Certifications">
        <label htmlFor="certs" className="mb-1 block text-xs font-medium text-ink-soft">
          One per line
        </label>
        <textarea
          id="certs"
          value={data.certifications.join("\n")}
          onChange={(e) => set((d) => ({ ...d, certifications: e.target.value.split("\n").slice(0, 15) }))}
          rows={3}
          placeholder="Google Data Analytics Certificate, 2024"
          className="input h-auto py-2.5 text-[13px]"
        />
      </Section>
    </div>
  );
}
