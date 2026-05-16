import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { StatusChip } from "@/components/status-chip";
import { getReportsData } from "@/lib/server/workspace";

const reports = [
  { title: "GSTR-1/GSTR-3B JSON", href: "/api/exports/gst.json", detail: "Draft GST working file with trace metadata." },
  { title: "GST invoice CSV", href: "/api/exports/gst.csv", detail: "Invoice-level outward supply register." },
  { title: "Transactions CSV", href: "/api/exports/transactions.csv", detail: "Posted accounting transactions." },
  { title: "Invoice pack CSV", href: "/api/exports/invoice-pack.csv", detail: "Invoice register with printable links." },
  { title: "ITR-4 planning pack", href: "/api/exports/tax-planning.json", detail: "Draft freelancer tax planning JSON." }
];

export default async function ReportsPage() {
  const { counts, exportJobs } = await getReportsData();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Export packs are generated from approved records and include source trace metadata.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Invoices", counts.invoices],
          ["Transactions", counts.transactions],
          ["Uploaded documents", counts.documents]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-sm text-zinc-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.title}>
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
                  <TableCell>{job.createdAt.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
