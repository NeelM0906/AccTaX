import Link from "next/link";
import { Download, FileText, Info } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { formatInr } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { getTaxData } from "@/lib/server/workspace";

export default async function TaxesPage() {
  const taxPlanner = await getTaxData();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Freelancer tax cockpit</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Planning-only income-tax workspace for 44AD/44ADA eligibility, regime comparison,
            advance-tax reminders, and CA export packs.
          </p>
        </div>
        <Button asChild>
          <Link href="/api/exports/tax-planning.json">
            <Download className="size-4" />
            Export CA pack
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Income</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{formatInr(taxPlanner.income)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Reviewed expenses</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{formatInr(taxPlanner.expenses)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Presumptive status</CardTitle></CardHeader>
          <CardContent>
            <StatusChip status={taxPlanner.eligibility.eligible ? "Eligible" : "Needs review"} />
            <p className="mt-3 text-sm text-zinc-600">
              44ADA deemed income: {formatInr(taxPlanner.presumptive.deemedIncome)}.
              {taxPlanner.eligibility.reasons.join(" ")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Old/new regime comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regime</TableHead>
                  <TableHead>Planning tax</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-zinc-950">New regime</TableCell>
                  <TableCell>{formatInr(taxPlanner.comparison.newRegime.totalTax)}</TableCell>
                  <TableCell>Default for business/profession taxpayers unless opted out.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-zinc-950">Old regime</TableCell>
                  <TableCell>{formatInr(taxPlanner.comparison.oldRegime.totalTax)}</TableCell>
                  <TableCell>Uses starter deduction inputs for planning. Recommended: {taxPlanner.comparison.recommendedRegime}.</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Document pack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["Income summary", "Expense category CSV", "GST return draft links", "44ADA eligibility note", "Form 10-IEA warning"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3">
                <FileText className="size-4 text-moss" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
            <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
              <Info className="mt-0.5 size-4 shrink-0" />
              Outputs are labeled draft/planning until reviewed by the taxpayer or CA.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
