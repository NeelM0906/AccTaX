import { NextResponse } from "next/server";
import { getNorthAmericaTaxData } from "@/lib/server/workspace";

export async function GET() {
  const data = await getNorthAmericaTaxData();
  return NextResponse.json({
    label: "Draft CPA planning output; review before filing or payment.",
    region: "NY/NJ/CT/SF",
    generatedAt: new Date().toISOString(),
    taxPlan: data.taxPlan,
    mileageDeduction: data.mileageDeduction,
    form1099K: data.form1099K,
    sourceNotes: data.sourceNotes
  });
}
