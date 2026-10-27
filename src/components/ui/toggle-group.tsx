import type { ComponentProps } from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

export function ToggleGroup({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("marketing-segments", className)}
      {...props}
    />
  );
}
export function ToggleGroupItem({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn("ui-button", className)}
      {...props}
    />
  );
}
export function Segments<T extends string>({
  values,
  value,
  onChange,
  label,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
    >
      {values.map((item) => (
        <ToggleGroupItem key={item} value={item}>
          {item}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
