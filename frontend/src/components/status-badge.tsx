import type { AppStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<AppStatus, string> = {
  applied: "Applied",
  under_review: "Under Review",
  interview_scheduled: "Interview Scheduled",
  offer: "Offer",
  rejected: "Rejected",
};

const STYLE: Record<AppStatus, string> = {
  applied: "bg-status-green text-status-greenInk",
  interview_scheduled: "bg-status-green text-status-greenInk",
  offer: "bg-tile-lav text-tile-lavInk",
  under_review: "bg-status-amber text-status-amberInk",
  rejected: "bg-status-red text-status-redInk",
};

export function StatusBadge({ status }: { status: AppStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", STYLE[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
