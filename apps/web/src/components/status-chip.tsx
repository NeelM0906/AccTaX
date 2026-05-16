import { Badge } from "@ledgerai/ui";

type StatusChipProps = {
  status: string;
};

export function StatusChip({ status }: StatusChipProps) {
  const normalized = status.toLowerCase();
  const variant =
    normalized.includes("ready") || normalized.includes("paid") || normalized.includes("approved")
      ? "success"
      : normalized.includes("review") || normalized.includes("draft")
        ? "warning"
        : normalized.includes("high") || normalized.includes("mismatch")
          ? "danger"
          : "default";

  return <Badge variant={variant}>{status}</Badge>;
}
