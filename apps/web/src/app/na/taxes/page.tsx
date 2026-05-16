import Link from "next/link";
import { Download, FileText, Info } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { formatCurrency } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { getNorthAmericaTaxData } from "@/lib/server/workspace";

export default async function NorthAmericaTaxesPage() {
  const data = await getNorthAmericaTaxData();
  const plan = data.taxPlan;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">NY / NJ / CT / SF tax cockpit</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Planning-only Schedule C, self-employment tax, 1040-ES set-aside, 1099-K threshold, and
            launch-region sales-tax support.
          </p>
        </div>
        <Button asChild>
          <Link href="/api/exports/na-tax-planning.json">
            <Download className="size-4" />
            Export CPA pack
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>Net profit</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{formatCurrency(plan.netProfit, "USD")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>SE tax</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{formatCurrency(plan.selfEmploymentTax.selfEmploymentTax, "USD")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Federal estimate</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{formatCurrency(plan.remainingEstimatedTax, "USD")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>1099-K</CardTitle></CardHeader>
          <CardContent>
            <StatusChip status={data.form1099K.meetsThreshold ? "Review" : "Monitor"} />
            <p className="mt-3 text-sm text-zinc-600">{data.form1099K.note}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>1040-ES draft installments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due date</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.installments.map((installment) => (
                  <TableRow key={installment.dueDate}>
                    <TableCell>{installment.dueDate}</TableCell>
                    <TableCell>{installment.label}</TableCell>
                    <TableCell className="text-right">{formatCurrency(installment.amount, "USD")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CPA document pack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Schedule C income and expense CSV",
              "1099-K / 1099-NEC tracker",
              "Mileage deduction support",
              "NY/NJ/CT/SF sales-tax nexus report",
              "Jurisdiction-rate evidence memo"
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3">
                <FileText className="size-4 text-moss" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
            <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
              <Info className="mt-0.5 size-4 shrink-0" />
              Outputs are draft planning artifacts until reviewed by a CPA, EA, bookkeeper, or the taxpayer.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supporting calculations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 p-3 text-sm">
            <div className="font-medium">Business mileage</div>
            <div className="mt-2 text-xl font-semibold">{formatCurrency(data.mileageDeduction, "USD")}</div>
            <div className="mt-1 text-zinc-500">3,420 miles at the configured 2026 IRS rate.</div>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 text-sm">
            <div className="font-medium">Taxable income</div>
            <div className="mt-2 text-xl font-semibold">{formatCurrency(plan.federalIncomeTax.taxableIncome, "USD")}</div>
            <div className="mt-1 text-zinc-500">After half-SE-tax deduction and standard deduction.</div>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 text-sm">
            <div className="font-medium">Rule version</div>
            <div className="mt-2 text-sm font-semibold">{plan.ruleVersion}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
