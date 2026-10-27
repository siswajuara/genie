import { learningModels, learningMetrics } from "./learning.mjs";
import { physicsModels, physicsState } from "./science.mjs";
export const FRAME_CONTEXT_LIMIT = 120000;
const clean = (s) =>
  String(s || "").replace(/\[\/?(?:c|b|i|u)(?:=[^\]]*)?\]/g, "");
function svgText(src) {
  if (typeof src !== "string" || !src.startsWith("data:image/svg+xml"))
    return [];
  let svg;
  try {
    const [head, ...body] = src.split(",");
    svg = /;base64/i.test(head)
      ? new TextDecoder().decode(
          Uint8Array.from(atob(body.join(",")), (c) => c.charCodeAt(0)),
        )
      : decodeURIComponent(body.join(","));
  } catch {
    return [];
  }
  if (svg.length > 2000000) return [];
  const decode = (s) =>
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, dec) => {
        const n = parseInt(hex || dec, hex ? 16 : 10);
        return n <= 0x10ffff ? String.fromCodePoint(n) : "";
      })
      .replace(
        /&(amp|lt|gt|quot|apos);/g,
        (_, k) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[k],
      )
      .replace(/\s+/g, " ")
      .trim();
  return [
    ...svg
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .matchAll(/<(text|title|desc)\b[^>]*>([\s\S]*?)<\/\1>/gi),
  ]
    .map((m) => decode(m[2]))
    .filter(Boolean);
}
function mediaInfo(o) {
  const type =
    o.t === "video"
      ? "video"
      : String(o.src || "").startsWith("data:image/svg+xml")
        ? "svg"
        : "image";
  const embedded = String(o.src || "").startsWith("data:"),
    vectorText = type === "svg" ? svgText(o.src) : [];
  return {
    type,
    present: !!o.src,
    embedded,
    name: o.label || o.n,
    description: o.aiDescription || "",
    ...(vectorText.length ? { vectorText } : {}),
    contentStatus: o.aiDescription
      ? "described"
      : vectorText.length
        ? "vector-text-only"
        : o.src
          ? "needs-description"
          : "empty-slot",
    note:
      type === "video"
        ? "Video pixels and sound are not observed by this text API; use a description and transcript/captions."
        : "Pixel contents are not observed by this text API; filenames are not proof of image contents.",
  };
}
export function buildFrameContext(document, selectedIds = [], options = {}) {
  const ids = new Set(selectedIds),
    elements = document.elements || [],
    all = elements.filter((o) => o.t === "frame");
  const selected = all.filter(
    (f) =>
      ids.has(f.id) || elements.some((o) => o.fid === f.id && ids.has(o.id)),
  );
  const targets = (selected.length ? selected : all)
    .slice()
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const context = {
    version: 1,
    canvasName: document.metadata?.name || "",
    metadata: structuredClone(document.metadata || {}),
    sampleTime: Number.isFinite(options.time) ? Math.max(0, options.time) : 0,
    coordinateUnits: "canvas pixels; not physical measurement units",
    frames: [],
  };
  for (const frame of targets) {
    const layers = elements
      .filter((o) => o.fid === frame.id)
      .map((o) => {
        const layer = {};
        for (const [key, value] of Object.entries(o))
          if (
            !["src", "audioTracks", "voiceoverDraft", "subtitles"].includes(
              key,
            ) &&
            value !== undefined
          )
            layer[key] = structuredClone(value);
        if (o.text !== undefined) layer.readableText = clean(o.text);
        if (o.latex || o.physics || o.learning)
          layer.renderedLabels = svgText(o.src);
        if (o.latex)
          layer.equation = {
            source: o.latex.source,
            notation: "math-only LaTeX",
          };
        if (o.learning)
          layer.teaching = {
            subject: learningModels[o.learning.kind]?.subject,
            model: learningModels[o.learning.kind]?.label,
            parameters: o.learning,
            metrics: learningMetrics(o.learning),
            rules: learningModels[o.learning.kind]?.description,
          };
        if (o.physics)
          layer.teaching = {
            subject: "physics",
            model: physicsModels[o.physics.kind]?.label,
            parameters: o.physics,
            stateAtSample: physicsState(o.physics, context.sampleTime),
            rules:
              physicsModels[o.physics.kind]?.description ||
              "Use the documented analytical model assumptions and SI units.",
          };
        if (
          (o.t === "img" || o.t === "video") &&
          !o.latex &&
          !o.physics &&
          !o.learning
        )
          layer.media = mediaInfo(o);
        return layer;
      });
    context.frames.push({
      id: frame.id,
      name: frame.n,
      geometry: { x: frame.x, y: frame.y, width: frame.w, height: frame.h },
      description: frame.aiDescription || "",
      hidden: !!frame.hide,
      appearance: Object.fromEntries(
        Object.entries(frame).filter(
          ([key]) =>
            !["src", "audioTracks", "voiceoverDraft", "subtitles"].includes(
              key,
            ),
        ),
      ),
      scene: frame.scene || {},
      layers,
      subtitles: structuredClone(frame.subtitles || []),
      narration: frame.voiceoverDraft?.script || "",
      audio: (frame.audioTracks || []).map(({ src, ...track }) => ({
        ...track,
        present: !!src,
        contentStatus:
          track.role === "voiceover" &&
          (frame.voiceoverDraft?.script || frame.subtitles?.length)
            ? "script-or-captions-available"
            : "needs-transcript",
      })),
    });
  }
  return context;
}
export function validateFrameContext(raw) {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    raw.version !== 1 ||
    !Array.isArray(raw.frames)
  )
    throw Error("Invalid frame context.");
  let encoded;
  try {
    encoded = JSON.stringify(raw);
  } catch {
    throw Error("Invalid frame context.");
  }
  if (encoded.length > FRAME_CONTEXT_LIMIT)
    throw Error(
      "Frame context is too large. Select fewer frames before using AI; no content was silently dropped.",
    );
  if (
    raw.frames.some(
      (f) => !f || typeof f.id !== "string" || !Array.isArray(f.layers),
    )
  )
    throw Error("Invalid frame context.");
  // Binary media and credentials are never part of a text-only context request.
  if (
    /"(?:src|base64|data)"\s*:\s*"data:(?:image|audio|video)\//i.test(encoded)
  )
    throw Error(
      "Frame context must contain semantic data, not embedded media bytes.",
    );
  return raw;
}
export function readableFrameText(context) {
  const parts = [];
  for (const frame of context.frames) {
    if (frame.description) parts.push(frame.description);
    for (const o of frame.layers) {
      if (
        o.hide ||
        o.brandRole === "logo" ||
        o.brandRole === "footer" ||
        o.generationRole === "fixed" ||
        o.generationRole === "page-number"
      )
        continue;
      if (o.readableText) parts.push(o.readableText);
      if (o.equation) parts.push(`LaTeX: ${o.equation.source}`);
      if (o.teaching)
        parts.push(
          `${o.teaching.model}: ${JSON.stringify(o.teaching.parameters)}; ${JSON.stringify(o.teaching.metrics || o.teaching.stateAtSample)}`,
        );
      if (o.media) {
        if (o.media.description) parts.push(o.media.description);
        if (o.media.vectorText?.length) parts.push(...o.media.vectorText);
      }
      if (!o.readableText && !o.teaching && !o.equation && !o.media)
        parts.push(
          `${o.n || o.t}: ${o.t}, ${o.w}×${o.h} px${o.aiDescription ? `; ${o.aiDescription}` : ""}`,
        );
    }
    if (frame.subtitles.length)
      parts.push(
        "Caption/transkrip: " +
          frame.subtitles.map((c) => c.text || "").join(" "),
      );
    if (frame.narration) parts.push("Draf narasi: " + frame.narration);
  }
  return parts.join("\n\n");
}
export function contextCoverage(context) {
  const layers = context.frames.flatMap((f) => f.layers);
  return {
    frames: context.frames.length,
    layers: layers.length,
    mediaNeedingDescription: layers
      .filter(
        (o) =>
          o.brandRole !== "logo" &&
          o.brandRole !== "footer" &&
          o.generationRole !== "fixed" &&
          ["needs-description", "vector-text-only"].includes(
            o.media?.contentStatus,
          ),
      )
      .map((o) => ({ id: o.id, name: o.n })),
    audioNeedingTranscript: context.frames.flatMap((f) =>
      f.audio
        .filter((a) => a.contentStatus === "needs-transcript")
        .map((a) => ({ id: a.id, name: a.name })),
    ),
    characters: JSON.stringify(context).length,
  };
}
