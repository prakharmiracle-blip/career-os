"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { useMe } from "@/lib/queries";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: user, isError, isLoading } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isError) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (user && !user.onboarded) router.replace("/onboarding");
  }, [isError, user, router, pathname]);

  if (isLoading || isError || !user || !user.onboarded) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin text-violet" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Sidebar />
      <div className="lg:pl-60">
        <Suspense>
          <Topbar user={user} />
        </Suspense>
        <main id="main" className="px-4 pb-12 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
