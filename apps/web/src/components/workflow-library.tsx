"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Library,
  MessageSquare,
  Plus,
  Search,
  Table2,
  User,
  X
} from "lucide-react";
import type { AccountingWorkflow } from "@/lib/workflow-catalog";

type WorkflowLibraryProps = {
  workflows: AccountingWorkflow[];
  basePath: "/app" | "/na";
};

type Tab = "all" | "builtin" | "custom" | "hidden";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "All Workflows" },
  { id: "builtin", label: "Built-in" },
  { id: "custom", label: "Custom" },
  { id: "hidden", label: "Hidden" }
];

export function WorkflowLibrary({ workflows, basePath }: WorkflowLibraryProps) {
  const [selected, setSelected] = useState<AccountingWorkflow | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"assistant" | "tabular" | null>(null);
  const [practiceFilter, setPracticeFilter] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const practices = useMemo(
    () => Array.from(new Set(workflows.map((workflow) => workflow.practice))).sort(),
    [workflows]
  );

  const filtered = workflows
    .filter(() => activeTab === "all" || activeTab === "builtin")
    .filter((workflow) => !typeFilter || workflow.type === typeFilter)
    .filter((workflow) => !practiceFilter || workflow.practice === practiceFilter)
    .filter((workflow) => workflow.title.toLowerCase().includes(query.toLowerCase()));

  const allChecked = filtered.length > 0 && filtered.every((workflow) => checkedIds.includes(workflow.id));
  const selectedWorkflowIds = new Set(checkedIds);

  function toggleAll() {
    setCheckedIds(allChecked ? [] : filtered.map((workflow) => workflow.id));
  }

  function toggleOne(id: string) {
    setCheckedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className="flex h-full min-h-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between px-8 py-4">
        <h1 className="font-serif text-2xl font-medium text-zinc-950">Workflows</h1>
        <div className="flex items-center gap-2">
          <label className="flex h-8 items-center gap-2 rounded-md px-2 text-zinc-500 hover:bg-zinc-100">
            <Search className="size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workflows..."
              className="w-40 border-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
          </label>
          <button className="flex size-8 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100" aria-label="Create workflow">
            <Plus className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex h-10 shrink-0 items-center justify-between border-y border-zinc-200 px-8">
        <div className="flex h-full items-center gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-full text-sm font-medium ${activeTab === tab.id ? "border-b border-zinc-950 text-zinc-950" : "text-zinc-500 hover:text-zinc-900"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-5 text-xs font-medium text-zinc-500">
          <select
            value={typeFilter ?? ""}
            onChange={(event) => setTypeFilter(event.target.value ? event.target.value as "assistant" | "tabular" : null)}
            className="border-0 bg-transparent p-0 text-xs font-medium text-zinc-500 outline-none"
          >
            <option value="">Filter by type</option>
            <option value="assistant">Assistant</option>
            <option value="tabular">Tabular</option>
          </select>
          <select
            value={practiceFilter ?? ""}
            onChange={(event) => setPracticeFilter(event.target.value || null)}
            className="border-0 bg-transparent p-0 text-xs font-medium text-zinc-500 outline-none"
          >
            <option value="">Filter by practice</option>
            {practices.map((practice) => (
              <option key={practice} value={practice}>{practice}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-[860px]">
          <div className="grid h-8 grid-cols-[2rem_minmax(20rem,1fr)_8rem_12rem_8rem_2rem] items-center border-b border-zinc-200 pr-8 text-xs font-medium text-zinc-500">
            <div className="flex justify-center">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} className="size-3 accent-zinc-950" aria-label="Select all workflows" />
            </div>
            <div>Name</div>
            <div>Type</div>
            <div>Practice</div>
            <div>Source</div>
            <div />
          </div>

          {filtered.map((workflow) => {
            const isChecked = selectedWorkflowIds.has(workflow.id);
            const TypeIcon = workflow.type === "assistant" ? MessageSquare : Table2;
            return (
              <div
                key={workflow.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(workflow)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelected(workflow);
                }}
                className="grid h-10 w-full grid-cols-[2rem_minmax(20rem,1fr)_8rem_12rem_8rem_2rem] items-center border-b border-zinc-100 pr-8 text-left hover:bg-zinc-50"
              >
                <span className="flex justify-center" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(workflow.id)}
                    className="size-3 accent-zinc-950"
                    aria-label={`Select ${workflow.title}`}
                  />
                </span>
                <span className="truncate px-2 text-sm font-medium text-zinc-800">{workflow.title}</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${workflow.type === "assistant" ? "text-blue-700" : "text-violet-700"}`}>
                  <TypeIcon className="size-3.5" />
                  {workflow.type === "assistant" ? "Assistant" : "Tabular"}
                </span>
                <span className="truncate text-xs font-medium text-zinc-600">{workflow.practice}</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                  <Library className="size-3.5" />
                  {workflow.source}
                </span>
                <span className="text-zinc-400">...</span>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div className="mx-auto flex max-w-xs flex-col items-start py-24">
              <Library className="mb-4 size-8 text-zinc-300" />
              <p className="font-serif text-2xl font-medium text-zinc-950">Workflows</p>
              <p className="mt-1 text-sm text-zinc-500">No accounting workflows match the current filters.</p>
            </div>
          ) : null}
        </div>
      </div>

      {selected ? (
        <WorkflowPreview workflow={selected} workflows={filtered} basePath={basePath} onSelect={setSelected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

function WorkflowPreview({
  workflow,
  workflows,
  basePath,
  onSelect,
  onClose
}: {
  workflow: AccountingWorkflow;
  workflows: AccountingWorkflow[];
  basePath: "/app" | "/na";
  onSelect: (workflow: AccountingWorkflow) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const visible = workflows.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));
  const useHref = workflow.type === "assistant"
    ? `${basePath}/assistant?q=${encodeURIComponent(`Run ${workflow.title}`)}&workflow=${encodeURIComponent(workflow.id)}`
    : `${basePath}/tabular-reviews?workflow=${encodeURIComponent(workflow.id)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/25 p-6 backdrop-blur-[2px]">
      <div className="grid h-[70vh] w-full max-w-5xl grid-cols-[19rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="col-span-2 flex h-14 items-center justify-between border-b border-zinc-200 px-5">
          <div className="text-sm text-zinc-500">Workflows <span className="px-1">›</span> Select workflow</div>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100" aria-label="Close workflow preview">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 border-r border-zinc-200">
          <div className="border-b border-zinc-200 p-3">
            <label className="flex h-8 items-center gap-2 rounded-md border border-zinc-200 px-2 text-zinc-500">
              <Search className="size-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
                className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
              />
            </label>
          </div>
          <div className="h-[calc(70vh-7rem)] overflow-auto">
            {visible.map((item) => {
              const Icon = item.type === "assistant" ? MessageSquare : Table2;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`flex h-10 w-full items-center justify-between gap-3 border-b border-zinc-100 px-4 text-left text-sm ${item.id === workflow.id ? "bg-zinc-100 font-semibold text-zinc-950" : "text-zinc-700 hover:bg-zinc-50"}`}
                >
                  <span className="truncate">{item.title}</span>
                  <Icon className="size-4 shrink-0 text-zinc-500" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-5">
            <div className="text-xs font-semibold text-zinc-700">
              {workflow.type === "assistant" ? "Workflow Prompt" : "Review Columns"}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
              {workflow.practice}
              <ChevronDown className="size-3" />
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {workflow.type === "assistant" ? (
              <div className="min-h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 font-serif text-sm leading-7 text-zinc-700">
                <h2 className="mb-3 text-lg font-semibold text-zinc-950">{workflow.title}</h2>
                <p className="whitespace-pre-wrap">{workflow.prompt}</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                {(workflow.columns ?? []).map((column, index) => (
                  <details key={column.name} className="group border-b border-zinc-200 last:border-b-0" open={index === 0}>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm hover:bg-white">
                      <span className="flex size-6 items-center justify-center rounded-md bg-white text-xs font-semibold text-zinc-500">{index + 1}</span>
                      <span className="flex-1 font-medium text-zinc-900">{column.name}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-500">{column.format}</span>
                      <ChevronDown className="size-4 text-zinc-400 group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-zinc-200 bg-white px-4 py-3 font-serif text-sm leading-6 text-zinc-600">
                      {column.prompt}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="flex h-16 shrink-0 items-center justify-between border-t border-zinc-200 px-5">
            <Link href={useHref} className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              View Page
            </Link>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <User className="size-3.5" />
                Built for accounting review
              </span>
              <Link href={useHref} className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800">
                <Check className="size-4" />
                Use
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
