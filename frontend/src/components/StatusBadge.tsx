import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "active" | "frozen" | "closed" | "completed" | "pending" | "failed" | "UP" | "DOWN" | "READY" | "NOT_READY";

const styles: Record<Status, string> = {
  active: "bg-success/10 text-success border-success/20",
  completed: "bg-success/10 text-success border-success/20",
  UP: "bg-success/10 text-success border-success/20",
  READY: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  frozen: "bg-warning/10 text-warning border-warning/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  DOWN: "bg-destructive/10 text-destructive border-destructive/20",
  NOT_READY: "bg-destructive/10 text-destructive border-destructive/20",
  closed: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: Status | string }) {
  const cls = styles[status as Status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", cls)}>
      {status}
    </Badge>
  );
}
