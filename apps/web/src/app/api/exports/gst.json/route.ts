import { buildGstJsonExport } from "@/lib/server/workspace";

export async function GET() {
  const body = await buildGstJsonExport();
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=ledgerai-gst-draft.json"
    }
  });
}
