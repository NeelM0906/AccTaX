import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  FileText,
  FolderOpen,
  MessageSquare,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  Upload
} from "lucide-react";
import { Button, Input } from "@ledgerai/ui";
import { formatCurrency, formatInr } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { createProject, deleteProject, renameProject, uploadDocument } from "@/app/app/actions";
import type { ProjectSummary } from "@/lib/server/workspace";

type Region = "india" | "north-america";

type ProjectsIndexData = {
  region: Region;
  basePath: string;
  projects: ProjectSummary[];
  totals: {
    projects: number;
    files: number;
    reviews: number;
  };
};

type ProjectWorkspaceData = {
  region: Region;
  basePath: string;
  project: ProjectSummary;
  documents: Array<{
    id: string;
    originalFilename: string;
    status: string;
    type: string;
    sizeBytes: number;
    createdAt: Date;
  }>;
  docsNeedingReview: Array<{
    id: string;
    originalFilename: string;
    status: string;
  }>;
  transactions: Array<{
    id: string;
    description: string;
    amount: unknown;
    category: string | null;
    transactionDate: Date;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    total: unknown;
  }>;
  bills: Array<{
    id: string;
    billNumber: string;
    status: string;
    total: unknown;
  }>;
  money: {
    income: number;
    expenses: number;
    receivables: number;
  };
  overview: {
    title: string;
    summary: string;
    bullets: string[];
  };
};

