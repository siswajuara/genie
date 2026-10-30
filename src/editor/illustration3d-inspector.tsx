import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { SelectField } from "@/components/ui/select";
import {
  drawIllustration3D,
  illustration3DModels,
  normalizeIllustration3D,
  type Illustration3DSpec,
} from "./illustration3d.mjs";
import type { Element } from "./model";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function Illustration3DFields({
  element,
  onChange,
}: {
  element: Element;
  onChange: (spec: Illustration3DSpec) => void;
}) {
  const spec = normalizeIllustration3D(element.illustration3d);
  const model = illustration3DModels[spec.scene];
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; yaw: number; pitch: number } | undefined>(undefined);
  const [view, setView] = useState<{ yaw: number; pitch: number }>();
  const draft = view ? { ...spec, ...view } : spec;
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 900, 620);
    drawIllustration3D(ctx, { ...element, x: 0, y: 0, w: 900, h: 620, illustration3d: draft });
  }, [element, draft]);
  function change(patch: Partial<Illustration3DSpec>) {
    onChange(normalizeIllustration3D({ ...spec, ...patch }));
  }
  return (
    <fieldset className="science-fields">
      <canvas
        ref={canvas}
        width={900}
        height={620}
        className="illustration3d-view"
        tabIndex={0}
        role="img"
        aria-label={`Rotate ${model.label} 3D view`}
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current) return;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: spec.yaw, pitch: spec.pitch };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          setView({
            yaw: clamp(start.yaw + (event.clientX - start.x) * 0.6, -180, 180),
            pitch: clamp(start.pitch + (event.clientY - start.y) * 0.6, 20, 83),
          });
        }}
        onPointerUp={(event) => {
          if (drag.current?.id !== event.pointerId) return;
          if (view) change(view);
          drag.current = undefined;
          setView(undefined);
        }}
        onPointerCancel={() => { drag.current = undefined; setView(undefined); }}
        onKeyDown={(event) => {
          const directions: Record<string, [number, number]> = {
            ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5],
          };
          const direction = directions[event.key];
          if (direction) {
            event.preventDefault(); event.stopPropagation();
            change({ yaw: clamp(spec.yaw + direction[0], -180, 180), pitch: clamp(spec.pitch + direction[1], 20, 83) });
          }
        }}
      />
      {model.parameters.map(({ k, label, min, max, step, unit }) => {
        const name = unit ? `${label} (${unit})` : label;
        if (spec.scene === "molekul" && k === "k") return (
          <SelectField key={k} label="Molecule" value={String(spec.parameters.k)}
            options={[{ value: "1", label: "H₂O · Air" }, { value: "2", label: "CO₂ · Karbon dioksida" }, { value: "3", label: "CH₄ · Metana" }]}
            onChange={(value) => change({ parameters: { ...spec.parameters, k: Number(value) } })} />
        );
        return (
          <div className="property" key={k}>
            <span>{name}</span>
            <NumberField label={name} value={spec.parameters[k]} min={min} max={max} step={step}
              onChange={(value) => change({ parameters: { ...spec.parameters, [k]: ["Z", "k"].includes(k) ? Math.round(value) : value } })} />
          </div>
        );
      })}
      {spec.scene === "piston" && (
        <div className="property">
          <span>Gas height (cm)</span>
          <NumberField label="Gas height (cm)" value={spec.gasHeight} min={1.5} max={7} step={0.1}
            onChange={(gasHeight) => change({ gasHeight, progress: (gasHeight - 1.5) / 5.5 })} />
        </div>
      )}
      {model.progressLabel && (
        <div className="property">
          <span>{model.progressLabel} (%)</span>
          <NumberField label={`${model.progressLabel} (%)`} value={spec.progress * 100} min={0} max={100} step={1}
            onChange={(progress) => change({ progress: progress / 100 })} />
        </div>
      )}
      <div className="property">
        <span>Rotation (°)</span>
        <NumberField label="3D rotation (degrees)" value={spec.yaw} min={-180} max={180} step={5} onChange={(yaw) => change({ yaw })} />
      </div>
      <div className="property">
        <span>Tilt (°)</span>
        <NumberField label="3D tilt (degrees)" value={spec.pitch} min={20} max={83} step={5} onChange={(pitch) => change({ pitch })} />
      </div>
      <div className="property">
        <span>Zoom (%)</span>
        <NumberField label="3D zoom (%)" value={spec.zoom * 100} min={50} max={300} step={10} onChange={(zoom) => change({ zoom: zoom / 100 })} />
      </div>
      <Button type="button" onClick={() => change({ yaw: -30, pitch: 30, zoom: 1 })}>Reset 3D view</Button>
      {([
        ...(model.animated ? [["animate", "Animate illustration"]] : []),
        ["showTitle", "Show title"],
        ["showDimensions", "Show dimensions"],
        ["showResults", "Show results"],
        ["showFormula", "Show formula"],
      ] as ["animate" | "showTitle" | "showDimensions" | "showResults" | "showFormula", string][]).map(([key, label]) => (
        <Label className="science-checkbox" key={key}>
          <Checkbox checked={spec[key]} onCheckedChange={(checked) => change({ [key]: checked === true })} />
          {label}
        </Label>
      ))}
    </fieldset>
  );
}
