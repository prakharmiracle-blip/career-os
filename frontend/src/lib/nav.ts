import {
  Bot,
  Briefcase,
  Building2,
  ClipboardList,
  FileText,
  GraduationCap,
  Heart,
  Home,
  Laptop,
  Medal,
  Mic,
  Search,
  Settings,
  Target,
  UserRoundSearch,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Miracle's existing AI interview platform; Interview Prep sends users there. */
export const INTERVIEW_APP_URL = "https://miracleinterviewai.netlify.app/";

export const isExternal = (href: string) => /^https?:\/\//.test(href);

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Present when the module isn't built yet: the route renders a clear "coming soon" page. */
  soon?: { phase: number; summary: string };
}

export const MAIN_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/jobs", label: "Job Search", icon: Search },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/resume-builder", label: "Resume Builder", icon: FileText },
  { href: "/coach", label: "AI Career Coach", icon: Bot },
  { href: INTERVIEW_APP_URL, label: "Interview Prep", icon: Mic },
  { href: "/skills", label: "Skill Development", icon: Target, soon: { phase: 3, summary: "Your current and missing skills, an AI roadmap with checkable steps, courses and a weekly streak." } },
  { href: "/saved", label: "Saved Jobs", icon: Heart },
  { href: "/companies", label: "Company Insights", icon: Building2, soon: { phase: 3, summary: "Culture, salary ranges, interview process and hiring trends for each company." } },
  { href: "/settings", label: "Profile & Settings", icon: Settings },
];

export const GROW_NAV: NavItem[] = [
  { href: "/upgrade-skill", label: "Upgrade Skill", icon: Medal, soon: { phase: 4, summary: "10-question skill assessments, level badges, score history and a personalised upgrade plan." } },
  { href: "/prime-skills", label: "Prime Skills", icon: GraduationCap, soon: { phase: 4, summary: "Certificate-grade tracks such as Generative AI, Data Analytics and Full-Stack, with graded projects and verifiable certificates." } },
  { href: "/networking", label: "Networking", icon: Users, soon: { phase: 5, summary: "A people directory, connection requests, messaging, communities, events and “who can refer me” for any job." } },
  { href: "/mentoring", label: "Mentoring", icon: Briefcase, soon: { phase: 5, summary: "Browse mentors, book free sessions on their calendar, meet by video and leave feedback." } },
  { href: "/freelancing", label: "Freelancing", icon: Laptop, soon: { phase: 6, summary: "A gig board with proposals, milestones, chat and reviews. Payments are agreed outside the app." } },
  { href: "/similar-people", label: "Find a Similar Person", icon: UserRoundSearch, soon: { phase: 5, summary: "Match with people on the same path for peer mock interviews or a 15-minute chat with someone already in your target role." } },
];

export const ALL_NAV = [...MAIN_NAV, ...GROW_NAV];

export function soonModule(slug: string) {
  return ALL_NAV.find((n) => n.href === `/${slug}` && n.soon);
}
