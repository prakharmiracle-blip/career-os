import { cn } from "@/lib/utils";

export function Logo({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <defs>
          <linearGradient id="co-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8B7CFF" />
            <stop offset="1" stopColor="#4F7CFF" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="11.5" fill="none" stroke="url(#co-ring)" strokeWidth="5" />
      </svg>
      <span className={cn("text-[21px] font-bold tracking-tight", tone === "light" ? "text-white" : "text-ink")}>CareerOS</span>
    </span>
  );
}
