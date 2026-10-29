"use client";

import { CheckCircle2, Gem } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useJoinWaitlist } from "@/lib/queries";

/** Premium has no checkout yet: this only records waitlist interest. */
export function PremiumDialog({
  open,
  onOpenChange,
  plan = "premium",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan?: "premium" | "prime";
}) {
  const join = useJoinWaitlist();
  const [done, setDone] = useState<null | "joined" | "already">(null);
  const name = plan === "prime" ? "Prime" : "Premium";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setDone(null);
          join.reset();
        }
      }}
    >
      <DialogContent
        title={`${name} is launching soon`}
        description="Unlimited AI resume reviews, unlimited mock interviews, priority job matches and certificate tracks. Join the waitlist and we'll email you the day it opens."
      >
        {done ? (
          <div className="flex items-start gap-3 rounded-xl bg-status-green p-4 text-sm text-status-greenInk" role="status">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              {done === "already"
                ? `You're already on the ${name} waitlist. We'll email you at launch.`
                : `You're on the ${name} waitlist. We'll email you at launch.`}
            </p>
          </div>
        ) : (
          <>
            <ul className="mb-5 space-y-2 text-sm text-ink-soft">
              {["Nothing to pay now, no card needed", "Early members get launch pricing", "Leave the list any time"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Gem className="h-4 w-4 text-violet" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            {join.isError && (
              <p className="mb-3 text-sm text-status-redInk" role="alert">
                {join.error.message}
              </p>
            )}
            <Button
              className="w-full"
              loading={join.isPending}
              onClick={() =>
                join.mutate(
                  { plan, source: "app" },
                  { onSuccess: (r) => setDone(r.already_joined ? "already" : "joined") },
                )
              }
            >
              Join the waitlist
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
