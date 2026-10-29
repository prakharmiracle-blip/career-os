import { ArrowRight, BarChart3, BriefcaseBusiness, FileText, Mic } from "lucide-react";
import Link from "next/link";

const CHIPS = [
  { label: "Resume", icon: FileText, href: "/resume-builder", pos: "left-[6%] top-[22%]" },
  { label: "Jobs", icon: BriefcaseBusiness, href: "/jobs", pos: "right-[4%] top-[24%]" },
  { label: "Interview Prep", icon: Mic, href: "/interview-prep", pos: "left-0 top-[56%]" },
  { label: "Skill Growth", icon: BarChart3, href: "/skills", pos: "right-0 top-[62%]" },
];

/**
 * Illustration slot. The reference design uses a licensed stock photo here;
 * swap this SVG for <Image src="/hero-person.png" ... /> once you have one.
 */
function HeroArt() {
  return (
    <svg viewBox="0 0 400 260" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="hb-glow" cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor="#6C5CE7" stopOpacity="0.55" />
          <stop offset="1" stopColor="#6C5CE7" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hb-ring" x1="0" x2="1">
          <stop offset="0" stopColor="#5B8CFF" />
          <stop offset="0.5" stopColor="#8B7CFF" />
          <stop offset="1" stopColor="#5B8CFF" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="hb-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B3F9E" />
          <stop offset="1" stopColor="#1A1C55" />
        </linearGradient>
        <filter id="hb-blur"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <ellipse cx="200" cy="150" rx="190" ry="120" fill="url(#hb-glow)" />
      <ellipse cx="200" cy="120" rx="170" ry="52" fill="none" stroke="url(#hb-ring)" strokeWidth="2.5" filter="url(#hb-blur)" />
      <ellipse cx="200" cy="120" rx="170" ry="52" fill="none" stroke="url(#hb-ring)" strokeWidth="1.2" />
      {/* abstract person silhouette */}
      <circle cx="200" cy="112" r="42" fill="url(#hb-body)" />
      <path d="M110 262c4-62 44-98 90-98s86 36 90 98z" fill="url(#hb-body)" />
      <circle cx="200" cy="112" r="42" fill="none" stroke="#8B7CFF" strokeOpacity=".35" />
      <ellipse cx="200" cy="215" rx="150" ry="30" fill="none" stroke="url(#hb-ring)" strokeWidth="1.2" strokeOpacity=".7" />
    </svg>
  );
}

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-card bg-hero-gradient text-white" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet/30 blur-3xl" aria-hidden />
      <div className="relative grid items-center gap-6 p-7 sm:p-9 md:grid-cols-[1.15fr_1fr]">
        <div>
          <h1 id="hero-title" className="text-[32px] font-extrabold leading-[1.12] tracking-tight sm:text-[40px]">
            Your Career.
            <br />
            Simplified with AI.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80 sm:text-base">
            Find jobs, build your resume, prepare for interviews and grow your skills — all in one place.
          </p>
          <Link
            href="/jobs"
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-brand-gradient px-6 text-sm font-semibold shadow-glow hover:brightness-110"
          >
            Explore Jobs <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="relative hidden h-[220px] md:block">
          <HeroArt />
          {CHIPS.map(({ label, icon: Icon, href, pos }) => (
            <Link
              key={label}
              href={href}
              className={`absolute ${pos} flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm font-semibold backdrop-blur-md hover:bg-white/20`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-azure/90">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
