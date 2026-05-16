import Link from "next/link";
import { Download, FileUp, Search } from "lucide-react";
import { Button, Input } from "@ledgerai/ui";
import { formatInr } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { uploadDocument } from "../actions";
import { getDocumentsData, getInvoicesData, getTransactionsData } from "@/lib/server/workspace";

export default async function VaultPage() {
  const [{ documents }, { transactions }, { invoices }] = await Promise.all([
    getDocumentsData(),
    getTransactionsData(),
    getInvoicesData()
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between px-8 py-4">
        <h1 className="font-serif text-2xl font-medium text-zinc-950">Source Vault</h1>
        <div className="flex items-center gap-2">
          <label className="flex h-8 items-center gap-2 rounded-md px-2 text-zinc-500 hover:bg-zinc-100">
            <Search className="size-4" />
            <input placeholder="Search documents..." className="w-44 border-0 bg-transparent text-sm outline-none placeholder:text-zinc-400" />
          </label>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/api/exports/transactions.csv">
              <Download className="size-4" />
              Export
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex h-10 shrink-0 items-center gap-6 border-y border-zinc-200 px-8 text-sm font-medium">
        <span className="flex h-full items-center border-b border-zinc-950 text-zinc-950">Documents</span>
        <Link href="#transactions" className="text-zinc-500 hover:text-zinc-900">Transactions</Link>
        <Link href="/app/invoices" className="text-zinc-500 hover:text-zinc-900">Invoices</Link>
      </div>

      <main className="grid flex-1 gap-8 px-8 py-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0">
          <div className="grid h-8 grid-cols-[2rem_minmax(18rem,1fr)_10rem_10rem_10rem_2rem] items-center border-b border-zinc-200 text-xs font-medium text-zinc-500">
            <div className="flex justify-center"><input type="checkbox" className="size-3 accent-zinc-950" aria-label="Select all documents" /></div>
            <div>Name</div>
            <div>Type</div>
            <div>Status</div>
            <div>Extraction</div>
            <div />
          </div>
          {documents.map((document) => (
            <div key={document.id} className="grid h-11 grid-cols-[2rem_minmax(18rem,1fr)_10rem_10rem_10rem_2rem] items-center border-b border-zinc-100 text-sm hover:bg-zinc-50">
              <span className="flex justify-center"><input type="checkbox" className="size-3 accent-zinc-950" aria-label={`Select ${document.originalFilename}`} /></span>
              <Link href={`/app/vault/${document.id}`} className="truncate px-2 font-medium text-zinc-900 hover:underline">{document.originalFilename}</Link>
              <span className="truncate text-zinc-600">{document.type.replaceAll("_", " ").toLowerCase()}</span>
              <span><StatusChip status={document.status.replaceAll("_", " ").toLowerCase()} /></span>
              <span className="text-zinc-600">{document.extractionCount ? "Ready" : "Pending"}</span>
              <span className="text-zinc-400">...</span>
            </div>
          ))}

          <div id="transactions" className="mt-10">
            <h2 className="mb-3 font-serif text-xl font-medium text-zinc-950">Recent transactions</h2>
            <div className="grid h-8 grid-cols-[8rem_minmax(18rem,1fr)_12rem_10rem] items-center border-b border-zinc-200 text-xs font-medium text-zinc-500">
              <div>Date</div>
              <div>Description</div>
              <div>Category</div>
              <div className="text-right">Amount</div>
            </div>
            {transactions.slice(0, 10).map((transaction) => (
              <div key={transaction.id} className="grid h-10 grid-cols-[8rem_minmax(18rem,1fr)_12rem_10rem] items-center border-b border-zinc-100 text-sm">
                <span className="text-zinc-600">{transaction.transactionDate.toLocaleDateString("en-IN")}</span>
                <span className="truncate font-medium text-zinc-900">{transaction.description}</span>
                <span className="truncate text-zinc-600">{transaction.category ?? "uncategorized"}</span>
                <span className="text-right font-medium text-zinc-900">{formatInr(Number(transaction.amount))}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 p-4">
            <div className="text-sm font-semibold text-zinc-950">Upload</div>
            <p className="mt-1 text-sm text-zinc-500">Receipts, bills, invoices, bank statements, and GST portal exports.</p>
            <form action={uploadDocument} className="mt-4 space-y-3">
              <input type="hidden" name="returnTo" value="/app/vault" />
              <Input name="file" type="file" required />
              <Button type="submit" className="w-full">
                <FileUp className="size-4" />
                Upload and extract
              </Button>
            </form>
          </div>
          <div className="rounded-2xl border border-zinc-200 p-4 text-sm text-zinc-600">
            <div className="font-semibold text-zinc-950">Workspace totals</div>
            <div className="mt-3 flex justify-between"><span>Documents</span><span>{documents.length}</span></div>
            <div className="mt-2 flex justify-between"><span>Transactions</span><span>{transactions.length}</span></div>
            <div className="mt-2 flex justify-between"><span>Invoices</span><span>{invoices.length}</span></div>
          </div>
        </aside>
      </main>
    </div>
  );
}
