import { AppShell } from "@/components/app-shell";
import { getShellData } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { ctx, suggestions } = await getShellData();

  return (
    <AppShell
      workspace={{
        name: ctx.workspaceName,
        gstin: ctx.gstin,
        financialYear: ctx.financialYear
      }}
      suggestions={suggestions.map((suggestion) => ({
        id: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
        source: "Internal records and review queue",
        action: suggestion.status === "PENDING" ? "Review suggestion" : "View"
      }))}
    >
      {children}
    </AppShell>
  );
}
