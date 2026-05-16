import Link from "next/link";
import { Download, MessageSquare, Play, Search, Table2 } from "lucide-react";
import { Button } from "@ledgerai/ui";
import { formatCurrency } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { getAssistantWorkspaceData } from "@/lib/server/workspace";
import { getWorkflowCatalog } from "@/lib/workflow-catalog";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NorthAmericaTabularReviewsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const workflowId = Array.isArray(params.workflow) ? params.workflow[0] : params.workflow;
  const workflows = getWorkflowCatalog("north-america").filter((workflow) => workflow.type === "tabular");
  const workflow = workflows.find((item) => item.id === workflowId) ?? workflows[0]!;
  const data = await getAssistantWorkspaceData("north-america");
  const records = [
    ...data.documents.map((document) => ({
      id: document.id,
      href: `/na/vault/${document.id}`,
      source: document.originalFilename,
      counterparty: "Awaiting review",
      amount: "-",
      category: document.type.replaceAll("_", " ").toLowerCase(),
      status: document.status.replaceAll("_", " ").toLowerCase()
    })),
    ...data.invoices.map((invoice) => ({
      id: invoice.id,
      href: "/na/invoices",
      source: invoice.invoiceNumber,
      counterparty: "Customer invoice",
      amount: formatCurrency(Number(invoice.total), "USD"),
      category: "sales",
      status: invoice.status.toLowerCase()
    })),
    ...data.bills.map((bill) => ({
      id: bill.id,
      href: "/na/vault",
      source: bill.billNumber,
      counterparty: "Vendor bill",
      amount: formatCurrency(Number(bill.total), "USD"),
      category: "expense",
      status: bill.status.toLowerCase()
    })),
    ...data.transactions.map((transaction) => ({
      id: transaction.id,
      href: "/na/vault#transactions",
      source: transaction.description,
      counterparty: transaction.category ?? "Uncategorized",
      amount: formatCurrency(Number(transaction.amount), "USD"),
      category: transaction.category ?? "review",
      status: "posted"
    }))
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between px-8 py-4">
        <div>
          <h1 className="font-serif text-2xl font-medium text-zinc-950">Tabular Review</h1>
          <p className="mt-1 text-sm text-zinc-500">{workflow.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-8 items-center gap-2 rounded-md px-2 text-zinc-500 hover:bg-zinc-100">
            <Search className="size-4" />
            <input placeholder="Search records..." className="w-40 border-0 bg-transparent text-sm outline-none placeholder:text-zinc-400" />
          </label>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/api/exports/transactions.csv">
              <Download className="size-4" />
              Export
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/na/assistant?q=${encodeURIComponent(`Run ${workflow.title} on my records`)}`}>
              <Play className="size-4" />
              Run
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex h-10 shrink-0 items-center justify-between border-y border-zinc-200 px-8">
        <div className="flex h-full items-center gap-6 text-sm font-medium">
          <span className="flex h-full items-center border-b border-zinc-950 text-zinc-950">All Records</span>
          <span className="text-zinc-500">Needs Review</span>
          <span className="text-zinc-500">Posted</span>
          <span className="text-zinc-500">Exceptions</span>
        </div>
        <Link href="/na/workflows" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">Change workflow</Link>
      </div>

      <main className="grid flex-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="overflow-auto">
          <div className="min-w-[860px]">
            <div className="grid h-8 grid-cols-[2rem_minmax(18rem,1fr)_12rem_10rem_11rem_8rem] items-center border-b border-zinc-200 pr-8 text-xs font-medium text-zinc-500">
              <div className="flex justify-center"><input type="checkbox" className="size-3 accent-zinc-950" aria-label="Select all records" /></div>
              <div>Source</div>
              <div>Counterparty</div>
              <div>Amount</div>
              <div>Category</div>
              <div>Status</div>
            </div>
            {records.map((record) => (
              <div key={`${record.href}-${record.id}`} className="grid h-11 grid-cols-[2rem_minmax(18rem,1fr)_12rem_10rem_11rem_8rem] items-center border-b border-zinc-100 pr-8 text-sm hover:bg-zinc-50">
                <span className="flex justify-center"><input type="checkbox" className="size-3 accent-zinc-950" aria-label={`Select ${record.source}`} /></span>
                <Link href={record.href} className="truncate px-2 font-medium text-zinc-900 hover:underline">{record.source}</Link>
                <span className="truncate text-zinc-600">{record.counterparty}</span>
                <span className="truncate font-medium text-zinc-900">{record.amount}</span>
                <span className="truncate text-zinc-600">{record.category}</span>
                <span><StatusChip status={record.status} /></span>
              </div>
            ))}
          </div>
        </section>

        <aside className="overflow-auto border-l border-zinc-200 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
            <Table2 className="size-4" />
            {workflow.title}
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{workflow.prompt}</p>
          <div className="mt-5 space-y-2">
            {(workflow.columns ?? []).map((column) => (
              <details key={column.name} className="rounded-lg border border-zinc-200" open={column.name === workflow.columns?.[0]?.name}>
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-zinc-900">{column.name}</summary>
                <div className="border-t border-zinc-200 px-3 py-2 text-sm leading-6 text-zinc-600">{column.prompt}</div>
              </details>
            ))}
          </div>
          <Button className="mt-5 w-full" asChild>
            <Link href={`/na/assistant?q=${encodeURIComponent(`Explain ${workflow.title}`)}`}>
              <MessageSquare className="size-4" />
              Ask assistant
            </Link>
          </Button>
        </aside>
      </main>
    </div>
  );
}
