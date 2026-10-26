import type { ComponentProps } from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({ className, value, max = 100, ...props }: ComponentProps<typeof ProgressPrimitive.Root>) {
  const percent = value == null ? undefined : Math.max(0, Math.min(100, value / max * 100));
  return (
    <ProgressPrimitive.Root data-slot="progress" className={cn("ui-progress", className)} value={value} max={max} {...props}>
      <ProgressPrimitive.Indicator className="ui-progress-indicator" style={{ width: percent === undefined ? "100%" : `${percent}%` }} />
    </ProgressPrimitive.Root>
  );
}
