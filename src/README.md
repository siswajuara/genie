# Genie editor implementation

React editor ported from `reference/siswa-juara-editor.html`. Supplied templates are individual JSON files under `asset-packs/siswa-juara/pack/presets/`, read on demand from the connected external pack with a small metadata catalog. Templates, branding, and previews are excluded from app builds. The reference drawing routines live in `editor/reference-renderer.js`. See [the preset authoring guide](../design-references/README.md).

For the complete user workflow, including narration, captions, presets, and export, see the [canvas user guide](../docs/canvas.md). For timing and renderer details, see [animation and exports](../docs/animation.md).

Templates use separate text, shapes, SVG ornaments, and transparent character/object media. Shared logo/footer layers come from `contoh-frame-standar.json`, with an optional standard saved in the local document library. Properties > Advanced can mark any new layer as logo, footer, or design content. Existing canvases keep their snapshots and local edits.

Preset social icons use per-icon imports from `thesvg`. `lib/brand.ts` embeds their blue monochrome SVGs and the SJ logo from `src-tauri/icons/icon.png` as portable image sources. The same sources are used in template thumbnails, editable canvas slots, and exports. Each template footer contains the project logo; custom uploaded slot images are preserved.

## Marketing modules

The app opens in **Canvases**. The sidebar contains **Canvases, Publish, Schedule, and Setting**. Create a new canvas or open a saved design; the editor returns to the canvas gallery. Legacy Idea, Chat, and Story routes redirect to Canvases.

A canvas has pages, and pages contain frames. The editor provides Elements, Templates, Assets, Properties, Narration, Animation, Layers, Timeline, export, and Debug tools. Canvases, pages, versions, drafts, plans, and delivery receipts stay local. Existing canvas backups remain readable; legacy conversation metadata is preserved for compatibility, without creating or running chats.

The Canvas header's **Versions** menu saves and restores snapshots of every page and frame. The most recent 20 versions are retained in backups. Restoring saves the current state first. Version history is separate from Undo.

Publish supports Canvas frames, local images/videos, public HTTPS media references, captions, connected channels, previews, and confirmed direct publishing/scheduling through Buffer and Zernio. Saved drafts, dated content plans, and delivery results use the local library (`genie.marketing.posts`). Local media stays embedded until publication; Canvas media retains source references. Saving a planned date alone does not publish. Provider queues and API usage are fetched directly on demand.

Setting → Social accounts stores provider keys in local `config.json` (application data directory on desktop, project root in browser development), supports channel authorization, and fetches actual usage. Buffer headers provide rolling request windows; Zernio's usage endpoint provides plan/quota/usage data, alongside rate headers. No website token, social database, or siswajuara.com API is used. See [social details](../docs/social.md).

Marketing components live in `marketing/`. Saved publishing state uses `genie.marketing.*`; canvas storage remains `genie.workspace.v1`.

## Run

```sh
npm install
npm install --prefix sidecar
npm run dev          # browser editor
npm run tauri dev    # desktop editor
```

Development requires Node. Packaged desktop builds include a Node runtime for direct social provider connections. No assistant CLI or login is required. See [desktop builds](../docs/builds.md).

## Projects and pages

Inside Canvas, the library contains **Elements, Templates, and Assets**. Debug opens from the editor footer.

Use Canvases to open or create a canvas, rename or delete saved designs, and export a workspace JSON backup. Each canvas has numbered page buttons in the page rail; Add page creates another document. Canvas settings supports deleting the current page or canvas with confirmation; the final page cannot be deleted.

Each page owns its document. Every canvas supports multiple frames. Add formats from Editor, apply templates as new frames, or duplicate the active frame with all its children. Frame copies receive fresh element and group IDs and appear to the right. Drag a frame label to move the entire slide. `Fit all` shows the carousel; select a frame in Editor to focus it. Export selects frames from the current page for PNG/JPG, ordered image ZIPs, or an MP4 sequence with frame audio and burned-in captions.

Desktop PNG and JSON exports use the operating system's Save dialog and write bytes through Rust, avoiding WebView blob downloads. Browser mode uses a standard download. The footer reports the saved path, cancellation, or a write error. PNG export waits for images and fonts before encoding.

Canvases, pages, versions, and canvas assets persist under the `genie.workspace.v1` library record: SQLite on desktop and IndexedDB in the browser. The previous single canvas is migrated into the first project's first page. Place images and text by dragging or pasting onto the canvas; images are embedded in their elements. Undo history belongs to the current page editing session and resets when switching pages; saved canvas contents survive switches and reloads. Export all projects for a portable backup before clearing browser data or replacing a workspace.

