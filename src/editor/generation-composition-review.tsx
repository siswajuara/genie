import { useState } from "react";
import type {
  CompositionAsset,
  CompositionLayer,
  SceneComposition,
} from "../../sidecar/scene-composition.mjs";
import {
  compositionEffects,
  compositionMotions,
  compositionTransitions,
} from "../../sidecar/scene-composition.mjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select";
import { LearningFields } from "./learning-inspector";
import { PhysicsFields } from "./science-inspector";

export function CompositionReview({
  value,
  assets,
  seconds,
  disabled,
  onChange,
}: {
  value: SceneComposition;
  assets: CompositionAsset[];
  seconds: number;
  disabled: boolean;
  onChange: (value: SceneComposition) => void;
}) {
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, value.layers.length - 1),
    layer = value.layers[index];
  const patch = (change: Partial<CompositionLayer>) =>
    onChange({
      ...value,
      layers: value.layers.map((l, i) =>
        i === index ? ({ ...l, ...change } as CompositionLayer) : l,
      ),
    });
  return (
    <div className="generate-composition-review">
      <div className="generate-field generate-color-field">
        <Label htmlFor="composition-background">Scene background</Label>
        <Input
          id="composition-background"
          type="color"
          value={value.background}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, background: e.target.value })}
        />
      </div>
      <div className="generate-field">
        <Label>Transition to next scene</Label>
        <SelectField
          label="Scene transition"
          value={value.transition?.type || "cut"}
          options={compositionTransitions.map((v) => ({ value: v, label: v }))}
          disabled={disabled}
          onChange={(type) =>
            onChange({
              ...value,
              transition: {
                type: type as NonNullable<
                  SceneComposition["transition"]
                >["type"],
                duration: value.transition?.duration || 0.4,
              },
            })
          }
        />
      </div>
      <div className="generate-section-heading">
        <h3>Scene layers</h3>
        <small>{value.layers.length} / 24</small>
      </div>
      <div className="generate-layer-list" aria-label="Composed layers">
        {value.layers.map((l, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            aria-pressed={i === index}
            onClick={() => setSelected(i)}
          >
            <span>{i + 1}</span>
            {l.name}
            <small>{l.type}</small>
          </button>
        ))}
      </div>
      {layer && (
        <div className="generate-layer-inspector">
          <div className="generate-field">
            <Label htmlFor="composition-layer-name">Layer name</Label>
            <Input
              id="composition-layer-name"
              value={layer.name}
              maxLength={100}
              disabled={disabled}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </div>
          {layer.type === "text" && (
            <>
              <div className="generate-field">
                <Label htmlFor="composition-text">Layer text</Label>
                <Textarea
                  id="composition-text"
                  rows={3}
                  value={layer.text}
                  maxLength={500}
                  disabled={disabled}
                  onChange={(e) => patch({ text: e.target.value })}
                />
              </div>
              <div className="generate-fields">
                <div className="generate-field">
                  <Label htmlFor="composition-font-size">
                    Text size (% width)
                  </Label>
                  <Input
                    id="composition-font-size"
                    type="number"
                    min={4.5}
                    max={12}
                    step={0.25}
                    value={layer.fontSize}
                    disabled={disabled}
                    onChange={(e) =>
                      patch({ fontSize: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="generate-field">
                  <Label>Text alignment</Label>
                  <SelectField
                    label="Text alignment"
                    value={layer.align}
                    options={["left", "center", "right"].map((v) => ({
                      value: v,
                      label: v,
                    }))}
                    disabled={disabled}
                    onChange={(align) =>
                      patch({ align: align as "left" | "center" | "right" })
                    }
                  />
                </div>
              </div>
            </>
          )}
          {"color" in layer ||
          layer.type === "text" ||
          layer.type === "latex" ? (
            <div className="generate-field generate-color-field">
              <Label htmlFor="composition-color">Layer colour</Label>
              <Input
                id="composition-color"
                type="color"
                value={layer.color || "#1b2a7a"}
                disabled={disabled}
                onChange={(e) => patch({ color: e.target.value })}
              />
            </div>
          ) : null}
          {(layer.type === "rect" || layer.type === "ellipse") && (
            <div className="generate-field generate-color-field">
              <Label htmlFor="composition-fill">Shape fill</Label>
              <Input
                id="composition-fill"
                type="color"
                value={
                  layer.fill === "none" ? "#ffffff" : layer.fill || "#eaf1ff"
                }
                disabled={disabled}
                onChange={(e) => patch({ fill: e.target.value })}
              />
            </div>
          )}
          {layer.type === "asset" && (
            <div className="generate-field">
              <Label>Library asset</Label>
              <SelectField
                label="Library asset"
                value={layer.assetRef}
                options={assets.map((a) => ({ value: a.ref, label: a.name }))}
                disabled={disabled}
                onChange={(assetRef) => patch({ assetRef })}
              />
            </div>
          )}
          {layer.type === "learning" && (
            <LearningFields
              value={layer.settings}
              disabled={disabled}
              onChange={(settings) => patch({ settings })}
            />
          )}
          {layer.type === "physics" && (
            <PhysicsFields
              value={layer.settings}
              disabled={disabled}
              onChange={(settings) => patch({ settings })}
            />
          )}
          {layer.type === "latex" && (
            <div className="generate-field">
              <Label htmlFor="composition-latex">LaTeX source</Label>
              <Textarea
                id="composition-latex"
                value={layer.source}
                disabled={disabled}
                onChange={(e) => patch({ source: e.target.value })}
              />
            </div>
          )}
          <details className="generate-layer-details">
            <summary>Placement & animation</summary>
            <div className="generate-composition-geometry">
              {(["x", "y", "w", "h"] as const).map((key) => (
                <div className="generate-field" key={key}>
                  <Label htmlFor={`composition-${key}`}>
                    {{ x: "Left", y: "Top", w: "Width", h: "Height" }[key]} (%)
                  </Label>
                  <Input
                    id={`composition-${key}`}
                    type="number"
                    min={key === "w" || key === "h" ? 1 : 0}
                    max={100}
                    value={layer[key]}
                    disabled={disabled}
                    onChange={(e) => patch({ [key]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
            <p className="generate-hint">
              Percentages use the safe content area. A layer's own timing takes
              precedence over default scene motion.
            </p>
            {layer.animation ? (
              <>
                <div className="generate-fields">
                  <div className="generate-field">
                    <Label htmlFor="composition-cue">Reveal at (seconds)</Label>
                    <Input
                      id="composition-cue"
                      type="number"
                      min={0}
                      max={seconds - 1}
                      step={0.1}
                      value={layer.animation.start}
                      disabled={disabled}
                      onChange={(e) =>
                        patch({
                          animation: {
                            ...layer.animation!,
                            start: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="generate-field">
                    <Label>Entrance</Label>
                    <SelectField
                      label="Layer entrance"
                      value={layer.animation.enter}
                      options={compositionEffects.map((v) => ({
                        value: v,
                        label: v,
                      }))}
                      disabled={disabled}
                      onChange={(enter) =>
                        patch({
                          animation: {
                            ...layer.animation!,
                            enter: enter as NonNullable<
                              CompositionLayer["animation"]
                            >["enter"],
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="generate-field">
                  <Label>Idle motion</Label>
                  <SelectField
                    label="Layer idle motion"
                    value={layer.animation.motion}
                    options={compositionMotions.map((v) => ({
                      value: v,
                      label: v,
                    }))}
                    disabled={disabled}
                    onChange={(motion) =>
                      patch({
                        animation: {
                          ...layer.animation!,
                          motion: motion as NonNullable<
                            CompositionLayer["animation"]
                          >["motion"],
                        },
                      })
                    }
                  />
                </div>
                <Button
                  size="sm"
                  disabled={disabled}
                  onClick={() => patch({ animation: undefined })}
                >
                  Use default scene motion
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                disabled={disabled}
                onClick={() =>
                  patch({
                    animation: {
                      start: 0,
                      enter: "fade",
                      duration: 0.35,
                      motion: "none",
                      amount: 0,
                    },
                  })
                }
              >
                Set layer timing
              </Button>
            )}
          </details>
          <Button
            size="sm"
            disabled={disabled || value.layers.length <= 1}
            onClick={() => {
              onChange({
                ...value,
                layers: value.layers.filter((_, i) => i !== index),
              });
              setSelected(Math.max(0, index - 1));
            }}
          >
            Remove layer
          </Button>
        </div>
      )}
    </div>
  );
}
