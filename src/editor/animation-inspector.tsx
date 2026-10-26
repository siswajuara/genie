import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState, type ReactNode } from "react";
import type { Editor } from "./use-editor";
import type { AnimationPlayback } from "./use-animation-playback";
import {
  clamp,
  defaultEffect,
  effectLabel,
  effects,
  motions,
  easings,
  transitions,
  timing,
  keyframePose,
  identity,
  type Animation,
  type Effect,
  type Easing,
  type Keyframe,
  type Motion,
  type Pose,
} from "./animation";
import { NumberField } from "../components/ui/number-field";
import { SelectField } from "../components/ui/select";
import { Accordion } from "../components/ui/accordion";
import { textEffects, textUnits, type TextAnimation } from "./text-animation";
import { EffectGrid } from "./effect-grid";
import { Icon } from "../components/ui/icon";

const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: effectLabel(value) }));
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="property">
      <span>{label}</span>
      {children}
    </div>
  );
}
type LayerSlot = "enter" | "motion" | "exit";
type SceneSlot = "camera" | "transition";

export function AnimationInspector({
  editor: e,
  playback: p,
}: {
  editor: Editor;
  playback: AnimationPlayback;
}) {
  const [timeInputRevision, setTimeInputRevision] = useState(0);
  const [slot, setSlot] = useState<LayerSlot>("enter");
  const [sceneSlot, setSceneSlot] = useState<SceneSlot>("camera");
  const [showTextGrid, setShowTextGrid] = useState(false);
  const frame = p.frame,
    o = e.active;
  if (!frame || !o)
    return (
      <div className="empty">
        <h2>Select a frame</h2>
        <p>Select a frame or one of its elements to edit animation.</p>
      </div>
    );
  const scene = frame.scene ?? { duration: 5 },
    isFrame = o.t === "frame";
  const a = o.animation ?? {},
    bounds = timing(o, p.duration),
    lifetime = bounds.end - bounds.start;
  const locked = e.scene.isLocked(o);
  const selected = e.selected.filter(
    (item) =>
      item.t !== "frame" && item.fid === frame.id && !e.scene.isLocked(item),
  );
  function replayAt(time: number) {
    p.setOpen(true);
    p.seek(clamp(time, 0, Math.max(0.01, p.duration)));
    if (!p.playing) p.toggle();
  }
  function patch(changes: Partial<Animation>) {
    const ids = new Set(selected.map((item) => item.id));
    e.change({
      ...e.doc,
      elements: e.doc.elements.map((item) =>
        ids.has(item.id)
          ? { ...item, animation: { ...item.animation, ...changes } }
          : item,
      ),
    });
  }
  function scenePatch(changes: Partial<typeof scene>) {
    e.patch({ scene: { ...scene, ...changes } }, [frame!.id]);
  }
  const textMotion = a.text ?? {
    preset: "none",
    duration: 1.5,
    delay: 0,
    easing: "linear",
  };
  function patchText(changes: Partial<TextAnimation>) {
    const ids = new Set(
      selected.filter((item) => item.t === "text").map((item) => item.id),
    );
    e.change({
      ...e.doc,
      elements: e.doc.elements.map((item) =>
        ids.has(item.id)
          ? {
              ...item,
              animation: {
                ...item.animation,
                text: { ...(item.animation?.text ?? textMotion), ...changes },
              },
            }
          : item,
      ),
    });
  }
  function applyEffectPreset(phase: "enter" | "exit", preset: Effect["preset"]) {
    const current = a[phase] ?? defaultEffect("none");
    patch({ [phase]: { ...current, preset } });
    if (preset === "none") return;
    replayAt(phase === "enter" ? bounds.start + 0.01 : Math.max(bounds.start, bounds.end - 0.6));
  }
  function applyMotionPreset(preset: Motion["preset"]) {
    const current = a.motion ?? { preset: "none", amount: 40, easing: "ease-in-out" as Easing };
    patch({ motion: { ...current, preset } });
    if (preset === "none") return;
    replayAt(bounds.start + 0.01);
  }
  function applyTextPreset(preset: TextAnimation["preset"]) {
    patchText({ preset });
    if (preset === "none") return;
    replayAt(bounds.start + (textMotion.delay ?? 0) + 0.01);
  }
  function slotButton(id: LayerSlot, label: string, preset: string) {
    const active = slot === id;
    return (
      <Button
        key={id}
        type="button"
        className={`anim-slot${active ? " is-active" : ""}${preset === "none" ? " is-none" : ""}`}
        aria-pressed={active}
        title={`${label}: ${preset === "none" ? "None" : effectLabel(preset)}. Click to edit.`}
        onClick={() => setSlot(id)}
      >
        <strong>{label}</strong>
        <span className="anim-slot-value">{preset === "none" ? "None" : effectLabel(preset)}</span>
      </Button>
    );
  }
  const local = clamp(p.time - bounds.start, 0, lifetime),
    keys = a.keyframes ?? [];
  const currentKey = keys.find((key) => Math.abs(key.time - local) < 0.005);
  function updateKey(changes: Partial<Keyframe>) {
    if (!currentKey) return;
    if (
      changes.time !== undefined &&
      keys.some(
        (key) =>
          key !== currentKey && Math.abs(key.time - changes.time!) < 0.000001,
      )
    ) {
      e.notify("A keyframe already exists at this time.");
      setTimeInputRevision((value) => value + 1);
      return;
    }
    e.patch(
      {
        animation: {
          ...a,
          keyframes: keys
            .map((key) => (key === currentKey ? { ...key, ...changes } : key))
            .sort((left, right) => left.time - right.time),
        },
      },
      [o!.id],
    );
    if (changes.time !== undefined) p.seek(bounds.start + changes.time);
  }
  const enter = a.enter ?? defaultEffect("none"),
    exit = a.exit ?? defaultEffect("none"),
    motion = a.motion ?? { preset: "none", amount: 40, easing: "ease-in-out" as Easing };
  return (
    <div className="animation-inspector">
      <div className="section-title">
        <h2>{isFrame ? "Scene" : "Animation"}</h2>
        <span>
          {isFrame
            ? frame.n
            : selected.length > 1
              ? `${selected.length} layers`
              : o.n}
        </span>
      </div>
      <div className="animation-preview-row">
        <Button className="primary" onClick={p.toggle}>
          <Icon name={p.playing ? "pause" : "play"} size={14} />
          {p.playing ? "Pause" : "Preview scene"}
        </Button>
        <Button
          onClick={() => {
            p.setOpen(true);
            p.seek(0);
          }}
        >
          <Icon name="film" size={14} />
          Show timeline
        </Button>
      </div>
      {locked && (
        <p className="hint">
          Unlock this {isFrame ? "frame" : "layer"} to change its animation.
        </p>
      )}
      <fieldset disabled={locked}>
        {isFrame ? (
          <>
            <section className="insp-section">
              <h3>Timing</h3>
              <Field label="Duration">
                <NumberField
                  label="Scene duration"
                  value={p.duration}
                  min={0.1}
                  max={600}
                  step={0.1}
                  onChange={(duration) => scenePatch({ duration })}
                />
              </Field>
              <p className="hint">
                Seconds. Each selected frame becomes a scene in MP4 export.
              </p>
            </section>
            <section className="insp-section">
              <h3>Camera</h3>
              <div className="anim-slots" role="group" aria-label="Scene slots">
                <Button
                  type="button"
                  className={`anim-slot${sceneSlot === "camera" ? " is-active" : ""}${(scene.camera?.preset ?? "none") === "none" ? " is-none" : ""}`}
                  aria-pressed={sceneSlot === "camera"}
                  title={`Camera: ${effectLabel(scene.camera?.preset ?? "none")}. Click to edit.`}
                  onClick={() => setSceneSlot("camera")}
                >
                  <strong>Camera</strong>
                  <span className="anim-slot-value">{effectLabel(scene.camera?.preset ?? "none")}</span>
                </Button>
                <Button
                  type="button"
                  className={`anim-slot${sceneSlot === "transition" ? " is-active" : ""}${(scene.transition?.type ?? "cut") === "cut" ? " is-none" : ""}`}
                  aria-pressed={sceneSlot === "transition"}
                  title={`Transition to next scene: ${effectLabel(scene.transition?.type ?? "cut")}. Click to edit.`}
                  onClick={() => setSceneSlot("transition")}
                >
                  <strong>Transition</strong>
                  <span className="anim-slot-value">{effectLabel(scene.transition?.type ?? "cut")}</span>
                </Button>
              </div>
              {sceneSlot === "camera" ? (
                <>
                  <EffectGrid
                    options={motions}
                    value={scene.camera?.preset ?? "none"}
                    kind="motion"
                    reduced={p.reducedMotion}
                    onSelect={(preset) => {
                      scenePatch({
                        camera: {
                          preset: preset as Motion["preset"],
                          amount: scene.camera?.amount ?? 40,
                          easing: scene.camera?.easing ?? "ease-in-out",
                        },
                      });
                      if (preset !== "none") replayAt(0.01);
                    }}
                  />
                  {(scene.camera?.preset ?? "none") !== "none" && (
                    <div className="anim-selected">
                      <h4>Selected: {effectLabel(scene.camera!.preset)}</h4>
                      <Field label="Intensity">
                        <NumberField
                          label="Camera intensity"
                          value={scene.camera!.amount}
                          min={0}
                          max={500}
                          step={5}
                          onChange={(amount) =>
                            scenePatch({ camera: { ...scene.camera!, amount } })
                          }
                        />
                      </Field>
                      <details>
                        <summary>Advanced (easing)</summary>
                        <Field label="Easing">
                          <SelectField
                            label="Camera easing"
                            value={scene.camera!.easing}
                            options={options(easings)}
                            onChange={(easing) =>
                              scenePatch({
                                camera: { ...scene.camera!, easing: easing as Easing },
                              })
                            }
                          />
                        </Field>
                      </details>
                    </div>
                  )}
                  <p className="hint">
                    Dolly moves the camera through depth. Set layer depth to create
                    parallax.
                  </p>
                </>
              ) : (
                <>
                  <EffectGrid
                    options={transitions}
                    value={scene.transition?.type ?? "cut"}
                    kind="transition"
                    reduced={p.reducedMotion}
                    onSelect={(type) => {
                      scenePatch({
                        transition: {
                          type: type as (typeof transitions)[number],
                          duration: scene.transition?.duration ?? 0.5,
                        },
                      });
                      if (type !== "cut") replayAt(Math.max(0, p.duration - 0.6));
                    }}
                  />
                  {(scene.transition?.type ?? "cut") !== "cut" && (
                    <div className="anim-selected">
                      <h4>Selected: {effectLabel(scene.transition!.type)}</h4>
                      <Field label="Duration">
                        <NumberField
                          label="Transition duration"
                          value={scene.transition!.duration}
                          min={0.05}
                          max={10}
                          step={0.05}
                          onChange={(duration) =>
                            scenePatch({
                              transition: { ...scene.transition!, duration },
                            })
                          }
                        />
                      </Field>
                      <details>
                        <summary>Advanced (easing)</summary>
                        <Field label="Easing">
                          <SelectField
                            label="Transition easing"
                            value={scene.transition!.easing ?? "ease-in-out"}
                            options={options(easings)}
                            onChange={(easing) =>
                              scenePatch({
                                transition: {
                                  ...scene.transition!,
                                  easing: easing as Easing,
                                },
                              })
                            }
                          />
                        </Field>
                      </details>
                    </div>
                  )}
                  <p className="hint">
                    Transitions overlap adjacent scenes, up to half of either scene.
                    Preview the full sequence in Export.
                  </p>
                </>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="insp-section">
              <h3>Layer timing</h3>
              {!o.fid ? (
                <p className="hint">Move this element into a frame first.</p>
              ) : (
                <>
                  <p className="anim-timing-line" aria-live="polite">
                    Visible&nbsp;
                    <strong>{bounds.start.toFixed(2)} s → {bounds.end.toFixed(2)} s</strong>
                  </p>
                  <Field label="Start">
                    <NumberField
                      label="Layer start"
                      value={bounds.start}
                      min={0}
                      max={bounds.end - 0.05}
                      step={0.05}
                      onChange={(start) => patch({ start, end: bounds.end })}
                    />
                  </Field>
                  <Field label="End">
                    <NumberField
                      label="Layer end"
                      value={bounds.end}
                      min={bounds.start + 0.05}
                      max={p.duration}
                      step={0.05}
                      onChange={(end) => patch({ start: bounds.start, end })}
                    />
                  </Field>
                  <p className="hint">
                    {lifetime.toFixed(2)} s visible. Entrance and exit durations
                    fit within this time. Drag in the timeline to adjust.
                  </p>
                </>
              )}
            </section>
            <section className="insp-section">
              <h3>Effect</h3>
              <div className="anim-slots" role="group" aria-label="Layer animation slots">
                {slotButton("enter", "In", enter.preset)}
                {slotButton("motion", "During", motion.preset)}
                {slotButton("exit", "Out", exit.preset)}
              </div>
              {slot === "enter" && (
                <>
                  <EffectGrid
                    options={effects}
                    value={enter.preset}
                    kind="effect"
                    reduced={p.reducedMotion}
                    onSelect={(preset) => applyEffectPreset("enter", preset as Effect["preset"])}
                  />
                  {enter.preset !== "none" && (
                    <div className="anim-selected">
                      <h4>Selected: In · {effectLabel(enter.preset)}</h4>
                      <Field label="Duration">
                        <NumberField
                          label="Entrance duration"
                          value={enter.duration}
                          min={0.05}
                          max={600}
                          step={0.05}
                          onChange={(duration) =>
                            patch({ enter: { ...enter, duration } })
                          }
                        />
                      </Field>
                      {enter.preset !== "fade" && (
                        <Field label="Intensity">
                          <NumberField
                            label="Entrance intensity"
                            value={enter.amount}
                            min={0}
                            max={500}
                            step={5}
                            onChange={(amount) =>
                              patch({ enter: { ...enter, amount } })
                            }
                          />
                        </Field>
                      )}
                      <details>
                        <summary>Advanced (easing)</summary>
                        <Field label="Easing">
                          <SelectField
                            label="Entrance easing"
                            value={enter.easing}
                            options={options(easings)}
                            onChange={(easing) => patch({ enter: { ...enter, easing: easing as Easing } })}
                          />
                        </Field>
                      </details>
                    </div>
                  )}
                  {o.t === "text" && (
                    <div className="anim-selected">
                      <h4>Text reveal</h4>
                      <Button
                        type="button"
                        className="anim-slot"
                        aria-expanded={showTextGrid}
                        title={showTextGrid ? "Hide text reveal choices" : "Show text reveal choices"}
                        onClick={() => setShowTextGrid((v) => !v)}
                      >
                        <strong>Style</strong>
                        <span className="anim-slot-value">
                          {textMotion.preset === "none" ? "None" : effectLabel(textMotion.preset)}
                        </span>
                      </Button>
                      {showTextGrid && (
                        <EffectGrid
                          options={textEffects}
                          value={textMotion.preset}
                          kind="text"
                          reduced={p.reducedMotion}
                          onSelect={(preset) => applyTextPreset(preset as TextAnimation["preset"])}
                        />
                      )}
                      {textMotion.preset !== "none" && (
                        <>
                          <Field label="Duration">
                            <NumberField
                              label="Text reveal duration"
                              value={textMotion.duration}
                              min={0.05}
                              max={600}
                              step={0.05}
                              onChange={(duration) => patchText({ duration })}
                            />
                          </Field>
                          <details>
                            <summary>Advanced (delay, easing, direction)</summary>
                            <Field label="Delay">
                              <NumberField
                                label="Text reveal delay"
                                value={textMotion.delay}
                                min={0}
                                max={600}
                                step={0.05}
                                onChange={(delay) => patchText({ delay })}
                              />
                            </Field>
                            {!["typewriter", "word-by-word", "line-by-line"].includes(
                              textMotion.preset,
                            ) && (
                              <Field label="Easing">
                                <SelectField
                                  label="Text reveal easing"
                                  value={textMotion.easing}
                                  options={options(easings)}
                                  onChange={(easing) =>
                                    patchText({ easing: easing as Easing })
                                  }
                                />
                              </Field>
                            )}
                            <Label className="check">
                              <Checkbox
                                checked={textMotion.reverse ?? false}
                                onCheckedChange={(checked) =>
                                  patchText({ reverse: checked === true })
                                }
                              />
                              Reverse reveal order
                            </Label>
                          </details>
                          <p className="hint">
                            {textUnits(o.text ?? "").count} characters ·{" "}
                            {textUnits(o.text ?? "").wordCount} words. Alignment,
                            colors, and line breaks stay in place.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
              {slot === "motion" && (
                <>
                  <EffectGrid
                    options={motions}
                    value={motion.preset}
                    kind="motion"
                    reduced={p.reducedMotion}
                    onSelect={(preset) => applyMotionPreset(preset as Motion["preset"])}
                  />
                  {motion.preset !== "none" && (
                    <div className="anim-selected">
                      <h4>Selected: During · {effectLabel(motion.preset)}</h4>
                      <Field label="Intensity">
                        <NumberField
                          label="Motion intensity"
                          value={motion.amount}
                          min={0}
                          max={500}
                          step={5}
                          onChange={(amount) => patch({ motion: { ...motion, amount } })}
                        />
                      </Field>
                      <details>
                        <summary>Advanced (easing)</summary>
                        <Field label="Easing">
                          <SelectField
                            label="Motion easing"
                            value={motion.easing}
                            options={options(easings)}
                            onChange={(easing) =>
                              patch({ motion: { ...motion, easing: easing as Easing } })
                            }
                          />
                        </Field>
                      </details>
                    </div>
                  )}
                </>
              )}
              {slot === "exit" && (
                <>
                  <EffectGrid
                    options={effects}
                    value={exit.preset}
                    kind="effect"
                    reduced={p.reducedMotion}
                    onSelect={(preset) => applyEffectPreset("exit", preset as Effect["preset"])}
                  />
                  {exit.preset !== "none" && (
                    <div className="anim-selected">
                      <h4>Selected: Out · {effectLabel(exit.preset)}</h4>
                      <Field label="Duration">
                        <NumberField
                          label="Exit duration"
                          value={exit.duration}
                          min={0.05}
                          max={600}
                          step={0.05}
                          onChange={(duration) =>
                            patch({ exit: { ...exit, duration } })
                          }
                        />
                      </Field>
                      {exit.preset !== "fade" && (
                        <Field label="Intensity">
                          <NumberField
                            label="Exit intensity"
                            value={exit.amount}
                            min={0}
                            max={500}
                            step={5}
                            onChange={(amount) =>
                              patch({ exit: { ...exit, amount } })
                            }
                          />
                        </Field>
                      )}
                      <details>
                        <summary>Advanced (easing)</summary>
                        <Field label="Easing">
                          <SelectField
                            label="Exit easing"
                            value={exit.easing}
                            options={options(easings)}
                            onChange={(easing) => patch({ exit: { ...exit, easing: easing as Easing } })}
                          />
                        </Field>
                      </details>
                    </div>
                  )}
                </>
              )}
            </section>
            <Accordion title="Timing details" triggerTitle="Show layer depth and keyframes">
              <Field label="Depth">
                <NumberField
                  label="Layer depth"
                  value={a.depth ?? 0}
                  min={-500}
                  max={500}
                  step={10}
                  onChange={(depth) => patch({ depth })}
                />
              </Field>
              <p className="hint">
                Positive depth brings this layer closer during a dolly.
              </p>
              <h3 className="section-heading">Keyframes</h3>
              {selected.length > 1 && (
                <p className="hint">Keyframes edit the active layer: {o.n}.</p>
              )}
              <p className="hint">
                Offsets from the editable design, in pixels and degrees. Scrub
                the timeline, add a keyframe, then set its values.
              </p>
              <Button
                className="full"
                disabled={
                  !!currentKey ||
                  keys.length >= 100 ||
                  p.time < bounds.start ||
                  p.time > bounds.end
                }
                onClick={() => {
                  const time = Math.round(local * 100) / 100;
                  const next: Keyframe[] = [...keys];
                  if (!next.length && time > 0)
                    next.push({ ...identity, time: 0, easing: "linear" });
                  next.push({
                    ...keyframePose(keys, time),
                    time,
                    easing: "ease-in-out",
                  });
                  next.sort((left, right) => left.time - right.time);
                  e.patch({ animation: { ...a, keyframes: next } }, [o.id]);
                  p.setOpen(true);
                  p.seek(bounds.start + time);
                }}
              >
                Add keyframe at {local.toFixed(2)} s
              </Button>
              {!!keys.length && (
                <div className="keyframe-list" aria-label="Keyframes">
                  {keys.map((key) => (
                    <span key={key.time}>
                      <Button
                        aria-pressed={key === currentKey}
                        onClick={() => {
                          p.setOpen(true);
                          p.seek(bounds.start + key.time);
                        }}
                      >
                        {key.time.toFixed(2)} s
                        {key.time > lifetime ? " (trimmed)" : ""}
                      </Button>
                      {key.time > lifetime && (
                        <Button
                          aria-label={`Delete trimmed keyframe at ${key.time} seconds`}
                          onClick={() =>
                            e.patch(
                              {
                                animation: {
                                  ...a,
                                  keyframes: keys.filter(
                                    (item) => item !== key,
                                  ),
                                },
                              },
                              [o.id],
                            )
                          }
                        >
                          <Icon name="close" size={14} />
                        </Button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {currentKey && (
                <>
                  <Field label="Time">
                    <NumberField
                      label="Keyframe time"
                      key={timeInputRevision}
                      value={currentKey.time}
                      min={0}
                      max={lifetime}
                      step={0.01}
                      onChange={(time) => updateKey({ time })}
                    />
                  </Field>
                  {(
                    [
                      ["x", "Move X", -10000, 10000, 1],
                      ["y", "Move Y", -10000, 10000, 1],
                      ["scale", "Scale", 0.01, 20, 0.05],
                      ["rotation", "Rotation", -10000, 10000, 5],
                      ["opacity", "Opacity", 0, 1, 0.05],
                      ["rotateY", "3D rotate Y", -10000, 10000, 5],
                      ["z", "Move Z", -10000, 10000, 10],
                    ] as const
                  ).map(([key, label, min, max, step]) => (
                    <Field label={label} key={key}>
                      <NumberField
                        label={`Keyframe ${label}`}
                        value={currentKey[key as keyof Pose]}
                        min={min}
                        max={max}
                        step={step}
                        onChange={(value) => updateKey({ [key]: value })}
                      />
                    </Field>
                  ))}
                  <Field label="Easing">
                    <SelectField
                      label="Keyframe easing"
                      value={currentKey.easing}
                      options={options(easings)}
                      onChange={(easing) =>
                        updateKey({ easing: easing as Easing })
                      }
                    />
                  </Field>
                  <Button
                    className="full danger"
                    onClick={() =>
                      e.patch(
                        {
                          animation: {
                            ...a,
                            keyframes: keys.filter((key) => key !== currentKey),
                          },
                        },
                        [o.id],
                      )
                    }
                  >
                    Delete keyframe
                  </Button>
                </>
              )}
            </Accordion>
            <Button
              className="full"
              disabled={!selected.some((item) => item.animation)}
              onClick={() => {
                const ids = new Set(selected.map((item) => item.id));
                e.change({
                  ...e.doc,
                  elements: e.doc.elements.map((item) =>
                    ids.has(item.id) ? { ...item, animation: undefined } : item,
                  ),
                });
              }}
            >
              Reset layer animation
            </Button>
          </>
        )}
      </fieldset>
    </div>
  );
}