export function ProjectsIndex({ data }: { data: ProjectsIndexData }) {
  const projectsHref = `${data.basePath}/projects`;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between gap-4 px-8 py-4 max-md:flex-col max-md:items-stretch max-md:px-5">
        <div>
          <h1 className="font-serif text-2xl font-medium text-zinc-950">Projects</h1>
          <div className="mt-1 text-sm text-zinc-500">
            {data.totals.projects} project{data.totals.projects === 1 ? "" : "s"} · {data.totals.files} file{data.totals.files === 1 ? "" : "s"} · {data.totals.reviews} review{data.totals.reviews === 1 ? "" : "s"}
          </div>
        </div>
        <form action={createProject} className="flex min-w-[22rem] items-center gap-2 max-md:min-w-0">
          <input type="hidden" name="returnTo" value={projectsHref} />
          <Input name="name" placeholder="New project name" required className="h-9" />
          <Button type="submit" size="sm">
            <Plus className="size-4" />
            Create
          </Button>
        </form>
      </header>

      <main className="flex-1 px-8 py-6 max-md:px-5">
        <div className="space-y-3 md:hidden">
          {data.projects.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 px-4 py-8 text-sm text-zinc-500">No projects yet. Create one to start adding files.</div>
          ) : data.projects.map((project) => (
            <div key={project.id} className="rounded-lg border border-zinc-200 p-4">
              <Link href={`${projectsHref}/${project.id}`} className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600">
                  <FolderOpen className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-950">{project.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{project.detail}</span>
                </span>
              </Link>
              <div className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
                <span>{project.fileCount} file{project.fileCount === 1 ? "" : "s"}</span>
                {project.reviewCount > 0 ? <StatusChip status={`${project.reviewCount} review`} /> : <StatusChip status="ready" />}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <form action={renameProject} className="flex min-w-0 flex-1 items-center gap-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="returnTo" value={projectsHref} />
                  <Input name="name" defaultValue={project.name} aria-label={`Rename ${project.name}`} className="h-8 min-w-0" />
                  <Button type="submit" variant="ghost" size="icon" aria-label={`Save ${project.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                </form>
                <form action={deleteProject}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="returnTo" value={projectsHref} />
                  <Button type="submit" variant="ghost" size="icon" aria-label={`Delete ${project.name}`}>
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 max-md:hidden">
          <div className="grid min-h-10 grid-cols-[minmax(16rem,1fr)_7rem_7rem_minmax(18rem,24rem)] items-center border-b border-zinc-200 bg-zinc-50 px-4 text-xs font-medium text-zinc-500">
            <div>Project</div>
            <div>Files</div>
            <div>Review</div>
            <div>Manage</div>
          </div>

          {data.projects.length === 0 ? (
            <div className="px-4 py-10 text-sm text-zinc-500">No projects yet. Create one to start adding files.</div>
          ) : data.projects.map((project) => (
            <div key={project.id} className="grid min-h-16 grid-cols-[minmax(16rem,1fr)_7rem_7rem_minmax(18rem,24rem)] items-center gap-3 border-b border-zinc-100 px-4 text-sm last:border-b-0 hover:bg-zinc-50">
              <Link href={`${projectsHref}/${project.id}`} className="flex min-w-0 items-center gap-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600">
                  <FolderOpen className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-950">{project.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{project.detail}</span>
                </span>
              </Link>
              <div className="text-zinc-700">{project.fileCount}</div>
              <div>{project.reviewCount > 0 ? <StatusChip status={`${project.reviewCount} review`} /> : <StatusChip status="ready" />}</div>
              <div className="flex items-center gap-2 py-3">
                <form action={renameProject} className="flex min-w-0 flex-1 items-center gap-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="returnTo" value={projectsHref} />
                  <Input name="name" defaultValue={project.name} aria-label={`Rename ${project.name}`} className="h-8 min-w-0" />
                  <Button type="submit" variant="ghost" size="icon" aria-label={`Save ${project.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                </form>
                <form action={deleteProject}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="returnTo" value={projectsHref} />
                  <Button type="submit" variant="ghost" size="icon" aria-label={`Delete ${project.name}`}>
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export function ProjectWorkspace({ data }: { data: ProjectWorkspaceData }) {
  const projectHref = `${data.basePath}/projects/${data.project.id}`;
  const assistantHref = `${data.basePath}/assistant?project=${data.project.id}`;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between gap-4 px-8 py-4 max-md:flex-col max-md:items-stretch max-md:px-5">
        <div className="min-w-0">
          <Link href={`${data.basePath}/projects`} className="mb-2 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
            <ArrowLeft className="size-4" />
            Projects
          </Link>
          <h1 className="truncate font-serif text-2xl font-medium text-zinc-950">{data.project.name}</h1>
          <div className="mt-1 truncate text-sm text-zinc-500">{data.project.detail}</div>
        </div>
        <Button asChild>
          <Link href={assistantHref}>
            <MessageSquare className="size-4" />
            Work in this project
          </Link>
        </Button>
      </header>

      <main className="flex-1 space-y-8 px-8 py-6 max-md:px-5">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-lg border border-zinc-200 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Bot className="size-4" />
              AI overview
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-normal text-zinc-950">{data.overview.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{data.overview.summary}</p>
            <div className="mt-4 grid gap-2">
              {data.overview.bullets.map((bullet) => (
                <div key={bullet} className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{bullet}</div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-5">
            <div className="text-sm font-semibold text-zinc-950">Add files</div>
            <form action={uploadDocument} className="mt-4 space-y-3">
              <input type="hidden" name="projectId" value={data.project.id} />
              <input type="hidden" name="returnTo" value={projectHref} />
              <Input name="file" type="file" required />
              <Button type="submit" className="w-full">
                <Upload className="size-4" />
                Upload and extract
              </Button>
            </form>
            <Button asChild variant="secondary" className="mt-3 w-full">
              <Link href={assistantHref}>
                <ArrowRight className="size-4" />
                Open project chat
              </Link>
            </Button>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-4 max-lg:flex-col max-lg:items-start">
            <div>
              <h2 className="font-serif text-xl font-medium text-zinc-950">Files and materials</h2>
              <div className="mt-1 text-sm text-zinc-500">{data.documents.length} source file{data.documents.length === 1 ? "" : "s"} in this project</div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">
              <span>Income {formatMoney(data.region, data.money.income)}</span>
              <span>Expenses {formatMoney(data.region, data.money.expenses)}</span>
              <span>Receivables {formatMoney(data.region, data.money.receivables)}</span>
            </div>
          </div>

          {data.documents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-sm text-zinc-500">
              Upload files to build this project context.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.documents.map((document) => (
                <Link key={document.id} href={`${data.basePath}/vault/${document.id}`} className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50">
                  <div className="flex items-start justify-between gap-3">
                    <FileText className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                    <StatusChip status={document.status.replaceAll("_", " ").toLowerCase()} />
                  </div>
                  <div className="mt-3 truncate font-medium text-zinc-950">{document.originalFilename}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {document.type.replaceAll("_", " ").toLowerCase()} · {formatBytes(document.sizeBytes)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div>
            <h2 className="mb-3 font-serif text-xl font-medium text-zinc-950">Accounting materials</h2>
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              {[...data.invoices.map((invoice) => ({
                id: invoice.id,
                label: invoice.invoiceNumber,
                kind: "Invoice",
                status: invoice.status,
                total: invoice.total
              })), ...data.bills.map((bill) => ({
                id: bill.id,
                label: bill.billNumber,
                kind: "Bill",
                status: bill.status,
                total: bill.total
              }))].length === 0 ? (
                <div className="px-4 py-8 text-sm text-zinc-500">No invoices or bills have been created from this project yet.</div>
              ) : (
                [...data.invoices.map((invoice) => ({
                  id: invoice.id,
                  label: invoice.invoiceNumber,
                  kind: "Invoice",
                  status: invoice.status,
                  total: invoice.total
                })), ...data.bills.map((bill) => ({
                  id: bill.id,
                  label: bill.billNumber,
                  kind: "Bill",
                  status: bill.status,
                  total: bill.total
                }))].map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="flex h-12 items-center justify-between gap-3 border-b border-zinc-100 px-4 text-sm last:border-b-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <ReceiptText className="size-4 shrink-0 text-zinc-500" />
                      <span className="truncate font-medium text-zinc-900">{item.label}</span>
                      <span className="text-xs text-zinc-500">{item.kind}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusChip status={item.status.toLowerCase()} />
                      <span className="w-24 text-right font-medium text-zinc-900">{formatMoney(data.region, Number(item.total))}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-serif text-xl font-medium text-zinc-950">Recent transactions</h2>
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              {data.transactions.length === 0 ? (
                <div className="px-4 py-8 text-sm text-zinc-500">No transactions have been posted from this project yet.</div>
              ) : data.transactions.slice(0, 8).map((transaction) => (
                <div key={transaction.id} className="grid h-12 grid-cols-[7rem_minmax(0,1fr)_7rem] items-center gap-3 border-b border-zinc-100 px-4 text-sm last:border-b-0">
                  <span className="text-zinc-500">{transaction.transactionDate.toLocaleDateString(data.region === "north-america" ? "en-US" : "en-IN")}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-zinc-900">{transaction.description}</span>
                    <span className="block truncate text-xs text-zinc-500">{transaction.category ?? "uncategorized"}</span>
                  </span>
                  <span className="text-right font-medium text-zinc-900">{formatMoney(data.region, Number(transaction.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function formatMoney(region: Region, value: number) {
  return region === "north-america" ? formatCurrency(value, "USD") : formatInr(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
