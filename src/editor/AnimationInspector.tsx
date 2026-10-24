import { useState, type ReactNode } from "react";
import type { Editor } from "./useEditor";
import type { AnimationPlayback } from "./useAnimationPlayback";
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
import { NumberField, SelectField } from "../components/ui/Controls";
import { textEffects, textUnits, type TextAnimation } from "./textAnimation";
import { Icon } from "../components/ui/Icon";

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
export function AnimationInspector({
  editor: e,
  playback: p,
}: {
  editor: Editor;
  playback: AnimationPlayback;
}) {
  const [timeInputRevision, setTimeInputRevision] = useState(0);
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
  function motionControls(
    value: Motion | undefined,
    label: string,
    onChange: (motion: Motion) => void,
  ) {
    const motion = value ?? {
      preset: "none",
      amount: 40,
      easing: "ease-in-out",
    };
    return (
      <>
        <Field label={label}>
          <SelectField
            label={label}
            value={motion.preset}
            options={options(motions)}
            onChange={(preset) =>
              onChange({ ...motion, preset: preset as Motion["preset"] })
            }
          />
        </Field>
        {motion.preset !== "none" && (
          <>
            <Field label="Amount">
              <NumberField
                label={`${label} amount`}
                value={motion.amount}
                min={0}
                max={500}
                step={5}
                onChange={(amount) => onChange({ ...motion, amount })}
              />
            </Field>
            <Field label="Easing">
              <SelectField
                label={`${label} easing`}
                value={motion.easing}
                options={options(easings)}
                onChange={(easing) =>
                  onChange({ ...motion, easing: easing as Easing })
                }
              />
            </Field>
          </>
        )}
      </>
    );
  }
  function effectControls(phase: "enter" | "exit") {
    const value = a[phase] ?? defaultEffect("none"),
      title = phase === "enter" ? "Entrance" : "Exit";
    return (
      <section className="insp-section">
        <h3>{title}</h3>
        <Field label="Effect">
          <SelectField
            label={`${title} effect`}
            value={value.preset}
            options={options(effects)}
            onChange={(preset) =>
              patch({
                [phase]: { ...value, preset: preset as Effect["preset"] },
              })
            }
          />
        </Field>
        {value.preset !== "none" && (
          <>
            <Field label="Duration">
              <NumberField
                label={`${title} duration`}
                value={value.duration}
                min={0.05}
                max={600}
                step={0.05}
                onChange={(duration) =>
                  patch({ [phase]: { ...value, duration } })
                }
              />
            </Field>
            <Field label="Easing">
              <SelectField
                label={`${title} easing`}
                value={value.easing}
                options={options(easings)}
                onChange={(easing) => patch({ [phase]: { ...value, easing } })}
              />
            </Field>
            {value.preset !== "fade" && (
              <Field label="Amount">
                <NumberField
                  label={`${title} amount`}
                  value={value.amount}
                  min={0}
                  max={500}
                  step={5}
                  onChange={(amount) =>
                    patch({ [phase]: { ...value, amount } })
                  }
                />
              </Field>
            )}
          </>
        )}
      </section>
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
        <button className="primary" onClick={p.toggle}>
          <Icon name={p.playing ? "pause" : "play"} size={14} />
          {p.playing ? "Pause" : "Preview scene"}
        </button>
        <button
          onClick={() => {
            p.setOpen(true);
            p.seek(0);
          }}
        >
          <Icon name="film" size={14} />
          Show timeline
        </button>
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
              {motionControls(scene.camera, "Camera motion", (camera) =>
                scenePatch({ camera }),
              )}
              <p className="hint">
                Dolly moves the camera through depth. Set layer depth to create
                parallax.
              </p>
            </section>
            <section className="insp-section">
              <h3>Transition to next scene</h3>
              <Field label="Transition">
                <SelectField
                  label="Scene transition"
                  value={scene.transition?.type ?? "cut"}
                  options={options(transitions)}
                  onChange={(type) =>
                    scenePatch({
                      transition: {
                        type: type as (typeof transitions)[number],
                        duration: scene.transition?.duration ?? 0.5,
                      },
                    })
                  }
                />
              </Field>
              {scene.transition && scene.transition.type !== "cut" && (
                <Field label="Duration">
                  <NumberField
                    label="Transition duration"
                    value={scene.transition.duration}
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
              )}
              <p className="hint">
                Transitions overlap adjacent scenes, up to half of either scene.
                Preview the full sequence in Export.
              </p>
              {scene.transition && scene.transition.type !== "cut" && (
                <Field label="Easing">
                  <SelectField
                    label="Transition easing"
                    value={scene.transition.easing ?? "ease-in-out"}
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
                    {lifetime.toFixed(2)} s visible. Entrance and exit durations
                    fit within this time. Positive depth brings this layer
                    closer during a dolly.
                  </p>
                </>
              )}
            </section>
            {effectControls("enter")}
            {o.t === "text" && (
              <section className="insp-section">
                <h3>Text reveal</h3>
                <Field label="Reveal">
                  <SelectField
                    label="Text reveal"
                    value={textMotion.preset}
                    options={options(textEffects)}
                    onChange={(preset) =>
                      patchText({ preset: preset as TextAnimation["preset"] })
                    }
                  />
                </Field>
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
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={textMotion.reverse ?? false}
                        onChange={(ev) =>
                          patchText({ reverse: ev.target.checked })
                        }
                      />
                      Reverse reveal order
                    </label>
                    <p className="hint">
                      {textUnits(o.text ?? "").count} characters ·{" "}
                      {textUnits(o.text ?? "").wordCount} words. Alignment,
                      colors, and line breaks stay in place.
                    </p>
                  </>
                )}
              </section>
            )}
            <section className="insp-section">
              <h3>During scene</h3>
              {motionControls(a.motion, "Layer motion", (motion) =>
                patch({ motion }),
              )}
            </section>
            {effectControls("exit")}
            <section className="insp-section">
              <h3>Keyframes</h3>
              {selected.length > 1 && (
                <p className="hint">Keyframes edit the active layer: {o.n}.</p>
              )}
              <p className="hint">
                Offsets from the editable design, in pixels and degrees. Scrub
                the timeline, add a keyframe, then set its values.
              </p>
              <button
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
              </button>
              {!!keys.length && (
                <div className="keyframe-list" aria-label="Keyframes">
                  {keys.map((key) => (
                    <span key={key.time}>
                      <button
                        aria-pressed={key === currentKey}
                        onClick={() => {
                          p.setOpen(true);
                          p.seek(bounds.start + key.time);
                        }}
                      >
                        {key.time.toFixed(2)} s
                        {key.time > lifetime ? " (trimmed)" : ""}
                      </button>
                      {key.time > lifetime && (
                        <button
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
                          ×
                        </button>
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
                  <button
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
                  </button>
                </>
              )}
            </section>
            <button
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
            </button>
          </>
        )}
      </fieldset>
    </div>
  );
}
