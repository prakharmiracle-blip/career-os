"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Gem } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { PremiumDialog } from "@/components/premium-dialog";
import { ResumeInsights, type ResumeAnalysis } from "@/components/resume-insights";
import { ResumeUpload } from "@/components/resume-upload";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { SkillsInput } from "@/components/skills-input";
import { Button } from "@/components/ui/button";
import { useMe, useUpdateProfile } from "@/lib/queries";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  headline: z.string().trim().max(120),
  target_role: z.string().trim().max(120),
  location: z.string().trim().max(120),
  skills: z.array(z.string()).max(50),
});
type Form = z.infer<typeof schema>;

export default function SettingsPage() {
  const { data: user } = useMe();
  const update = useUpdateProfile();
  const [premium, setPremium] = useState(false);
  const latest = useQuery({
    queryKey: ["resume"],
    queryFn: () =>
      api<{ filename: string; uploaded_at: string; detected_skills: string[]; analysis: ResumeAnalysis | null } | null>("/api/me/resume"),
  });
  const { register, handleSubmit, control, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    values: user
      ? { name: user.name, headline: user.headline ?? "", target_role: user.target_role ?? "", location: user.location ?? "", skills: user.skills }
      : undefined,
  });
  if (!user) return null;
  const plan = { free: "Free", premium: "Premium", prime: "Prime" }[user.plan];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Profile & Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">Your profile drives job matching. Keep your target role and skills current.</p>
      </div>

      <form onSubmit={handleSubmit((v) => update.mutate(v))} className="card space-y-5 p-6" aria-labelledby="profile-h" noValidate>
        <h2 id="profile-h" className="text-base font-bold text-ink">
          Profile
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="label">Full name</label>
            <input id="name" className="input" {...register("name")} aria-invalid={!!formState.errors.name} />
            {formState.errors.name && <p className="mt-1 text-xs text-status-redInk">{formState.errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="headline" className="label">Headline</label>
            <input id="headline" className="input" placeholder="Job Seeker" {...register("headline")} />
          </div>
          <div>
            <label htmlFor="target_role" className="label">Target role</label>
            <input id="target_role" className="input" placeholder="AI Engineer" {...register("target_role")} />
          </div>
          <div>
            <label htmlFor="location" className="label">Preferred location</label>
            <input id="location" className="input" placeholder="Bengaluru, India" {...register("location")} />
          </div>
        </div>
        <div>
          <label htmlFor="skills" className="label">Skills</label>
          <Controller control={control} name="skills" render={({ field }) => <SkillsInput value={field.value} onChange={field.onChange} />} />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={update.isPending}>
            Save profile
          </Button>
          {update.isSuccess && !formState.isDirty && (
            <span className="inline-flex items-center gap-1 text-sm text-status-greenInk" role="status">
              <CheckCircle2 className="h-4 w-4" /> Profile saved
            </span>
          )}
          {update.isError && (
            <span className="text-sm text-status-redInk" role="alert">
              {update.error.message}
            </span>
          )}
        </div>
      </form>

      <section id="resume" className="card p-6" aria-labelledby="resume-h">
        <h2 id="resume-h" className="text-base font-bold text-ink">
          Resume
        </h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">Upload a new version any time. New skills it mentions are added to your profile.</p>
        {latest.data && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-ink-soft">
              Current: <span className="font-medium text-ink">{latest.data.filename}</span>, uploaded{" "}
              {new Date(latest.data.uploaded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            {latest.data.analysis && <ResumeInsights analysis={latest.data.analysis} />}
          </div>
        )}
        <ResumeUpload compact />
      </section>

      <section id="plan" className="card p-6" aria-labelledby="plan-h">
        <h2 id="plan-h" className="text-base font-bold text-ink">
          Plan
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          You&apos;re on the <span className="font-semibold text-ink">{plan}</span> plan. Billing is coming soon: there is nothing to pay today.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => setPremium(true)}>
          <Gem className="h-4 w-4 text-violet" /> Join the Premium waitlist
        </Button>
        <PremiumDialog open={premium} onOpenChange={setPremium} />
      </section>

      <section className="card p-6" aria-labelledby="more-h">
        <h2 id="more-h" className="text-base font-bold text-ink">
          Account
        </h2>
        <p className="mt-1 text-sm text-ink-muted">Signed in as {user.email}</p>
        <ul className="mt-4 divide-y divide-line text-sm">
          {["Notification preferences", "Privacy controls", "Delete account"].map((t) => (
            <li key={t} className="flex items-center justify-between py-3">
              <span className="text-ink">{t}</span>
              <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ink-muted">Coming soon</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
