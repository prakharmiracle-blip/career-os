"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { ResumeUpload } from "@/components/resume-upload";
import { SkillsInput } from "@/components/skills-input";
import { Button } from "@/components/ui/button";
import { useMe, useUpdateProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";

const ROLE_IDEAS = ["Software Engineer", "AI Engineer", "Data Analyst", "Data Scientist", "Frontend Developer", "Product Manager", "UI/UX Designer", "DevOps Engineer"];
const CITY_IDEAS = ["Bengaluru, India", "Hyderabad, India", "Pune, India", "Gurugram, India", "Noida, India", "Mumbai, India", "Remote"];
const STEPS = ["Target role", "Skills", "Resume"];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: user, isLoading, isError } = useMe();
  const update = useUpdateProfile();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [resumeDone, setResumeDone] = useState(false);

  useEffect(() => {
    if (isError) router.replace("/login");
    if (user) {
      setRole((r) => r || user.target_role || "");
      setLocation((l) => l || user.location || "");
      setSkills((s) => (s.length ? s : user.skills));
    }
  }, [user, isError, router]);

  if (isLoading || !user)
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin text-violet" />
      </div>
    );

  // Completeness: name + email from signup, then role, location, 3+ skills and a resume.
  const filled = 2 + (role.trim() ? 1 : 0) + (location.trim() ? 1 : 0) + (skills.length >= 3 ? 1 : 0) + (resumeDone ? 1 : 0);
  const pct = Math.round((filled / 6) * 100);

  // Save role, location and skills before the resume step, so the upload's skill merge
  // and job matching work from the profile the user just built.
  const toResume = () =>
    update.mutate({ target_role: role.trim(), location: location.trim(), skills }, { onSuccess: () => setStep(2) });

  const finish = () => update.mutate({ onboarded: true }, { onSuccess: () => router.replace("/home") });

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <Logo tone="dark" />
        <div className="mt-8">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-ink">Profile {pct}% complete</span>
            <span className="text-ink-muted">
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
            <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="card mt-6 p-6 sm:p-8">
          {step === 0 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (role.trim()) setStep(1);
              }}
            >
              <h1 className="text-xl font-bold text-ink">Hi {user.name.split(" ")[0]}, what role are you aiming for?</h1>
              <p className="mt-1.5 text-sm text-ink-soft">We use this to rank jobs and explain how well you match.</p>
              <label htmlFor="role" className="label mt-6">Target role</label>
              <input id="role" value={role} onChange={(e) => setRole(e.target.value)} className="input" placeholder="e.g. AI Engineer" required />
              <div className="mt-3 flex flex-wrap gap-2">
                {ROLE_IDEAS.map((r) => (
                  <button key={r} type="button" onClick={() => setRole(r)} className={cn("rounded-full border px-3 py-1 text-sm", role === r ? "border-violet bg-violet-soft text-violet-ink" : "border-line bg-white text-ink-soft hover:text-ink")}>
                    {r}
                  </button>
                ))}
              </div>
              <label htmlFor="loc" className="label mt-6">Preferred location</label>
              <input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} className="input" placeholder="e.g. Bengaluru, India" />
              <div className="mt-3 flex flex-wrap gap-2">
                {CITY_IDEAS.map((c) => (
                  <button key={c} type="button" onClick={() => setLocation(c)} className={cn("rounded-full border px-3 py-1 text-sm", location === c ? "border-violet bg-violet-soft text-violet-ink" : "border-line bg-white text-ink-soft hover:text-ink")}>
                    {c}
                  </button>
                ))}
              </div>
              <Button type="submit" className="mt-8 w-full" size="lg" disabled={!role.trim()}>
                Continue
              </Button>
            </form>
          ) : step === 1 ? (
            <div>
              <button onClick={() => setStep(0)} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <h1 className="text-xl font-bold text-ink">Add your skills</h1>
              <p className="mt-1.5 text-sm text-ink-soft">Add at least three. Matching compares these with each job&apos;s requirements.</p>
              <div className="mt-5">
                <SkillsInput value={skills} onChange={setSkills} />
              </div>
              {update.isError && (
                <p className="mt-4 text-sm text-status-redInk" role="alert">
                  {update.error.message}
                </p>
              )}
              <Button className="mt-8 w-full" size="lg" disabled={skills.length < 3} loading={update.isPending} onClick={toResume}>
                {skills.length < 3 ? `Add ${3 - skills.length} more skill${3 - skills.length === 1 ? "" : "s"}` : "Continue"}
              </Button>
            </div>
          ) : (
            <div>
              <button onClick={() => setStep(1)} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <h1 className="text-xl font-bold text-ink">Upload your resume</h1>
              <p className="mt-1.5 text-sm text-ink-soft">
                We&apos;ll read it, add any skills you missed, and find the jobs that fit you best.
              </p>
              <div className="mt-6">
                <ResumeUpload
                  onComplete={(r) => {
                    setResumeDone(true);
                    setSkills(r.user.skills);
                  }}
                />
              </div>
              {update.isError && (
                <p className="mt-4 text-sm text-status-redInk" role="alert">
                  {update.error.message}
                </p>
              )}
              {resumeDone ? (
                <Button className="mt-8 w-full" size="lg" loading={update.isPending} onClick={finish}>
                  See my jobs
                </Button>
              ) : (
                <button
                  onClick={finish}
                  disabled={update.isPending}
                  className="mt-6 w-full text-center text-sm font-medium text-ink-soft hover:text-ink disabled:opacity-60"
                >
                  Skip for now. You can upload it later in Profile &amp; Settings.
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
