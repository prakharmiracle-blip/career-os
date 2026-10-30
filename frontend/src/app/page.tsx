import {
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  Check,
  ClipboardList,
  FileText,
  GraduationCap,
  Laptop,
  Medal,
  Mic,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Faq, LandingNav, WaitlistButton } from "@/components/landing/landing-client";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "CareerOS: your career, simplified with AI",
  description: "Find jobs that match your skills, build an ATS-ready resume, get AI career coaching and practise interviews, in one place.",
};

const FEATURES: { icon: LucideIcon; title: string; body: string; live: boolean }[] = [
  { icon: BriefcaseBusiness, title: "Job matching", body: "Every job shows a match score and the skills you're missing, so you know where to apply first.", live: true },
  { icon: ClipboardList, title: "Application tracker", body: "One list or Kanban board for every application, with status, notes and upcoming interviews.", live: true },
  { icon: FileText, title: "Resume Builder", body: "Three ATS-friendly templates, a live preview, an ATS checklist, and PDF or Word downloads.", live: true },
  { icon: Sparkles, title: "AI resume review", body: "Upload your resume for an ATS score, the fixes that matter most, and stronger bullet points.", live: true },
  { icon: Bot, title: "AI Career Coach", body: "Ask anything. The coach knows your profile, resume and applications, so the advice is about you.", live: true },
  { icon: Mic, title: "Interview Prep", body: "Practise AI mock interviews with Miracle Interview AI and get scored feedback.", live: true },
  { icon: BarChart3, title: "Skill Development", body: "A roadmap from the skills you have to the ones your target role needs.", live: false },
  { icon: Building2, title: "Company Insights", body: "Culture, salary ranges and interview process for the companies you're targeting.", live: false },
  { icon: Medal, title: "Skill assessments", body: "Short quizzes that turn your skills into verified badges on your profile.", live: false },
  { icon: GraduationCap, title: "Prime Skills tracks", body: "Certificate tracks in Generative AI, Data Analytics and Full-Stack, with graded projects.", live: false },
  { icon: Users, title: "Networking and mentoring", body: "Find people on the same path, ask for referrals, and book free mentor sessions.", live: false },
  { icon: Laptop, title: "Freelancing", body: "Pick up project work that matches your skills while you job hunt.", live: false },
];

const STEPS = [
  { title: "Create your profile", body: "Tell us your target role, location and skills. It takes two minutes." },
  { title: "Upload your resume", body: "We read it, add skills you missed, and score how well it will pass ATS filters." },
  { title: "Apply to your best matches", body: "Start with the jobs where you match most, and track every application." },
  { title: "Prepare and improve", body: "Fix your resume, ask the coach, and practise interviews before the real one." },
];

const PLANS = [
  {
    name: "Free",
    note: "Available now",
    items: ["Job matching and search", "Application tracker", "Resume Builder with PDF and Word download", "AI resume review", "AI Career Coach (daily limit)", "Interview Prep access"],
    cta: "free" as const,
  },
  {
    name: "Premium",
    note: "Launching soon",
    items: ["Everything in Free", "Higher daily AI limits", "Unlimited resume versions", "Priority job matches", "Deeper interview feedback"],
    cta: "premium" as const,
  },
  {
    name: "Prime",
    note: "Launching soon",
    items: ["Everything in Premium", "Certificate-grade Prime Skills tracks", "Graded projects and final exams", "Verifiable certificates", "Mentor sessions"],
    cta: "prime" as const,
  },
];

const FAQ = [
  { q: "Is CareerOS free?", a: "Yes. Everything available today is on the free plan. Premium and Prime are launching later; joining the waitlist costs nothing and needs no card." },
  { q: "Are the jobs real?", a: "During the beta, job listings are samples so you can try matching and tracking. Each sample is labelled. We'll announce when live listings switch on." },
  { q: "How does the ATS score work?", a: "The Resume Builder checks the things applicant tracking systems and recruiters look for: contact details, clear sections, measurable results, length, and the keywords your target role asks for. Each check tells you what to fix." },
  { q: "What happens to my resume and data?", a: "Your profile and resume text are used to match jobs and personalise advice for you. We don't sell your data. You can update your resume or profile at any time from Profile & Settings." },
  { q: "Who is CareerOS for?", a: "Students, freshers and experienced professionals in India looking for tech, data, AI, product and design roles." },
];

