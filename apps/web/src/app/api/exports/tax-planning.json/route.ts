import { buildTaxPlanningJsonExport } from "@/lib/server/workspace";

export async function GET() {
  const body = await buildTaxPlanningJsonExport();
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=ledgerai-tax-planning.json"
    }
  });
}
