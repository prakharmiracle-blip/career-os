"use client";

import { Copy, FileText, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TEMPLATES, useCreateResume, useDeleteResume, useDuplicateResume, useResumeList, type ResumeDocSummary } from "@/lib/resume";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ResumeListPage() {
  const router = useRouter();
  const list = useResumeList();
  const create = useCreateResume();
  const dup = useDuplicateResume();
  const del = useDeleteResume();
  const [confirm, setConfirm] = useState<ResumeDocSummary | null>(null);

  const newResume = () => create.mutate({ title: "My resume" }, { onSuccess: (r) => router.push(`/resume-builder/${r.id}`) });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Resume Builder</h1>
          <p className="mt-1 text-sm text-ink-soft">Create a professional, ATS-friendly resume in minutes.</p>
        </div>
        <Button onClick={newResume} loading={create.isPending}>
          <Plus className="h-4 w-4" /> New resume
        </Button>
      </div>
      {(create.isError || dup.isError) && (
        <p className="mt-3 rounded-xl bg-status-red px-4 py-3 text-sm text-status-redInk" role="alert">
          {(create.error ?? dup.error)?.message}
        </p>
      )}

      <div className="mt-6">
        {list.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-36 animate-pulse" />
            ))}
          </div>
        ) : !list.data?.length ? (
          <div className="card p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-violet" />
            <p className="mt-3 font-semibold text-ink">No resumes yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">We&apos;ll start you off with your name, contact details and skills from your profile.</p>
            <Button className="mt-5" onClick={newResume} loading={create.isPending}>
              Create my first resume
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.map((r) => (
              <li key={r.id} className="card relative flex flex-col p-5 transition hover:border-violet/30">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-tile-blue">
                  <FileText className="h-5 w-5 text-tile-blueInk" />
                </span>
                <h2 className="mt-3 truncate text-[15px] font-semibold text-ink">
                  <Link href={`/resume-builder/${r.id}`} className="after:absolute after:inset-0 after:rounded-card">
                    {r.title}
                  </Link>
                </h2>
                <p className="text-sm text-ink-soft">
                  {TEMPLATES.find((t) => t.id === r.template)?.name ?? r.template} template <span aria-hidden>•</span> Edited {fmt(r.updated_at)}
                </p>
                <div className="relative z-10 mt-4 flex gap-1 self-end">
                  <button onClick={() => dup.mutate(r.id)} className="rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink" aria-label={`Duplicate ${r.title}`} title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirm(r)} className="rounded-lg p-2 text-ink-muted hover:bg-status-red hover:text-status-redInk" aria-label={`Delete ${r.title}`} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        {confirm && (
          <DialogContent title={`Delete "${confirm.title}"?`} description="This can't be undone. Any copies you downloaded stay on your device.">
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="solid"
                className="bg-status-redInk hover:bg-status-redInk/90"
                loading={del.isPending}
                onClick={() => del.mutate(confirm.id, { onSuccess: () => setConfirm(null) })}
              >
                Delete resume
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
