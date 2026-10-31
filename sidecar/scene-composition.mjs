import { normalizeLearning } from "./learning.mjs";
import { normalizeLatex, normalizePhysics } from "./science.mjs";

export const compositionEffects = [
  "fade",
  "reveal-up",
  "reveal-left",
  "reveal-right",
  "zoom",
  "pop",
];
export const compositionMotions = ["none", "float", "pulse", "breathe", "sway"];
export const compositionTransitions = [
  "cut",
  "crossfade",
  "wipe",
  "slide-left",
  "zoom",
];
const colour = /^#[\da-f]{6}$/i;
const number = (value, min, max) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
const fail = (message) => {
  throw Error(`Scene composition: ${message}`);
};
function keys(value, allowed) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    fail(
      "use only the supplied declarative fields; code, URLs and document IDs are not supported.",
    );
}

export function validateCompositionScene(scene) {
  const c = scene.composition;
  keys(c, ["width", "height", "assets"]);
  if (
    !number(c.width, 200, 16000) ||
    !number(c.height, 200, 16000) ||
    !Array.isArray(c.assets) ||
    c.assets.length > 240
  )
    fail("invalid frame or asset catalog.");
  const seen = new Set();
  for (const asset of c.assets) {
    keys(asset, ["ref", "name", "description", "kind"]);
    if (
      typeof asset.ref !== "string" ||
      !/^[a-z0-9-]{1,100}$/.test(asset.ref) ||
      seen.has(asset.ref) ||
      !["image", "video", "element"].includes(asset.kind) ||
      typeof asset.name !== "string" ||
      !asset.name.trim() ||
      asset.name.length > 200 ||
      typeof asset.description !== "string" ||
      asset.description.length > 600
    )
      fail("invalid asset reference.");
    seen.add(asset.ref);
  }
}

export const compositionDirection = [
  "Use the Animate workflow: plan the true process, choose a story format that fits it, identify one recurring visual device, establish a coherent look, then storyboard every beat before choreographing layers. Also return story:{idea,format,device,look,palette:[3–5 '#RRGGBB' colours]}. idea/format/device/look are short, specific strings (at most 500 chars each). For each frame return direction:{action,framing,bridge}, where action describes the visible change (at most 400 chars), framing is wide/medium/close, and bridge explains the connection to the next scene or opening callback (at most 300 chars). Story, look and storyboard will be reviewed before motion or speech is activated. Do not claim web verification, render inspection, soundtrack generation or measured audio checks; this is a text-only design request grounded in supplied facts.",
  "For scenes with composition, act as the scene designer as well as writer. Start from a blank branded frame, choose the composition, and return composition:{background:'#RRGGBB',layers:[...]} with 1–24 layers in back-to-front drawing order. Optional composition.transition:{type:'cut|crossfade|wipe|slide-left|zoom',duration:0.2..0.8} links this scene to the next; choose it for the story format. Return texts:[]; there are no template text slots. Do not return visual, physics or learning echoes for these scenes; put diagrams in composition.layers.",
  "Each layer has type ('text','rect','ellipse','line','asset','learning','physics','latex'), a short name, x,y,w,h in percentages of the CONTENT SAFE AREA (0–100; x+w<=100, y+h<=100). The editor maps these percentages into pixels below the logo/username and above captions. You own arrangement within this area. Never place duplicate branding, a footer strip, or captions in it. Do not return IDs, groups, executable code, SVG, HTML, paths, URLs, audio files, or arbitrary document properties.",
  "Text layers: text (1–500 chars), fontSize (4.5–12 percent of frame width), weight (400,600,700,800,900), align ('left','center','right'), color ('#RRGGBB'), optional role ('headline','body','cta'). Keep text large enough for phones; shorten copy instead of shrinking it. Shapes: fill ('#RRGGBB' or 'none'), optional stroke ('#RRGGBB') and strokeWidth (0–2 percent of frame width), optional radius (0–5 percent of frame width, rect only). Lines use their box as endpoints. Asset layers: assetRef from this scene's exact supplied asset catalog; do not invent assets. Metadata describes assets but does not mean you have seen their pixels. Learning/physics layers: settings from teachingCatalog. LaTeX layers: source containing math-only LaTeX. Diagrams can also have color. All content stays editable.",
  "Optional per-layer animation:{start:number,enter:string,duration:number,motion:string,amount:number}. start is seconds after scene start, no later than seconds-1; duration 0.15–0.8 seconds; enter is fade/reveal-up/reveal-left/reveal-right/zoom/pop; motion is none/float/pulse/breathe/sway; amount 0–4. Coordinate containing cards and their text on the same start cue. Essential text settles early and stays visible through the end. If omitted the editor applies motionPlan. Avoid constant motion on reading text. Give each scene its own visual idea and staging, with a recurring subject/colour to connect the sequence; vary scale and arrangement. Prefer showing a process or comparison over stacks of identical cards. Use existing assets where they help, never random decoration. Keep text short with generous room; use at least one text layer and a distinct headline per scene.",
  "For movement that explains a process, animation may also contain keyframes:[{time,dx,dy,scale,opacity},...], 2–8 in strictly increasing layer-local seconds. time is 0..(seconds-start), dx/dy are offsets in safe-area percentages (-100..100), scale is 0.5..1, opacity is 0..1. Keep the entire translated box inside the safe area at every key, start with a key at time:0, and settle essential text at opacity:1 and scale:1. The editor translates these to deterministic keyframes. Use this to move a recurring subject, connect cause and effect, or demonstrate change rather than making every layer fade in. Shape-morph bridges, procedural textures, generated artwork and synthesized scores are unavailable; choose staging achievable with these editable layers. Avoid generic gradient title cards, corner labels, particles, and a logo-only ending.",
  "For EVERY closing scene, design a topic-specific resolution and one clear CTA. Include the exact destination siswajuara.com in a visible text layer (role:'cta'). When narrated, say siswajuara dot com in its complete narration. Keep this destination even if source notes suggest another link. Do not default to an unrelated academic-test sales pitch.",
].join("\n");

