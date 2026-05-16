import { buildGstCsvExport } from "@/lib/server/workspace";

export async function GET() {
  const body = await buildGstCsvExport();
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=ledgerai-gst-invoices.csv"
    }
  });
}
