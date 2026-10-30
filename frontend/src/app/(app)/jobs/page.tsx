"use client";

import * as Dd from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { AdzunaCredit, JobRow } from "@/components/job-card";
import { useJobSearch, type SearchParams } from "@/lib/queries";
import { cn } from "@/lib/utils";

const JOB_TYPES = ["Full-time", "Internship", "Contract"];
const MODES = ["On-site", "Hybrid", "Remote"];
const CITIES = ["Bengaluru", "Hyderabad", "Pune", "Gurugram", "Noida", "Mumbai", "Chennai", "Kolkata", "Ahmedabad", "Lucknow"];
const EXP = [
  { v: "0", l: "Fresher (0 yrs)" },
  { v: "1", l: "1 year" },
  { v: "2", l: "2 years" },
  { v: "3", l: "3 years" },
  { v: "5", l: "5 years" },
  { v: "7", l: "7+ years" },
];
const SALARY = [
  { v: "5", l: "₹ 5 LPA+" },
  { v: "10", l: "₹ 10 LPA+" },
  { v: "15", l: "₹ 15 LPA+" },
  { v: "25", l: "₹ 25 LPA+" },
];

function FilterMenu({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dd.Root>
      <Dd.Trigger
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition",
          active ? "border-violet/40 bg-violet-soft text-violet-ink" : "border-line bg-white text-ink-soft hover:text-ink",
        )}
      >
        {label} <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </Dd.Trigger>
      <Dd.Portal>
        <Dd.Content align="start" sideOffset={6} className="z-50 min-w-[200px] rounded-xl border border-line bg-white p-1.5 shadow-xl">
          {children}
        </Dd.Content>
      </Dd.Portal>
    </Dd.Root>
  );
}

