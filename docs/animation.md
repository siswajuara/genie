# Canvas animation and exports

Open **Timeline** above the canvas. Select a frame or an element inside a frame to see its tracks. An open timeline stays visible when selection is cleared and displays **No frame selected**. The toggle also opens this empty state directly.

Select **Animation** in the inspector to edit scene duration, the camera, transitions, or the selected layers. Animation changes use the editor's undo history and local document storage. They survive page switching, canvas versions, backups, duplication. Dragging does not change the original artwork geometry.

## Timeline and inspector

- Lucide transport controls play, pause, loop, step individual frames, and jump to either end. Choose 24/30/60 fps for stepping and snapping, and 0.25×–2× for preview speed. Playback pauses when the browser tab is hidden. **Edit canvas** returns to the editable layout; scrubbing or playing resumes the animation preview.
- Move a clip or trim either end. Snapping uses the chosen frame grid plus nearby clip/keyframe boundaries and the playhead. Toggle the magnet or hold Alt while dragging to move freely. The inspector accepts exact values. A drag is one undo step, and pointer cancellation restores the initial state.
- Shift-click layer labels to select a range; Ctrl/Cmd-click toggles individual layers. Drag selected clips together while preserving relative offsets and respecting scene bounds. Locked layers remain protected.
- Right-click a layer track to set its start/end at the playhead, fill the scene, add fades/keyframes, align selected starts, copy/paste animation, or remove animation. Pasting to non-text layers omits text-specific settings. Right-click empty track space to stagger unlocked layers.
- Focus the timeline tracks and use Space to play/pause, arrows to step one video frame, Shift+arrows to step one second, Home/End to jump, K to add a keyframe, comma/period to navigate keys, and Ctrl/Cmd+Z to undo. Focus a clip and use arrows to move selected clips by one frame (Shift: ten frames). Context menus support arrow keys and Escape.
- Set the playback range with I/O or the range buttons, then drag its ruler handles to adjust it. Looping honors this range. Clear the range to play the complete scene.
- Search layers or filter to selected, animated, or text tracks. Fit the timeline to its available width or choose a zoom level; playback follows the playhead horizontally. Drag the top separator to resize the track area, or focus it and press Up/Down.
- Entrance/exit effects include fades, slides, zoom, perspective zoom, flip, spin, pop, bounce, elastic, rise/drop, swing, rotation, zoom-out, and directional masked reveals. Continuous motion adds sway, rock, orbit, breathe, vertical pan, and clockwise/counterclockwise rotation to float, pulse, zoom, and dolly. Camera rotation also rotates layer positions around the scene center.
- Add keyframes at the playhead. Set their local time, X/Y offsets, scale, rotation, opacity, Y-axis rotation, depth translation, and easing. Drag diamonds to retime them; Delete removes a focused keyframe. Keyframe times are relative to the clip start. Trimmed keys remain recoverable or can be deleted in the inspector.
- **Reduce motion** defaults to the operating-system preference and keeps visibility timing while suppressing fades and transforms in the editor preview. Playback is explicitly user initiated. Export preserves the authored motion.

Layer animations compose in this order: continuous motion, entrance/exit, keyframe offsets/multipliers, then glyph reveals. Keyframes hold their endpoint values outside their keyed interval. Short clips automatically fit entrance and exit durations within their lifetime. Layer visibility is clipped to the scene duration.

## Text animation

Select an editable text layer and open **Animation → Text reveal**. Choose typewriter, word-by-word, line-by-line, character fade, character rise, word rise, word pop, or wave. Set reveal duration, delay, reverse order, and easing where applicable. Text reveals can combine with layer movement and keyframes.

The renderer measures the complete text before revealing glyphs. Center/right alignment, inline colors, outlines, curved text, and line breaks retain their positions throughout playback and export. Unicode grapheme segmentation keeps combining accents and emoji sequences together; word segmentation uses language-aware browser segmentation. Text remains one editable layer with its full original string. Reduced-motion editor previews show the complete text.

Scene camera motion uses frame-centered pan/zoom and perspective dolly. Positive layer depth increases parallax. Perspective zoom/flip and Y rotation project editable 2D layers as textured planes; these are not imported 3D meshes.

## Templates

