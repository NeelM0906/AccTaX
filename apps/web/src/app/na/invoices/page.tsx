import Link from "next/link";
import { Mail } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { formatCurrency } from "@ledgerai/config";
import { queueInvoiceEmail } from "@/app/app/actions";
import { getInvoicesData } from "@/lib/server/workspace";

export default async function NorthAmericaInvoicesPage() {
  const { invoices } = await getInvoicesData();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Client invoice records used for receivables, income summaries, and CPA export packs.
          </p>
        </div>
        <Button asChild>
          <Link href="/na/assistant?q=Create%20an%20invoice">Draft in assistant</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input className="max-w-72" placeholder="Search invoice number or customer" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium text-zinc-950">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.invoiceDate.toLocaleDateString("en-US")}</TableCell>
                  <TableCell>{invoice.status.toLowerCase()}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(invoice.taxableValue), "USD")}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(invoice.cgst) + Number(invoice.sgst) + Number(invoice.igst), "USD")}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(invoice.total), "USD")}</TableCell>
                  <TableCell>
                    <form action={queueInvoiceEmail}>
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <input type="hidden" name="returnTo" value="/na/invoices" />
                      <Button type="submit" variant="ghost" size="sm">
                        <Mail className="size-4" />
                        Queue email
                      </Button>
                    </form>
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
