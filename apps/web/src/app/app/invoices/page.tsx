import Link from "next/link";
import { Mail, Plus, Printer } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { formatInr } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { queueInvoiceEmail } from "../actions";
import { getInvoicesData } from "@/lib/server/workspace";

export default async function InvoicesPage() {
  const { invoices } = await getInvoicesData();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">GST invoices</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Create GST invoices, bills of supply, export invoices, credit notes, and debit notes with
            deterministic tax calculation.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/invoices/new">
            <Plus className="size-4" />
            New invoice
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Invoice register</CardTitle>
          <Input className="max-w-72" placeholder="Search invoice number or customer" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium text-zinc-950">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.buyerGstin ?? "Unregistered / cash customer"}</TableCell>
                  <TableCell>{invoice.invoiceDate.toLocaleDateString("en-IN")}</TableCell>
                  <TableCell>
                    <StatusChip status={invoice.status.toLowerCase()} />
                  </TableCell>
                  <TableCell className="text-right">{formatInr(Number(invoice.taxableValue))}</TableCell>
                  <TableCell className="text-right">{formatInr(Number(invoice.cgst) + Number(invoice.sgst) + Number(invoice.igst))}</TableCell>
                  <TableCell className="text-right">{formatInr(Number(invoice.total))}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="Print invoice" asChild>
                        <Link href={`/app/invoices/${invoice.id}/print`} aria-label={`Print invoice ${invoice.invoiceNumber}`}>
                          <Printer className="size-4" />
                        </Link>
                      </Button>
                      <form action={queueInvoiceEmail}>
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <Button variant="ghost" size="icon" aria-label="Email invoice">
                          <Mail className="size-4" />
                        </Button>
                      </form>
                    </div>
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
