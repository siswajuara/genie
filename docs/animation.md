# Canvas animation and exports

Open **Timeline** above the canvas. Select a frame or an element inside a frame to see its tracks. An open timeline stays visible when selection is cleared and displays **No frame selected**. The toggle also opens this empty state directly.

Select **Animation** in the inspector to edit scene duration, the camera, transitions, or the selected layers. Animation changes use the editor's undo history and local document storage. They survive page switching, canvas versions, backups, duplication, and assistant edits. Dragging does not change the original artwork geometry.

## Timeline and inspector

- Play, pause, loop, scrub, and return to the start. Playback pauses when the browser tab is hidden. **Edit canvas** returns to the editable layout; scrubbing or playing resumes the animation preview.
- Move a clip or trim either end. Timing snaps to 0.05 seconds during clip dragging; the inspector accepts exact values. A drag is one undo step, and pointer cancellation restores the initial state.
- Right-click a layer track to set its start/end at the playhead, fill the scene, add fades, or remove animation. Right-click empty track space to stagger unlocked layers. Locked layers remain protected.
- Focus the timeline tracks and use Space to play/pause, arrows to step 1/30 second, Shift+arrows to step one second, and Ctrl/Cmd+Z to undo. Focus a clip and use arrows to move it. Context menus support arrow keys and Escape.
- Add entrance/exit effects, continuous motion, and layer depth. Available effects include fades, directional slides, zoom, perspective zoom, flip, and spin. Continuous motion includes float, pulse, pan, zoom, and dolly.
- Add keyframes at the playhead. Set their local time, X/Y offsets, scale, rotation, opacity, Y-axis rotation, depth translation, and easing. Drag diamonds to retime them; Delete removes a focused keyframe. Keyframe times are relative to the clip start. Trimmed keys remain recoverable or can be deleted in the inspector.
- **Reduce motion** defaults to the operating-system preference and keeps visibility timing while suppressing fades and transforms in the editor preview. Playback is explicitly user initiated. Export preserves the authored motion.

Layer animations compose in this order: continuous motion, entrance/exit, then keyframe offsets/multipliers. Keyframes hold their endpoint values outside their keyed interval. Short clips automatically fit entrance and exit durations within their lifetime. Layer visibility is clipped to the scene duration.

Scene camera motion uses frame-centered pan/zoom and perspective dolly. Positive layer depth increases parallax. Perspective zoom/flip and Y rotation project editable 2D layers as textured planes; these are not imported 3D meshes.

## Templates

All 13 built-in templates are six seconds long. Headlines reveal first, content cards and their contents use shared timing, supporting artwork enters next, and mascots have a restrained two-pixel float. Every entrance completes before two seconds, leaving at least four seconds with all text visible. Text stays steady after its entrance. Footers enter together. Default scene transitions are cuts, so all 13 templates export as exactly 78 seconds.

The motion definitions live in `src/editor/templateAnimation.ts`; the original artwork and copy remain in `src/editor/presets.json`. Applying or replacing a template copies its scene settings and per-element animation into the document. Saved frame presets retain customized scene settings. Legacy template presets receive six-second defaults when loaded; existing customized animation is preserved.

## Export

**Export** opens a modal with a preview, selectable frames, and format settings. It captures the current document when opened.

- **PNG**: one image or an ordered ZIP of separate images; 1×/2×/3× scale; optional transparent background.
- **JPG**: one image or a ZIP of separate images; scale and quality controls. Transparent areas flatten onto white.
- Images normally capture the original design. Enable **Capture animation** to render the editor playhead time instead, clamped to each scene's duration.
- **MP4**: selected frames become an ordered, silent H.264 sequence. Reorder scenes with the up/down controls, preview the complete sequence, and choose resolution, 24/30/60 fps, and quality. Different scene aspect ratios fit within the first selected frame's aspect ratio without cropping. Smaller artwork is not enlarged, apart from rounding dimensions to even numbers for H.264.
- Transitions belong to the outgoing frame. Crossfade, slides, wipe, and zoom overlap scenes by the requested duration, capped at half of either adjacent scene. The final scene has no outgoing overlap. The dialog shows the resulting total duration.
- Progress and cancellation cover loading, image rendering, ZIP creation, and MP4 encoding. Native saves use the desktop save dialog; browser exports download locally. No server rendering or provider calls are used.

