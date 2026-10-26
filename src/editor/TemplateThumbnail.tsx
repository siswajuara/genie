import { useEffect, useRef, useState } from "react";
import type { Preset } from "./model";
import { bounds } from "./scene";
import {
  matchLibraryAsset,
  loadAssetThumbnail,
  useAssetLibrary,
} from "./assets";
import { drawElement } from "./reference-renderer";
import { ensureDocumentFonts } from "../lib/fonts";
import { Icon } from "../components/ui/Icon";
import { brandImageSource } from "../lib/brand";

let previews = new WeakMap<Preset, Promise<string>>();
let previewRevision = -1;
const images = new Map<string, Promise<HTMLImageElement | undefined>>();
const waiting: (() => void)[] = [];
let running = 0;
function drain() {
  while (running < 2 && waiting.length) {
    running++;
    waiting.shift()!();
  }
}
function image(src: string) {
  let promise = images.get(src);
  if (!promise) {
    promise = (async () => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      try {
        await img.decode();
        return img;
      } catch {
        return undefined;
      }
    })();
    images.set(src, promise);
    if (images.size > 48) images.delete(images.keys().next().value!);
  }
  return promise;
}
async function render(preset: Preset) {
  const objects = preset.objects.filter((o) => !o.hide);
  await ensureDocumentFonts(objects);
  const areas = objects.map(bounds),
    x =
      preset.kind === "template" || !areas.length
        ? 0
        : Math.min(...areas.map((o) => o.x)),
    y =
      preset.kind === "template" || !areas.length
        ? 0
        : Math.min(...areas.map((o) => o.y));
  const width =
      preset.kind === "template"
        ? preset.W || 1122
        : Math.max(1, ...areas.map((o) => o.x + o.w - x)),
    height =
      preset.kind === "template"
        ? preset.H || 1402
        : Math.max(1, ...areas.map((o) => o.y + o.h - y));
  const scale = Math.min(1, 480 / Math.max(width, height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Preview unavailable.");
  const sources = await Promise.all(
    objects.map(async (o) => {
      if (o.t !== "img") return undefined;
      const embedded =
        o.src || (o.identifier ? brandImageSource(o.identifier) : undefined);
      if (embedded) return embedded;
      const asset = o.identifier ? matchLibraryAsset(o.identifier) : undefined;
      return asset
        ? loadAssetThumbnail(asset).catch(() => undefined)
        : undefined;
    }),
  );
  const loaded = await Promise.all(
    sources.map((src) => (src ? image(src) : undefined)),
  );
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(-x, -y);
  for (let i = 0; i < objects.length; i++)
    drawElement(ctx, { ...objects[i], img: loaded[i] });
  const result = canvas.toDataURL("image/webp", 0.85);
  canvas.width = canvas.height = 1;
  return result;
}
function thumbnail(preset: Preset) {
  let cached = previews.get(preset);
  if (!cached) {
    cached = new Promise<string>((resolve, reject) => {
      waiting.push(() => {
        setTimeout(() => {
          void render(preset)
            .then(resolve, reject)
            .finally(() => {
              running--;
              drain();
            });
        }, 0);
      });
      drain();
    });
    previews.set(preset, cached);
    void cached.catch(() => previews.delete(preset));
  }
  return cached;
}

export function TemplateThumbnail({ preset }: { preset: Preset }) {
  const pack = useAssetLibrary();
  const ref = useRef<HTMLDivElement>(null),
    [src, setSrc] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    if (previewRevision !== pack.revision) {
      previews = new WeakMap();
      previewRevision = pack.revision;
    }
    setSrc("");
    setFailed(false);
    const load = () => {
      void thumbnail(preset)
        .then((value) => {
          if (live) setSrc(value);
        })
        .catch(() => {
          if (live) setFailed(true);
        });
    };
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                observer?.disconnect();
                load();
              }
            },
            { rootMargin: "120px" },
          )
        : undefined;
    if (observer && ref.current) observer.observe(ref.current);
    else load();
    return () => {
      live = false;
      observer?.disconnect();
    };
  }, [preset, pack.revision]);
  return (
    <div ref={ref} className="template-thumbnail" aria-busy={!src && !failed}>
      {src ? (
        <img
          src={src}
          alt={`${preset.name} template preview`}
          decoding="async"
        />
      ) : (
        <span className="template-preview-status">
          <Icon name={failed ? "image" : "layers"} size={22} />
          <span>{failed ? "Preview unavailable" : "Loading preview…"}</span>
        </span>
      )}
    </div>
  );
}
