import type { ComponentProps } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export function ScrollArea({
  className,
  children,
  orientation = "vertical",
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn("ui-scroll-area", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="ui-scroll-viewport" tabIndex={0}>
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        className="ui-scroll-bar"
        orientation={orientation}
      >
        <ScrollAreaPrimitive.Thumb className="ui-scroll-thumb" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
