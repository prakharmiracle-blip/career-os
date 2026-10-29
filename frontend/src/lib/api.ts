// Typed fetch client. Auth lives in httpOnly cookies set by the API; on a 401 we
// try one silent refresh, then retry. Callers never handle tokens.

export class ApiError extends Error {
  constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

function parseError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return new ApiError(status, detail);
  if (Array.isArray(detail)) {
    // FastAPI/Pydantic validation errors
    const fields: Record<string, string> = {};
    for (const d of detail as { loc?: unknown[]; msg?: string }[]) {
      const key = String(d.loc?.[d.loc.length - 1] ?? "form");
      fields[key] = (d.msg ?? "Invalid value").replace(/^Value error, /, "");
    }
    return new ApiError(status, Object.values(fields)[0] ?? "Please check the form", fields);
  }
  if (status === 429) return new ApiError(status, "Too many attempts. Wait a minute and try again.");
  return new ApiError(status, "Something went wrong on our side. Try again.");
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    credentials: "include",
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (res.status === 401 && retry && !path.startsWith("/api/auth/")) {
    if (await refreshSession()) return api<T>(path, init, false);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw parseError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------- Types (mirror backend/app/schemas.py) ----------
export type RoleType = "student" | "fresher" | "experienced";
export type Plan = "free" | "premium" | "prime";

export interface User {
  id: string;
  name: string;
  email: string;
  role_type: RoleType;
  plan: Plan;
  headline: string | null;
  target_role: string | null;
  location: string | null;
  skills: string[];
  onboarded: boolean;
}

export interface Company {
  id: number;
  name: string;
  industry: string;
  brand_color: string;
}

export interface Match {
  score: number;
  matched_skills: string[];
  missing_skills: string[];
  reasons: string[];
}

export interface Job {
  id: number;
  title: string;
  company: Company;
  location: string;
  work_mode: string;
  job_type: string;
  salary_min_lpa: number;
  salary_max_lpa: number;
  exp_min: number;
  exp_max: number;
  skills: string[];
  posted_at: string;
  source: string;
  saved: boolean;
  applied: boolean;
  match: Match | null;
}

export interface JobDetail extends Job {
  description: string;
  responsibilities: string[];
}

export interface JobPage {
  items: Job[];
  total: number;
  next_cursor: number | null;
}

export type AppStatus = "applied" | "under_review" | "interview_scheduled" | "offer" | "rejected";

export interface Application {
  id: number;
  status: AppStatus;
  notes: string;
  applied_at: string;
  updated_at: string;
  job: Job;
}

export interface Overview {
  days: number;
  applied: number;
  interviews: number;
  offers: number;
  saved: number;
}

export interface Activity {
  id: number;
  kind: "interview" | "resume_review" | "practice" | string;
  title: string;
  subtitle: string;
  starts_at: string;
}
