import { AppShell } from "@/components/app-shell";
import { getShellData } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export default async function NorthAmericaLayout({ children }: { children: React.ReactNode }) {
  const { suggestions } = await getShellData();

  return (
    <AppShell
      variant="north-america"
      workspace={{
        name: "Maple & Main Studio",
        gstin: "US EIN 12-3456789 · NY/NJ/CT/SF",
        financialYear: "TY 2026"
      }}
      suggestions={suggestions.map((suggestion) => ({
        id: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
        source: "NA compliance workspace",
        action: suggestion.status === "PENDING" ? "Review suggestion" : "View"
      }))}
    >
      {children}
    </AppShell>
  );
}
