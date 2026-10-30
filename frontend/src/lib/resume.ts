"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";

export type Template = "modern" | "professional" | "minimal";

export interface Basics {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  summary: string;
}
export interface Experience {
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
}
export interface Education {
  degree: string;
  school: string;
  start: string;
  end: string;
  score: string;
}
export interface Project {
  name: string;
  link: string;
  bullets: string[];
}
export interface ResumeData {
  basics: Basics;
  experience: Experience[];
  projects: Project[];
  education: Education[];
  skills: string[];
  certifications: string[];
}
export interface ResumeDocSummary {
  id: string;
  title: string;
  template: Template;
  updated_at: string;
}
export interface ResumeDoc extends ResumeDocSummary {
  data: ResumeData;
}
export interface AtsReport {
  score: number;
  checks: { id: string; weight: number; pass: boolean; message: string }[];
  keywords_found: string[];
  keywords_missing: string[];
  target_role: string | null;
}

export const TEMPLATES: { id: Template; name: string; blurb: string }[] = [
  { id: "modern", name: "Modern", blurb: "Violet accents, clean sans-serif" },
  { id: "professional", name: "Professional", blurb: "Centred header, classic serif" },
  { id: "minimal", name: "Minimal", blurb: "Plain and compact, no rules" },
];

export const emptyExperience = (): Experience => ({ role: "", company: "", location: "", start: "", end: "", bullets: [""] });
export const emptyEducation = (): Education => ({ degree: "", school: "", start: "", end: "", score: "" });
export const emptyProject = (): Project => ({ name: "", link: "", bullets: [""] });

export function useResumeList() {
  return useQuery({ queryKey: ["resumes"], queryFn: () => api<ResumeDocSummary[]>("/api/resumes") });
}

export function useResumeDoc(id: string) {
  return useQuery({ queryKey: ["resumes", id], queryFn: () => api<ResumeDoc>(`/api/resumes/${id}`), staleTime: Infinity });
}

export function useAts(id: string, version: number) {
  return useQuery({ queryKey: ["resumes", id, "ats", version], queryFn: () => api<AtsReport>(`/api/resumes/${id}/ats`), placeholderData: (p) => p });
}

export function useCreateResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; template?: Template }) => api<ResumeDoc>("/api/resumes", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resumes"] }),
  });
}

export function useDuplicateResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ResumeDoc>(`/api/resumes/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resumes"] }),
  });
}

export function useDeleteResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/resumes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resumes"] }),
  });
}

export function saveResume(id: string, body: { title?: string; template?: Template; data?: ResumeData }) {
  return api<ResumeDoc>(`/api/resumes/${id}`, { method: "PUT", json: body });
}