function Section({ id, title, lead, children, className }: { id?: string; title: string; lead?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 px-4 py-20 sm:px-6", className)} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="mx-auto max-w-6xl">
        <h2 id={id ? `${id}-h` : undefined} className="max-w-2xl text-3xl font-extrabold tracking-tight text-ink sm:text-[34px]">
          {title}
        </h2>
        {lead && <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-soft">{lead}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

/** A small, static rendering of the dashboard (fictional data) for the hero. */
function ProductPreview() {
  const tiles = [
    { n: 18, l: "Jobs Applied", bg: "bg-tile-blue", ink: "text-tile-blueInk" },
    { n: 4, l: "Interviews", bg: "bg-tile-teal", ink: "text-tile-tealInk" },
    { n: 1, l: "Offers", bg: "bg-tile-lav", ink: "text-tile-lavInk" },
    { n: 9, l: "Saved Jobs", bg: "bg-tile-amber", ink: "text-tile-amberInk" },
  ];
  const jobs = [
    { t: "Data Analyst", c: "Example Retail Co.", m: 92, s: "₹ 6–10 LPA" },
    { t: "AI Engineer", c: "Example Fintech", m: 81, s: "₹ 12–24 LPA" },
  ];
  return (
    <div aria-hidden className="relative rounded-2xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur">
      <div className="rounded-xl bg-canvas p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-ink">Application Overview</p>
          <p className="text-[11px] text-ink-muted">Last 30 days</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {tiles.map((t) => (
            <div key={t.l} className={cn("rounded-lg p-2.5", t.bg)}>
              <p className={cn("text-lg font-extrabold", t.ink)}>{t.n}</p>
              <p className="text-[10px] text-ink-soft">{t.l}</p>
            </div>
          ))}
        </div>
        <p className="mb-2 mt-4 text-sm font-bold text-ink">Recommended for you</p>
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.t} className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2.5">
              <div>
                <p className="text-[13px] font-semibold text-ink">{j.t}</p>
                <p className="text-[11px] text-ink-soft">
                  {j.c} <span className="text-ink-muted">• {j.s}</span>
                </p>
              </div>
              <span className="rounded-full bg-status-green px-2 py-0.5 text-[11px] font-bold text-status-greenInk">{j.m}% match</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="bg-canvas">
      <LandingNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-gradient px-4 pb-20 pt-16 text-white sm:px-6 sm:pt-24">
        <div className="pointer-events-none absolute -right-40 top-10 h-[28rem] w-[28rem] rounded-full bg-violet/30 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <h1 className="text-[40px] font-extrabold leading-[1.08] tracking-tight sm:text-[56px]">
              Your Career.
              <br />
              Simplified with AI.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/80">
              See which jobs fit you and why, fix your resume before a recruiter sees it, and get advice that knows your profile.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-gradient px-7 text-[15px] font-semibold shadow-glow hover:brightness-110">
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how" className="text-[15px] font-semibold text-white/85 hover:text-white">
                See how it works
              </a>
            </div>
            <p className="mt-5 text-sm text-white/55">Free during the beta. No card needed.</p>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* Strip */}
      <div className="border-b border-line bg-white px-4 py-5 sm:px-6">
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-medium text-ink-soft">
          {["Match score on every job", "ATS checks while you write", "AI coach that knows your profile", "Built for job seekers in India"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-violet" aria-hidden /> {t}
            </li>
          ))}
        </ul>
      </div>

      <Section id="features" title="Everything your job search needs, in one place" lead="Six tools are live today. The rest are on the way, and we say so.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, live }) => (
            <div key={title} className={cn("card p-6", !live && "bg-white/70")}>
              <div className="flex items-start justify-between">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", live ? "bg-violet-soft" : "bg-canvas")}>
                  <Icon className={cn("h-5 w-5", live ? "text-violet" : "text-ink-muted")} aria-hidden />
                </span>
                {!live && <span className="rounded-full bg-status-amber px-2.5 py-0.5 text-xs font-semibold text-status-amberInk">Coming soon</span>}
              </div>
              <h3 className="mt-4 text-[17px] font-bold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="how" title="From sign-up to interview in four steps" className="bg-white">
        <ol className="grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-4 text-[17px] font-bold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="One bullet point can change a recruiter's mind" lead="An example of the kind of rewrite the Resume Builder and AI review suggest.">
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="card p-6">
            <figcaption className="text-sm font-semibold text-status-redInk">Before</figcaption>
            <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">&ldquo;Responsible for making sales dashboards.&rdquo;</p>
            <ul className="mt-5 space-y-1.5 text-sm text-ink-muted">
              <li>No action verb</li>
              <li>No result or number</li>
              <li>No tools named, so keyword filters miss it</li>
            </ul>
          </figure>
          <figure className="card border-violet/30 p-6">
            <figcaption className="text-sm font-semibold text-status-greenInk">After</figcaption>
            <p className="mt-3 text-[17px] font-medium leading-relaxed text-ink">
              &ldquo;Built Power BI sales dashboards used weekly by 40 store managers, cutting report preparation from 2 days to 2 hours.&rdquo;
            </p>
            <ul className="mt-5 space-y-1.5 text-sm text-ink-soft">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-status-greenInk" /> Starts with what you did</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-status-greenInk" /> Shows the impact in numbers</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-status-greenInk" /> Names the tool recruiters search for</li>
            </ul>
          </figure>
        </div>
      </Section>

      <Section id="plans" title="Start free. Upgrade when it's worth it." lead="Premium and Prime are launching soon. Join the waitlist and we'll email you; there's nothing to pay today." className="bg-white">
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={cn("card flex flex-col p-6", p.cta === "premium" && "border-violet/40 ring-1 ring-violet/20")}>
              <h3 className="text-xl font-bold text-ink">{p.name}</h3>
              <p className={cn("mt-1 text-sm font-medium", p.cta === "free" ? "text-status-greenInk" : "text-ink-muted")}>{p.note}</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-ink-soft">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden /> {it}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {p.cta === "free" ? (
                  <Link href="/signup" className="flex h-10 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white shadow-glow">
                    Get started free
                  </Link>
                ) : (
                  <WaitlistButton plan={p.cta} label="Join waitlist" />
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="faq" title="Questions">
        <div className="max-w-3xl">
          <Faq items={FAQ} />
        </div>
      </Section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-card bg-hero-gradient px-8 py-14 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Find out which jobs you really match</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/75">Set up your profile in two minutes and see your top matches straight away.</p>
          <Link href="/signup" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-brand-gradient px-7 text-[15px] font-semibold shadow-glow hover:brightness-110">
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-white px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
          <div>
            <Logo tone="dark" />
            <p className="mt-2 text-sm text-ink-muted">© {new Date().getFullYear()} CareerOS. A Miracle product.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-6 text-sm text-ink-soft">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#plans" className="hover:text-ink">Plans</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
            <Link href="/login" className="hover:text-ink">Log in</Link>
            <Link href="/signup" className="hover:text-ink">Sign up</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
