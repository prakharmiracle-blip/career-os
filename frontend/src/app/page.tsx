"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useMe } from "@/lib/queries";

// The marketing landing page is planned for Phase 2; until then "/" routes
// people straight into the app or to login.
export default function Root() {
  const router = useRouter();
  const { data, isError } = useMe();
  useEffect(() => {
    if (isError) router.replace("/login");
    else if (data) router.replace(data.onboarded ? "/home" : "/onboarding");
  }, [data, isError, router]);
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="h-6 w-6 animate-spin text-violet" />
    </div>
  );
}
