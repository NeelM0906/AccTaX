"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpenText,
  ChevronDown,
  ChevronsUpDown,
  FolderOpen,
  Library,
  MessageSquare,
  PanelLeft,
  Settings,
  Table2
} from "lucide-react";

const nav = [
  { href: "/app/assistant", label: "Assistant", icon: MessageSquare },
  { href: "/app/projects", label: "Projects", icon: FolderOpen },
  { href: "/app/tabular-reviews", label: "Tabular Review", icon: Table2 },
  { href: "/app/workflows", label: "Workflows", icon: Library },
  { href: "/app/reports", label: "Reports", icon: BarChart3 }
];

const naNav = [
  { href: "/na/assistant", label: "Assistant", icon: MessageSquare },
  { href: "/na/projects", label: "Projects", icon: FolderOpen },
  { href: "/na/tabular-reviews", label: "Tabular Review", icon: Table2 },
  { href: "/na/workflows", label: "Workflows", icon: Library },
  { href: "/na/reports", label: "Reports", icon: BarChart3 }
];

type AppShellProps = {
  children: React.ReactNode;
  workspace: {
    name: string;
    gstin: string;
    financialYear: string;
  };
  variant?: "india" | "north-america";
  suggestions: Array<{
    id: string;
    title: string;
    description: string | null;
    source: string;
    action: string;
  }>;
};

export function AppShell({ children, workspace, suggestions, variant = "india" }: AppShellProps) {
  const pathname = usePathname();
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const isNorthAmerica = variant === "north-america";
  const activeNav = isNorthAmerica ? naNav : nav;
  const assistantHref = isNorthAmerica ? "/na/assistant" : "/app/assistant";
  const settingsHref = isNorthAmerica ? "/na/settings" : "/app/settings";
  const isAssistantRoute = pathname.includes("/assistant");

  return (
    <div className="grid h-screen grid-cols-[15.5rem_minmax(0,1fr)] overflow-hidden bg-white text-zinc-950 max-lg:grid-cols-1">
      <aside className="flex h-screen flex-col border-r border-zinc-200 bg-zinc-50 max-lg:hidden">
        <div className="mb-3 flex items-center justify-between px-3 py-2">
          <Link href={assistantHref} className="flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 hover:bg-zinc-100">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-[11px] font-semibold text-white">
              {isNorthAmerica ? "NA" : "LA"}
            </div>
            <div className="min-w-0">
              <div className="truncate font-serif text-lg font-medium">{isNorthAmerica ? "LedgerAI NA" : "LedgerAI India"}</div>
            </div>
          </Link>
          <button className="flex size-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100" aria-label="Collapse sidebar">
            <PanelLeft className="size-4" />
          </button>
        </div>

        <nav className="space-y-1 px-2.5">
          {activeNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? "flex h-9 items-center gap-3 rounded-md bg-zinc-100 px-2.5 text-sm font-semibold text-zinc-950"
                  : "flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );})}
        </nav>

        {isAssistantRoute ? (
        <div className="mt-7 min-h-0 flex-1 px-5">
          <button
            type="button"
            onClick={() => setHistoryCollapsed((value) => !value)}
            className="flex w-full items-center justify-between text-xs font-semibold text-zinc-500 hover:text-zinc-800"
          >
            <span>Assistant History</span>
            <ChevronDown className={`size-3.5 transition-transform ${historyCollapsed ? "-rotate-90" : ""}`} />
          </button>
          <div className={historyCollapsed ? "hidden" : "mt-3 space-y-1"}>
            <Link href={`${assistantHref}?q=What%20needs%20my%20review%3F`} className="block truncate rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
              What needs review?
            </Link>
            <Link href={`${assistantHref}?q=Summarize%20my%20tax%20status`} className="block truncate rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
              Tax status summary
            </Link>
            <Link href={`${assistantHref}?q=Prepare%20my%20monthly%20report`} className="block truncate rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
              Monthly report
            </Link>
          </div>
        </div>
        ) : <div className="flex-1" />}

        <div className="mt-auto border-t border-zinc-200 p-4">
          <Link
            href={`${assistantHref}#approvals`}
            className="mb-2 flex items-center justify-between rounded-md px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpenText className="size-4" />
              Approvals
            </span>
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">{suggestions.length}</span>
          </Link>
          <Link href={settingsHref} className="flex items-center gap-3 rounded-md px-2.5 py-2 hover:bg-zinc-100">
            <div className="flex size-7 items-center justify-center rounded-full bg-zinc-800 font-serif text-xs font-medium text-white">
              {workspace.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{workspace.name}</div>
              <div className="truncate text-xs text-zinc-500">{workspace.financialYear}</div>
            </div>
            {pathname === settingsHref ? <Settings className="size-4 text-zinc-600" /> : <ChevronsUpDown className="size-4 text-zinc-400" />}
          </Link>
        </div>
      </aside>

      <main className="min-w-0 overflow-y-auto bg-white">{children}</main>
    </div>
  );
}