All 13 built-in templates are six seconds long. Headlines use character-rise reveals, longer content uses word-by-word reveals, content cards and their contents use shared entrance timing, supporting artwork enters next, and mascots have a restrained two-pixel float. Reveals finish before two seconds, leaving at least four seconds with all text visible. Text stays steady after its entrance. Footers enter together. Default scene transitions are cuts, so all 13 templates export as exactly 78 seconds.

The motion definitions live in `src/editor/template-animation.ts`; the original artwork and copy remain in `src/editor/presets.json`. Applying or replacing a template copies its scene settings and per-element animation into the document. Saved frame presets retain customized scene settings. Legacy template presets receive six-second defaults when loaded; existing customized animation is preserved.

## Export

**Export** opens a modal with a preview, selectable frames, and format settings. It captures the current document when opened.

Resolution, frame rate, quality, and image scale use the app's Radix custom select component. Menus mount inside the modal so they remain visible and interactive in the browser's top layer. Keyboard navigation, type-ahead, selection, and Escape work without closing the underlying export dialog.

- **PNG**: one image or an ordered ZIP of separate images; 1×/2×/3× scale; optional transparent background.
- **JPG**: one image or a ZIP of separate images; scale and quality controls. Transparent areas flatten onto white.
- Images normally capture the original design. Enable **Capture animation** to render the editor playhead time instead, clamped to each scene's duration.
- **MP4**: selected frames become an ordered, silent H.264 sequence. Reorder scenes with the up/down controls, preview the complete sequence, and choose resolution, 24/30/60 fps, and quality. Different scene aspect ratios fit within the first selected frame's aspect ratio without cropping. Smaller artwork is not enlarged, apart from rounding dimensions to even numbers for H.264.
- Transitions belong to the outgoing frame. Choose crossfade, directional slides/pushes/wipes, circle-in/out, diamond, blinds, fade-through-black/white, zoom/zoom-out, or spin; set duration and easing in the scene inspector. Transitions overlap scenes by the requested duration, capped at half of either adjacent scene. The final scene has no outgoing overlap. The dialog shows the resulting total duration.
- Progress and cancellation cover loading, image rendering, ZIP creation, and MP4 encoding. Native saves use the desktop save dialog; browser exports download locally. No server rendering or provider calls are used.

