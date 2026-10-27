import type { ComponentProps } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn("ui-checkbox", className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="inline-flex items-center justify-center">
        <Icon name="check" size={11} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
