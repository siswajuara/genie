import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

const calendarComponents = {
  Chevron: ({ orientation }: { orientation?: string }) => (
    <Icon
      name={
        orientation === "left"
          ? "left"
          : orientation === "right"
            ? "right"
            : orientation === "up"
              ? "up"
              : "down"
      }
    />
  ),
};

export function Calendar({ className, components, ...props }: ComponentProps<typeof DayPicker>) {
  return <DayPicker data-slot="calendar" className={cn("ui-calendar", className)} components={{ ...calendarComponents, ...components }} {...props} />;
}