H.264 availability is checked against the chosen resolution, frame rate, and bitrate using [MediaBunny's encoding capability API](https://mediabunny.dev/guide/supported-formats-and-codecs). Unsupported settings disable video export with an explanation. Encoding uses awaited canvas samples with deterministic timestamps, rather than recording wall-clock playback; see [MediaBunny media sources](https://mediabunny.dev/guide/media-sources).

Limits: 0.1–600 seconds per scene, at most 100 keyframes per element, at most ten minutes per MP4, estimated MP4 size up to 256 MB, ZIP image data up to 256 MB, and 64 megapixels/16,384 pixels per side for still images. Missing fonts/images and inaccessible cross-origin images produce actionable errors instead of silently missing content.

## Document contract

Optional `scene` belongs to frame elements; optional `animation` belongs to non-frame elements. The canvas remains `version: 1`, and its ownership remains conversation → canvas → pages → frames. `sidecar/canvas.schema.json` describes both fields, runtime import validation checks them, and the bridge writes animation instructions into the assistant workspace's `CANVAS.md`.

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

Automated coverage: `bun test tests/animation.test.ts tests/editor.test.ts tests/scene.test.ts tests/export.test.ts tests/identifiers.test.ts tests/conversations.test.ts`. Cases cover default and clipped timing, easing/keyframe interpolation, reduced motion, overlapping scenes, malformed assistant/import data, every animated template, preset round trips, and desktop binary export.

Local Chromium verification exercised exact timing, clip move/trim and undo, keyframe insertion/retiming, preview/play/pause, menus, empty selection, reload persistence, cancellation, PNG/JPG ZIPs, JPG downloads, and MP4 downloads. Ninety-six render cases exercised every effect and motion preset, including perspective on shapes, negative-dimension lines, and images. Pixel checks verified the frame origin, transparent PNG backgrounds, fade endpoints, and crossfade compositing. Broken-image exports reported an error. Compact 760 × 600 and dark layouts were inspected, with no page errors or horizontal overflow.

`ffprobe` verified a two-scene MP4 as H.264, 400 × 300, 30 fps, 105 frames, 3.5 seconds including a 0.5-second overlap. The complete built-in template export was H.264, 400 × 500, 24 fps, 1,872 frames, exactly 78 seconds, with 419 editable source layers. A native macOS WKWebView also encoded a perspective-animation sequence as H.264, 400 × 300, 24 fps, 84 frames, exactly 3.5 seconds. The Rust backend compiled successfully. A packaged desktop application's save dialog and Windows/Linux desktop runtimes were not exercised in this session.

## UI design review

The editor keeps Genie's existing Nunito typography, navy text, blue accent, light/dark surfaces, and compact properties controls. ENERGY 1 / RHYTHM 1 / MOTION 1 applies to the editing UI: controls respond immediately, and motion occurs only in explicitly requested artwork previews. Timeline rows align labels, clips, and time in one scrollable grid; color distinguishes selected timing data. The clock icon opens timing tools; the layers icon explains the missing-frame state. The dialog uses a native modal for focus containment and Escape handling. No new visual assets are required.

- R-02/R-15/R-16 PASS: interface labels name concrete editing/export actions and contain no promotional claims or decorative em dashes.
- R-03/R-34 PASS: compact and dark screenshots were inspected; the 760-pixel layout had no horizontal overflow.
- R-25 PASS: muted text has 5.40:1 contrast on the light surface and 8.08:1 on the dark surface. New selected labels use the regular text color. New dark-mode primary buttons use a darker blue to keep white labels above 4.5:1.
- R-17/R-18/R-23/R-24/R-28/R-36/R-38 PASS: no marketing metrics, testimonials, new brand assets, navigation, FAQ, or factual policy claims were added.
- R-26/R-27/R-32/R-35 PASS: browser interaction checks covered controls, disabled states, empty selection, loading, errors, cancellation, keyboard undo, and a compiled application build. Native dialog semantics provide modal focus containment.
- Purpose gate PASS: no new decorative gradients, glow, glass, illustrations, or repeated feature cards; the timeline ruler and clip colors encode actual timing and selection.
- Liveliness/quality gate PASS: existing product direction is retained; scene content is the focal point, grouped controls separate settings from preview, and authored template motion follows content roles rather than UI decoration. Original template copy and editable geometry remain intact.
