import { useState, type ComponentProps } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { portalContainer } from "./portal-container";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn("select-trigger", className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <Icon name="down" size={15} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  container,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content> & {
  container?: HTMLElement | null;
}) {
  return (
    <SelectPrimitive.Portal container={container ?? portalContainer()}>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn("select-menu", className)}
        position="popper"
        sideOffset={5}
        collisionPadding={10}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="select-scroll">
          <Icon name="up" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="select-scroll">
          <Icon name="down" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn("select-option", className)}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Icon name="check" size={15} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

// An anchor ref keeps the menu in the right themed workspace or modal portal.
export function SelectField({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  const empty = "__canvas_empty__";
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  return (
    <Select
      value={value || empty}
      onValueChange={(value) => onChange(value === empty ? "" : value)}
      disabled={disabled}
    >
      <SelectTrigger ref={setTrigger} aria-label={label}>
        <SelectValue placeholder="Choose" />
      </SelectTrigger>
      <SelectContent
        container={portalContainer(trigger)}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value || empty}
            textValue={option.label}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