## JSON contract

A canvas is `{ version: 1, metadata: { name, updatedAt }, elements: [...] }`. Every element has a stable `id`, type `t`, name `n`, and absolute coordinates `x,y,w,h`. Frames use `t: "frame"`; children reference their frame through `fid`. `gid` groups elements and array order defines layer order. Images embed their content in `src`. Missing reference illustrations remain labeled image slots.

Debug reads and applies complete workspaces, individual canvases, frame templates, and selection presets. It also supports the reference format `{name,kind,W,H,objects}`, arrays of presets, and `{presets:[...]}`. Runtime validation checks IDs, frame links, geometry, types, image sources, and styles. `sidecar/canvas.schema.json` describes the canvas structure; `editor/model.ts` also checks relationships.

Workspace JSON is `{ version: 1, projects: [{ id, name, pages: [{ id, name, canvas }], uploads: [...] }], activeProjectId, activePageId }`. Importing a workspace replaces the current workspace; export a backup first to preserve existing projects.

## Controls and checks

Shared controls live in `components/ui`: Lucide icons, keyboard-accessible selects and popovers, number fields with minus/plus buttons, react-colorful hex/alpha colors, and single-date/range calendars. Social platform logos use the existing per-brand SVG assets. Document metadata supports optional `date` and `dateRange` values as local calendar dates in JSON.

The searchable Google Fonts picker uses `react-fontpicker-ts` with bundled previews and no API key. Nunito and Baloo 2 are packaged locally. `lib/fonts.ts` caches font loading, loads selected Google Fonts before applying them, and loads imported document fonts before PNG export. Additional Google Fonts require a connection on first use. Inline text editing has a transparent background and preserves font family, weight, size, alignment, spacing, opacity, and inline word colors.

Drag to move; use handles to resize and the upper dot to rotate. Shift constrains movement, proportions, and rotation; Alt resizes around the center. Ctrl/Cmd disables snapping while dragging. Shift-click selects multiple objects. Double-click edits text. Layers provides access to hidden and locked elements.

Space plays/pauses; Shift+Space-drag or middle-drag pans; Ctrl/Cmd-wheel zooms. Ctrl/Cmd-0 fits the frame; Ctrl/Cmd-1 sets 100%. Ctrl/Cmd-A selects all unlocked, visible elements including frames. Arrow keys nudge (Shift: 10px). Ctrl/Cmd-C/V/D copies/pastes/duplicates; Ctrl/Cmd-G groups; Ctrl/Cmd-Shift-G ungroups; Ctrl/Cmd-brackets reorder (Shift: front/back); Ctrl/Cmd-Z undoes; Ctrl/Cmd-Shift-Z or Ctrl/Cmd-Y redoes. Delete removes selections and frame children. PNG export excludes controls and image placeholders; remote images require CORS permission.

Checks: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, and the affected Playwright specs under `tests/`. Preset coverage uses `npm run test:ui -- tests/presets.spec.ts` with a prepared local pack. Use mocked provider responses; do not make paid audio calls or publish posts to verify ordinary changes.

## Layer hierarchy and canvas rendering

Layers shows expandable frames and groups, with frontmost siblings first. Stack commands and layer-row dragging reorder siblings within their current frame/group. Frame backgrounds stay behind their children, including documents saved with an older global array order. Selecting a layer in the tree works even when another shape covers it on the canvas. Alt-click cycles through overlapping unlocked elements.

Changing stack order or clicking an element never changes its parent frame. Children can extend beyond a frame and remain clipped to it. A deliberate drag into another frame reparents the element; dropping onto empty workspace retains its current frame. The Properties panel's Arrange > Move to frame selector can explicitly move elements between frames or to the canvas. Moving a frame, including through its X/Y properties, moves its children together. Frame visibility and locking apply to descendants.

Canvas interaction coalesces pointer events to animation frames, indexes parent relationships once per document update, precomputes snap targets for each drag, and saves/history-commits after a completed gesture. Unchanged frames reuse cached rasters during panning, selection, and edits elsewhere; offscreen frames are culled and raster memory is bounded. Export always renders from document elements at full frame resolution. Layers avoids rerendering its tree for transient geometry previews. Escape cancels an active transform, and drag cancellation restores its starting document.

## Direct placement

Every supplied preset and element has a semantic `identifier`, separate from its stable Canvas `id`. Image slots use `searchable-name-color-facing`, such as `laptop-computer-blue-front` or `owl-student-mascot-using-laptop-happy-blue-front`. Appearance > Identifier accepts normal text and converts it to a lowercase slug on blur/Enter. Editing an image identifier applies its matching library image; the inspector also offers Use matching asset. Picking an asset manually stores its canonical identifier.

