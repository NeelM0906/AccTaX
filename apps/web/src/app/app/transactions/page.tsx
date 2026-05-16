import Link from "next/link";
import { Download } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { formatInr } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { getTransactionsData } from "@/lib/server/workspace";

export default async function TransactionsPage() {
  const { transactions } = await getTransactionsData();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Accounting entries linked to source documents, invoices, bills, and bank transactions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/api/exports/transactions.csv">
              <Download className="size-4" />
              CSV export
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Ledger activity</CardTitle>
          <Input className="max-w-72" placeholder="Search by party, category, GST status" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{transaction.transactionDate.toLocaleDateString("en-IN")}</TableCell>
                  <TableCell className="font-medium text-zinc-950">{transaction.kind.toLowerCase()}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>{transaction.category ?? "uncategorized"}</TableCell>
                  <TableCell>{transaction.gstTreatment ?? "none"}</TableCell>
                  <TableCell>
                    <StatusChip status={transaction.status.toLowerCase()} />
                  </TableCell>
                  <TableCell className={Number(transaction.amount) < 0 ? "text-right text-red-700" : "text-right text-zinc-950"}>
                    {formatInr(Number(transaction.amount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
