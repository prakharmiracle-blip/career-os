"use client";

import { Bot, Loader2, MessageSquarePlus, SendHorizontal, Sparkles, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { useApplications, useAiStatus, useAsk, useConversation, useConversations, useDeleteConversation, useMe } from "@/lib/queries";
import { cn, initials } from "@/lib/utils";

function suggestions(target: string | null, interviewCompany: string | null) {
  const role = target || "my target role";
  return [
    "How can I improve my resume?",
    `Which skills should I learn next for ${role}?`,
    interviewCompany ? `Give me interview tips for ${interviewCompany}` : "How should I prepare for my first interview?",
    "Which of my matched jobs should I apply to first?",
  ];
}

function Reply({ content }: { content: string }) {
  return (
    <div className="prose-coach text-[15px] leading-relaxed text-ink">
      <ReactMarkdown
        components={{
          p: (p) => <p className="mb-2 last:mb-0" {...p} />,
          ul: (p) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0" {...p} />,
          ol: (p) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0" {...p} />,
          strong: (p) => <strong className="font-semibold" {...p} />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-azure-ink underline">
              {children}
            </a>
          ),
          h1: (p) => <p className="mb-2 font-bold" {...p} />,
          h2: (p) => <p className="mb-2 font-bold" {...p} />,
          h3: (p) => <p className="mb-2 font-semibold" {...p} />,
          code: (p) => <code className="rounded bg-canvas px-1 py-0.5 text-[13px]" {...p} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function Coach() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const activeId = params.get("c");
  const { data: me } = useMe();
  const ai = useAiStatus();
  const list = useConversations();
  const thread = useConversation(activeId);
  const apps = useApplications();
  const ask = useAsk();
  const del = useDeleteConversation();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const interviewCompany = apps.data?.find((a) => a.status === "interview_scheduled")?.job.company.name ?? null;
  const messages = activeId ? thread.data?.messages ?? [] : [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  const open = (id: string | null) => router.replace(id ? `${pathname}?c=${id}` : pathname, { scroll: false });

  const send = (text: string) => {
    const content = text.trim();
    if (!content || ask.isPending) return;
    setPending(content);
    setDraft("");
    ask.mutate(
      { content, conversation_id: activeId },
      {
        onSuccess: (r) => {
          if (r.conversation.id !== activeId) open(r.conversation.id);
        },
        onError: () => setDraft(content),
        onSettled: () => setPending(null),
      },
    );
  };

  const off = ai.data && !ai.data.enabled;
  const remaining = ai.data ? Math.max(0, ai.data.limit - ai.data.used) : null;

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="card hidden h-[calc(100vh-140px)] flex-col p-3 lg:flex" aria-label="Saved conversations">
        <button
          onClick={() => open(null)}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-gradient text-sm font-semibold text-white shadow-glow hover:brightness-110"
        >
          <MessageSquarePlus className="h-4 w-4" /> New chat
        </button>
        <p className="mb-1 mt-4 px-2 text-xs font-semibold text-ink-muted">Saved chats</p>
        <ul className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
          {list.data?.length === 0 && <li className="px-2 py-2 text-sm text-ink-muted">Your chats will be saved here.</li>}
          {list.data?.map((c) => (
            <li key={c.id} className="group flex items-center">
              <button
                onClick={() => open(c.id)}
                aria-current={c.id === activeId ? "true" : undefined}
                className={cn("min-w-0 flex-1 truncate rounded-lg px-2.5 py-2 text-left text-sm", c.id === activeId ? "bg-violet-soft font-medium text-violet-ink" : "text-ink-soft hover:bg-canvas")}
              >
                {c.title}
              </button>
              <button
                onClick={() => del.mutate(c.id, { onSuccess: () => c.id === activeId && open(null) })}
                className="rounded-lg p-1.5 text-ink-muted opacity-0 hover:bg-status-red hover:text-status-redInk focus:opacity-100 group-hover:opacity-100"
                aria-label={`Delete chat: ${c.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="card flex h-[calc(100vh-140px)] min-h-[480px] flex-col" aria-label="Chat with your career coach">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-tile-lav">
              <Bot className="h-5 w-5 text-tile-lavInk" />
            </span>
            <div>
              <h1 className="text-[15px] font-bold leading-tight text-ink">AI Career Coach</h1>
              <p className="text-xs text-ink-muted">Knows your profile, resume and applications</p>
            </div>
          </div>
          <div className="flex items-center gap-1 lg:hidden">
            {!!list.data?.length && (
              <>
                <label htmlFor="chat-pick" className="sr-only">
                  Saved chats
                </label>
                <select
                  id="chat-pick"
                  value={activeId ?? ""}
                  onChange={(e) => open(e.target.value || null)}
                  className="max-w-[140px] truncate rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-ink-soft"
                >
                  <option value="">Saved chats ({list.data.length})</option>
                  {list.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button onClick={() => open(null)} className="rounded-lg p-2 text-ink-soft hover:bg-canvas" aria-label="New chat">
              <MessageSquarePlus className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
          {off ? (
            <div className="mx-auto max-w-md pt-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-violet" />
              <p className="mt-3 font-semibold text-ink">The coach is switching on soon</p>
              <p className="mt-1 text-sm text-ink-soft">It needs an AI key on the server. Once that&apos;s added, it answers using your profile, resume and applications.</p>
            </div>
          ) : messages.length === 0 && !pending ? (
            <div className="mx-auto max-w-lg pt-6 text-center">
              <p className="text-lg font-bold text-ink">Hi {me?.name.split(" ")[0]}, what would you like help with?</p>
              <p className="mt-1 text-sm text-ink-soft">Ask about your resume, which jobs to go for, skills to learn, or interviews.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {suggestions(me?.target_role ?? null, interviewCompany).map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-xl border border-line bg-white px-3.5 py-3 text-left text-sm text-ink-soft hover:border-violet/40 hover:text-ink">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="space-y-5">
              {messages.map((m) => (
                <li key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      m.role === "user" ? "bg-brand-gradient text-white" : "bg-tile-lav text-tile-lavInk",
                    )}
                    aria-hidden
                  >
                    {m.role === "user" ? initials(me?.name ?? "You") : <Bot className="h-4 w-4" />}
                  </span>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", m.role === "user" ? "bg-violet-soft text-[15px] text-ink" : "bg-canvas")}>
                    <span className="sr-only">{m.role === "user" ? "You said:" : "Coach:"}</span>
                    {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <Reply content={m.content} />}
                  </div>
                </li>
              ))}
              {pending && (
                <>
                  <li className="flex flex-row-reverse gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white" aria-hidden>
                      {initials(me?.name ?? "You")}
                    </span>
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-violet-soft px-4 py-3 text-[15px] text-ink">{pending}</p>
                  </li>
                  <li className="flex gap-3" role="status">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tile-lav text-tile-lavInk" aria-hidden>
                      <Bot className="h-4 w-4" />
                    </span>
                    <p className="flex items-center gap-2 rounded-2xl bg-canvas px-4 py-3 text-sm text-ink-soft">
                      <Loader2 className="h-4 w-4 animate-spin" /> Thinking about your profile…
                    </p>
                  </li>
                </>
              )}
            </ol>
          )}
          <div ref={bottom} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="border-t border-line p-3.5"
        >
          {ask.isError && (
            <p className="mb-2 rounded-lg bg-status-red px-3 py-2 text-sm text-status-redInk" role="alert">
              {ask.error.message}
            </p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="coach-input" className="sr-only">
              Ask your career question
            </label>
            <textarea
              id="coach-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={1}
              maxLength={2000}
              disabled={!!off}
              placeholder={off ? "Coach not switched on yet" : "Ask your career question…"}
              className="input h-auto max-h-40 min-h-[44px] resize-none py-2.5"
            />
            <button
              type="submit"
              disabled={!draft.trim() || ask.isPending || !!off}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white disabled:opacity-50"
              aria-label="Send"
            >
              {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </button>
          </div>
          {remaining !== null && !off && (
            <p className="mt-1.5 text-right text-[11px] text-ink-muted">
              {remaining} AI request{remaining === 1 ? "" : "s"} left today
            </p>
          )}
        </form>
      </section>
    </div>
  );
}

export default function CoachPage() {
  return (
    <Suspense>
      <Coach />
    </Suspense>
  );
}
