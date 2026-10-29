"use client";

import * as Dd from "@radix-ui/react-dropdown-menu";
import * as D from "@radix-ui/react-dialog";
import { Bell, ChevronDown, LogOut, Menu, Search, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { api, type User } from "@/lib/api";
import { initials } from "@/lib/utils";

import { SidebarContent } from "./sidebar";

function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  useEffect(() => setQ(params.get("q") ?? ""), [params]);
  return (
    <form
      role="search"
      className="relative w-full max-w-[420px]"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/jobs?q=${encodeURIComponent(q.trim())}` : "/jobs");
      }}
    >
      <label htmlFor="global-search" className="sr-only">
        Search jobs, companies or skills
      </label>
      <input
        id="global-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search jobs, companies or skills..."
        className="h-11 w-full rounded-full border border-line bg-white pl-5 pr-12 text-sm text-ink placeholder:text-ink-muted focus:border-violet focus:outline-none focus:ring-4 focus:ring-violet/15"
      />
      <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-soft hover:bg-canvas" aria-label="Search">
        <Search className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}

function Notifications() {
  return (
    <Dd.Root>
      <Dd.Trigger className="relative rounded-full p-2.5 text-ink-soft hover:bg-white" aria-label="Notifications (1 new)">
        <Bell className="h-5 w-5" strokeWidth={1.8} />
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-canvas" aria-hidden />
      </Dd.Trigger>
      <Dd.Portal>
        <Dd.Content align="end" sideOffset={8} className="z-50 w-80 rounded-2xl border border-line bg-white p-2 shadow-xl">
          <p className="px-3 py-2 text-sm font-semibold text-ink">Notifications</p>
          <Dd.Item asChild>
            <Link href="/applications" className="block rounded-xl px-3 py-2.5 text-sm text-ink-soft outline-none hover:bg-canvas focus:bg-canvas">
              <span className="font-medium text-ink">Welcome to CareerOS.</span> Track every application from the Applications page.
            </Link>
          </Dd.Item>
          <p className="px-3 pb-2 pt-1 text-xs text-ink-muted">Live notifications arrive in a later release.</p>
        </Dd.Content>
      </Dd.Portal>
    </Dd.Root>
  );
}

function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const qc = useQueryClient();
  const roleLabel = user.headline || { student: "Student", fresher: "Job Seeker", experienced: "Professional" }[user.role_type];
  return (
    <Dd.Root>
      <Dd.Trigger className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 hover:bg-white" aria-label="Account menu">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">{initials(user.name)}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-ink">{user.name}</span>
          <span className="block text-xs text-ink-muted">{roleLabel}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-ink-muted sm:block" />
      </Dd.Trigger>
      <Dd.Portal>
        <Dd.Content align="end" sideOffset={8} className="z-50 w-56 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
          <p className="truncate px-3 py-2 text-xs text-ink-muted">{user.email}</p>
          <Dd.Item asChild>
            <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-canvas focus:bg-canvas">
              <UserRound className="h-4 w-4" /> Profile
            </Link>
          </Dd.Item>
          <Dd.Item asChild>
            <Link href="/settings#plan" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink outline-none hover:bg-canvas focus:bg-canvas">
              <Settings className="h-4 w-4" /> Settings
            </Link>
          </Dd.Item>
          <Dd.Separator className="my-1 h-px bg-line" />
          <Dd.Item
            onSelect={async () => {
              await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
              qc.clear();
              router.replace("/login");
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-status-redInk outline-none hover:bg-status-red focus:bg-status-red"
          >
            <LogOut className="h-4 w-4" /> Log out
          </Dd.Item>
        </Dd.Content>
      </Dd.Portal>
    </Dd.Root>
  );
}

export function Topbar({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-canvas/85 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Trigger className="rounded-lg p-2 text-ink lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-navy-900/50 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden" aria-describedby={undefined}>
            <D.Title className="sr-only">Navigation</D.Title>
            <SidebarContent onNavigate={() => setOpen(false)} onCollapse={() => setOpen(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>
      <SearchBox />
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <Notifications />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
