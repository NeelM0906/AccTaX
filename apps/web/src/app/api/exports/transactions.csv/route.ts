import { buildTransactionsCsvExport } from "@/lib/server/workspace";

export async function GET() {
  const body = await buildTransactionsCsvExport();
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=ledgerai-transactions.csv"
    }
  });
}
