import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { StatusChip } from "@/components/status-chip";
import { saveIntegrationAccount } from "../actions";
import { getSettingsData } from "@/lib/server/workspace";

const aiModelOptions = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o", "o4-mini", "o3"];

export default async function SettingsPage() {
  const { members, integrations, auditEvents, ai } = await getSettingsData();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Workspace controls for RBAC, audit retention, integrations, and AI review boundaries.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-moss" /> Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm">
                <span>{member.invitedEmail ?? member.userId ?? "Workspace owner"}</span>
                <StatusChip status={member.role.toLowerCase()} />
              </div>
            ))}
            <p className="text-sm text-zinc-500">Permissions are enforced per workspace and all writes are audit logged.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LockKeyhole className="size-4 text-moss" /> Audit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600">
            <div>Create/update/delete, AI suggestions, approvals, exports, locks, and credentials are logged.</div>
            <div className="rounded-lg border border-zinc-200 p-3">Recent audit events: {auditEvents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-moss" /> Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action={saveIntegrationAccount} className="space-y-3">
              <Select name="provider" defaultValue="gsp_sandbox">
                <option value="gsp_sandbox">GSP sandbox</option>
                <option value="gmail">Gmail ingestion</option>
                <option value="google_drive">Google Drive</option>
                <option value="razorpay">Razorpay payment links</option>
                <option value="tally">Tally import/export</option>
              </Select>
              <Input name="label" placeholder="Credential label" required />
              <Button type="submit" variant="secondary" className="w-full">Save integration label</Button>
            </form>
            <p className="text-sm text-zinc-500">External API submission always requires explicit approval.</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>AI model access</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm font-medium">
            Provider
            <Select defaultValue={ai.provider} disabled>
              <option value="openai">OpenAI</option>
              <option value="mock">Mock</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Preferred model
            <Select defaultValue={ai.defaultModel} disabled>
              {[ai.defaultModel, ...aiModelOptions.filter((model) => model !== ai.defaultModel)].map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Allowed models
            <Input value={ai.allowedModels} readOnly />
          </label>
          <p className="md:col-span-3 text-sm text-zinc-500">
            {ai.allowsAllModels ? "Local configuration allows all OpenAI model IDs." : "Local configuration restricts model IDs."} Compliance-critical actions still require review.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Integration accounts</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((integration) => (
                <TableRow key={integration.id}>
                  <TableCell>{integration.provider}</TableCell>
                  <TableCell>{integration.label}</TableCell>
                  <TableCell><StatusChip status={integration.status.toLowerCase()} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