H.264 availability is checked against the chosen resolution, frame rate, and bitrate using [MediaBunny's encoding capability API](https://mediabunny.dev/guide/supported-formats-and-codecs). Unsupported settings disable video export with an explanation. Encoding uses awaited canvas samples with deterministic timestamps, rather than recording wall-clock playback; see [MediaBunny media sources](https://mediabunny.dev/guide/media-sources).

Limits: 0.1–600 seconds per scene, at most 100 keyframes per element, at most ten minutes per MP4, estimated MP4 size up to 256 MB, ZIP image data up to 256 MB, and 64 megapixels/16,384 pixels per side for still images. Missing fonts/images and inaccessible cross-origin images produce actionable errors instead of silently missing content.

## Document contract

Optional `scene` belongs to frame elements; optional `animation` belongs to non-frame elements. The canvas remains `version: 1`, and its ownership remains canvas → pages → frames. `sidecar/canvas.schema.json` describes both fields, runtime import validation checks them.

```json
{
  "scene": {
    "duration": 6,
    "transition": { "type": "crossfade", "duration": 0.5 },
    "camera": { "preset": "dolly-in", "amount": 20, "easing": "ease-in-out" }
  }
}
```

```json
{
  "animation": {
    "start": 0.3,
    "end": 6,
    "depth": 35,
    "text": {
      "preset": "word-rise",
      "duration": 1.2,
      "delay": 0,
      "easing": "ease-out",
      "reverse": false
    },
    "enter": {
      "preset": "slide-down",
      "duration": 0.5,
      "easing": "ease-out",
      "amount": 24
    },
    "keyframes": [
      {
        "time": 0,
        "x": 0,
        "y": 0,
        "scale": 1,
        "rotation": 0,
        "opacity": 1,
        "rotateY": 0,
        "z": 0,
        "easing": "linear"
      },
      {
        "time": 2,
        "x": 30,
        "y": 0,
        "scale": 1.1,
        "rotation": 0,
        "opacity": 1,
        "rotateY": 15,
        "z": 0,
        "easing": "ease-in-out"
      }
    ]
  }
}
```

## Validation record

Automated coverage: `bun test tests/text-animation.test.ts tests/animation.test.ts tests/editor.test.ts tests/scene.test.ts tests/export.test.ts tests/identifiers.test.ts tests/conversations.test.ts`. Cases cover Unicode segmentation, text reveal timing, layout-preserving reveal units, effect endpoints, schema/UI preset synchronization, group movement and bounds, snapping, default and clipped timing, easing/keyframe interpolation, reduced motion, overlapping scenes, malformed assistant/import data, every animated template, preset round trips, and desktop binary export. These 44 tests and the nine sidecar/skill/lockfile checks passed.

Local Chromium verification exercised exact timing, clip move/trim and undo, keyframe insertion/retiming, preview/play/pause, menus, empty selection, reload persistence, cancellation, PNG/JPG ZIPs, JPG downloads, and MP4 downloads. Ninety-six render cases exercised every effect and motion preset, including perspective on shapes, negative-dimension lines, and images. Pixel checks verified the frame origin, transparent PNG backgrounds, fade endpoints, and crossfade compositing. Broken-image exports reported an error. Compact 760 × 600 and dark layouts were inspected, with no page errors or horizontal overflow.

Expanded Chromium verification passed frame stepping, speed, playback range/loop, filters, grouped clip movement and undo, keyframe navigation, animation copy/paste, resizing, custom dropdown containment and Escape, plus an 11.5-second H.264 MP4 at 24 fps (276 frames). An additional 346 render cases covered all 22 layer-effect options, 17 motion options, nine text options, and 23 scene-transition options, including their None/Cut choices. Glyph checks verified that partial reveals retain the full-layout glyph positions and inline colors, including an accent spanning a color tag. The native WKWebView test also passed word-rise text and a circular scene transition. The complete template set was re-encoded with the new reveals and retained exactly 78 seconds at 24 fps.

`ffprobe` verified a two-scene MP4 as H.264, 400 × 300, 30 fps, 105 frames, 3.5 seconds including a 0.5-second overlap. The complete built-in template export was H.264, 400 × 500, 24 fps, 1,872 frames, exactly 78 seconds, with 419 editable source layers. A native macOS WKWebView also encoded a perspective-animation sequence as H.264, 400 × 300, 24 fps, 84 frames, exactly 3.5 seconds. The Rust backend compiled successfully. A packaged desktop application's save dialog and Windows/Linux desktop runtimes were not exercised in this session.

## UI design review

The editor keeps Genie's existing Nunito typography, navy text, blue accent, light/dark surfaces, and compact properties controls. ENERGY 1 / RHYTHM 1 / MOTION 1 applies to the editing UI: controls respond immediately, and motion occurs only in explicitly requested artwork previews. Timeline rows align labels, clips, and time in one scrollable grid; color distinguishes selected timing data. Lucide film, play/pause, step, repeat, keyframe, fit, and magnet icons identify their corresponding timeline actions; the layers icon explains the missing-frame state. The dialog uses a native modal for focus containment, custom dropdowns for settings, and Escape handling. No new visual assets are required.

- R-02/R-15/R-16 PASS: interface labels name concrete editing/export actions and contain no promotional claims or decorative em dashes.
- R-03/R-34 PASS: compact and dark screenshots were inspected; the 760-pixel layout had no horizontal overflow.
- R-25 PASS: muted text has 5.40:1 contrast on the light surface and 8.08:1 on the dark surface. New selected labels use the regular text color. New dark-mode primary buttons use a darker blue to keep white labels above 4.5:1.
- R-17/R-18/R-23/R-24/R-28/R-36/R-38 PASS: no marketing metrics, testimonials, new brand assets, navigation, FAQ, or factual policy claims were added.
- R-26/R-27/R-32/R-35 PASS: browser interaction checks covered controls, disabled states, empty selection, loading, errors, cancellation, keyboard undo, and a compiled application build. Native dialog semantics provide modal focus containment.
- Purpose gate PASS: no new decorative gradients, glow, glass, illustrations, or repeated feature cards; the timeline ruler and clip colors encode actual timing and selection.
- Liveliness/quality gate PASS: existing product direction is retained; scene content is the focal point, grouped controls separate settings from preview, and authored template motion follows content roles rather than UI decoration. Original template copy and editable geometry remain intact.
