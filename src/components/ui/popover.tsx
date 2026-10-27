import { useState, type ComponentProps, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { portalContainer } from "./portal-container";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  align = "center",
  sideOffset = 6,
  container,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content> & {
  container?: HTMLElement | null;
}) {
  return (
    <PopoverPrimitive.Portal container={container ?? portalContainer()}>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        className={cn("picker-popover", className)}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export function PickerPopover({
  trigger,
  children,
  label,
  open,
  onOpenChange,
  side = "bottom",
  align = "center",
}: {
  trigger: ReactNode;
  children: ReactNode;
  label: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger ref={setAnchor} asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        container={portalContainer(anchor)}
        aria-label={label}
        side={side}
        align={align}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
