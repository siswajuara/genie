import { useCallback, useEffect, useMemo, useState } from "react";
import { useAudioPreview } from "./use-audio-preview";
import type { Editor } from "./use-editor";
import { clamp, sceneDuration } from "./animation";

export function useAnimationPlayback(editor: Editor) {
  const frame = editor.frame;
  const [open, setOpen] = useState(false),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false),
    [preview, setPreview] = useState(false);
  const [fps, setFps] = useState(30),
    [speed, setSpeed] = useState(1),
    [snapping, setSnapping] = useState(true);
  const [range, setRange] = useState<{ start: number; end: number }>();
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const duration = frame ? sceneDuration(frame) : 5;
  const visibleFrames = editor.scene.frames.filter((f) => !f.hide);
  const frameIndex = visibleFrames.findIndex((f) => f.id === frame?.id);
  const nextFrame = frameIndex >= 0 ? visibleFrames[frameIndex + 1] : undefined;
  const previewFrames = useMemo(() => {
    if (!frame) return [];
    return nextFrame && frame.scene?.transition && frame.scene.transition.type !== "cut"
      ? [frame, nextFrame]
      : [frame];
  }, [frame, nextFrame]);
  const audioError = useAudioPreview(
    previewFrames,
    time,
    playing,
    open && preview,
    speed,
  );
  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setRange(undefined);
  }, [frame?.id]);
  useEffect(() => {
    setTime((t) => clamp(t, 0, duration));
    setRange((value) =>
      value
        ? {
            start: clamp(value.start, 0, duration - 0.05),
            end: clamp(
              value.end,
              Math.min(value.start, duration - 0.05) + 0.05,
              duration,
            ),
          }
        : undefined,
    );
  }, [duration]);
  useEffect(() => {
    if (!open || !frame) {
      setPlaying(false);
      setPreview(false);
    }
  }, [open, frame?.id]);
  useEffect(() => {
    if (!playing || !open || !frame) return;
    let request = 0,
      previous: number | undefined;
    const tick = (now: number) => {
      const delta =
        previous === undefined ? 0 : Math.min((now - previous) / 1000, 0.1);
      previous = now;
      setTime((t) => {
        const next = t + delta * speed,
          start = range?.start ?? 0,
          end = range?.end ?? duration;
        if (next >= end) {
          if (loop) return start + ((next - start) % (end - start));
          setPlaying(false);
          return end;
        }
        return next;
      });
      request = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", visibility);
    request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [playing, loop, duration, open, frame?.id, range, speed]);
  const seek = useCallback(
    (value: number) => {
      setTime(clamp(value, 0, duration));
      setPreview(true);
      setPlaying(false);
    },
    [duration],
  );
  function toggle() {
    if (!frame) return;
    setOpen(true);
    setPreview(true);
    if (time >= (range?.end ?? duration) || time < (range?.start ?? 0))
      setTime(range?.start ?? 0);
    setPlaying(!playing);
  }
  function playFrom(value: number) {
    if (!frame) return;
    setOpen(true);
    setPreview(true);
    setTime(clamp(value, 0, duration));
    setPlaying(true);
  }
  function edit() {
    setPlaying(false);
    setPreview(false);
  }
  return {
    frame,
    nextFrame,
    previewFrames,
    audioError,
    duration,
    open,
    setOpen,
    time,
    playing,
    toggle,
    playFrom,
    seek,
    loop,
    setLoop,
    preview,
    setPreview,
    edit,
    reducedMotion,
    setReducedMotion,
    fps,
    setFps,
    speed,
    setSpeed,
    snapping,
    setSnapping,
    range,
    setRange,
  };
}
export type AnimationPlayback = ReturnType<typeof useAnimationPlayback>;
