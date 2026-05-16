import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { formatCurrency } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { getNorthAmericaSalesTaxData, getNorthAmericaTaxData, getReportsData } from "@/lib/server/workspace";

const reports = [
  { title: "CPA tax planning JSON", href: "/api/exports/na-tax-planning.json", detail: "Schedule C, SE tax, 1040-ES, and 1099 planning evidence." },
  { title: "Sales-tax nexus JSON", href: "/api/exports/na-sales-tax.json", detail: "NY, NJ, CT, and SF nexus and rate evidence." },
  { title: "Transactions CSV", href: "/api/exports/transactions.csv", detail: "Reviewed income and expense transactions." },
  { title: "Invoice pack CSV", href: "/api/exports/invoice-pack.csv", detail: "Invoice register with printable links." }
];

export default async function NorthAmericaReportsPage() {
  const [{ counts, exportJobs }, tax, salesTax] = await Promise.all([
    getReportsData(),
    getNorthAmericaTaxData(),
    getNorthAmericaSalesTaxData()
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-zinc-600">
          CPA-ready exports generated from reviewed records with source trace metadata.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Documents" value={String(counts.documents)} />
        <Metric label="Transactions" value={String(counts.transactions)} />
        <Metric label="Net profit" value={formatCurrency(tax.taxPlan.netProfit, "USD")} />
        <Metric label="Federal estimate" value={formatCurrency(tax.taxPlan.remainingEstimatedTax, "USD")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reports.map((report) => (
          <Card key={report.title} id={report.title.toLowerCase().includes("sales") ? "sales-tax" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-moss" />
                {report.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-600">{report.detail}</p>
              <Button variant="secondary" className="w-full" asChild>
                <Link href={report.href}>
                  <Download className="size-4" />
                  Generate
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales-tax review</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesTax.nexusChecks.map((check) => (
                <TableRow key={check.state}>
                  <TableCell className="font-medium text-zinc-950">{check.state}</TableCell>
                  <TableCell className="text-right">{formatCurrency(check.grossRevenue, "USD")}</TableCell>
                  <TableCell><StatusChip status={check.status.replaceAll("_", " ")} /></TableCell>
                  <TableCell>{check.reasons.join(" ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exportJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium text-zinc-950">{job.kind}</TableCell>
                  <TableCell><StatusChip status={job.status.toLowerCase()} /></TableCell>
                  <TableCell>{job.createdAt.toLocaleString("en-US")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-zinc-500">{label}</div>
        <div className="mt-2 break-words text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
