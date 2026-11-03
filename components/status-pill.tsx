import { cn } from "cn";
import type { AttentionBucket } from "@/lib/attention";
import type { DateStatus } from "@/lib/dates";

export function StatusPill({
  bucket,
  status,
  children,
  className,
}: {
  bucket?: AttentionBucket;
  status?: DateStatus;
  children: React.ReactNode;
  className?: string;
}) {
  const tone =
    status === "unparsed" || status === "suspicious" || bucket === "review"
      ? "review"
      : bucket === "expired"
        ? "expired"
        : bucket === "d30"
          ? "soon"
          : bucket === "d60" || bucket === "d90"
            ? "watch"
            : bucket === "missing"
              ? "missing"
              : bucket === "ok"
                ? "ok"
                : "na";
  return <span className={cn("status-pill", `status-${tone}`, className)}>{children}</span>;
}
