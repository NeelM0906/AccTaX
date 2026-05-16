import { Card, CardContent, CardHeader, CardTitle } from "@ledgerai/ui";
import { StatusChip } from "./status-chip";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  status: string;
};

export function MetricCard({ label, value, detail, status }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-xs font-medium uppercase tracking-normal text-zinc-500">
            {label}
          </CardTitle>
          <StatusChip status={status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-zinc-950">{value}</div>
        <p className="mt-2 text-sm text-zinc-500">{detail}</p>
      </CardContent>
    </Card>
  );
}