export function parseStory(value) {
  keys(value, ["idea", "format", "device", "look", "palette"]);
  for (const key of ["idea", "format", "device", "look"])
    if (
      typeof value[key] !== "string" ||
      !value[key].trim() ||
      value[key].length > 500
    )
      fail("include a clear story idea, format, visual device and look.");
  if (
    !Array.isArray(value.palette) ||
    value.palette.length < 3 ||
    value.palette.length > 5 ||
    value.palette.some((c) => !colour.test(c))
  )
    fail("choose 3–5 consistent palette colours.");
  return {
    idea: value.idea.trim(),
    format: value.format.trim(),
    device: value.device.trim(),
    look: value.look.trim(),
    palette: [...value.palette],
  };
}

export function parseDirection(value) {
  keys(value, ["action", "framing", "bridge"]);
  if (
    typeof value.action !== "string" ||
    !value.action.trim() ||
    value.action.length > 400 ||
    !["wide", "medium", "close"].includes(value.framing) ||
    typeof value.bridge !== "string" ||
    !value.bridge.trim() ||
    value.bridge.length > 300
  )
    fail("storyboard each scene's action, framing and bridge.");
  return {
    action: value.action.trim(),
    framing: value.framing,
    bridge: value.bridge.trim(),
  };
}

export function parseComposition(value, scene) {
  keys(value, ["background", "layers", "transition"]);
  if (
    !colour.test(value.background) ||
    !Array.isArray(value.layers) ||
    value.layers.length < 1 ||
    value.layers.length > 24
  )
    fail("return a background and 1–24 editable layers.");
  if (value.transition !== undefined) {
    keys(value.transition, ["type", "duration"]);
    if (
      !compositionTransitions.includes(value.transition.type) ||
      !number(value.transition.duration, 0.2, 0.8)
    )
      fail("unsupported scene transition.");
  }
  const types = [
    "text",
    "rect",
    "ellipse",
    "line",
    "asset",
    "learning",
    "physics",
    "latex",
  ];
  const layers = value.layers.map((layer) => {
    if (!types.includes(layer?.type)) fail("unsupported layer type.");
    const extras = {
      text: ["text", "fontSize", "weight", "align", "color", "role"],
      rect: ["fill", "stroke", "strokeWidth", "radius"],
      ellipse: ["fill", "stroke", "strokeWidth"],
      line: ["stroke", "strokeWidth"],
      asset: ["assetRef"],
      learning: ["settings", "color"],
      physics: ["settings", "color"],
      latex: ["source", "color"],
    };
    keys(layer, [
      "type",
      "name",
      "x",
      "y",
      "w",
      "h",
      "animation",
      ...extras[layer.type],
    ]);
    if (
      typeof layer.name !== "string" ||
      !layer.name.trim() ||
      layer.name.length > 100 ||
      !number(layer.x, 0, 100) ||
      !number(layer.y, 0, 100) ||
      !number(layer.w, 1, 100) ||
      !number(layer.h, 1, 100) ||
      layer.x + layer.w > 100.001 ||
      layer.y + layer.h > 100.001
    )
      fail("layers must fit inside the content safe area.");
    for (const field of ["color", "fill", "stroke"])
      if (
        layer[field] !== undefined &&
        !(field === "fill" && layer[field] === "none") &&
        !colour.test(layer[field])
      )
        fail("use six-digit hex colours.");
    if (layer.strokeWidth !== undefined && !number(layer.strokeWidth, 0, 2))
      fail("invalid stroke width.");
    if (layer.radius !== undefined && !number(layer.radius, 0, 5))
      fail("invalid corner radius.");
    let result = { ...layer, name: layer.name.trim() };
    if (layer.type === "text") {
      if (
        typeof layer.text !== "string" ||
        !layer.text.trim() ||
        layer.text.length > 500 ||
        !number(layer.fontSize, 4.5, 12) ||
        ![400, 600, 700, 800, 900].includes(layer.weight) ||
        !["left", "center", "right"].includes(layer.align) ||
        (layer.role !== undefined &&
          !["headline", "body", "cta"].includes(layer.role))
      )
        fail("invalid editable text layer.");
      result.text = layer.text.trim();
    }
    if (
      layer.type === "asset" &&
      !scene.composition.assets.some((asset) => asset.ref === layer.assetRef)
    )
      fail("choose an asset from the supplied catalog.");
    if (layer.type === "learning")
      result.settings = normalizeLearning(layer.settings);
    if (layer.type === "physics")
      result.settings = normalizePhysics(layer.settings);
    if (layer.type === "latex")
      result.source = normalizeLatex({ source: layer.source }).source;
    if (layer.animation !== undefined) {
      const a = layer.animation;
      keys(a, ["start", "enter", "duration", "motion", "amount", "keyframes"]);
      if (
        !number(a.start, 0, scene.seconds - 1) ||
        !compositionEffects.includes(a.enter) ||
        !number(a.duration, 0.15, 0.8) ||
        !compositionMotions.includes(a.motion) ||
        !number(a.amount, 0, 4)
      )
        fail("unsupported layer animation or timing.");
      result.animation = { ...a };
      if (a.keyframes !== undefined) {
        if (
          !Array.isArray(a.keyframes) ||
          a.keyframes.length < 2 ||
          a.keyframes.length > 8
        )
          fail("use 2–8 movement keys.");
        let previous = -1;
        result.animation.keyframes = a.keyframes.map((k) => {
          keys(k, ["time", "dx", "dy", "scale", "opacity"]);
          if (
            !number(k.time, 0, scene.seconds - a.start) ||
            k.time <= previous ||
            !number(k.dx, -100, 100) ||
            !number(k.dy, -100, 100) ||
            !number(k.scale, 0.5, 1) ||
            !number(k.opacity, 0, 1) ||
            layer.x + k.dx < 0 ||
            layer.x + layer.w + k.dx > 100.001 ||
            layer.y + k.dy < 0 ||
            layer.y + layer.h + k.dy > 100.001
          )
            fail(
              "movement keys must be ordered and remain within the safe area.",
            );
          previous = k.time;
          return { ...k };
        });
        if (a.keyframes[0].time !== 0)
          fail("movement starts with a key at time zero.");
        if (
          layer.type === "text" &&
          (a.keyframes.at(-1).opacity !== 1 || a.keyframes.at(-1).scale !== 1)
        )
          fail("text must settle fully visible.");
      }
    }
    return result;
  });
  if (!layers.some((l) => l.type === "text"))
    fail("include readable scene text.");
  if (
    scene.useCase === "closing" &&
    !layers.some(
      (l) => l.type === "text" && /\bsiswajuara\.com\b/i.test(l.text),
    )
  )
    fail("the closing CTA must visibly include siswajuara.com.");
  return {
    background: value.background,
    layers,
    ...(value.transition ? { transition: { ...value.transition } } : {}),
  };
}
