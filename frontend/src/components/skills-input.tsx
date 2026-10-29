"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export const SUGGESTED_SKILLS = [
  "Python", "SQL", "JavaScript", "TypeScript", "React", "Node.js", "Java", "Machine Learning",
  "LLMs", "RAG", "LangChain", "Power BI", "Excel", "AWS", "Docker", "Figma", "Data Structures", "Statistics",
];

export function SkillsInput({ value, onChange, id = "skills" }: { value: string[]; onChange: (v: string[]) => void; id?: string }) {
  const [draft, setDraft] = useState("");
  const has = (s: string) => value.some((v) => v.toLowerCase() === s.toLowerCase());
  const add = (s: string) => {
    const t = s.trim().slice(0, 40);
    if (t && !has(t) && value.length < 50) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="Type a skill and press Enter"
          className="input"
        />
        <button type="button" onClick={() => add(draft)} className="h-11 rounded-xl border border-line bg-white px-3 text-ink-soft hover:text-ink" aria-label="Add skill">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Your skills">
          {value.map((s) => (
            <li key={s} className="inline-flex items-center gap-1 rounded-full bg-violet-soft py-1 pl-3 pr-1.5 text-sm font-medium text-violet-ink">
              {s}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== s))} className="rounded-full p-0.5 hover:bg-white" aria-label={`Remove ${s}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mb-2 mt-4 text-xs font-medium text-ink-muted">Popular</p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_SKILLS.filter((s) => !has(s)).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => add(s)}
            className={cn("rounded-full border border-line bg-white px-3 py-1 text-sm text-ink-soft hover:border-violet/40 hover:text-violet-ink")}
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}
