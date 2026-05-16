import Link from "next/link";
import { Download, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { formatInr } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { updateGstReturnStatus } from "../actions";
import { getGstData } from "@/lib/server/workspace";

export default async function GstPage() {
  const { invoices, gstr1, gstr3b, validations, returnPeriod } = await getGstData();
  const b2bTaxable = gstr1.b2b.flatMap((invoice) => invoice.lines).reduce((sum, line) => sum + line.taxableValue, 0);
  const b2cTaxable = gstr1.b2cs.reduce((sum, line) => sum + line.taxableValue, 0);
  const exportTaxable = gstr1.exports.flatMap((invoice) => invoice.lines).reduce((sum, line) => sum + line.taxableValue, 0);
  const outputTax = gstr3b.outwardTaxableSupplies.igst + gstr3b.outwardTaxableSupplies.cgst + gstr3b.outwardTaxableSupplies.sgst;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">GST cockpit</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Draft GSTR-1 and GSTR-3B from approved records, resolve validation cards, export files,
            and lock periods after external filing.
          </p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="April 2026" className="w-44">
            <option>April 2026</option>
            <option>Q1 FY 2026-27</option>
          </Select>
          <Button variant="secondary" asChild>
            <Link href="/api/exports/gst.json">
              <Download className="size-4" />
              Export JSON
            </Link>
          </Button>
          <form action={updateGstReturnStatus}>
            <Button name="action" value="mark_filed" type="submit">
              <LockKeyhole className="size-4" />
              Mark filed externally
            </Button>
          </form>
          <form action={updateGstReturnStatus}>
            <Button name="action" value="lock" type="submit" variant="secondary">
              Lock
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>GSTR-1 draft</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span>B2B taxable</span><strong>{formatInr(b2bTaxable)}</strong></div>
            <div className="flex justify-between"><span>B2C taxable</span><strong>{formatInr(b2cTaxable)}</strong></div>
            <div className="flex justify-between"><span>Export taxable</span><strong>{formatInr(exportTaxable)}</strong></div>
            <div className="flex justify-between border-t border-zinc-200 pt-3"><span>Output tax</span><strong>{formatInr(outputTax)}</strong></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>GSTR-3B summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Outward taxable</span><strong>{formatInr(gstr3b.outwardTaxableSupplies.taxableValue)}</strong></div>
            <div className="flex justify-between"><span>Outward tax</span><strong>{formatInr(outputTax)}</strong></div>
            <div className="flex justify-between"><span>Return status</span><strong>{returnPeriod.status.replaceAll("_", " ").toLowerCase()}</strong></div>
            <div className="flex justify-between border-t border-zinc-200 pt-3"><span>Draft rule version</span><strong>{gstr3b.ruleVersion}</strong></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>GSTR-1 candidate invoices</CardTitle>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium text-zinc-950">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.buyerGstin ?? "Unregistered"}</TableCell>
                    <TableCell>{invoice.invoiceDate.toLocaleDateString("en-IN")}</TableCell>
                    <TableCell><StatusChip status={invoice.status.toLowerCase()} /></TableCell>
                    <TableCell className="text-right">{formatInr(Number(invoice.taxableValue))}</TableCell>
                    <TableCell className="text-right">{formatInr(Number(invoice.cgst) + Number(invoice.sgst) + Number(invoice.igst))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validation cards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(validations.length ? validations : ["No GST validation warnings for current records"]).map((validation) => (
              <div key={validation} className="flex gap-3 rounded-lg border border-zinc-200 p-3">
                <ShieldCheck className="mt-0.5 size-4 text-moss" />
                <div className="text-sm text-zinc-700">{validation}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
