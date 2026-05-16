import { Bot, KeyRound, ShieldCheck, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Input, Select } from "@ledgerai/ui";
import { aiModelOptions } from "@/lib/demo";
import { getSettingsData } from "@/lib/server/workspace";

export default async function NorthAmericaSettingsPage() {
  const { members, auditEvents, ai } = await getSettingsData();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Workspace access, AI model access, audit visibility, and regional configuration.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-4 text-moss" />
              Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                <div className="font-medium">{member.invitedEmail ?? member.userId ?? "workspace user"}</div>
                <div className="mt-1 text-xs text-zinc-500">{member.role.toLowerCase()} · {member.status.toLowerCase()}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-moss" />
              AI models
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select defaultValue={ai.provider} disabled>
              <option value="openai">OpenAI</option>
              <option value="mock">Mock</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </Select>
            <Select defaultValue={ai.defaultModel} disabled>
              {[ai.defaultModel, ...aiModelOptions.filter((model) => model !== ai.defaultModel)].map((model) => (
                <option key={model}>{model}</option>
              ))}
            </Select>
            <Input value={ai.allowedModels} readOnly />
            <div className="text-xs text-zinc-500">
              {ai.allowsAllModels ? "All OpenAI model IDs are allowed." : "Model IDs are restricted."}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-moss" />
              Region
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {["New York", "New Jersey", "Connecticut", "San Francisco"].map((item) => (
              <div key={item} className="rounded-lg border border-zinc-200 p-3">{item}</div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-moss" />
            Recent audit events
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {auditEvents.map((event) => (
            <div key={event.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
              <div className="font-medium">{event.action}</div>
              <div className="mt-1 text-xs text-zinc-500">{event.entityType} · {event.createdAt.toLocaleString("en-US")}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
