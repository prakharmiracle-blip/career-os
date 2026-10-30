"use client";

import { Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAiStatus, useAsk } from "@/lib/queries";

/** Compact "ask the coach" box; the answer opens in the full Coach page. */
export function CoachPrompt({ chips }: { chips: string[] }) {
  const router = useRouter();
  const ai = useAiStatus();
  const ask = useAsk();
  const [q, setQ] = useState("");
  const send = (text: string) => {
    const content = text.trim();
    if (!content) return;
    ask.mutate({ content }, { onSuccess: (r) => router.push(`/coach?c=${r.conversation.id}`) });
  };
  const off = ai.data && !ai.data.enabled;

  return (
    <section className="card mt-6 p-5" aria-labelledby="assistant-h">
      <h2 id="assistant-h" className="flex items-center gap-2 text-base font-bold text-ink">
        <Sparkles className="h-5 w-5 text-violet" /> AI Career Assistant
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        {off ? "Switching on soon: it needs an AI key on the server." : "Ask anything about jobs, resumes, interviews or skills."}
      </p>
      <form
        className="relative mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(q);
        }}
      >
        <label htmlFor="assistant-q" className="sr-only">
          Ask your career question
        </label>
        <input id="assistant-q" value={q} onChange={(e) => setQ(e.target.value)} disabled={!!off || ask.isPending} placeholder="Ask your career question..." className="input h-11 rounded-full pr-12" />
        <button type="submit" disabled={!q.trim() || !!off || ask.isPending} aria-label="Ask" className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-brand-gradient text-white disabled:opacity-50">
          {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </button>
      </form>
      {ask.isError && (
        <p className="mt-2 text-sm text-status-redInk" role="alert">
          {ask.error.message}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c} onClick={() => send(c)} disabled={!!off || ask.isPending} className="rounded-full border border-azure/30 bg-azure-pill px-3 py-1 text-xs font-medium text-azure-ink hover:border-azure disabled:opacity-50">
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}
