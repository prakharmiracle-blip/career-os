"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  api,
  type Activity,
  type AppStatus,
  type Application,
  type Job,
  type JobDetail,
  type JobPage,
  type Overview,
  type User,
} from "./api";

export const keys = {
  me: ["me"] as const,
  overview: (days: number) => ["overview", days] as const,
  activities: ["activities"] as const,
  recommended: ["jobs", "recommended"] as const,
  jobs: (params: Record<string, unknown>) => ["jobs", "search", params] as const,
  job: (id: number) => ["jobs", "detail", id] as const,
  similar: (id: number) => ["jobs", "similar", id] as const,
  saved: ["jobs", "saved"] as const,
  applications: ["applications"] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api<User>("/api/auth/me"), retry: false, staleTime: 60_000 });
}

export function useOverview(days: number) {
  return useQuery({ queryKey: keys.overview(days), queryFn: () => api<Overview>(`/api/me/overview?days=${days}`) });
}

export function useActivities() {
  return useQuery({ queryKey: keys.activities, queryFn: () => api<Activity[]>("/api/me/activities?limit=3") });
}

export function useRecommended() {
  return useQuery({ queryKey: keys.recommended, queryFn: () => api<Job[]>("/api/jobs/recommended?limit=3") });
}

export interface SearchParams {
  q: string;
  location: string;
  job_type: string[];
  work_mode: string[];
  exp: string;
  min_salary: string;
  sort: "relevance" | "date" | "salary";
}

function toQuery(p: SearchParams, cursor: number) {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.location) qs.set("location", p.location);
  p.job_type.forEach((t) => qs.append("job_type", t));
  p.work_mode.forEach((m) => qs.append("work_mode", m));
  if (p.exp) qs.set("exp", p.exp);
  if (p.min_salary) qs.set("min_salary", p.min_salary);
  qs.set("sort", p.sort);
  qs.set("cursor", String(cursor));
  return qs.toString();
}

export function useJobSearch(params: SearchParams) {
  return useInfiniteQuery({
    queryKey: keys.jobs(params as unknown as Record<string, unknown>),
    queryFn: ({ pageParam }) => api<JobPage>(`/api/jobs?${toQuery(params, pageParam)}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useJob(id: number) {
  return useQuery({ queryKey: keys.job(id), queryFn: () => api<JobDetail>(`/api/jobs/${id}`) });
}

export function useSimilar(id: number) {
  return useQuery({ queryKey: keys.similar(id), queryFn: () => api<Job[]>(`/api/jobs/${id}/similar`) });
}

export function useSavedJobs() {
  return useQuery({ queryKey: keys.saved, queryFn: () => api<Job[]>("/api/jobs/saved") });
}

export function useApplications() {
  return useQuery({ queryKey: keys.applications, queryFn: () => api<Application[]>("/api/applications") });
}

/** Toggle save with an optimistic flip across every cached job list. */
export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saved }: { id: number; saved: boolean }) =>
      api<void>(`/api/jobs/${id}/save`, { method: saved ? "DELETE" : "PUT" }),
    onMutate: async ({ id, saved }) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const flip = (j: Job) => (j.id === id ? { ...j, saved: !saved } : j);
      qc.setQueriesData<unknown>({ queryKey: ["jobs"] }, (data: unknown) => {
        if (!data) return data;
        if (Array.isArray(data)) return (data as Job[]).map(flip);
        const d = data as { pages?: JobPage[]; id?: number };
        if (d.pages) return { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.map(flip) })) };
        if (d.id === id) return flip(d as Job);
        return data;
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) => api<Application>("/api/applications", { method: "POST", json: { job_id: jobId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: keys.applications });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; status?: AppStatus; notes?: string }) =>
      api<Application>(`/api/applications/${id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.applications });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<User, "name" | "headline" | "target_role" | "location" | "skills" | "onboarded" | "role_type">>) =>
      api<User>("/api/me", { method: "PATCH", json: body }),
    onSuccess: (user) => {
      qc.setQueryData(keys.me, user);
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useJoinWaitlist() {
  return useMutation({
    mutationFn: (body: { plan: "premium" | "prime"; email?: string; source?: string }) =>
      api<{ ok: boolean; already_joined: boolean; plan: string }>("/api/waitlist", { method: "POST", json: body }),
  });
}

// ---------- AI ----------
export interface AiStatus {
  enabled: boolean;
  used: number;
  limit: number;
}

export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export function useAiStatus() {
  return useQuery({ queryKey: ["ai"], queryFn: () => api<AiStatus>("/api/me/ai"), staleTime: 60_000 });
}

export function useConversations() {
  return useQuery({ queryKey: ["coach", "list"], queryFn: () => api<Conversation[]>("/api/coach/conversations") });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ["coach", "thread", id],
    queryFn: () => api<{ conversation: Conversation; messages: ChatMessage[] }>(`/api/coach/conversations/${id}`),
    enabled: !!id,
  });
}

export function useAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { content: string; conversation_id?: string | null }) =>
      api<{ conversation: Conversation; user_message: ChatMessage; reply: ChatMessage }>("/api/coach/ask", {
        method: "POST",
        json: { content: body.content, conversation_id: body.conversation_id ?? null },
      }),
    onSuccess: (r) => {
      qc.setQueryData<{ conversation: Conversation; messages: ChatMessage[] }>(["coach", "thread", r.conversation.id], (old) => ({
        conversation: r.conversation,
        messages: [...(old?.messages ?? []), r.user_message, r.reply],
      }));
      qc.invalidateQueries({ queryKey: ["coach", "list"] });
      qc.invalidateQueries({ queryKey: ["ai"] });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/coach/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach", "list"] }),
  });
}
