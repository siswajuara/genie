# Canvas animation and exports

For the complete editing workflow and narration setup, start with the [canvas user guide](canvas.md).

Open **Timeline** above the canvas. Select a frame or an element inside a frame to see its tracks. An open timeline stays visible when selection is cleared and displays **No frame selected**. The toggle also opens this empty state directly.

Select **Animation** in the inspector to edit scene duration, the camera, transitions, or the selected layers. Animation changes use the editor's undo history and local document storage. They survive page switching, canvas versions, backups, duplication. Dragging does not change the original artwork geometry.

## Timeline and inspector

- Lucide transport controls play, pause, loop, step individual frames, and jump to either end. Choose 24/30/60 fps for stepping and snapping, and 0.25×–2× for preview speed. Playback pauses when the browser tab is hidden. **Edit canvas** returns to the editable layout; scrubbing or playing resumes the animation preview.
- Move a clip or trim either end. Snapping uses the chosen frame grid plus nearby clip/keyframe boundaries and the playhead. Toggle the magnet or hold Alt while dragging to move freely. The inspector accepts exact values. A drag is one undo step, and pointer cancellation restores the initial state.
- Shift-click layer labels to select a range; Ctrl/Cmd-click toggles individual layers. Drag selected clips together while preserving relative offsets and respecting scene bounds. Locked layers remain protected.
- Right-click a layer track to set its start/end at the playhead, fill the scene, add fades/keyframes, align selected starts, copy/paste animation, or remove animation. Pasting to non-text layers omits text-specific settings. Right-click empty track space to stagger unlocked layers.
- Space plays/pauses from the canvas or timeline, including focused timeline buttons. Input fields keep normal typing. Focus the timeline tracks and use arrows to step one video frame, Shift+arrows to step one second, Home/End to jump, K to add a keyframe, comma/period to navigate keys, and Ctrl/Cmd+Z to undo. Focus a clip and use arrows to move selected clips by one frame (Shift: ten frames). Context menus support arrow keys and Escape.
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

Templates come from the connected external asset pack. The supplied catalog currently includes 48 templates across Classic, Essentials, Studio, Math & Physics, and Standard. Each preset can declare static motion (`motion: "none"`), automatic choreography (`motion: "auto"`), an explicit scene, or per-layer animation. Do not assume every template has the same duration or reveals.

Automatic choreography lives in `src/editor/template-animation.ts`; absent an explicit duration, it uses a six-second scene. Presets live in `asset-packs/siswa-juara/pack/presets/`, with metadata in `catalog.json`. Applying a template copies its scene settings and layer animations into the document. Later pack edits do not rewrite placed designs.

Saved frame templates retain scene and layer-animation settings, but omit frame-level narration drafts, audio tracks, subtitle cues, and caption style. Duplicate the complete frame or use canvas JSON to retain those fields. Replacing a frame's template preserves its existing frame audio and cues; review them against the new scene duration. See [preset authoring](../design-references/README.md).

## Narration, audio, and captions

Select a frame or one of its layers and open the inspector's **Narration** tab. Draft a script, select the billed ElevenLabs account, and optionally enable matching captions before generating. Configure accounts in **Setting → Audio**. The current voice is fixed to Roger. Generation and transcription use provider credits; local imports, editing, preview, WAV mixing, and media export require no generation request.

Narration, music, and sound effects are saved as embedded frame audio tracks. Import recordings under **Music**, then change their role and turn off Loop for speech. The same section exposes exact start/end, source trim, fades, level, and mute controls for all tracks. A visual video layer plays muted; **Extract audio from …** creates a separate track when the source contains audio.

**Captions** edits frame-relative cue text and timing. **Files & transcription** imports/exports SRT and transcribes non-looping tracks. Generation, transcription, and SRT import append cues; remove unwanted prior cues when replacing a take. Audio and captions have separate timings, so check synchronization after trimming or moving tracks.

