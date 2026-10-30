import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberField } from "@/components/ui/number-field";
import { SelectField } from "@/components/ui/select";
import { ColorField } from "@/components/ui/color-field";
import type { Element } from "./model";
import type { Editor } from "./use-editor";
import {
  normalizePhysics,
  physicsModels,
  type PhysicsKind,
  type PhysicsSpec,
} from "../../sidecar/science.mjs";
import { prepareScienceElement } from "./science";
import { LearningFields } from "./learning-inspector";
import { learningSvg } from "./learning-drawing.mjs";
import { physicsSvg } from "./physics-drawing.mjs";
import { Illustration3DFields } from "./illustration3d-inspector";
import { illustration3DSvg, illustration3DModels } from "./illustration3d.mjs";

const labels: Record<string, string> = {
  gravity: "Gravity (m/s²)",
  length: "Length (m)",
  angle: "Angle (degrees)",
  damping: "Damping (s⁻¹)",
  mass: "Mass (kg)",
  springConstant: "Spring constant (N/m)",
  amplitude: "Amplitude (m)",
  velocity: "Launch speed (m/s)",
  radius: "Radius (m)",
  period: "Period (s)",
  distance: "Distance (m)",
  height: "Initial height (m)",
  loadMass: "Load mass (kg)",
  loadArm: "Load arm (m)",
  effortArm: "Effort arm (m)",
  supportingRopes: "Supporting rope segments",
  objectDensity: "Object density (kg/m³)",
  fluidDensity: "Fluid density (kg/m³)",
  volume: "Volume (m³)",
  wavelength: "Wavelength (m)",
  frequency: "Frequency (Hz)",
  voltage: "Voltage (V)",
  resistance: "Resistance (Ω)",
  initialVelocity: "Initial speed (m/s)",
  acceleration: "Acceleration (m/s²)",
  coefficient: "Kinetic friction coefficient",
  force: "Input force (N)",
  area1: "Input area (m²)",
  area2: "Output area (m²)",
  depth: "Depth (m)",
  index1: "Refractive index 1",
  index2: "Refractive index 2",
  resistance1: "Resistance 1 (Ω)",
  resistance2: "Resistance 2 (Ω)",
  soundSpeed: "Sound speed (m/s)",
  specificHeat: "Specific heat (J/(kg·K))",
  power: "Heating power (W)",
  initialTemperature: "Initial temperature (°C)",
  temperatureRise: "Temperature rise (K)",
  mass1: "Mass 1 (kg)",
  mass2: "Mass 2 (kg)",
  velocity1: "Initial velocity 1 (m/s)",
  velocity2: "Initial velocity 2 (m/s)",
  expansionCoefficient: "Expansion coefficient (×10⁻⁶ K⁻¹)",
};
export function PhysicsFields({
  value,
  onChange,
  disabled = false,
  allowModelChange = true,
}: {
  value: PhysicsSpec;
  onChange: (value: PhysicsSpec) => void;
  disabled?: boolean;
  allowModelChange?: boolean;
}) {
  const p = normalizePhysics(value),
    model = physicsModels[p.kind];
  const parameterLabel = (key: string) => {
    if (p.kind === "photosynthesis" && key === "period") return "Illustration cycle (s)";
    if (key === "force") {
      if (p.kind === "newton-first") return "Balanced force (N)";
      if (p.kind === "newton-second") return "Net force (N)";
      if (p.kind === "newton-third") return "Interaction force (N)";
    }
    return labels[key];
  };
  return (
    <fieldset disabled={disabled} className="science-fields">
      <Label>Physics model</Label>
      <SelectField
        label="Physics model"
        value={p.kind}
        disabled={disabled || !allowModelChange}
        options={Object.entries(physicsModels).map(([value, m]) => ({
          value,
          label: m.label,
        }))}
        onChange={(kind) =>
          onChange(normalizePhysics({ kind: kind as PhysicsKind }))
        }
      />
      {model.description && <p className="muted">{model.description}</p>}
      {Object.entries(model.ranges).map(([key, [min, max]]) => (
        <div className="property" key={key}>
          <span>{parameterLabel(key)}</span>
          <NumberField
            label={parameterLabel(key)}
            value={(p[key as keyof PhysicsSpec] as number) * (key === "expansionCoefficient" ? 1e6 : 1)}
            min={min * (key === "expansionCoefficient" ? 1e6 : 1)}
            max={max * (key === "expansionCoefficient" ? 1e6 : 1)}
            step={
              key === "expansionCoefficient"
                ? 1
                : key === "angle" || key === "supportingRopes"
                ? 1
                : ["volume", "area1", "area2"].includes(key)
                  ? 0.0001
                  : 0.1
            }
            onChange={(number) =>
              onChange(normalizePhysics({ ...p, [key]: key === "expansionCoefficient" ? number / 1e6 : number }))
            }
          />
        </div>
      ))}
      {[
        "pendulum",
        "spring",
        "projectile",
        "orbit",
        "linear-motion",
        "free-fall",
        "wave",
        "circuit",
        "accelerated-motion",
        "inclined-plane",
        "friction",
        "refraction",
        "longitudinal-wave",
        "series-circuit",
        "sound-travel",
        "heating",
        "energy-conservation",
        "parallel-circuit",
        "elastic-collision",
        "thermal-expansion",
        "newton-first",
        "newton-second",
        "newton-third",
        "photosynthesis",
      ].includes(p.kind) && (
        <Label className="science-checkbox">
          <Checkbox
            checked={p.loop}
            disabled={disabled}
            onCheckedChange={(loop) => onChange({ ...p, loop: loop === true })}
          />
          Continue motion
        </Label>
      )}
      {[
        "pendulum",
        "spring",
        "projectile",
        "orbit",
        "linear-motion",
        "free-fall",
      ].includes(p.kind) && (
        <Label className="science-checkbox">
          <Checkbox
            checked={p.trail}
            disabled={disabled}
            onCheckedChange={(trail) =>
              onChange({ ...p, trail: trail === true })
            }
          />
          Show path / reference
        </Label>
      )}
    </fieldset>
  );
}
const equations = [
  { label: "Fractions", source: "\\frac{1}{2}+\\frac{1}{4}=\\frac{3}{4}" },
  {
    label: "Linear equation",
    source: "\\begin{aligned}2x+3&=11\\\\2x&=8\\\\x&=4\\end{aligned}",
  },
  {
    label: "Matrix",
    source:
      "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\begin{pmatrix}2\\\\1\\end{pmatrix}=\\begin{pmatrix}4\\\\10\\end{pmatrix}",
  },
  {
    label: "Integral",
    source: "\\int_0^1 x^2\\,dx=\\left[\\frac{x^3}{3}\\right]_0^1=\\frac{1}{3}",
  },
];
export function ScienceInspector({
  element,
  editor,
}: {
  element: Element;
  editor: Editor;
}) {
  const [source, setSource] = useState(element.latex?.source || "");
  const [color, setColor] = useState(element.color || "#112866");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setSource(element.latex?.source || "");
    setColor(element.color || "#112866");
    setError("");
  }, [element.id, element.latex?.source, element.color]);
  async function render() {
    setBusy(true);
    setError("");
    try {
      const next = await prepareScienceElement({
        ...element,
        color,
        latex: { ...element.latex, source },
      });
      editor.patch({ latex: next.latex, src: next.src, color }, [element.id]);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  if (element.illustration3d)
    return (
      <section className="insp-section">
        <h3>3D illustration</h3>
        <Illustration3DFields element={element}
          onChange={(illustration3d) => editor.patch({
            illustration3d,
            ...(element.illustration3d?.scene !== illustration3d.scene
              ? { n: `${illustration3DModels[illustration3d.scene].label} · 3D` }
              : {}),
            src: illustration3DSvg(illustration3d),
          }, [element.id])} />
      </section>
    );
  if (element.learning)
    return (
      <section className="insp-section">
        <h3>Learning diagram</h3>
        <LearningFields
          value={element.learning}
          onChange={(learning) =>
            editor.patch(
              {
                learning,
                src: learningSvg(learning, element.color || "#0757ec"),
              },
              [element.id],
            )
          }
        />
      </section>
    );
  if (element.physics)
    return (
      <section className="insp-section">
        <h3>Physics simulation</h3>
        <PhysicsFields
          value={element.physics}
          onChange={(physics) =>
            editor.patch(
              { physics, src: physicsSvg(physics, element.color || "#0757ec") },
              [element.id],
            )
          }
        />
      </section>
    );
  if (!element.latex) return null;
  return (
    <section className="insp-section science-fields science-compact">
      <h3>LaTeX equation</h3>
      <div className="latex-head">
        <Label htmlFor={`latex-${element.id}`}>LaTeX source</Label>
        {source.trim() && !busy && (
          <button
            type="button"
            className="latex-clear"
            title="Clear source"
            aria-label="Clear LaTeX source"
            onClick={() => setSource("")}
          >
            Clear
          </button>
        )}
      </div>
      <Textarea
        id={`latex-${element.id}`}
        aria-label="LaTeX source"
        spellCheck={false}
        rows={3}
        maxLength={2000}
        value={source}
        disabled={busy}
        placeholder="e.g. \frac{1}{2}+\frac{1}{4}=\frac{3}{4}"
        onChange={(event) => setSource(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            if (source.trim() && !busy) void render();
          }
        }}
      />
      <div className="science-examples">
        {equations.map((example) => (
          <Button
            key={example.label}
            type="button"
            title={`Insert ${example.label} example`}
            disabled={busy}
            onClick={() => setSource(example.source)}
          >
            {example.label}
          </Button>
        ))}
      </div>
      <div className="latex-actions">
        <ColorField label="Equation color" value={color} onChange={setColor} />
        <Button
          type="button"
          className="primary latex-render"
          aria-label="Render LaTeX"
          disabled={busy || !source.trim()}
          title="Render equation (Ctrl+Enter)"
          onClick={() => void render()}
        >
          {busy ? "Rendering…" : "Render"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
