import type { ReactNode } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Icon } from "./icon";

export function Accordion({
  title,
  children,
  className = "",
  triggerClassName = "",
  triggerTitle,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  triggerTitle?: string;
  defaultOpen?: boolean;
}) {
  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      defaultValue={defaultOpen ? "section" : undefined}
      asChild
    >
      <AccordionPrimitive.Item
        value="section"
        className={`ui-accordion ${className}`}
      >
        <AccordionPrimitive.Header className="accordion-heading">
          <AccordionPrimitive.Trigger
            className={`accordion-trigger ${triggerClassName}`}
            title={triggerTitle}
          >
            <span className="accordion-label">{title}</span>
            <span className="accordion-chevron" aria-hidden="true">
              <Icon name="down" size={15} />
            </span>
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        {/* Keep local form and editor state when the section is collapsed. */}
        <AccordionPrimitive.Content className="accordion-content" forceMount>
          {children}
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
}
