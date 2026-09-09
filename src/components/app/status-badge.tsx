import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type ProjectStatus } from "@/lib/domain/enums";

const TONES: Record<ProjectStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  draft: "neutral",
  concept_generating: "violet",
  media_generating: "magenta",
  rendering: "electric",
  ready: "mint",
  failed: "danger",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