function Option({ checked, onSelect, children }: { checked: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <Dd.CheckboxItem
      checked={checked}
      onSelect={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className="flex cursor-pointer items-center justify-between gap-6 rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-canvas focus:bg-canvas"
    >
      {children}
      {checked && <Check className="h-4 w-4 text-violet" aria-hidden />}
    </Dd.CheckboxItem>
  );
}

function useUrlState(): [SearchParams, (patch: Partial<SearchParams>) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state: SearchParams = useMemo(
    () => ({
      q: sp.get("q") ?? "",
      location: sp.get("location") ?? "",
      job_type: sp.getAll("job_type"),
      work_mode: sp.getAll("work_mode"),
      exp: sp.get("exp") ?? "",
      min_salary: sp.get("min_salary") ?? "",
      sort: (sp.get("sort") as SearchParams["sort"]) || "relevance",
    }),
    [sp],
  );
  const update = (patch: Partial<SearchParams>) => {
    const next = { ...state, ...patch };
    const qs = new URLSearchParams();
    if (next.q) qs.set("q", next.q);
    if (next.location) qs.set("location", next.location);
    next.job_type.forEach((t) => qs.append("job_type", t));
    next.work_mode.forEach((m) => qs.append("work_mode", m));
    if (next.exp) qs.set("exp", next.exp);
    if (next.min_salary) qs.set("min_salary", next.min_salary);
    if (next.sort !== "relevance") qs.set("sort", next.sort);
    router.replace(`${pathname}${qs.size ? `?${qs}` : ""}`, { scroll: false });
  };
  return [state, update];
}

function JobSearch() {
  const [p, update] = useUrlState();
  const [q, setQ] = useState(p.q);
  useEffect(() => setQ(p.q), [p.q]);
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useJobSearch(p);

  // Infinite scroll: load the next page when the sentinel enters the viewport.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const jobs = data?.pages.flatMap((pg) => pg.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const anyFilter = !!(p.location || p.job_type.length || p.work_mode.length || p.exp || p.min_salary || p.q);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-ink">Job Search</h1>
      <p className="mt-1 text-sm text-ink-soft">Find the right opportunities for your career</p>

      <form
        role="search"
        className="relative mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() });
        }}
      >
        <label htmlFor="job-q" className="sr-only">
          Search job title, skills or company
        </label>
        <input id="job-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job title, skills or company..." className="input h-12 rounded-full pl-5 pr-14" />
        <button type="submit" aria-label="Search" className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-brand-gradient text-white">
          <Search className="h-4 w-4" />
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FilterMenu label={p.location || "Location"} active={!!p.location}>
          {CITIES.map((c) => (
            <Option key={c} checked={p.location === c} onSelect={() => update({ location: p.location === c ? "" : c })}>
              {c}
            </Option>
          ))}
        </FilterMenu>
        <FilterMenu label={EXP.find((e) => e.v === p.exp)?.l ?? "Experience"} active={!!p.exp}>
          {EXP.map((e) => (
            <Option key={e.v} checked={p.exp === e.v} onSelect={() => update({ exp: p.exp === e.v ? "" : e.v })}>
              {e.l}
            </Option>
          ))}
        </FilterMenu>
        <FilterMenu label={p.job_type.length ? `Job Type (${p.job_type.length})` : "Job Type"} active={!!p.job_type.length}>
          {JOB_TYPES.map((t) => (
            <Option key={t} checked={p.job_type.includes(t)} onSelect={() => update({ job_type: toggle(p.job_type, t) })}>
              {t}
            </Option>
          ))}
        </FilterMenu>
        <FilterMenu label={SALARY.find((s) => s.v === p.min_salary)?.l ?? "Salary"} active={!!p.min_salary}>
          {SALARY.map((s) => (
            <Option key={s.v} checked={p.min_salary === s.v} onSelect={() => update({ min_salary: p.min_salary === s.v ? "" : s.v })}>
              {s.l}
            </Option>
          ))}
        </FilterMenu>
        <FilterMenu label={p.work_mode.length ? `Work Mode (${p.work_mode.length})` : "More Filters"} active={!!p.work_mode.length}>
          <p className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-ink-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Work mode
          </p>
          {MODES.map((m) => (
            <Option key={m} checked={p.work_mode.includes(m)} onSelect={() => update({ work_mode: toggle(p.work_mode, m) })}>
              {m}
            </Option>
          ))}
        </FilterMenu>
        {anyFilter && (
          <button
            onClick={() => update({ q: "", location: "", job_type: [], work_mode: [], exp: "", min_salary: "" })}
            className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-ink-soft hover:text-ink"
          >
            <X className="h-3.5 w-3.5" /> Clear all
          </button>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          {isLoading ? "Searching…" : `${total.toLocaleString("en-IN")} jobs found`}
        </p>
        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          Sort by:
          <select value={p.sort} onChange={(e) => update({ sort: e.target.value as SearchParams["sort"] })} className="cursor-pointer bg-transparent font-semibold text-ink">
            <option value="relevance">Relevance</option>
            <option value="date">Date posted</option>
            <option value="salary">Salary</option>
          </select>
        </label>
      </div>

      <div className="mt-4 space-y-3">
        {isError ? (
          <div className="card flex items-center justify-between p-5 text-sm text-ink-soft">
            Jobs didn&apos;t load. Check that the API is running.
            <button onClick={() => refetch()} className="font-semibold text-azure-ink hover:underline">
              Try again
            </button>
          </div>
        ) : isLoading ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="card h-[104px] animate-pulse" />)
        ) : jobs.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-semibold text-ink">No jobs match these filters</p>
            <p className="mt-1 text-sm text-ink-soft">Remove a filter or try a broader search, such as a skill instead of a job title.</p>
          </div>
        ) : (
          jobs.map((job) => <JobRow key={job.id} job={job} />)
        )}
        <div ref={sentinel} />
        {isFetchingNextPage && (
          <div className="flex justify-center py-4" role="status" aria-label="Loading more jobs">
            <Loader2 className="h-5 w-5 animate-spin text-violet" />
          </div>
        )}
        {!hasNextPage && jobs.length > 0 && <p className="py-4 text-center text-sm text-ink-muted">You&apos;ve seen all {total} jobs.</p>}
        {jobs.some((j) => j.source === "adzuna") && <AdzunaCredit className="pb-4 text-center" />}
      </div>
    </div>
  );
}

export default function JobSearchPage() {
  return (
    <Suspense>
      <JobSearch />
    </Suspense>
  );
}
