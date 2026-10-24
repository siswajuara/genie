import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "./useEditor";
import { frames } from "./model";
import { buildSequence, sceneDuration } from "./animation";
import {
  createSequenceRenderer,
  drawAnimationFrame,
} from "./animationRenderer";
import {
  exportImages,
  exportVideo,
  mp4Support,
  prepareMedia,
  videoBitrate,
  videoDimensions,
} from "./mediaExport";
import { saveExport, exportFilename, exportMessage } from "../lib/export";
import { Icon } from "../components/ui/Icon";
import { SelectField } from "../components/ui/Controls";

type Media = Awaited<ReturnType<typeof prepareMedia>>;
export function ExportDialog({
  editor: e,
  playhead,
  onClose,
}: {
  editor: Editor;
  playhead: number;
  onClose: () => void;
}) {
  const [doc] = useState(e.doc),
    artboards = useMemo(() => frames(doc), [doc]);
  const [ids, setIds] = useState(() => {
    const selected = new Set(
      e.selected.map((o) => (o.t === "frame" ? o.id : o.fid)),
    );
    const chosen = artboards.filter((f) => selected.has(f.id));
    return chosen.length
      ? chosen.map((f) => f.id)
      : [e.frame?.id ?? artboards[0]?.id].filter((id): id is string => !!id);
  });
  const selected = useMemo(
    () => ids.flatMap((id) => artboards.find((f) => f.id === id) ?? []),
    [ids, artboards],
  );
  const [format, setFormat] = useState<"png" | "jpeg" | "mp4">("png"),
    [scale, setScale] = useState(1);
  const [transparent, setTransparent] = useState(false),
    [quality, setQuality] = useState(0.92),
    [stillTime, setStillTime] = useState(false);
  const [size, setSize] = useState(1080),
    [fps, setFps] = useState(30),
    [videoQuality, setVideoQuality] = useState<"standard" | "high">("high");
  const [name, setName] = useState(e.frame?.n || doc.metadata.name || "canvas");
  const [progress, setProgress] = useState<{
      fraction: number;
      message: string;
    }>(),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState(""),
    [support, setSupport] = useState<boolean | undefined>();
  const [media, setMedia] = useState<Media>(),
    [mediaError, setMediaError] = useState("");
  const [previewTime, setPreviewTime] = useState(0),
    [playing, setPlaying] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    preview = useRef<HTMLCanvasElement>(null),
    abort = useRef<AbortController | undefined>(undefined);
  const duration = buildSequence(selected).at(-1)?.end ?? 0;
  const dimensions = selected[0]
    ? videoDimensions(selected[0], size)
    : { width: 1080, height: 1080 };
  const bitrate = videoBitrate(
    dimensions.width,
    dimensions.height,
    fps,
    videoQuality,
  );
  const busy = !!progress;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      abort.current?.abort();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setMedia(undefined);
    setMediaError("");
    setPlaying(false);
    setPreviewTime(0);
    if (selected.length)
      void prepareMedia(doc, selected, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setMedia(value);
        })
        .catch((err) => {
          if (!controller.signal.aborted)
            setMediaError(err instanceof Error ? err.message : String(err));
        });
    return () => controller.abort();
  }, [doc, selected]);
  useEffect(() => {
    if (format !== "mp4") return;
    let live = true;
    setSupport(undefined);
    void mp4Support(dimensions.width, dimensions.height, fps, bitrate)
      .then((value) => {
        if (live) setSupport(value);
      })
      .catch(() => {
        if (live) setSupport(false);
      });
    return () => {
      live = false;
    };
  }, [format, dimensions.width, dimensions.height, fps, bitrate]);
  const previewDimensions = selected[0]
    ? videoDimensions(selected[0], 480)
    : { width: 480, height: 480 };
  const renderer = useMemo(
    () =>
      media && selected.length
        ? createSequenceRenderer(
            selected,
            media.children,
            media.images,
            previewDimensions.width,
            previewDimensions.height,
          )
        : undefined,
    [media, selected, previewDimensions.width, previewDimensions.height],
  );
  useEffect(() => () => renderer?.dispose(), [renderer]);
  useEffect(() => {
    const canvas = preview.current,
      first = selected[0];
    if (!canvas || !media || !first) return;
    canvas.width = previewDimensions.width;
    canvas.height = previewDimensions.height;
    const ctx = canvas.getContext("2d")!;
    if (format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (format === "mp4") renderer?.draw(ctx, previewTime);
    else
      drawAnimationFrame(
        ctx,
        first,
        media.children.get(first.id) ?? [],
        stillTime ? Math.min(playhead, sceneDuration(first)) : undefined,
        media.images,
        { ...previewDimensions, transparent: format === "png" && transparent },
      );
  }, [
    renderer,
    media,
    previewTime,
    format,
    selected,
    stillTime,
    playhead,
    transparent,
    previewDimensions.width,
    previewDimensions.height,
  ]);
  useEffect(() => {
    if (!playing || busy || format !== "mp4") return;
    let request = 0,
      previous: number | undefined;
    const tick = (now: number) => {
      const delta =
        previous === undefined ? 0 : Math.min(0.1, (now - previous) / 1000);
      previous = now;
      setPreviewTime((time) => {
        const next = time + delta;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, duration, busy, format]);
  function reorder(index: number, direction: number) {
    const next = [...ids],
      other = index + direction;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    setIds(next);
  }
  async function runExport() {
    if (busy || !selected.length) return;
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    setPlaying(false);
    setProgress({ fraction: 0, message: "Preparing export…" });
    const update = (fraction: number, message: string) => {
      if (!controller.signal.aborted) setProgress({ fraction, message });
    };
    try {
      let result: { blob: Blob; name: string };
      if (format === "mp4") {
        const blob = await exportVideo(
          doc,
          selected,
          { ...dimensions, fps, bitrate },
          controller.signal,
          update,
        );
        result = {
          blob,
          name:
            exportFilename(
              (name.trim() || "canvas").replace(/\.(png|jpe?g|mp4|zip)$/i, ""),
            ) + ".mp4",
        };
      } else
        result = await exportImages(
          doc,
          selected,
          {
            format,
            scale,
            transparent,
            quality,
            time: stillTime ? playhead : undefined,
            name,
          },
          controller.signal,
          update,
        );
      controller.signal.throwIfAborted();
      setSaving(true);
      update(1, "Saving export…");
      const saved = await saveExport(result.blob, result.name);
      if (controller.signal.aborted) return;
      e.notify(exportMessage(saved));
      if (saved.status !== "cancelled") onClose();
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abort.current === controller) {
        abort.current = undefined;
        setProgress(undefined);
        setSaving(false);
      }
    }
  }
  return (
    <dialog
      className="modal-dialog media-export-dialog"
      ref={dialog}
      aria-labelledby="media-export-title"
      onCancel={(ev) => {
        ev.preventDefault();
        if (!busy) onClose();
        else if (!saving) abort.current?.abort();
      }}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onClose();
      }}
      onKeyDown={(ev) => ev.stopPropagation()}
    >
      <header className="modal-head">
        <div>
          <h2 id="media-export-title">Export canvas</h2>
          <p>Images or an animated video from your frames</p>
        </div>
        <button
          className="icon-btn"
          aria-label="Close export"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="media-export-body">
        <section className="export-preview-column" aria-label="Export preview">
          <div
            className={`export-preview${format === "png" && transparent ? " checkerboard" : ""}`}
          >
            {media && selected.length ? (
              <canvas
                ref={preview}
                aria-label={
                  format === "mp4"
                    ? "Video sequence preview"
                    : "First selected frame preview"
                }
              />
            ) : (
              <p role="status">
                {mediaError ||
                  (selected.length
                    ? "Loading preview…"
                    : "Select frames to preview")}
              </p>
            )}
          </div>
          {format === "mp4" && (
            <div className="sequence-preview-controls">
              <button
                disabled={!media || busy || !duration}
                onClick={() => {
                  if (previewTime >= duration) setPreviewTime(0);
                  setPlaying(!playing);
                }}
              >
                <Icon name={playing ? "pause" : "play"} size={15} />
                {playing ? "Pause preview" : "Play sequence"}
              </button>
              <output>
                {previewTime.toFixed(2)} / {duration.toFixed(2)} s
              </output>
              <input
                aria-label="Sequence playhead"
                type="range"
                min={0}
                max={duration || 1}
                step={0.01}
                value={Math.min(previewTime, duration)}
                disabled={busy}
                onChange={(ev) => {
                  setPlaying(false);
                  setPreviewTime(Number(ev.target.value));
                }}
              />
            </div>
          )}
          <p className="hint">
            {format === "mp4"
              ? "Scenes follow the order below. Different aspect ratios are fitted without cropping. Video is silent."
              : selected.length > 1
                ? `${selected.length} separate images, packaged in one ZIP file. Preview shows the first selected frame.`
                : "Preview shows the selected frame."}
          </p>
          <fieldset className="export-frames" disabled={busy}>
            <legend>Frames {format === "mp4" ? "/ scene order" : ""}</legend>
            <div className="row">
              <button onClick={() => setIds(artboards.map((f) => f.id))}>
                Select all
              </button>
              <button disabled={!ids.length} onClick={() => setIds([])}>
                Clear
              </button>
              <span>{ids.length} selected</span>
            </div>
            <div className="export-frame-list">
              {[
                ...selected,
                ...artboards.filter((f) => !ids.includes(f.id)),
              ].map((frame) => {
                const index = ids.indexOf(frame.id);
                return (
                  <div className="export-frame-row" key={frame.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={index >= 0}
                        onChange={(ev) =>
                          setIds(
                            ev.target.checked
                              ? [...ids, frame.id]
                              : ids.filter((id) => id !== frame.id),
                          )
                        }
                      />
                      <span>
                        <strong>
                          {index >= 0 ? `${index + 1}. ` : ""}
                          {frame.n}
                        </strong>
                        <small>
                          {Math.round(frame.w)} × {Math.round(frame.h)}
                          {format === "mp4"
                            ? ` · ${sceneDuration(frame)} s`
                            : ""}
                        </small>
                      </span>
                    </label>
                    {index >= 0 && format === "mp4" && (
                      <div className="row">
                        <button
                          aria-label={`Move ${frame.n} earlier`}
                          disabled={index === 0}
                          onClick={() => reorder(index, -1)}
                        >
                          <Icon name="up" size={13} />
                        </button>
                        <button
                          aria-label={`Move ${frame.n} later`}
                          disabled={index === ids.length - 1}
                          onClick={() => reorder(index, 1)}
                        >
                          <Icon name="down" size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        </section>
        <section className="export-options" aria-label="Export settings">
          <fieldset disabled={busy}>
            <div className="field">
              <span id="export-format-label">Format</span>
              <div
                className="segmented"
                role="group"
                aria-labelledby="export-format-label"
              >
                {(["png", "jpeg", "mp4"] as const).map((value) => (
                  <button
                    key={value}
                    className={format === value ? "active" : ""}
                    aria-pressed={format === value}
                    onClick={() => {
                      setFormat(value);
                      setPlaying(false);
                      setError("");
                    }}
                  >
                    <Icon
                      name={value === "mp4" ? "video" : "image"}
                      size={16}
                    />
                    {value === "jpeg" ? "JPG" : value.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {format === "mp4" ? (
              <>
                <div className="field">
                  <span>Resolution (longest side)</span>
                  <SelectField
                    label="Video resolution"
                    value={String(size)}
                    disabled={busy}
                    onChange={(value) => setSize(Number(value))}
                    options={[720, 1080, 1920, 3840].map((value) => ({
                      value: String(value),
                      label: `${value} px${value === 3840 ? " · 4K" : ""}`,
                    }))}
                  />
                </div>
                <div className="field">
                  <span>Frame rate</span>
                  <SelectField
                    label="Frame rate"
                    value={String(fps)}
                    disabled={busy}
                    onChange={(value) => setFps(Number(value))}
                    options={[24, 30, 60].map((value) => ({
                      value: String(value),
                      label: `${value} fps`,
                    }))}
                  />
                </div>
                <div className="field">
                  <span>Quality</span>
                  <SelectField
                    label="Video quality"
                    value={videoQuality}
                    disabled={busy}
                    onChange={(value) =>
                      setVideoQuality(value as "standard" | "high")
                    }
                    options={[
                      { value: "standard", label: "Standard · smaller file" },
                      { value: "high", label: "High · finer detail" },
                    ]}
                  />
                </div>
                <p className="hint">
                  {dimensions.width} × {dimensions.height} px ·{" "}
                  {duration.toFixed(2)} s · H.264
                  <br />
                  Estimated {((duration * bitrate) / 8 / 1e6).toFixed(1)} MB
                </p>
                {support === undefined ? (
                  <p role="status" className="hint">
                    Checking video encoder…
                  </p>
                ) : (
                  !support && (
                    <p className="export-error" role="status">
                      H.264 encoding is unavailable at these settings. Try a
                      lower resolution or use current Chrome, Edge, or Safari.
                    </p>
                  )
                )}
              </>
            ) : (
              <>
                <div className="field">
                  <span>Scale</span>
                  <SelectField
                    label="Image scale"
                    value={String(scale)}
                    disabled={busy}
                    onChange={(value) => setScale(Number(value))}
                    options={[1, 2, 3].map((value) => ({
                      value: String(value),
                      label: `${value}×${value === 1 ? " · original size" : ""}`,
                    }))}
                  />
                </div>
                {format === "png" ? (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={transparent}
                      onChange={(ev) => setTransparent(ev.target.checked)}
                    />
                    Transparent background
                  </label>
                ) : (
                  <label className="field">
                    <span>JPG quality · {Math.round(quality * 100)}%</span>
                    <input
                      aria-label="JPG quality"
                      type="range"
                      min={0.5}
                      max={1}
                      step={0.01}
                      value={quality}
                      onChange={(ev) => setQuality(Number(ev.target.value))}
                    />
                  </label>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={stillTime}
                    onChange={(ev) => setStillTime(ev.target.checked)}
                  />
                  Capture animation at {playhead.toFixed(2)} s
                </label>
                <p className="hint">
                  {selected[0]
                    ? `${Math.round(selected[0].w * scale)} × ${Math.round(selected[0].h * scale)} px for the first frame. `
                    : ""}
                  {stillTime
                    ? "Timing and animations are applied."
                    : "Exports the original editable design."}
                </p>
              </>
            )}
            <label className="field">
              <span>File name</span>
              <input
                aria-label="Export file name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
              />
            </label>
          </fieldset>
          {error && (
            <p className="export-error" role="alert">
              {error}
            </p>
          )}
          {progress && (
            <div className="export-progress" role="status">
              <progress
                max={1}
                value={progress.fraction}
                aria-label="Export progress"
              />
              <span>{progress.message}</span>
            </div>
          )}
        </section>
      </div>
      <footer className="modal-foot">
        <button
          disabled={saving}
          onClick={() => (busy ? abort.current?.abort() : onClose())}
        >
          {busy ? "Cancel export" : "Cancel"}
        </button>
        <button
          className="primary"
          disabled={
            busy || !selected.length || (format === "mp4" && support !== true)
          }
          onClick={() => void runExport()}
        >
          {busy
            ? "Exporting…"
            : format === "mp4"
              ? "Export MP4"
              : selected.length > 1
                ? "Export images as ZIP"
                : `Export ${format === "png" ? "PNG" : "JPG"}`}
        </button>
      </footer>
    </dialog>
  );
}
