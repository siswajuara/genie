import { Button } from "@/components/ui/button";
import { prepareVideos, disposeVideos, type MediaImages } from "./video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { frames, makeElement, type Element } from "./model";
import { prepareScienceElement, textToEquation } from "./science";
import { detectLatexSource } from "../../sidecar/science.mjs";
import { bounds, hitElements, intersects, reparentOnDrop } from "./scene";
import { renderScene, type RenderCache } from "./render-scene";
import type { Editor } from "./use-editor";
import {
  clipboardElements,
  elementMime,
  isTextInput,
  readClipboardElements,
} from "./transfer";
import { ensureFont } from "../lib/fonts";
import { Icon } from "../components/ui/icon";
import { InlineText } from "./inline-text";
import { resizeFrameLayout } from "./preset-layout";
import {
  assetMime,
  findAsset,
  takeDraggedAssetId,
  type LibraryAsset,
} from "./assets";
import { AssetThumbnail } from "./asset-thumbnail";
import type { AnimationPlayback } from "./use-animation-playback";
import { createSequenceRenderer, type AnimationTextures } from "./animation-renderer";
import { Timeline } from "./timeline";

type Point = { x: number; y: number };
type View = Point & { z: number };
const handles = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];
function rotate(p: Point, o: Element, direction = 1) {
  const cx = o.x + o.w / 2,
    cy = o.y + o.h / 2,
    a = (((o.rot || 0) * Math.PI) / 180) * direction;
  return {
    x: cx + (p.x - cx) * Math.cos(a) - (p.y - cy) * Math.sin(a),
    y: cy + (p.x - cx) * Math.sin(a) + (p.y - cy) * Math.cos(a),
  };
}
export function Canvas({
  editor: e,
  onImage,
  pendingAsset,
  onAssetPlace,
  onAssetCancel,
  playback,
  customAssets = [],
}: {
  editor: Editor;
  onImage: (files: File[], at?: Point) => void | Promise<void>;
  pendingAsset?: LibraryAsset;
  onAssetPlace: (
    asset: LibraryAsset,
    at: Point,
    viewport: { w: number; h: number },
    slotId?: string,
  ) => Promise<void>;
  onAssetCancel: () => void;
  playback: AnimationPlayback;
  customAssets?: LibraryAsset[];
}) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 700 });
  const [view, setView] = useState<View>({ x: 40, y: 30, z: 0.4 });
  const [box, setBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  }>();
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [editing, setEditing] = useState<string>();
  const [menu, setMenu] = useState<Point>();
  const [imageTick, setImageTick] = useState(0);
  const images = useRef<MediaImages>(new Map());
  const rasters = useRef<RenderCache>(new Map());
  const animationTextures = useRef<AnimationTextures>(new Map());
  const sequencePreview = useMemo(() => {
    if (!playback.open || !playback.preview || playback.previewFrames.length < 2)
      return undefined;
    const frame = playback.frame!;
    const scale = Math.min(1, 1280 / Math.max(frame.w, frame.h));
    const width = Math.max(1, Math.round(frame.w * scale));
    const height = Math.max(1, Math.round(frame.h * scale));
    return {
      width, height,
      renderer: createSequenceRenderer(
        playback.previewFrames, e.scene.frameChildren, images.current,
        width, height, playback.reducedMotion,
      ),
    };
  }, [playback.open, playback.preview, playback.previewFrames, e.scene.frameChildren, playback.reducedMotion]);
  useEffect(() => () => sequencePreview?.renderer.dispose(), [sequencePreview]);
  const queuedPointer = useRef<PointerEvent | undefined>(undefined);
  const moveFrame = useRef<number | undefined>(undefined);
  const pointer = useRef<Point | undefined>(undefined);
  useEffect(() => {
    if (pendingAsset) {
      setEditing(undefined);
      canvas.current?.focus();
    }
  }, [pendingAsset]);
  useEffect(() => {
    pointer.current = undefined;
  }, [view]);
  function pastePosition(): Point {
    return (
      pointer.current || {
        x: (size.w / 2 - view.x) / view.z,
        y: (size.h / 2 - view.y) / view.z,
      }
    );
  }
  function addText(value: string, at: Point) {
    if (!value.trim()) return;
    const text = value.replace(/\r\n?/g, "\n"),
      o = makeElement("Text");
    const sized = {
      ...o,
      n: text.split("\n")[0].slice(0, 40) || "Text",
      text,
      align: "left",
      w: Math.min(
        800,
        Math.max(160, ...text.split("\n").map((line) => line.length * 26)),
      ),
      h: Math.max(64, text.split("\n").length * 52),
    };
    const math = detectLatexSource(text);
    if (math) {
      // Pasted math becomes a rendered equation instead of literal text.
      void textToEquation(sized, math)
        .then((ready) => e.add(ready, at))
        .catch(() => e.add(sized, at));
      return;
    }
    e.add(sized, at);
  }
  async function placeTransfer(
    data: DataTransfer,
    at: Point,
  ): Promise<boolean> {
    try {
      const id = data.getData(assetMime) || takeDraggedAssetId() || "";
      const asset =
        customAssets.find((asset) => asset.id === id) || findAsset(id);
      if (asset) {
        const target = hit(at);
        await onAssetPlace(
          asset,
          at,
          { w: size.w / view.z, h: size.h / view.z },
          target?.t === "img" &&
            !target.latex &&
            !target.physics &&
            !target.learning &&
            asset.type !== "video"
            ? target.id
            : undefined,
        );
        return true;
      }
      const kind = data.getData("genie/element");
      if (kind) {
        e.add(await prepareScienceElement(makeElement(kind)), at);
        return true;
      }
      const encoded = data.getData(elementMime) || data.getData("text/plain");
      const elements = readClipboardElements(encoded);
      if (elements) {
        e.paste(elements, at);
        return true;
      }
      const legacyImage = data.getData("genie/image");
      if (legacyImage) {
        e.add({ ...JSON.parse(legacyImage), id: crypto.randomUUID() }, at);
        return true;
      }
      const files = Array.from(
        data.files.length
          ? data.files
          : Array.from(data.items)
              .filter((item) => item.kind === "file")
              .map((item) => item.getAsFile())
              .filter((file): file is File => !!file),
      );
      if (files.length) {
        const images = files.filter(
          (file) =>
            file.type.startsWith("image/") ||
            file.type.startsWith("video/") ||
            /\.(mp4|webm|mov|m4v)$/i.test(file.name) ||
            /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(file.name),
        );
        if (images.length) await onImage(images, at);
        let count = images.length;
        for (const file of files.filter(
          (file) =>
            file.type.startsWith("text/") ||
            /\.(txt|md|csv|json)$/i.test(file.name),
        )) {
          addText(await file.text(), {
            x: at.x + count * 24,
            y: at.y + count * 24,
          });
          count++;
        }
        if (!count)
          e.notify(
            "Drop images, videos, or text files to place them on the canvas.",
          );
        return true;
      }
      const html = data.getData("text/html"),
        parsed = html
          ? new DOMParser().parseFromString(html, "text/html")
          : undefined;
      const url =
        parsed?.querySelector("img")?.getAttribute("src") ||
        data
          .getData("text/uri-list")
          .split("\n")
          .find((line) =>
            /^https?:\/\/[^\s]+\.(png|jpe?g|webp|gif|svg|avif)(?:[?#].*)?$/i.test(
              line,
            ),
          ) ||
        (/^(data:image\/|https?:\/\/[^\s]+\.(png|jpe?g|webp|gif|svg|avif)(?:[?#].*)?$)/i.test(
          encoded.trim(),
        )
          ? encoded.trim()
          : undefined);
      if (url && /^(https?:\/\/|data:image\/)/i.test(url)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        await img.decode();
        e.add(
          {
            id: crypto.randomUUID(),
            t: "img",
            n:
              parsed?.querySelector("img")?.getAttribute("alt") ||
              "Pasted image",
            label: "Pasted image",
            src: url,
            x: 0,
            y: 0,
            w: img.naturalWidth,
            h: img.naturalHeight,
            fit: "contain",
          },
          at,
        );
        return true;
      }
      const text =
        data.getData("text/plain") ||
        parsed?.body.textContent ||
        data.getData("text/uri-list") ||
        "";
      if (text.trim()) {
        addText(text, at);
        return true;
      }
      return false;
    } catch (err) {
      e.notify(
        `Could not place clipboard/drop content: ${err instanceof Error ? err.message : String(err)}`,
      );
      return true;
    }
  }
  async function pasteFromMenu(at: Point) {
    try {
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read(),
          data = new DataTransfer();
        for (const item of items)
          for (const type of item.types) {
            const blob = await item.getType(type);
            if (type.startsWith("image/"))
              data.items.add(
                new File([blob], `Pasted image.${type.split("/")[1]}`, {
                  type,
                }),
              );
            else if (type === "text/plain" || type === "text/html")
              data.setData(type, await blob.text());
          }
        if (await placeTransfer(data, at)) return;
      } else {
        const text = await navigator.clipboard.readText();
        if (text) {
          const data = new DataTransfer();
          data.setData("text/plain", text);
          if (await placeTransfer(data, at)) return;
        }
      }
    } catch {
      /* Keyboard paste still works when the WebView does not allow programmatic clipboard reads. */
    }
    e.paste(undefined, at);
  }
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (isTextInput(event.target) || !event.clipboardData) return;
      event.preventDefault();
      void placeTransfer(event.clipboardData, pastePosition()).then(
        (handled) => {
          if (!handled) e.paste();
        },
      );
    };
    const copy = (event: ClipboardEvent) => {
      if (
        isTextInput(event.target) ||
        !event.clipboardData ||
        !e.selection.length ||
        (window.getSelection()?.toString() && event.target !== canvas.current)
      )
        return;
      event.preventDefault();
      const value = clipboardElements(e.expanded());
      try {
        event.clipboardData.setData(elementMime, value);
      } catch {
        /* Plain JSON also supports clipboard implementations without custom formats. */
      }
      event.clipboardData.setData("text/plain", value);
      e.copySelection();
      if (event.type === "cut") e.remove();
    };
    window.addEventListener("paste", paste);
    window.addEventListener("copy", copy);
    window.addEventListener("cut", copy);
    return () => {
      window.removeEventListener("paste", paste);
      window.removeEventListener("copy", copy);
      window.removeEventListener("cut", copy);
    };
  });
  const drag = useRef<
    | {
        mode: string;
        p: Point;
        doc: typeof e.doc;
        ids: string[];
        object?: Element;
        handle?: number[];
        view: View;
        idSet: Set<string>;
        movingBounds?: { x: number; y: number; w: number; h: number };
        moved?: boolean;
        box?: { x: number; y: number; w: number; h: number };
        snapX?: number[];
        snapY?: number[];
      }
    | undefined
  >(undefined);
  const fit = useCallback(() => {
    const f = e.frame;
    if (!f) return;
    const z = Math.min((size.w - 90) / f.w, (size.h - 100) / f.h, 1);
    setView({
      x: (size.w - f.w * z) / 2 - f.x * z,
      y: (size.h - f.h * z) / 2 - f.y * z + 10,
      z,
    });
  }, [e.frame, size]);
  const fitAll = () => {
    const all = frames(e.doc).filter((f) => !f.hide);
    if (!all.length) return;
    const x = Math.min(...all.map((f) => f.x)),
      y = Math.min(...all.map((f) => f.y));
    const w = Math.max(...all.map((f) => f.x + f.w)) - x,
      h = Math.max(...all.map((f) => f.y + f.h)) - y;
    const z = Math.min((size.w - 80) / w, (size.h - 100) / h, 1);
    setView({
      x: (size.w - w * z) / 2 - x * z,
      y: (size.h - h * z) / 2 - y * z + 10,
      z,
    });
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    fitRef.current();
  }, [size.w, size.h]);
  const selectedFrameId = e.active?.t === "frame" ? e.active.id : undefined;
  useEffect(() => {
    if (selectedFrameId && !drag.current) fitRef.current();
  }, [selectedFrameId]);
  const fontKey = JSON.stringify(
    [
      ...new Set(
        e.doc.elements
          .filter((o) => o.t === "text")
          .map((o) => JSON.stringify([o.font || "Nunito", o.weight || 800])),
      ),
    ].sort(),
  );
  useEffect(() => {
    let live = true;
    const fonts = JSON.parse(fontKey) as string[];
    void Promise.allSettled(
      fonts.map((key) => {
        const [family, weight] = JSON.parse(key) as [string, number];
        return ensureFont(family, weight);
      }),
    ).then((results) => {
      if (!live) return;
      setImageTick((n) => n + 1);
      const failed = results.find((r) => r.status === "rejected");
      if (failed?.status === "rejected") e.notify(String(failed.reason));
    });
    return () => {
      live = false;
    };
  }, [fontKey]);
  const zoom = (z: number, at: Point = { x: size.w / 2, y: size.h / 2 }) =>
    setView((v) => {
      const next = Math.min(4, Math.max(0.05, z));
      return {
        z: next,
        x: at.x - ((at.x - v.x) * next) / v.z,
        y: at.y - ((at.y - v.y) * next) / v.z,
      };
    });
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const wheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const r = node.getBoundingClientRect();
      if (ev.ctrlKey || ev.metaKey)
        zoom(view.z * Math.exp(-ev.deltaY * 0.005), {
          x: ev.clientX - r.left,
          y: ev.clientY - r.top,
        });
      else setView((v) => ({ ...v, x: v.x - ev.deltaX, y: v.y - ev.deltaY }));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  });
  useEffect(() => {
    const sources = new Set(
      e.doc.elements.flatMap((o) => (o.src ? [o.src] : [])),
    );
    for (const src of images.current.keys())
      if (!sources.has(src)) images.current.delete(src);
    for (const o of e.doc.elements)
      if (o.t !== "video" && o.src && !images.current.has(o.src)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        images.current.set(o.src, img);
        img.onload = () => setImageTick((n) => n + 1);
        img.onerror = () => e.notify(`Could not load image: ${o.n}`);
        img.src = o.src;
      }
  }, [e.doc.elements]);
  const videoSources = JSON.stringify(
    e.doc.elements
      .filter((o) => o.t === "video" && o.src)
      .map((o) => ({ id: o.id, t: o.t, src: o.src })),
  );
  useEffect(() => {
    let live = true;
    void prepareVideos(
      images.current,
      JSON.parse(videoSources),
      undefined,
      () => {
        if (live) setImageTick((n) => n + 1);
      },
    ).catch((err) => {
      if (live) e.notify(String(err));
    });
    return () => {
      live = false;
      disposeVideos(images.current);
    };
  }, [videoSources]);
  useEffect(() => {
    const request = requestAnimationFrame(() => {
      const cv = canvas.current;
      if (!cv) return;
      const dpr = window.devicePixelRatio || 1,
        width = Math.round(size.w * dpr),
        height = Math.round(size.h * dpr);
      if (cv.width !== width || cv.height !== height) {
        cv.width = width;
        cv.height = height;
      }
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#d9dce6";
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.translate(view.x, view.y);
      ctx.scale(view.z, view.z);
      renderScene(
        ctx,
        e.scene,
        {
          x: -view.x / view.z,
          y: -view.y / view.z,
          w: size.w / view.z,
          h: size.h / view.z,
        },
        view.z * dpr,
        view.z,
        images.current,
        rasters.current,
        imageTick,
        editing,
        playback.open && playback.preview && playback.frame
          ? {
              frameId: playback.frame.id,
              time: playback.time,
              reducedMotion: playback.reducedMotion,
              textures: animationTextures.current,
              sequence: sequencePreview,
            }
          : undefined,
      );
      ctx.lineWidth = 1.5 / view.z;
      ctx.strokeStyle = "#2f4bd8";
      for (const o of e.selected) {
        if (playback.open && playback.preview) continue;
        if (e.scene.isHidden(o)) continue;
        ctx.save();
        const c = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
        ctx.translate(c.x, c.y);
        ctx.rotate(((o.rot || 0) * Math.PI) / 180);
        ctx.translate(-c.x, -c.y);
        ctx.setLineDash(o.gid ? [5 / view.z, 4 / view.z] : []);
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.setLineDash([]);
        if (e.selected.length === 1 && !e.scene.isLocked(o)) {
          for (const [hx, hy] of handles) {
            ctx.fillStyle = "#fff";
            ctx.fillRect(
              c.x + (hx * o.w) / 2 - 4 / view.z,
              c.y + (hy * o.h) / 2 - 4 / view.z,
              8 / view.z,
              8 / view.z,
            );
            ctx.strokeRect(
              c.x + (hx * o.w) / 2 - 4 / view.z,
              c.y + (hy * o.h) / 2 - 4 / view.z,
              8 / view.z,
              8 / view.z,
            );
          }
          if (o.t !== "frame") {
            ctx.beginPath();
            ctx.moveTo(c.x, o.y);
            ctx.lineTo(c.x, o.y - 30 / view.z);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(c.x, o.y - 30 / view.z, 5 / view.z, 0, 7);
            ctx.fillStyle = "#2f4bd8";
            ctx.fill();
          }
          if (o.t === "line") {
            const len = Math.hypot(o.w, o.h) || 1;
            ctx.fillStyle = "#d64d09";
            ctx.beginPath();
            ctx.arc(
              c.x - (o.h / len) * (o.bend || 0),
              c.y + (o.w / len) * (o.bend || 0),
              6 / view.z,
              0,
              7,
            );
            ctx.fill();
          }
        }
        ctx.restore();
      }
      if (box) {
        ctx.fillStyle = "#2f4bd822";
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
      }
      ctx.strokeStyle = "#db1b67";
      ctx.beginPath();
      if (guides.x !== undefined) {
        ctx.moveTo(guides.x, -view.y / view.z);
        ctx.lineTo(guides.x, (size.h - view.y) / view.z);
      }
      if (guides.y !== undefined) {
        ctx.moveTo(-view.x / view.z, guides.y);
        ctx.lineTo((size.w - view.x) / view.z, guides.y);
      }
      ctx.stroke();
    });
    return () => cancelAnimationFrame(request);
  }, [
    e.doc.elements,
    e.selection,
    view,
    size,
    box,
    guides,
    imageTick,
    editing,
    playback.open,
    playback.preview,
    playback.time,
    playback.frame?.id,
    playback.reducedMotion,
    sequencePreview,
  ]);
  const space = useRef(false);
  useEffect(() => {
    function key(ev: KeyboardEvent) {
      if (
        ev.defaultPrevented ||
        ((ev.target as HTMLElement).closest("button") &&
          (ev.key === "Enter" ||
            (ev.key === " " && !host.current?.matches(":hover"))))
      )
        return;
      if (
        /INPUT|TEXTAREA|SELECT/.test((ev.target as HTMLElement).tagName) ||
        (ev.target as HTMLElement).isContentEditable
      )
        return;
      const k = ev.key.toLowerCase(),
        mod = ev.ctrlKey || ev.metaKey;
      if (mod && ["v", "c", "x"].includes(k)) return;
      if (k === " " && ev.shiftKey) {
        space.current = true;
        ev.preventDefault();
        return;
      }
      if (k === "escape") {
        if (pendingAsset) {
          ev.preventDefault();
          onAssetCancel();
          return;
        }
        if (drag.current) {
          cancelDrag();
          return;
        }
        if (menu) {
          setMenu(undefined);
          return;
        }
        setEditing(undefined);
        e.select([]);
        return;
      }
      if (mod && ["z", "y", "a", "d", "g", "[", "]", "0", "1"].includes(k)) {
        ev.preventDefault();
        if (k === "z") ev.shiftKey ? e.redo() : e.undo();
        if (k === "y") e.redo();
        if (k === "a")
          e.select(
            e.doc.elements
              .filter((o) => !e.scene.isLocked(o) && !e.scene.isHidden(o))
              .map((o) => o.id),
          );
        if (k === "d") e.duplicate();
        if (k === "g") e.group(ev.shiftKey);
        if (k === "[" || k === "]") e.order(k === "]" ? 1 : -1, ev.shiftKey);
        if (k === "0") fit();
        if (k === "1") zoom(1);
        return;
      }
      if (k === "+" || k === "=") zoom(view.z * 1.2);
      if (k === "-") zoom(view.z / 1.2);
      if (k === "delete" || k === "backspace") {
        ev.preventDefault();
        e.remove();
      }
      const delta: Record<string, number[]> = {
        arrowleft: [-1, 0],
        arrowright: [1, 0],
        arrowup: [0, -1],
        arrowdown: [0, 1],
      };
      if (delta[k]) {
        ev.preventDefault();
        const [x, y] = delta[k],
          step = ev.shiftKey ? 10 : 1,
          ids = e
            .expanded()
            .filter(
              (o) =>
                !e.scene.isLocked(o) ||
                (o.fid &&
                  e.selection.includes(o.fid) &&
                  !e.scene.isLocked(e.scene.byId.get(o.fid)!)),
            )
            .map((o) => o.id);
        e.change({
          ...e.doc,
          elements: e.doc.elements.map((o) =>
            ids.includes(o.id)
              ? { ...o, x: o.x + x * step, y: o.y + y * step }
              : o,
          ),
        });
      }
    }
    window.addEventListener("keydown", key);
    const releasePan = () => {
      space.current = false;
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") releasePan();
    };
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", releasePan);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", releasePan);
    };
  });
  function pos(ev: { clientX: number; clientY: number }) {
    const r = canvas.current!.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left - view.x) / view.z,
      y: (ev.clientY - r.top - view.y) / view.z,
    };
  }
  function hit(p: Point, cycle = false) {
    const label = [...e.scene.frames]
      .reverse()
      .find(
        (f) =>
          !f.hide &&
          !f.lock &&
          p.x >= f.x &&
          p.x <= f.x + Math.max(100, f.n.length * 8) / view.z &&
          p.y >= f.y - 32 / view.z &&
          p.y < f.y,
      );
    if (label) return label;
    const hits = hitElements(e.scene, p, 6 / view.z);
    if (cycle && hits.length > 1) {
      const index = hits.findIndex((o) => e.selection.includes(o.id));
      return hits[(index + 1) % hits.length];
    }
    return hits[0];
  }
  function down(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (ev.button === 2) return;
    if (pendingAsset && ev.button === 0 && !space.current) {
      ev.preventDefault();
      setMenu(undefined);
      canvas.current?.focus();
      const at = pos(ev),
        target = hit(at);
      void onAssetPlace(
        pendingAsset,
        at,
        { w: size.w / view.z, h: size.h / view.z },
        target?.t === "img" && pendingAsset.type !== "video"
          ? target.id
          : undefined,
      );
      return;
    }
    setMenu(undefined);
    const p = pos(ev);
    let mode = "box",
      ids: string[] = [],
      handle: number[] | undefined;
    const o = e.active;
    if (space.current || ev.button === 1) mode = "pan";
    else if (
      o &&
      !e.scene.isLocked(o) &&
      !e.scene.isHidden(o) &&
      e.selected.length === 1
    ) {
      const q = rotate(p, o, -1),
        cx = o.x + o.w / 2,
        cy = o.y + o.h / 2;
      handle = handles.find(
        ([hx, hy]) =>
          Math.hypot(q.x - cx - (hx * o.w) / 2, q.y - cy - (hy * o.h) / 2) <
          10 / view.z,
      );
      if (handle) mode = "resize";
      else if (
        o.t !== "frame" &&
        Math.hypot(q.x - cx, q.y - o.y + 30 / view.z) < 12 / view.z
      )
        mode = "rotate";
      else if (o.t === "line") {
        const len = Math.hypot(o.w, o.h) || 1;
        if (
          Math.hypot(
            q.x - cx + (o.h / len) * (o.bend || 0),
            q.y - cy - (o.w / len) * (o.bend || 0),
          ) <
          12 / view.z
        )
          mode = "bend";
      }
    }
    if (mode === "box") {
      const object = hit(p, ev.altKey);
      if (object) {
        ids = ev.shiftKey
          ? e.selection.includes(object.id)
            ? e.selection.filter((id) => id !== object.id)
            : [...e.selection, object.id]
          : e.selection.includes(object.id)
            ? e.selection
            : object.gid && !ev.altKey
              ? e.doc.elements
                  .filter((o) => o.gid === object.gid && o.fid === object.fid)
                  .map((o) => o.id)
              : [object.id];
        e.select(ids);
        mode = "move";
      } else e.select([]);
    }
    const selectedIds = new Set(ids);
    const expanded = e.doc.elements
      .filter(
        (q) =>
          (selectedIds.has(q.id) && !e.scene.isLocked(q)) ||
          (q.fid &&
            selectedIds.has(q.fid) &&
            !e.scene.isLocked(e.scene.byId.get(q.fid)!)),
      )
      .map((q) => q.id);
    const chosen = new Set(expanded),
      movingObjects = e.doc.elements.filter((q) => chosen.has(q.id)),
      movingFrames = movingObjects.some((q) => q.t === "frame"),
      parentId = movingObjects.find((q) => q.t !== "frame")?.fid;
    const targets = e.doc.elements.filter(
      (q) =>
        !chosen.has(q.id) &&
        !e.scene.isHidden(q) &&
        (movingFrames
          ? q.t === "frame"
          : q.id === parentId || (q.t !== "frame" && q.fid === parentId)),
    );
    const areas = movingObjects.map(bounds),
      left = Math.min(...areas.map((q) => q.x)),
      top = Math.min(...areas.map((q) => q.y));
    const movingBounds = areas.length
      ? {
          x: left,
          y: top,
          w: Math.max(...areas.map((q) => q.x + q.w)) - left,
          h: Math.max(...areas.map((q) => q.y + q.h)) - top,
        }
      : undefined;
    drag.current = {
      mode,
      p,
      doc: e.doc,
      ids: expanded,
      idSet: chosen,
      movingBounds,
      object: o,
      handle,
      view,
      snapX: targets
        .flatMap((q) => {
          const b = bounds(q);
          return [b.x, b.x + b.w / 2, b.x + b.w];
        })
        .sort((a, b) => a - b),
      snapY: targets
        .flatMap((q) => {
          const b = bounds(q);
          return [b.y, b.y + b.h / 2, b.y + b.h];
        })
        .sort((a, b) => a - b),
    };
    ev.currentTarget.focus();
    ev.currentTarget.setPointerCapture(ev.pointerId);
  }
  function move(ev: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = pos(ev),
      dx = p.x - d.p.x,
      dy = p.y - d.p.y;
    if (!d.moved && Math.hypot(dx, dy) * view.z < 3) return;
    d.moved = true;
    if (d.mode === "pan") {
      const r = canvas.current!.getBoundingClientRect();
      setView({
        ...d.view,
        x: ev.clientX - r.left - d.p.x * d.view.z,
        y: ev.clientY - r.top - d.p.y * d.view.z,
      });
      return;
    }
    if (d.mode === "box") {
      d.box = {
        x: Math.min(d.p.x, p.x),
        y: Math.min(d.p.y, p.y),
        w: Math.abs(dx),
        h: Math.abs(dy),
      };
      setBox(d.box);
      return;
    }
    let mx = dx,
      my = dy;
    const gs: { x?: number; y?: number } = {};
    if (d.mode === "move" && d.ids.length) {
      if (ev.shiftKey) Math.abs(dx) > Math.abs(dy) ? (my = 0) : (mx = 0);
      if (!ev.ctrlKey && !ev.metaKey) {
        const area = d.movingBounds!;
        const left = area.x,
          right = area.x + area.w,
          top = area.y,
          bottom = area.y + area.h;
        const snap = (values: number[], targets: number[], offset: number) => {
          let delta = 7 / view.z,
            result = offset,
            guide: number | undefined;
          for (const value of values) {
            let low = 0,
              high = targets.length;
            while (low < high) {
              const mid = (low + high) >> 1;
              if (targets[mid] < value) low = mid + 1;
              else high = mid;
            }
            for (const index of [low - 1, low]) {
              const target = targets[index];
              if (target !== undefined && Math.abs(target - value) < delta) {
                delta = Math.abs(target - value);
                result = offset + target - value;
                guide = target;
              }
            }
          }
          return { offset: result, guide };
        };
        const x = snap(
            [left + mx, (left + right) / 2 + mx, right + mx],
            d.snapX || [],
            mx,
          ),
          y = snap(
            [top + my, (top + bottom) / 2 + my, bottom + my],
            d.snapY || [],
            my,
          );
        mx = x.offset;
        my = y.offset;
        gs.x = x.guide;
        gs.y = y.guide;
      }
    }
    setGuides(gs);
    let elements = d.doc.elements.map((o) => {
      if (d.mode === "move" && d.idSet.has(o.id))
        return { ...o, x: Math.round(o.x + mx), y: Math.round(o.y + my) };
      if (o.id !== d.object?.id) return o;
      const cx = o.x + o.w / 2,
        cy = o.y + o.h / 2;
      if (d.mode === "rotate") {
        let a = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
        if (ev.shiftKey) a = Math.round(a / 15) * 15;
        return { ...o, rot: Math.round(a) };
      }
      if (d.mode === "bend") {
        const q = rotate(p, o, -1),
          len = Math.hypot(o.w, o.h) || 1;
        return {
          ...o,
          bend: Math.round(
            ((q.x - cx) * -o.h) / len + ((q.y - cy) * o.w) / len,
          ),
        };
      }
      if (d.mode === "resize" && d.handle) {
        const [hx, hy] = d.handle,
          a = ((o.rot || 0) * Math.PI) / 180,
          anchor = ev.altKey
            ? { x: cx, y: cy }
            : rotate({ x: cx - (hx * o.w) / 2, y: cy - (hy * o.h) / 2 }, o),
          px = p.x - anchor.x,
          py = p.y - anchor.y,
          lx = px * Math.cos(a) + py * Math.sin(a),
          ly = -px * Math.sin(a) + py * Math.cos(a),
          factor = ev.altKey ? 2 : 1;
        let w = hx ? Math.max(1, hx * lx * factor) : o.w,
          h = hy ? Math.max(o.t === "line" ? 0 : 1, hy * ly * factor) : o.h;
        if (ev.shiftKey && hx && hy && o.h) {
          const ratio = Math.max(w / o.w, h / o.h);
          w = o.w * ratio;
          h = o.h * ratio;
        }
        const ox = ev.altKey ? 0 : (hx * w) / 2,
          oy = ev.altKey ? 0 : (hy * h) / 2;
        return {
          ...o,
          w: Math.round(w),
          h: Math.round(h),
          x: Math.round(anchor.x + ox * Math.cos(a) - oy * Math.sin(a) - w / 2),
          y: Math.round(anchor.y + ox * Math.sin(a) + oy * Math.cos(a) - h / 2),
        };
      }
      return o;
    });
    if (d.mode === "resize" && d.object?.t === "frame") {
      const after = elements.find((o) => o.id === d.object!.id)!;
      elements = resizeFrameLayout(elements, d.object, after);
    }
    e.change({ ...d.doc, elements }, false);
  }
  const performMove = useRef(move);
  performMove.current = move;
  function queueMove(ev: React.PointerEvent) {
    pointer.current = pos(ev);
    if (!drag.current) return;
    queuedPointer.current = ev.nativeEvent;
    if (moveFrame.current === undefined)
      moveFrame.current = requestAnimationFrame(() => {
        moveFrame.current = undefined;
        const event = queuedPointer.current;
        queuedPointer.current = undefined;
        if (event) performMove.current(event);
      });
  }
  function flushMove() {
    if (moveFrame.current !== undefined)
      cancelAnimationFrame(moveFrame.current);
    moveFrame.current = undefined;
    const event = queuedPointer.current;
    queuedPointer.current = undefined;
    if (event) performMove.current(event);
  }
  useEffect(
    () => () => {
      if (moveFrame.current !== undefined)
        cancelAnimationFrame(moveFrame.current);
    },
    [],
  );
  function up() {
    flushMove();
    const d = drag.current;
    if (!d) return;
    if (d.mode === "box" && d.box) {
      const area = d.box;
      e.select(
        e.scene.paint
          .filter(
            (o) =>
              o.t !== "frame" &&
              !e.scene.isHidden(o) &&
              !e.scene.isLocked(o) &&
              intersects(bounds(o), area),
          )
          .map((o) => o.id),
      );
    }
    if (d.moved && d.mode !== "pan" && d.mode !== "box") {
      const doc = e.current.current;
      e.change({
        ...doc,
        elements:
          d.mode === "move"
            ? reparentOnDrop(doc.elements, d.ids, true)
            : doc.elements,
      });
    }
    drag.current = undefined;
    setBox(undefined);
    setGuides({});
  }
  function cancelDrag() {
    if (moveFrame.current !== undefined)
      cancelAnimationFrame(moveFrame.current);
    moveFrame.current = undefined;
    queuedPointer.current = undefined;
    const d = drag.current;
    if (d?.moved && d.mode !== "pan" && d.mode !== "box")
      e.change(d.doc, false);
    drag.current = undefined;
    setBox(undefined);
    setGuides({});
  }
  const text = e.doc.elements.find((o) => o.id === editing);
  return (
    <section className="canvas-column" aria-label="Canvas editor">
      <div className="canvas-toolbar">
        <div className="row">
          <Button
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!e.canUndo}
            onClick={e.undo}
          >
            <Icon name="undo" />
          </Button>
          <Button
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!e.canRedo}
            onClick={e.redo}
          >
            <Icon name="redo" />
          </Button>
        </div>
        <div className="row">
          <Button
            className="primary"
            aria-label={
              playback.playing ? "Pause scene preview" : "Preview scene"
            }
            title={
              playback.frame
                ? "Preview scene animation"
                : "Select a frame to preview"
            }
            disabled={!playback.frame}
            onClick={playback.toggle}
          >
            <Icon name={playback.playing ? "pause" : "play"} size={16} />
            {playback.playing ? "Pause" : "Preview scene"}
          </Button>
          <Button
            aria-label="Toggle animation timeline"
            title="Show or hide animation timeline"
            aria-pressed={playback.open}
            onClick={() => playback.setOpen(!playback.open)}
          >
            <Icon name="film" size={16} /> Timeline
          </Button>
        </div>
      </div>
      <div
        className={`canvas-stage ${pendingAsset ? "is-placing-asset" : ""}`}
        ref={host}
        onDragOver={(ev) => ev.preventDefault()}
        onDrop={(ev) => {
          ev.preventDefault();
          pointer.current = pos(ev);
          canvas.current?.focus();
          void placeTransfer(ev.dataTransfer, pointer.current);
        }}
      >
        {pendingAsset && (
          <div className="asset-placement-banner" role="status">
            <AssetThumbnail asset={pendingAsset} size={36} />
            <span>
              Click the canvas to place this asset.
              <small>Shift+Space-drag to pan. Space to play.</small>
            </span>
            <Button aria-label="Cancel asset placement" onClick={onAssetCancel}>
              <Icon name="close" size={16} />
            </Button>
          </div>
        )}
        <div className="canvas-zoom" role="toolbar" aria-label="Zoom tools">
          <Button
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => zoom(view.z / 1.2)}
          >
            <Icon name="minus" size={15} />
          </Button>
          <span className="zoom-value">{Math.round(view.z * 100)}%</span>
          <Button
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => zoom(view.z * 1.2)}
          >
            <Icon name="add" size={15} />
          </Button>
          <Button aria-label="Fit frame" title="Fit frame" onClick={fit}>
            <Icon name="fit" size={15} />
          </Button>
          <Button
            aria-label="Fit all"
            title="Fit all"
            disabled={!frames(e.doc).length}
            onClick={fitAll}
          >
            <Icon name="expand" size={15} />
          </Button>
          <Button aria-label="100%" title="100%" onClick={() => zoom(1)}>
            <Icon name="actual" size={15} />
          </Button>
        </div>
        <canvas
          ref={canvas}
          style={{ width: size.w, height: size.h }}
          tabIndex={0}
          aria-label="Design canvas. Use the layers and properties panels for keyboard editing."
          onPointerDown={(ev) => {
            playback.edit();
            down(ev);
          }}
          onPointerMove={queueMove}
          onPointerUp={up}
          onPointerCancel={cancelDrag}
          onDoubleClick={(ev) => {
            const o = hit(pos(ev));
            if (o?.t === "text") {
              e.select([o.id]);
              setEditing(o.id);
            }
          }}
          onContextMenu={(ev) => {
            ev.preventDefault();
            const o = hit(pos(ev));
            if (o && !e.selection.includes(o.id)) e.select([o.id]);
            setMenu({
              x: Math.min(ev.clientX, window.innerWidth - 210),
              y: Math.min(ev.clientY, window.innerHeight - 390),
            });
          }}
        />
        {text && (
          <InlineText
            key={text.id}
            element={text}
            view={view}
            onCommit={(value) => {
              e.patch({ text: value }, [text.id]);
              setEditing(undefined);
            }}
          />
        )}
        {!e.doc.elements.length && (
          <div className="canvas-empty">
            Drop or paste images and text here, or add a frame from Editor.
          </div>
        )}
      </div>
      <Timeline editor={e} playback={playback} />
      {menu && (
        <>
          <div className="menu-dismiss" onClick={() => setMenu(undefined)} />
          <div
            className="context-menu"
            role="menu"
            style={{ left: menu.x, top: menu.y }}
          >
            {[
              ["Copy", e.copySelection],
              [
                "Paste",
                () =>
                  void pasteFromMenu(pos({ clientX: menu.x, clientY: menu.y })),
              ],
              ["Duplicate", e.duplicate],
              ["Group / ungroup", () => e.group()],
              ["Bring forward", () => e.order(1)],
              ["Send backward", () => e.order(-1)],
              ["Bring to front", () => e.order(1, true)],
              ["Send to back", () => e.order(-1, true)],
              ["Lock / unlock", () => e.patch({ lock: !e.active?.lock })],
              ["Hide / show", () => e.patch({ hide: !e.active?.hide })],
              ["Delete", e.remove],
            ].map(([label, action]) => (
              <Button
                role="menuitem"
                key={label as string}
                onClick={() => {
                  (action as () => void)();
                  setMenu(undefined);
                }}
              >
                {label as string}
              </Button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
