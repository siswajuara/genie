import type { ComponentProps } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({ className, value, defaultValue, min = 0, max = 100, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  const values = value ?? defaultValue ?? [min];
  return (
    <SliderPrimitive.Root data-slot="slider" className={cn("ui-slider", className)} value={value} defaultValue={defaultValue} min={min} max={max} {...props}>
      <SliderPrimitive.Track className="ui-slider-track">
        <SliderPrimitive.Range className="ui-slider-range" />
      </SliderPrimitive.Track>
      {values.map((_, index) => <SliderPrimitive.Thumb key={index} className="ui-slider-thumb" aria-label={props["aria-label"]} />)}
    </SliderPrimitive.Root>
  );
}
