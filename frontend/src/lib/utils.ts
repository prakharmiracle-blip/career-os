import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const m = Math.floor(d / 30);
  return `${m} month${m === 1 ? "" : "s"} ago`;
}

/** "Today, 6:00 PM" / "Tomorrow, 11:00 AM" / "Tue, 10:00 AM" in the viewer's timezone. */
export function friendlyWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / 86_400_000);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString("en-IN", { weekday: "short" })}, ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
}

export function salary(min: number | null, max: number | null, estimated = false) {
  if (min == null || max == null) return null;
  const range = min === max ? `₹ ${min} LPA` : `₹ ${min}–${max} LPA`;
  return estimated ? `${range} (est.)` : range;
}

export function experience(min: number | null, max: number | null) {
  if (min == null) return "Not specified";
  if (max === 0) return "Fresher";
  if (max == null || max === min) return `${min}+ years`;
  return `${min}–${max} years`;
}

/** "Bengaluru, India • Hybrid", leaving out parts the posting doesn't state. */
export function placeLine(location: string, mode: string) {
  return [location, mode].filter(Boolean).join(" • ");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
