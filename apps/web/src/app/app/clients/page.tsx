import { Link as LinkIcon, UserPlus } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ledgerai/ui";
import { StatusChip } from "@/components/status-chip";
import { createDocumentRequest, inviteWorkspaceMember } from "../actions";
import { getClientsData } from "@/lib/server/workspace";

export default async function ClientsPage() {
  const { parties, invitedMembers, reviewTasks } = await getClientsData();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clients and collaborators</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Invite accountants and client contacts, request documents, and collect uploads without
            exposing the full workspace.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-moss" />
              Invite collaborator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={inviteWorkspaceMember} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
              <Input name="invitedEmail" type="email" placeholder="accountant@example.com" required />
              <Select name="role" defaultValue="ACCOUNTANT">
                <option value="ACCOUNTANT">Accountant</option>
                <option value="REVIEWER">Reviewer</option>
                <option value="STAFF">Staff</option>
                <option value="CLIENT_READONLY">Read-only client/CA</option>
              </Select>
              <Button type="submit">Invite</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="size-4 text-moss" />
              Document request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createDocumentRequest} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
              <Input name="title" placeholder="Request April purchase bills" required />
              <Input name="contact" placeholder="client@example.com" />
              <Button type="submit">Create</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Client and supplier register</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Party</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((party) => (
                <TableRow key={party.id}>
                  <TableCell className="font-medium text-zinc-950">{party.displayName}</TableCell>
                  <TableCell>{party.type.toLowerCase()}</TableCell>
                  <TableCell>{party.email ?? party.phone ?? "Not set"}</TableCell>
                  <TableCell><StatusChip status="current" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Invitations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {invitedMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm">
                <div>
                  <div className="font-medium text-zinc-950">{member.invitedEmail}</div>
                  <div className="text-xs text-zinc-500">{member.role.toLowerCase()}</div>
                </div>
                <StatusChip status={member.status.toLowerCase()} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Document requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {reviewTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm">
                <div>
                  <div className="font-medium text-zinc-950">{task.title}</div>
                  <div className="text-xs text-zinc-500">{task.description ?? "No extra note"}</div>
                </div>
                <StatusChip status={task.status.toLowerCase()} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
