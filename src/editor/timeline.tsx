import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Editor } from "./use-editor";
import type { AnimationPlayback } from "./use-animation-playback";
import {
  clamp,
  defaultEffect,
  effectLabel,
  timing,
  type Animation,
  type Keyframe,
} from "./animation";
import { copy, type Element } from "./model";
import { Icon } from "../components/ui/icon";
import { TimelineControls, type TimelineFilter } from "./timeline-controls";
import {
  addTimelineKeyframe,
  moveTimelineClips,
  snapTimelineTime,
} from "./timeline-editing";

export function Timeline({
  editor: e,
  playback: p,
}: {
  editor: Editor;
  playback: AnimationPlayback;
}) {
  const [zoom, setZoom] = useState(1),
    [menu, setMenu] = useState<{ x: number; y: number; id?: string }>();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState<TimelineFilter>("all"),
    [height, setHeight] = useState(200);
  const [animationClipboard, setAnimationClipboard] = useState<Animation>();
  const menuRef = useRef<HTMLDivElement>(null),
    tracks = useRef<HTMLDivElement>(null);
  const gesture = useRef<(() => void) | undefined>(undefined);
  const frame = p.frame;
  const children = frame ? (e.scene.frameChildren.get(frame.id) ?? []) : [];
  const pixels = Math.max(440, p.duration * 70) * zoom;
  const visibleChildren = children.filter(
    (o) =>
      o.n.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "selected" && e.selection.includes(o.id)) ||
        (filter === "animated" && !!o.animation) ||
        (filter === "text" && o.t === "text")),
  );
  const selectedIds = children
    .filter((o) => e.selection.includes(o.id) && !e.scene.isLocked(o))
    .map((o) => o.id);
  const latest = useRef(e);
  latest.current = e;
  function gotoNarration(trackId?: string) {
    if (!frame) return;
    if (!e.selection.includes(frame.id)) e.select([frame.id]);
    p.setOpen(true);
    window.dispatchEvent(
      new CustomEvent("genie:show-narration", { detail: { trackId } }),
    );
  }
  useEffect(() => setMenu(undefined), [p.frame?.id]);
  useEffect(() => () => gesture.current?.(), [p.frame?.id]);
  useEffect(() => {
    const host = tracks.current;
    if (!p.playing || !host) return;
    const left = 170 + (p.time / p.duration) * pixels;
    if (left > host.scrollLeft + host.clientWidth - 24)
      host.scrollLeft = left - host.clientWidth + 48;
    else if (left < host.scrollLeft + 170)
      host.scrollLeft = Math.max(0, left - 190);
  }, [p.time, p.playing, pixels, p.duration]);
  useEffect(() => {
    if (!menu) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const close = (ev: globalThis.PointerEvent) => {
      if (!menuRef.current?.contains(ev.target as Node)) setMenu(undefined);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);
  if (!p.open) return null;
  if (!frame)
    return (
      <section
        className="animation-timeline timeline-no-selection"
        aria-label="Animation timeline"
      >
        <header className="timeline-toolbar">
          <strong>Timeline</strong>
          <Button
            aria-label="Hide timeline"
            title="Hide timeline"
            onClick={() => p.setOpen(false)}
          >
            <Icon name="close" size={15} />
          </Button>
        </header>
        <div className="timeline-selection-message" role="status">
          <Icon name="layers" size={24} />
          <div>
            <strong>No frame selected</strong>
            <p>
              Select a frame or an element inside a frame to view its timeline.
            </p>
          </div>
        </div>
      </section>
    );
  function context(ev: React.MouseEvent, id?: string) {
    ev.preventDefault();
    ev.stopPropagation();
    if (id && !e.selection.includes(id)) e.select([id]);
    setMenu({
      x: Math.max(4, Math.min(ev.clientX, window.innerWidth - 248)),
      y: Math.max(
        4,
        Math.min(ev.clientY, window.innerHeight - (id ? 410 : 180)),
      ),
      id,
    });
  }
  function patch(element: Element, changes: Partial<Animation>) {
    e.patch({ animation: { ...element.animation, ...changes } }, [element.id]);
  }
  function selectLayer(element: Element, event: React.MouseEvent) {
    if (event.shiftKey && e.active) {
      const a = children.findIndex((o) => o.id === e.active!.id),
        b = children.indexOf(element);
      e.select(
        children
          .slice(Math.max(0, Math.min(a, b)), Math.max(a, b) + 1)
          .map((o) => o.id),
      );
    } else if (event.metaKey || event.ctrlKey)
      e.select(
        e.selection.includes(element.id)
          ? e.selection.filter((id) => id !== element.id)
          : [...e.selection, element.id],
      );
    else e.select([element.id]);
  }
  function addKey() {
    const ids = new Set(selectedIds);
    e.change({
      ...e.doc,
      elements: e.doc.elements.map((o) =>
        ids.has(o.id) ? addTimelineKeyframe(o, p.time, p.duration) : o,
      ),
    });
    p.seek(p.time);
  }
  function resize(ev: ReactPointerEvent) {
    if (ev.button !== 0) return;
    ev.preventDefault();
    gesture.current?.();
    const node = ev.currentTarget as HTMLElement,
      y = ev.clientY,
      original = height;
    node.setPointerCapture(ev.pointerId);
    const move = (event: globalThis.PointerEvent) =>
      setHeight(
        clamp(
          original + y - event.clientY,
          85,
          Math.min(500, window.innerHeight * 0.5),
        ),
      );
    const cleanup = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("lostpointercapture", cancel);
      gesture.current = undefined;
    };
    function up() {
      cleanup();
    }
    function cancel() {
      cleanup();
      setHeight(original);
    }
    gesture.current = cancel;
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", cancel);
    node.addEventListener("lostpointercapture", cancel);
  }
  function dragRange(ev: ReactPointerEvent, edge: "start" | "end") {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    gesture.current?.();
    const node = ev.currentTarget as HTMLElement,
      ruler = node.parentElement!.getBoundingClientRect(),
      original = p.range;
    const range = original ?? { start: 0, end: p.duration };
    p.seek(p.time);
    node.setPointerCapture(ev.pointerId);
    const move = (event: globalThis.PointerEvent) => {
      const time = snapTimelineTime(
        ((event.clientX - ruler.left) / ruler.width) * p.duration,
        p.fps,
        p.snapping,
        [0, p.duration, p.time],
        pixels / p.duration,
      );
      const next =
        edge === "start"
          ? { ...range, start: clamp(time, 0, range.end - 1 / p.fps) }
          : { ...range, end: clamp(time, range.start + 1 / p.fps, p.duration) };
      p.setRange(next);
      p.seek(next[edge]);
    };
    const cleanup = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("lostpointercapture", cancel);
      gesture.current = undefined;
    };
    function up() {
      cleanup();
    }
    function cancel() {
      cleanup();
      p.setRange(original);
    }
    gesture.current = cancel;
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", cancel);
    node.addEventListener("lostpointercapture", cancel);
  }
  function dragKey(ev: ReactPointerEvent, element: Element, key: Keyframe) {
    if (ev.button !== 0 || e.scene.isLocked(element)) return;
    ev.stopPropagation();
    ev.preventDefault();
    gesture.current?.();
    if (!e.selection.includes(element.id)) e.select([element.id]);
    const initial = e.current.current,
      origin = ev.clientX,
      node = ev.currentTarget as HTMLElement;
    const bounds = timing(element, p.duration),
      keys = element.animation?.keyframes ?? [];
    node.setPointerCapture(ev.pointerId);
    let moved = false;
    function move(event: globalThis.PointerEvent) {
      const time = clamp(
        snapTimelineTime(
          bounds.start +
            key.time +
            ((event.clientX - origin) / pixels) * p.duration,
          p.fps,
          p.snapping,
          [
            0,
            p.duration,
            ...keys
              .filter((other) => other !== key)
              .map((other) => bounds.start + other.time),
          ],
          pixels / p.duration,
        ) - bounds.start,
        0,
        bounds.end - bounds.start,
      );
      if (
        keys.some(
          (other) => other !== key && Math.abs(other.time - time) < 0.000001,
        )
      )
        return;
      const keyframes = keys
        .map((other) => (other === key ? { ...key, time } : other))
        .sort((left, right) => left.time - right.time);
      latest.current.change(
        {
          ...initial,
          elements: initial.elements.map((o) =>
            o.id === element.id
              ? { ...o, animation: { ...o.animation, keyframes } }
              : o,
          ),
        },
        false,
      );
      p.seek(bounds.start + time);
      moved = true;
    }
    const cleanup = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("lostpointercapture", cancel);
      gesture.current = undefined;
    };
    function up() {
      cleanup();
      if (moved) {
        latest.current.commit();
        const suppress = (event: Event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
        };
        node.addEventListener("click", suppress, { capture: true, once: true });
        window.setTimeout(
          () => node.removeEventListener("click", suppress, true),
          0,
        );
      }
    }
    function cancel() {
      cleanup();
      if (moved) latest.current.change(initial, false);
    }
    gesture.current = cancel;
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", cancel);
    node.addEventListener("lostpointercapture", cancel);
  }
  function drag(
    ev: ReactPointerEvent,
    element: Element,
    mode: "move" | "start" | "end",
  ) {
    if (ev.button !== 0 || e.scene.isLocked(element)) return;
    if (mode === "move" && (ev.shiftKey || ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    ev.stopPropagation();
    gesture.current?.();
    p.edit();
    if (!e.selection.includes(element.id)) e.select([element.id]);
    const initial = e.current.current,
      origin = ev.clientX,
      bounds = timing(element, p.duration);
    const node = ev.currentTarget as HTMLElement;
    const ids =
      mode === "move" && e.selection.includes(element.id)
        ? selectedIds
        : [element.id];
    const points = [
      0,
      p.duration,
      p.time,
      ...children
        .filter((o) => !ids.includes(o.id))
        .flatMap((o) => {
          const t = timing(o, p.duration);
          return [
            t.start,
            t.end,
            ...(o.animation?.keyframes ?? []).map((key) => t.start + key.time),
          ];
        }),
    ];
    node.setPointerCapture(ev.pointerId);
    let changed = false;
    function move(event: globalThis.PointerEvent) {
      const rawDelta = ((event.clientX - origin) / pixels) * p.duration;
      const anchor = mode === "end" ? bounds.end : bounds.start;
      const delta =
        snapTimelineTime(
          anchor + rawDelta,
          p.fps,
          p.snapping && !event.altKey,
          points,
          pixels / p.duration,
        ) - anchor;
      let start = bounds.start,
        end = bounds.end;
      if (mode === "move") {
        start = clamp(
          bounds.start + delta,
          0,
          p.duration - (end - bounds.start),
        );
        end = start + bounds.end - bounds.start;
      }
      if (mode === "start") start = clamp(bounds.start + delta, 0, end - 0.05);
      if (mode === "end")
        end = clamp(bounds.end + delta, start + 0.05, p.duration);
      if (mode === "move") {
        latest.current.change(
          moveTimelineClips(initial, ids, delta, p.duration),
          false,
        );
        changed = true;
        return;
      }
      const animation = { ...element.animation, start, end };
      latest.current.change(
        {
          ...initial,
          elements: initial.elements.map((o) =>
            o.id === element.id ? { ...o, animation } : o,
          ),
        },
        false,
      );
      changed = true;
    }
    const cleanup = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("lostpointercapture", cancel);
      gesture.current = undefined;
    };
    function up() {
      cleanup();
      if (changed) latest.current.commit();
    }
    function cancel() {
      cleanup();
      if (changed) latest.current.change(initial, false);
    }
    gesture.current = cancel;
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", cancel);
    node.addEventListener("lostpointercapture", cancel);
  }
  const target = menu?.id ? e.scene.byId.get(menu.id) : undefined;
  const locked = target ? e.scene.isLocked(target) : frame.lock;
  const contextIds =
    target && e.selection.includes(target.id)
      ? selectedIds
      : target && !e.scene.isLocked(target)
        ? [target.id]
        : selectedIds;
  function patchContext(changes: Partial<Animation>) {
    const ids = new Set(contextIds);
    e.change({
      ...e.doc,
      elements: e.doc.elements.map((o) =>
        ids.has(o.id) ? { ...o, animation: { ...o.animation, ...changes } } : o,
      ),
    });
  }
  const menuItems: [string, () => void, boolean?][] = target
    ? [
        [
          "Start at playhead",
          () =>
            patch(target, {
              start: clamp(p.time, 0, timing(target, p.duration).end - 0.05),
            }),
          locked,
        ],
        [
          "End at playhead",
          () =>
            patch(target, {
              end: clamp(
                p.time,
                timing(target, p.duration).start + 0.05,
                p.duration,
              ),
            }),
          locked,
        ],
        [
          "Show for entire scene",
          () => patch(target, { start: 0, end: p.duration }),
          locked,
        ],
        ["Add fade in", () => patchContext({ enter: defaultEffect() }), locked],
        ["Add fade out", () => patchContext({ exit: defaultEffect() }), locked],
        [
          "Remove animation",
          () => e.patch({ animation: undefined }, contextIds),
          locked,
        ],
        ["Add keyframe at playhead", addKey, locked],
        [
          "Align selected starts to playhead",
          () => {
            const ids = new Set(contextIds);
            e.change({
              ...e.doc,
              elements: e.doc.elements.map((o) => {
                if (!ids.has(o.id)) return o;
                const t = timing(o, p.duration),
                  length = t.end - t.start,
                  start = clamp(p.time, 0, p.duration - length);
                return {
                  ...o,
                  animation: { ...o.animation, start, end: start + length },
                };
              }),
            });
          },
          locked,
        ],
        [
          "Copy animation",
          () => setAnimationClipboard(copy(target.animation ?? {})),
        ],
        [
          "Paste animation to selected",
          () => {
            const ids = new Set(contextIds);
            e.change({
              ...e.doc,
              elements: e.doc.elements.map((o) => {
                if (!ids.has(o.id)) return o;
                const animation = copy(animationClipboard!);
                if (o.t !== "text") delete animation.text;
                return { ...o, animation };
              }),
            });
          },
          locked || !animationClipboard,
        ],
      ]
    : [
        [p.playing ? "Pause" : "Play scene", p.toggle],
        ["Return to start", () => p.seek(0)],
        [
          "Stagger layers (0.15 s)",
          () => {
            e.change({
              ...e.doc,
              elements: e.doc.elements.map((o) => {
                const index = children.findIndex((child) => child.id === o.id);
                return index < 0 || e.scene.isLocked(o)
                  ? o
                  : {
                      ...o,
                      animation: {
                        ...o.animation,
                        start: Math.min(index * 0.15, p.duration - 0.1),
                        end: p.duration,
                        enter: defaultEffect(),
                      },
                    };
              }),
            });
          },
          !!frame.lock,
        ],
        ["Hide timeline", () => p.setOpen(false)],
      ];
  return (
    <section
      className="animation-timeline"
      aria-label="Animation timeline"
      onKeyDown={(ev) => {
        ev.stopPropagation();
        if (ev.key === "Escape") {
          setMenu(undefined);
          gesture.current?.();
          return;
        }
        if (
          !(ev.target as HTMLElement).closest("input,select,textarea") &&
          (ev.ctrlKey || ev.metaKey) &&
          ["z", "y"].includes(ev.key.toLowerCase())
        ) {
          ev.preventDefault();
          p.edit();
          ev.key.toLowerCase() === "y" || ev.shiftKey ? e.redo() : e.undo();
          return;
        }
        if (
          (ev.target as HTMLElement).closest(
            "input,select,textarea,[contenteditable='true'],[role='combobox'],[role='slider'],[role='checkbox'],[role='menu']",
          )
        )
          return;
        if (ev.key.toLowerCase() === "i") {
          ev.preventDefault();
          p.setRange({
            start: clamp(p.time, 0, (p.range?.end ?? p.duration) - 1 / p.fps),
            end: p.range?.end ?? p.duration,
          });
        }
        if (ev.key.toLowerCase() === "o") {
          ev.preventDefault();
          p.setRange({
            start: p.range?.start ?? 0,
            end: clamp(p.time, (p.range?.start ?? 0) + 1 / p.fps, p.duration),
          });
        }
        if (ev.key === "Home" || ev.key === "End") {
          ev.preventDefault();
          p.seek(ev.key === "Home" ? 0 : p.duration);
        }
        if (ev.key.toLowerCase() === "k") {
          ev.preventDefault();
          addKey();
        }
        if (ev.key === " ") {
          ev.preventDefault();
          if (!ev.repeat) p.toggle();
        }
        if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
          ev.preventDefault();
          p.seek(
            p.time +
              (ev.key === "ArrowLeft" ? -1 : 1) * (ev.shiftKey ? 1 : 1 / p.fps),
          );
        }
      }}
    >
      <div
        className="timeline-resizer"
        role="separator"
        tabIndex={0}
        aria-label="Timeline height"
        aria-orientation="horizontal"
        aria-valuenow={Math.round(height)}
        aria-valuemin={85}
        aria-valuemax={500}
        onPointerDown={resize}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
            ev.stopPropagation();
            ev.preventDefault();
            setHeight(
              clamp(
                height + (ev.key === "ArrowUp" ? 20 : -20),
                85,
                Math.min(500, window.innerHeight * 0.5),
              ),
            );
          }
        }}
      />
      <TimelineControls
        playback={p}
        zoom={zoom}
        onZoom={setZoom}
        onFit={() =>
          setZoom(
            clamp(
              ((tracks.current?.clientWidth ?? 700) - 170) /
                Math.max(440, p.duration * 70),
              0.1,
              8,
            ),
          )
        }
        search={search}
        onSearch={setSearch}
        filter={filter}
        onFilter={setFilter}
      />
      {p.audioError && (
        <p role="alert" className="timeline-audio-error">
          {p.audioError}
        </p>
      )}
      <div className="timeline-content" style={{ height, maxHeight: "45dvh" }}>
        <div
          className="timeline-scroll"
          style={{ maxHeight: `min(${height}px, 45dvh)` }}
          ref={tracks}
          tabIndex={0}
          aria-label="Timeline tracks. Space plays; arrow keys step the playhead."
          onContextMenu={(ev) => context(ev)}
        >
          <div className="timeline-grid" style={{ width: pixels + 170 }}>
            <div className="timeline-label timeline-ruler-label">
              <strong title={frame.n}>{frame.n}</strong>
              {frame.scene?.transition &&
                frame.scene.transition.type !== "cut" && (
                  <Button
                    type="button"
                    className="anim-chip timeline-transition-chip"
                    title={`Transition to next scene: ${effectLabel(frame.scene.transition.type)} (${frame.scene.transition.duration.toFixed(2)} s). Click to preview the transition.`}
                    aria-label={`Transition to next scene: ${effectLabel(frame.scene.transition.type)}`}
                    onClick={() =>
                      p.seek(
                        Math.max(
                          0,
                          p.duration -
                            (frame.scene!.transition!.duration + 0.2),
                        ),
                      )
                    }
                  >
                    ⇄ {effectLabel(frame.scene.transition.type)}
                  </Button>
                )}
            </div>
            <div className="timeline-ruler" style={{ width: pixels }}>
              {p.range && (
                <div
                  className="timeline-preview-range"
                  style={{
                    left: `${(p.range.start / p.duration) * 100}%`,
                    width: `${((p.range.end - p.range.start) / p.duration) * 100}%`,
                  }}
                />
              )}
              {p.range &&
                (["start", "end"] as const).map((edge) => (
                  <Button
                    key={edge}
                    className={`timeline-range-handle ${edge}`}
                    title={`Preview range ${edge}`}
                    aria-label={`Preview range ${edge}`}
                    style={{ left: `${(p.range![edge] / p.duration) * 100}%` }}
                    onPointerDown={(ev) => dragRange(ev, edge)}
                    onClick={() => p.seek(p.range![edge])}
                    onKeyDown={(ev) => {
                      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
                        ev.preventDefault();
                        ev.stopPropagation();
                        const value =
                          p.range![edge] +
                          (ev.key === "ArrowLeft" ? -1 : 1) / p.fps;
                        p.setRange(
                          edge === "start"
                            ? {
                                ...p.range!,
                                start: clamp(
                                  value,
                                  0,
                                  p.range!.end - 1 / p.fps,
                                ),
                              }
                            : {
                                ...p.range!,
                                end: clamp(
                                  value,
                                  p.range!.start + 1 / p.fps,
                                  p.duration,
                                ),
                              },
                        );
                      }
                    }}
                  />
                ))}
              {Array.from(
                { length: Math.min(61, Math.ceil(p.duration) + 1) },
                (_, i) => {
                  const t =
                    (i * p.duration) /
                    (Math.min(61, Math.ceil(p.duration) + 1) - 1);
                  return (
                    <span
                      key={i}
                      style={{ left: `${(t / p.duration) * 100}%` }}
                    >
                      {t.toFixed(p.duration < 3 ? 1 : 0)}s
                    </span>
                  );
                },
              )}
              <Slider
                aria-label="Timeline playhead"
                min={0}
                max={p.duration}
                step={0.01}
                value={[p.time]}
                onValueChange={([value]) => p.seek(value)}
              />
            </div>
            {frame.voiceoverDraft?.script &&
              !frame.audioTracks?.some(
                (track) => track.role === "voiceover",
              ) && (
                <div className="timeline-row timeline-sound-track">
                  <Button
                    className="timeline-label"
                    title="Open narration in the right panel"
                    onClick={() => gotoNarration()}
                  >
                    Narration draft
                  </Button>
                  <div className="timeline-track" style={{ width: pixels }}>
                    <Button
                      className="timeline-media-clip"
                      style={{ left: 0, width: "100%" }}
                      title={frame.voiceoverDraft.script}
                      onClick={() => gotoNarration()}
                    >
                      Script · edit narration in the right panel
                    </Button>
                  </div>
                </div>
              )}
            {!(frame.audioTracks ?? []).some(
              (track) => track.role === "voiceover",
            ) &&
              !frame.voiceoverDraft?.script && (
                <div className="timeline-row timeline-sound-track is-placeholder">
                  <Button
                    className="timeline-label"
                    title="Add a narrator voice to this frame"
                    onClick={() => gotoNarration()}
                  >
                    ♪ Narration
                  </Button>
                  <div className="timeline-track" style={{ width: pixels }}>
                    <Button
                      className="timeline-placeholder-clip"
                      onClick={() => gotoNarration()}
                    >
                      No narration yet — select the frame, then use Narration →
                    </Button>
                  </div>
                </div>
              )}
            {(frame.audioTracks ?? []).map((track) => (
              <div
                className="timeline-row timeline-sound-track"
                key={`audio-${track.id}`}
              >
                <Button
                  className="timeline-label"
                  title={`Edit ${track.name} in the Narration panel`}
                  onClick={() => {
                    p.seek(track.start);
                    gotoNarration(track.id);
                  }}
                >
                  {track.muted ? "Muted · " : "♫ "}
                  {track.name}
                </Button>
                <div className="timeline-track" style={{ width: pixels }}>
                  <Button
                    className="timeline-media-clip"
                    title={`${track.name} · ${track.start.toFixed(2)}–${track.end.toFixed(2)} s · ${Math.round(track.volume * 100)}%`}
                    style={{
                      left: `${Math.min(100, (track.start / p.duration) * 100)}%`,
                      width: `${(Math.max(0, Math.min(track.end, p.duration) - track.start) / p.duration) * 100}%`,
                      opacity: track.muted ? 0.4 : 1,
                    }}
                    onClick={() => {
                      p.seek(track.start);
                      gotoNarration(track.id);
                    }}
                  >
                    {track.role} · {Math.round(track.volume * 100)}%
                  </Button>
                </div>
              </div>
            ))}
            {!!frame.subtitles?.length && (
              <div className="timeline-row timeline-sound-track">
                <div className="timeline-label">
                  Subtitles · {frame.subtitles.length}
                </div>
                <div className="timeline-track" style={{ width: pixels }}>
                  {frame.subtitles.map((cue) => (
                    <Button
                      key={cue.id}
                      className="timeline-media-clip subtitle"
                      title={`${cue.text} · ${cue.start.toFixed(2)}–${cue.end.toFixed(2)} s`}
                      style={{
                        left: `${Math.min(100, (cue.start / p.duration) * 100)}%`,
                        width: `${(Math.max(0, Math.min(cue.end, p.duration) - cue.start) / p.duration) * 100}%`,
                      }}
                      onClick={() => {
                        p.seek(cue.start);
                        gotoNarration();
                      }}
                    >
                      {cue.text}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {!frame.subtitles?.length && (
              <div className="timeline-row timeline-sound-track is-placeholder">
                <Button
                  className="timeline-label"
                  title="Captions appear here after you generate narration"
                  onClick={() => gotoNarration()}
                >
                  Captions
                </Button>
                <div className="timeline-track" style={{ width: pixels }}>
                  <span
                    className="timeline-placeholder-hint"
                    aria-hidden="true"
                  >
                    Captions will appear here
                  </span>
                </div>
              </div>
            )}
            {visibleChildren.map((o) => {
              const { start, end } = timing(o, p.duration),
                selected = e.selection.includes(o.id),
                a = o.animation;
              return (
                <div
                  className={`timeline-row${selected ? " selected" : ""}`}
                  key={o.id}
                >
                  <Button
                    className="timeline-label"
                    title={o.n}
                    onClick={(ev) => selectLayer(o, ev)}
                    onContextMenu={(ev) => context(ev, o.id)}
                  >
                    <Icon
                      name={
                        o.t === "text"
                          ? "text"
                          : o.t === "img"
                            ? "image"
                            : "box"
                      }
                      size={13}
                    />
                    <span>{o.n}</span>
                    {o.lock && <Icon name="lock" size={12} />}
                  </Button>
                  <div
                    className="timeline-track"
                    style={{ width: pixels }}
                    onClick={(ev) => {
                      const rect = ev.currentTarget.getBoundingClientRect();
                      p.seek(
                        ((ev.clientX - rect.left) / rect.width) * p.duration,
                      );
                    }}
                    onContextMenu={(ev) => context(ev, o.id)}
                  >
                    <div
                      className={`timeline-clip${o.hide ? " is-hidden" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${o.n}, ${start.toFixed(2)} to ${end.toFixed(2)} seconds. Use Animation inspector for exact timing.`}
                      style={{
                        left: `${(start / p.duration) * 100}%`,
                        width: `${((end - start) / p.duration) * 100}%`,
                      }}
                      onPointerDown={(ev) => drag(ev, o, "move")}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (
                          ev.shiftKey ||
                          ev.ctrlKey ||
                          ev.metaKey ||
                          !e.selection.includes(o.id)
                        )
                          selectLayer(o, ev);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") e.select([o.id]);
                        if (
                          (ev.key === "ArrowLeft" || ev.key === "ArrowRight") &&
                          !e.scene.isLocked(o)
                        ) {
                          ev.preventDefault();
                          ev.stopPropagation();
                          e.change(
                            moveTimelineClips(
                              e.doc,
                              e.selection.includes(o.id) ? selectedIds : [o.id],
                              ((ev.key === "ArrowRight" ? 1 : -1) *
                                (ev.shiftKey ? 10 : 1)) /
                                p.fps,
                              p.duration,
                            ),
                          );
                        }
                      }}
                    >
                      <span
                        className="timeline-trim start"
                        onPointerDown={(ev) => drag(ev, o, "start")}
                      />
                      {a?.enter && a.enter.preset !== "none" && (
                        <span
                          className="clip-effect enter"
                          style={{
                            width: `${Math.min(a.enter.duration / (end - start), a.exit && a.exit.preset !== "none" ? 0.5 : 1) * 100}%`,
                          }}
                        />
                      )}
                      <span className="clip-name">
                        {a?.text && a.text.preset !== "none"
                          ? effectLabel(a.text.preset)
                          : a?.motion && a.motion.preset !== "none"
                            ? effectLabel(a.motion.preset)
                            : o.n}
                      </span>
                      {a?.exit && a.exit.preset !== "none" && (
                        <span
                          className="clip-effect exit"
                          style={{
                            width: `${Math.min(a.exit.duration / (end - start), a.enter && a.enter.preset !== "none" ? 0.5 : 1) * 100}%`,
                          }}
                        />
                      )}
                      {a?.keyframes
                        ?.filter((key) => key.time <= end - start)
                        .map((key, index) => (
                          <Button
                            className="timeline-keyframe"
                            key={index}
                            aria-label={`Keyframe at ${(start + key.time).toFixed(2)} seconds`}
                            style={{
                              left: `${(key.time / (end - start)) * 100}%`,
                            }}
                            onPointerDown={(ev) => dragKey(ev, o, key)}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              e.select([o.id]);
                              p.seek(start + key.time);
                            }}
                            onKeyDown={(ev) => {
                              if (
                                (ev.key === "Delete" ||
                                  ev.key === "Backspace") &&
                                !e.scene.isLocked(o)
                              ) {
                                ev.preventDefault();
                                ev.stopPropagation();
                                patch(o, {
                                  keyframes: a.keyframes!.filter(
                                    (item) => item !== key,
                                  ),
                                });
                              }
                            }}
                          >
                            <Icon name="keyframe" size={12} />
                          </Button>
                        ))}
                      <span
                        className="timeline-trim end"
                        onPointerDown={(ev) => drag(ev, o, "end")}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {!visibleChildren.length && (
              <p className="timeline-empty">
                {children.length
                  ? "No layers match this filter."
                  : "Add text, images, or shapes to this frame to animate them."}
              </p>
            )}
            <div
              className="timeline-playhead"
              style={{ left: 170 + (p.time / p.duration) * pixels }}
            />
          </div>
        </div>
      </div>
      <footer>
        Space play/pause · ←/→ step · I/O range · K keyframe · Drag edges to
        trim
      </footer>
      {menu && (
        <div
          className="context-menu timeline-context"
          ref={menuRef}
          role="menu"
          aria-label="Timeline actions"
          style={{ left: menu.x, top: menu.y }}
          onKeyDown={(ev) => {
            if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
              ev.preventDefault();
              const buttons = [
                ...ev.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button:not(:disabled)",
                ),
              ];
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              buttons[
                (index + (ev.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                  buttons.length
              ]?.focus();
            }
            if (ev.key === "Tab") setMenu(undefined);
          }}
        >
          {menuItems.map(([label, action, disabled]) => (
            <Button
              key={label}
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                action();
                setMenu(undefined);
                tracks.current?.focus();
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