Timeline and export sequence previews play audible tracks. MP4 mixes them into an AAC soundtrack when encoding is supported, with scene overlaps matching transitions. Captions burn into video; SRT is an optional separate export. Preview ranges and playback speed do not trim or retime the final export. See the [narration instructions](canvas.md#add-narration-and-matching-captions) for the complete workflow.

## Export

**Export** opens a modal with a preview, selectable frames, and format settings. It captures the current document when opened.

Resolution, frame rate, quality, and image scale use the app's Radix custom select component. Menus mount inside the modal so they remain visible and interactive in the browser's top layer. Keyboard navigation, type-ahead, selection, and Escape work without closing the underlying export dialog.

- **PNG**: one image or an ordered ZIP of separate images; 1×/2×/3× scale; optional transparent background.
- **JPG**: one image or a ZIP of separate images; scale and quality controls. Transparent areas flatten onto white.
- Images normally capture the original design, including captions active at time zero. Enable **Capture animation** to render the editor playhead time instead, clamped to each scene's duration.
- **MP4**: selected frames become an ordered H.264 sequence with unmuted frame audio mixed as AAC and captions burned in. Reorder scenes with the up/down controls, preview the complete sequence, and choose resolution, 24/30/60 fps, and quality. Different scene aspect ratios fit within the first selected frame's aspect ratio without cropping. Smaller artwork is not enlarged, apart from rounding dimensions to even numbers for H.264.
- Transitions belong to the outgoing frame. Choose crossfade, directional slides/pushes/wipes, circle-in/out, diamond, blinds, fade-through-black/white, zoom/zoom-out, or spin; set duration and easing in the scene inspector. Transitions overlap scenes by the requested duration, capped at half of either adjacent scene. The final scene has no outgoing overlap. The dialog shows the resulting total duration.
- Progress and cancellation cover loading, image rendering, ZIP creation, and MP4 encoding. Native saves use the desktop save dialog; browser exports download locally. Export uses local rendering and encoding; no publishing or generation provider request is made.

Audible video also requires AAC encoding support; unsupported audio encoding produces an error rather than silently discarding the tracks. H.264 availability is checked against the chosen resolution, frame rate, and bitrate using [MediaBunny's encoding capability API](https://mediabunny.dev/guide/supported-formats-and-codecs). Unsupported settings disable video export with an explanation. Encoding uses awaited canvas samples with deterministic timestamps, rather than recording wall-clock playback; see [MediaBunny media sources](https://mediabunny.dev/guide/media-sources).

Limits: 0.1–600 seconds per scene, at most 100 keyframes per element, at most ten minutes per MP4, estimated MP4 size up to 256 MB, ZIP image data up to 256 MB, and 64 megapixels/16,384 pixels per side for still images. Missing fonts/images and inaccessible cross-origin images produce actionable errors instead of silently missing content.

## Document contract

Optional `scene` belongs to frame elements; optional `animation` belongs to non-frame elements. Frames can also hold `voiceoverDraft`, `audioTracks`, `subtitles`, and `subtitleStyle`; embedded tracks and cue timing remain part of ordinary document JSON. The canvas remains `version: 1`, and its ownership remains canvas → pages → frames. `sidecar/canvas.schema.json` describes these fields, and runtime import validation checks them.

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

## Development verification

Run `npm run build` and the affected tests under `tests/`. `npm run test:ui -- tests/presets.spec.ts` exercises catalog loading, editable presets, branding, local saves, folder switching, and portable artwork with a prepared local pack. Native asset-pack checks use `cargo test --lib asset_pack::tests --manifest-path src-tauri/Cargo.toml`.

For animation/audio changes, verify the affected controls with local media or mocked provider responses: scene preview, sound/caption timing, transitions, still capture, and the exported file. Runtime codec support varies, so a build alone does not verify encoding on every desktop platform. Do not generate paid audio or mutate live publishing providers for ordinary verification.

## LaTeX and physics layers

Elements now include **LaTeX equation** and **Physics diagram**. Equations retain editable math source and embedded SVG, with vector reveals and timed solution steps. Physics diagrams evaluate pendulum, spring, projectile, or uniform circular motion at the timeline time and use the same rendering path in exports. Their metadata is stored on ordinary `img` layers, so existing canvas backups remain readable. See [math and physics support](science.md) for assumptions, SI units, example presets, generator contracts, and local checks.
