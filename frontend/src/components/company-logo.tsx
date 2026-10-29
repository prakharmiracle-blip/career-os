import type { Company } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Monogram tile in the company's brand colour. Real logos are trademarks, so we
 * don't bundle them; Phase 2 can pull licensed logos from the job source API.
 */
export function CompanyLogo({ company, size = "md" }: { company: Company; size?: "sm" | "md" | "lg" }) {
  const letters = company.name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, company.name.length <= 4 ? 1 : 2)
    .map((w, i, arr) => (arr.length === 1 && w.length <= 4 ? w : w[0]))
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border border-line bg-white font-extrabold tracking-tight",
        size === "sm" && "h-9 w-9 text-[11px]",
        size === "md" && "h-11 w-11 text-sm",
        size === "lg" && "h-14 w-14 text-lg",
      )}
      style={{ color: company.brand_color }}
    >
      {letters}
    </div>
  );
}
