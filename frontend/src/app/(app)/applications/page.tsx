"use client";

import { ArrowRight, Columns3, List, NotebookPen } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { CompanyLogo } from "@/components/company-logo";
import { STATUS_LABEL, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { AppStatus, Application } from "@/lib/api";
import { useApplications, useUpdateApplication } from "@/lib/queries";
import { cn } from "@/lib/utils";

const TABS: { key: string; label: string; match: (s: AppStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "applied", label: "Applied", match: (s) => s === "applied" },
  { key: "progress", label: "In Progress", match: (s) => s === "under_review" },
  { key: "interviews", label: "Interviews", match: (s) => s === "interview_scheduled" },
  { key: "offers", label: "Offers", match: (s) => s === "offer" },
];

const COLUMNS: AppStatus[] = ["applied", "under_review", "interview_scheduled", "offer", "rejected"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StatusSelect({ app }: { app: Application }) {
  const update = useUpdateApplication();
  return (
    <label>
      <span className="sr-only">Status for {app.job.title}</span>
      <select
        value={app.status}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ id: app.id, status: e.target.value as AppStatus })}
        className="cursor-pointer rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-medium text-ink"
      >
        {COLUMNS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

function NotesForm({ app, onClose }: { app: Application; onClose: () => void }) {
  const update = useUpdateApplication();
  const [notes, setNotes] = useState(app.notes);
  return (
    <>
      <label htmlFor="app-notes" className="sr-only">
        Notes
      </label>
      <textarea
        id="app-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        maxLength={5000}
        placeholder="Recruiter name, interview rounds, questions they asked…"
        className="input h-auto py-3"
      />
      {update.isError && (
        <p className="mt-2 text-sm text-status-redInk" role="alert">
          {update.error.message}
        </p>
      )}
      <Button className="mt-4 w-full" loading={update.isPending} onClick={() => update.mutate({ id: app.id, notes }, { onSuccess: onClose })}>
        Save notes
      </Button>
    </>
  );
}

function NotesDialog({ app, onClose }: { app: Application | null; onClose: () => void }) {
  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      {app && (
        <DialogContent title="Notes" description={`${app.job.title} at ${app.job.company.name}`}>
          <NotesForm key={app.id} app={app} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function Tracker() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = TABS.find((t) => t.key === sp.get("tab")) ?? TABS[0]!;
  const [view, setView] = useState<"list" | "board">("list");
  const [notesFor, setNotesFor] = useState<Application | null>(null);
  const { data = [], isLoading, isError, refetch } = useApplications();
  const rows = data.filter((a) => tab.match(a.status));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Application Tracking</h1>
          <p className="mt-1 text-sm text-ink-soft">Every job you&apos;ve applied to, in one place.</p>
        </div>
        <div className="flex rounded-lg border border-line bg-white p-0.5" role="group" aria-label="View">
          {(["list", "board"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold", view === v ? "bg-violet-soft text-violet-ink" : "text-ink-soft")}
            >
              {v === "list" ? <List className="h-3.5 w-3.5" /> : <Columns3 className="h-3.5 w-3.5" />}
              {v === "list" ? "List" : "Kanban"}
            </button>
          ))}
        </div>
      </div>

      {view === "list" && (
        <div role="tablist" aria-label="Filter applications" className="mt-5 flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => {
            const count = data.filter((a) => t.match(a.status)).length;
            const active = t.key === tab.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => router.replace(t.key === "all" ? pathname : `${pathname}?tab=${t.key}`, { scroll: false })}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium",
                  active ? "border-azure text-azure-ink" : "border-transparent text-ink-soft hover:text-ink",
                )}
              >
                {t.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        {isError ? (
          <div className="card flex items-center justify-between p-5 text-sm text-ink-soft">
            Applications didn&apos;t load.
            <button onClick={() => refetch()} className="font-semibold text-azure-ink hover:underline">
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="card h-64 animate-pulse" />
        ) : data.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-semibold text-ink">No applications yet</p>
            <p className="mt-1 text-sm text-ink-soft">Apply to a job and it will appear here so you can track its status.</p>
            <Link href="/jobs" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-azure-ink hover:underline">
              Find jobs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : view === "list" ? (
          <ul className="card divide-y divide-line">
            {rows.length === 0 && <li className="p-6 text-sm text-ink-soft">No applications in this stage.</li>}
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                <CompanyLogo company={a.job.company} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{a.job.company.name}</p>
                  <p className="truncate text-sm text-ink-soft">{a.job.title}</p>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <StatusBadge status={a.status} />
                  <span className="text-xs text-ink-muted">Applied on {fmtDate(a.applied_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusSelect app={a} />
                  <button
                    onClick={() => setNotesFor(a)}
                    className={cn("rounded-lg p-2 hover:bg-canvas", a.notes ? "text-violet" : "text-ink-muted")}
                    aria-label={`${a.notes ? "Edit" : "Add"} notes for ${a.job.title}`}
                  >
                    <NotebookPen className="h-4 w-4" />
                  </button>
                  <Link href={`/jobs/${a.job.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-azure-ink hover:underline">
                    View <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid auto-cols-[260px] grid-flow-col gap-4 overflow-x-auto pb-2">
            {COLUMNS.map((col) => {
              const items = data.filter((a) => a.status === col);
              return (
                <section key={col} className="rounded-card bg-white/60 p-3" aria-label={STATUS_LABEL[col]}>
                  <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-ink">
                    {STATUS_LABEL[col]} <span className="text-ink-muted">{items.length}</span>
                  </h2>
                  <ul className="space-y-2.5">
                    {items.map((a) => (
                      <li key={a.id} className="card p-3.5">
                        <div className="flex items-center gap-2.5">
                          <CompanyLogo company={a.job.company} size="sm" />
                          <div className="min-w-0">
                            <Link href={`/jobs/${a.job.id}`} className="block truncate text-sm font-semibold text-ink hover:text-violet">
                              {a.job.title}
                            </Link>
                            <p className="truncate text-xs text-ink-soft">{a.job.company.name}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <StatusSelect app={a} />
                          <button onClick={() => setNotesFor(a)} className="text-xs font-semibold text-azure-ink hover:underline">
                            {a.notes ? "Notes" : "Add notes"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
      <NotesDialog app={notesFor} onClose={() => setNotesFor(null)} />
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense>
      <Tracker />
    </Suspense>
  );
}
