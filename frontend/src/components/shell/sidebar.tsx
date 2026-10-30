"use client";

import { ArrowRight, ArrowUpRight, ChevronsLeft, Gem } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/logo";
import { PremiumDialog } from "@/components/premium-dialog";
import { GROW_NAV, isExternal, MAIN_NAV, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  const external = isExternal(item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      {...(external ? { target: "_blank", rel: "noopener noreferrer", "aria-label": `${item.label} (opens in a new tab)` } : {})}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3.5 py-[9px] text-sm font-medium transition-colors",
        active ? "bg-white/[0.09] text-white" : "text-white/70 hover:bg-white/[0.05] hover:text-white",
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-white/60 group-hover:text-white")} strokeWidth={1.8} />
      <span className="truncate">{item.label}</span>
      {external && <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/45" aria-hidden />}
      {item.soon && (
        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" title="Coming soon" aria-label="Coming soon" />
      )}
    </Link>
  );
}

export function SidebarContent({ onNavigate, onCollapse }: { onNavigate?: () => void; onCollapse?: () => void }) {
  const [premium, setPremium] = useState(false);
  return (
    <div className="flex h-full flex-col bg-sidebar-gradient px-4 pb-5 pt-6">
      <div className="mb-7 flex items-center justify-between px-1.5">
        <Link href="/home" onClick={onNavigate} aria-label="CareerOS home">
          <Logo />
        </Link>
        {onCollapse && (
          <button onClick={onCollapse} className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close menu">
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="-mx-1 flex-1 overflow-y-auto px-1 [scrollbar-width:thin]">
        <ul className="space-y-1">
          {MAIN_NAV.map((item) => (
            <li key={item.href}>
              <NavLink item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        <p className="mb-2 mt-5 px-3.5 text-xs font-semibold text-white/40">Grow</p>
        <ul className="space-y-1">
          {GROW_NAV.map((item) => (
            <li key={item.href}>
              <NavLink item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.05] p-4">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
          <Gem className="h-5 w-5 text-amber-300" aria-hidden /> Get Premium
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/70">
          Unlock advanced AI tools, track more applications and get personalized guidance.
        </p>
        <button
          onClick={() => setPremium(true)}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient text-sm font-semibold text-white shadow-glow hover:brightness-110"
        >
          Upgrade Now <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <PremiumDialog open={premium} onOpenChange={setPremium} />
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
      <SidebarContent />
    </aside>
  );
}