Templates and object presets resolve missing image sources before being added or replacing a frame, preserving slot geometry, rotation, opacity, and fit. The initial page also resolves named empty slots. Matching considers meaningful subject/activity words and ranks color and facing deterministically; it does not substitute unrelated images. Unavailable subjects, photos, brand marks, and social logos stay editable slots. Existing uploaded or embedded images are kept when loading a saved preset. Four loading workers and the shared asset cache bound concurrent work. Identifier edits never alter element IDs or parent-frame references.

Editor > Assets > Library lists images and green-screen animations from a connected external asset pack, with searchable names and category filters. Its grid renders only visible rows and a small overscan area; thumbnails load lazily and decode asynchronously. Asset cards stay memoized during unrelated canvas interactions. Drag an asset onto the canvas, or click one and then click the canvas to place it. Escape or the placement banner cancels click placement. Clicking an asset with a single unlocked image slot selected fills that slot, keeping its position, size, rotation, corner radius, opacity, and fit. Dropping onto an image slot also replaces its image.

New assets keep their aspect ratio, never upscale beyond their prepared dimensions, and have a maximum side of 320 canvas units, further limited to 40% of the target frame and 45% of the visible viewport. Selected images are embedded in document JSON so saved projects and exports remain independent of asset-library URLs.

`npm run assets:prepare` prepares a separate pack from `asset-packs/siswa-juara/source/`, including 192px thumbnails, optimized WebP images, compressed MP4 clips, and a versioned `manifest.json`. `npm run assets:pack` creates a standalone ZIP for distribution. Templates, catalog JSON, branding, previews, and video sources are excluded from app builds. Users choose the extracted asset folder in Setting > Assets; desktop remembers its location in local `config.json`. Browser mode can select a local folder for the current session. Placed assets are embedded in canvas documents and remain portable. See [asset pack setup and metadata](../asset-packs/README.md).

The library provides Elements, Templates, and Assets. Drop image files, text files, browser images, or text directly onto the canvas. Ctrl/Cmd-V places clipboard images, text, or copied canvas elements. Content dropped inside an unlocked frame becomes a child of that frame; content dropped onto empty workspace stays on the canvas. Clipboard copy/cut also carries canvas elements between pages. Input fields and inline text editing retain normal clipboard behavior. The context-menu Paste action reads the system clipboard when the WebView supports it and otherwise falls back to the editor clipboard.

## Narration, captions, and portability

Frame elements own optional `voiceoverDraft`, `audioTracks`, `subtitles`, and `subtitleStyle` fields. Scripts, generated/imported audio data URLs, timing, and cues persist with the frame in documents, versions, duplication, and workspace JSON. `sound.ts` and `subtitles.ts` validate these fields. `audio-panel.tsx` provides the right-inspector Narration flow; timeline audio/caption rows open it. `use-audio-preview.ts` synchronizes audio with scene playback. `media-export.ts` mixes unmuted frame audio into AAC for H.264 MP4 output; captions render into the scene. Visual video elements are muted; extracting source sound creates a separate frame audio track.

The current generation voice is fixed by `sidecar/voice-prototype.mjs`; the editor's account selector controls billing. Speech and transcription requests go directly to ElevenLabs through the local provider middleware/sidecar. Actual account credits are read on demand. Soniox remains reserved. See the [narration workflow](../docs/canvas.md#add-narration-and-matching-captions).

Saved frame templates copy layout, dimensions, background, scene settings, and child-layer animations. They do not copy frame-level narration, tracks, captions, or subtitle style. Use frame duplication or workspace JSON to preserve a complete narrated scene. Replacing a template preserves existing frame-level audio/caption data, so check timing after changing the scene.

Supplied preset files are listed with exact byte sizes in the optional `presets` manifest array. The browser folder reader, desktop binary IPC reader, and development endpoint read only listed files. Catalog and branding caches follow the connected pack revision; switching/disconnecting packs invalidates cached library data. Packs without a template listing remain valid media packs. Manual preset changes require `presets:index`; layout changes also need fresh previews.

For backup boundaries, see [storage and recovery](../docs/storage.md). Workspace JSON includes canvas-owned data, while personal templates are separate local records. Provider keys and external pack catalogs are not embedded in workspace exports. Build, release, and updater instructions live in [desktop builds](../docs/builds.md) and [updates](../docs/updates.md).
