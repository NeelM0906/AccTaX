import Link from "next/link";
import { ArrowUp, CheckCircle2, FileText, FolderOpen, Sparkles, Workflow } from "lucide-react";
import { Button, Input, Select } from "@ledgerai/ui";
import { formatInr } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { reviewAiSuggestion, uploadDocument } from "../actions";
import { getAssistantWorkspaceData } from "@/lib/server/workspace";
import { getWorkflowCatalog } from "@/lib/workflow-catalog";

type AssistantPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssistantPage({ searchParams }: AssistantPageProps) {
  const params = (await searchParams) ?? {};
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  const model = Array.isArray(params.model) ? params.model[0] : params.model;
  const workflowId = Array.isArray(params.workflow) ? params.workflow[0] : params.workflow;
  const projectId = Array.isArray(params.project) ? params.project[0] : params.project;
  const selectedWorkflow = getWorkflowCatalog("india").find((workflow) => workflow.id === workflowId);
  const data = await getAssistantWorkspaceData("india", q, projectId);
  const hasQuery = Boolean(q?.trim());

  return (
    <div className="min-h-screen bg-white px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <div className={hasQuery ? "flex-1 pt-8" : "flex flex-1 items-center justify-center"}>
          <div className="w-full">
            <div className="mx-auto max-w-3xl text-center">
              <Sparkles className="mx-auto mb-5 size-8 text-zinc-900" />
              <h1 className="text-3xl font-semibold tracking-normal text-zinc-950">
                {hasQuery ? (data.project ? "Project chat" : "Assistant") : `Hi, ${data.project?.name ?? data.ctx.workspaceName}`}
              </h1>
              {data.project ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600">
                  <FolderOpen className="size-3" />
                  {data.project.name}
                </div>
              ) : null}
            </div>

            {hasQuery ? (
              <div className="mx-auto mt-8 max-w-3xl space-y-5">
                <div className="ml-auto w-fit max-w-[80%] rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-900">
                  {q}
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white">
                      <Sparkles className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-zinc-950">{data.answer.title}</h2>
                        {data.project ? (
                          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-500">
                            Project: {data.project.name}
                          </span>
                        ) : null}
                        {selectedWorkflow ? (
                          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-500">
                            Workflow: {selectedWorkflow.title}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-700">{data.answer.message}</p>
                    </div>
                  </div>
                  {data.answer.citations.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2 pl-11">
                      {data.answer.citations.map((citation) => (
                        <Button key={`${citation.href}-${citation.label}`} variant="secondary" size="sm" asChild>
                          <Link href={citation.href}>{citation.label}</Link>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-3 border-t border-zinc-100 pt-3 pl-11 text-xs text-zinc-400">
                    <span>{data.documents.length} documents</span>
                    <span>{data.transactions.length} entries</span>
                    <span>{data.pendingCount} items needing attention</span>
                  </div>
                </div>
              </div>
            ) : null}

            <AssistantPrompt
              q={hasQuery ? "" : q ?? ""}
              returnTo={data.project ? `/app/assistant?project=${data.project.id}` : "/app/vault"}
              askPath="/app/assistant"
              workflowPath="/app/workflows"
              vaultPath="/app/projects"
              reportsPath="/app/reports"
              model={model ?? "gpt-4.1-mini"}
              project={data.project}
              selectedWorkflowId={selectedWorkflow?.id}
              selectedWorkflowTitle={selectedWorkflow?.title}
            />

            <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-zinc-400">
              <span>Income {formatInr(data.money.income)}</span>
              <span>Expenses {formatInr(data.money.expenses)}</span>
              <span>Receivables {formatInr(data.money.receivables)}</span>
              <span>{data.docsNeedingReview.length} need review</span>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl space-y-3 pb-4">
          <details id="approvals" className="rounded-xl border border-zinc-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-zinc-900">
              Approvals waiting ({data.suggestions.length})
            </summary>
            <div className="mt-4 grid gap-3">
              {data.suggestions.length === 0 ? (
                <div className="text-sm text-zinc-500">No AI changes are waiting.</div>
              ) : data.suggestions.map((suggestion) => (
                <form key={suggestion.id} action={reviewAiSuggestion} className="rounded-lg border border-zinc-200 p-3">
                  <input type="hidden" name="suggestionId" value={suggestion.id} />
                  <input type="hidden" name="returnTo" value="/app/assistant" />
                  <div className="text-sm font-medium">{suggestion.title}</div>
                  <div className="mt-3 flex gap-2">
                    <Button type="submit" name="action" value="accept" size="sm" variant="secondary">
                      <CheckCircle2 className="size-4" />
                      Accept
                    </Button>
                    <Button type="submit" name="action" value="reject" size="sm" variant="ghost">
                      Reject
                    </Button>
                  </div>
                </form>
              ))}
            </div>
          </details>

          <details className="rounded-xl border border-zinc-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-zinc-900">
              Recent source records ({data.documents.length})
            </summary>
            <div className="mt-4 divide-y divide-zinc-100">
              {data.documents.slice(0, 6).map((document) => (
                <Link key={document.id} href={`/app/vault/${document.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-zinc-50">
                  <span className="truncate font-medium text-zinc-900">{document.originalFilename}</span>
                  <StatusChip status={document.status.replaceAll("_", " ").toLowerCase()} />
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function AssistantPrompt({
  q,
  returnTo,
  askPath,
  workflowPath,
  vaultPath,
  reportsPath,
  model,
  project,
  selectedWorkflowId,
  selectedWorkflowTitle
}: {
  q: string;
  returnTo: string;
  askPath: string;
  workflowPath: string;
  vaultPath: string;
  reportsPath: string;
  model: string;
  project?: { id: string; name: string } | null;
  selectedWorkflowId?: string;
  selectedWorkflowTitle?: string;
}) {
  return (
    <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <form action={askPath}>
        {project ? <input type="hidden" name="project" value={project.id} /> : null}
        {selectedWorkflowId ? <input type="hidden" name="workflow" value={selectedWorkflowId} /> : null}
        {selectedWorkflowTitle ? (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
            <Workflow className="size-3" />
            {selectedWorkflowTitle}
          </div>
        ) : null}
        <Input
          name="q"
          defaultValue={q}
          className="h-12 border-0 px-1 text-base shadow-none focus:border-transparent focus:ring-0"
          placeholder="Ask a question about your documents, expenses, invoices, or taxes..."
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
          <Link href={project ? `${vaultPath}/${project.id}` : vaultPath} className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
            <FolderOpen className="size-4" />
            Projects
          </Link>
          <Link href={project ? `${workflowPath}?project=${project.id}` : workflowPath} className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
            <Workflow className="size-4" />
            Workflows
          </Link>
          <Link href={reportsPath} className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
            <FileText className="size-4" />
            Reports
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Select name="model" defaultValue={model} className="h-8 border-0 bg-transparent text-zinc-500">
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
              <option value="gpt-4.1">gpt-4.1</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="o4-mini">o4-mini</option>
              <option value="gpt-5.1-mini">gpt-5.1-mini</option>
              <option value="gpt-5.1">gpt-5.1</option>
            </Select>
            <Button type="submit" size="icon" className="rounded-xl">
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </form>
      <form action={uploadDocument} className="mt-2 flex items-center gap-2 border-t border-zinc-100 pt-2">
        <input type="hidden" name="returnTo" value={returnTo} />
        {project ? <input type="hidden" name="projectId" value={project.id} /> : null}
        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
          <FileText className="size-4" />
          Upload document
          <input name="file" type="file" className="sr-only" required />
        </label>
        <Button type="submit" variant="ghost" size="sm" className="ml-auto">
          Extract
        </Button>
      </form>
      <div className="mt-3 text-center text-xs text-zinc-400">
        AI can make mistakes. Compliance and tax outputs stay draft until reviewed.
      </div>
    </div>
  );
}
