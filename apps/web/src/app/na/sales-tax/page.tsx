import Link from "next/link";
import { Download, MapPinned, ShieldCheck } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { formatCurrency } from "@ledgerai/config";
import { StatusChip } from "@/components/status-chip";
import { getNorthAmericaSalesTaxData } from "@/lib/server/workspace";

export default async function NorthAmericaSalesTaxPage() {
  const data = await getNorthAmericaSalesTaxData();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-500">Launch region · NY / NJ / CT / SF</div>
          <h1 className="mt-1 text-2xl font-semibold">NY / NJ / CT / SF sales-tax cockpit</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600">
            Jurisdiction-level rates, direct-vs-marketplace treatment, and economic nexus monitoring
            for the first-client footprint. Filing and collection changes stay approval-gated.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/api/exports/na-sales-tax.json">
            <Download className="size-4" />
            Export nexus report
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Economic nexus monitor</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead>Logic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.nexusChecks.map((check) => (
                  <TableRow key={check.state}>
                    <TableCell className="font-medium text-zinc-950">{check.state}</TableCell>
                    <TableCell className="text-right">{formatCurrency(check.grossRevenue, "USD")}</TableCell>
                    <TableCell className="text-right">{check.transactionCount}</TableCell>
                    <TableCell>{check.threshold.logic}</TableCell>
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
            <CardTitle>Coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["New York metro", "New Jersey", "Connecticut", "San Francisco"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm">
                <MapPinned className="size-4 text-moss" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supported launch rates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Reporting code</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.supportedJurisdictions.map((jurisdiction) => (
                <TableRow key={jurisdiction.code}>
                  <TableCell className="font-medium text-zinc-950">{jurisdiction.label}</TableCell>
                  <TableCell>{jurisdiction.state}</TableCell>
                  <TableCell className="text-right">{jurisdiction.rate.toFixed(3).replace(/0$/, "")}%</TableCell>
                  <TableCell>{jurisdiction.reportingCode ?? "statewide"}</TableCell>
                  <TableCell>{jurisdiction.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sample regional calculations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.sampleSalesTax.map((line) => (
              <div key={line.destinationJurisdiction} className="rounded-lg border border-zinc-200 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span>{line.jurisdictionLabel}</span>
                  <strong>{formatCurrency(line.salesTax, "USD")}</strong>
                </div>
                <div className="mt-1 text-zinc-500">
                  {line.rate}% on {formatCurrency(line.taxableAmount, "USD")} · {line.note}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connecticut special-rate checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.ctSpecialRates.map((line) => (
              <div key={line.taxabilityCode} className="rounded-lg border border-zinc-200 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span>{line.taxabilityCode.replaceAll("_", " ")}</span>
                  <strong>{formatCurrency(line.salesTax, "USD")}</strong>
                </div>
                <div className="mt-1 text-zinc-500">
                  {line.rate}% on {formatCurrency(line.taxableAmount, "USD")} · {line.note}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Validation model</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            "New York uses jurisdiction/reporting codes; ZIP-only matching is not treated as filing evidence.",
            "NJ, CT, and SF rates are deterministic launch rules, with exemptions and marketplace sales tagged separately.",
            "A provider or official lookup response should still be snapshotted before live collection at checkout."
          ].map((item) => (
            <div key={item} className="flex gap-3 rounded-lg border border-zinc-200 p-3">
              <ShieldCheck className="mt-0.5 size-4 text-moss" />
              <div className="text-sm text-zinc-700">{item}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
