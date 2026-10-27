import { useState, type ComponentProps } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { portalContainer } from "./portal-container";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent({
  className,
  children,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  return (
    <DialogPrimitive.Portal container={portalContainer()}>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn("ui-dialog-content", className)}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented && opener?.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
