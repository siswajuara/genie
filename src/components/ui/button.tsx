import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The default size follows Genie's compact controls. Feature classes can refine it.
const buttonVariants = cva("ui-button", {
  variants: {
    variant: {
      default: "",
      primary: "primary",
      destructive: "danger",
      ghost: "border-transparent bg-transparent",
      link: "border-0 bg-transparent p-0 text-primary underline-offset-4 hover:underline",
    },
    size: {
      default: "",
      sm: "px-2 py-1 text-xs",
      icon: "inline-flex size-8 items-center justify-center p-0",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
