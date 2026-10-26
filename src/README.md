# Siswa Juara Marketing Workspace

React editor ported from `reference/siswa-juara-editor.html`. The built-in templates live in `editor/presets.json`; the reference drawing routines live in `editor/reference-renderer.js`.

Preset social icons use per-icon imports from `thesvg`. `lib/brand.ts` embeds their blue monochrome SVGs and the SJ logo from `src-tauri/icons/icon.png` as portable image sources. The same sources are used in template thumbnails, editable canvas slots, and exports. Each template footer contains the project logo; custom uploaded slot images are preserved.

## Marketing modules

The app opens in **Canvases**. The sidebar contains **Canvases, Publish, Schedule, and Setting**. Create a new canvas or open a saved design; the editor returns to the canvas gallery. Legacy Idea, Chat, and Story routes redirect to Canvases.

A canvas has pages, and pages contain frames. The editor provides Elements, Templates, Assets, animation, export, and Debug tools. Canvases, pages, versions, drafts, plans, and delivery receipts stay local. Existing canvas backups remain readable; legacy conversation metadata is preserved for compatibility, without creating or running chats.

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

Inside Canvas, the library contains **Elements, Templates, and Assets**. Debug is available in canvas settings.

Use Canvases to open or create a canvas. Project settings support rename, duplicate, deletion, and a JSON export of all projects. Each project has pages in the bar below the header. `+ Page` creates an empty canvas; Page settings support rename, duplicate, and deletion. The final project or page cannot be deleted. Deletion requires confirmation.

Each page owns its document. Every canvas supports multiple frames. Add formats from Editor, apply templates as new frames, or duplicate the active frame with all its children. Frame copies receive fresh element and group IDs and appear to the right. Drag a frame label to move the entire slide. `Fit all` shows the carousel; select a frame in Editor to focus it. PNG export saves the active slide.

Desktop PNG and JSON exports use the operating system's Save dialog and write bytes through Rust, avoiding WebView blob downloads. Browser mode uses a standard download. The footer reports the saved path, cancellation, or a write error. PNG export waits for images and fonts before encoding.

Projects, pages, canvases, and project uploads persist in `genie.workspace.v1` in local storage. The previous single canvas is migrated into the first project's first page. Place images and text by dragging or pasting onto the canvas; images are embedded in their elements. Undo history belongs to the current page editing session and resets when switching pages; saved canvas contents survive switches and reloads. Export all projects for a portable backup, particularly when embedded images approach the browser storage limit.

## JSON contract

A canvas is `{ version: 1, metadata: { name, updatedAt }, elements: [...] }`. Every element has a stable `id`, type `t`, name `n`, and absolute coordinates `x,y,w,h`. Frames use `t: "frame"`; children reference their frame through `fid`. `gid` groups elements and array order defines layer order. Images embed their content in `src`. Missing reference illustrations remain labeled image slots.

Debug reads and applies complete workspaces, individual canvases, frame templates, and selection presets. It also supports the reference format `{name,kind,W,H,objects}`, arrays of presets, and `{presets:[...]}`. Runtime validation checks IDs, frame links, geometry, types, image sources, and styles. `sidecar/canvas.schema.json` describes the canvas structure; `editor/model.ts` also checks relationships.

Workspace JSON is `{ version: 1, projects: [{ id, name, pages: [{ id, name, canvas }], uploads: [...] }], activeProjectId, activePageId }`. Importing a workspace replaces the current workspace; export a backup first to preserve existing projects.

## Controls and checks

Shared controls live in `components/ui`: Lucide icons, keyboard-accessible selects and popovers, number fields with minus/plus buttons, react-colorful hex/alpha colors, and single-date/range calendars. Social platform logos use the existing per-brand SVG assets. Page settings saves optional `metadata.date` and `metadata.dateRange` values as local calendar dates in JSON.

The searchable Google Fonts picker uses `react-fontpicker-ts` with bundled previews and no API key. Nunito and Baloo 2 are packaged locally. `lib/fonts.ts` caches font loading, loads selected Google Fonts before applying them, and loads imported document fonts before PNG export. Additional Google Fonts require a connection on first use. Inline text editing has a transparent background and preserves font family, weight, size, alignment, spacing, opacity, and inline word colors.

Drag to move; use handles to resize and the upper dot to rotate. Shift constrains movement, proportions, and rotation; Alt resizes around the center. Ctrl/Cmd disables snapping while dragging. Shift-click selects multiple objects. Double-click edits text. Layers provides access to hidden and locked elements.

Space-drag pans; Ctrl/Cmd-wheel zooms. Ctrl/Cmd-0 fits the frame; Ctrl/Cmd-1 sets 100%. Ctrl/Cmd-A selects all unlocked, visible elements including frames. Arrow keys nudge (Shift: 10px). Ctrl/Cmd-C/V/D copies/pastes/duplicates; G groups; Shift-G ungroups; brackets reorder (Shift: front/back); Z undoes; Shift-Z/Y redoes. Delete removes selections and frame children. PNG export excludes controls and image placeholders; remote images require CORS permission.

Checks: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `bun test tests/editor.test.ts`.

## Layer hierarchy and canvas rendering

Layers shows expandable frames and groups, with frontmost siblings first. Stack commands and layer-row dragging reorder siblings within their current frame/group. Frame backgrounds stay behind their children, including documents saved with an older global array order. Selecting a layer in the tree works even when another shape covers it on the canvas. Alt-click cycles through overlapping unlocked elements.

Changing stack order or clicking an element never changes its parent frame. Children can extend beyond a frame and remain clipped to it. A deliberate drag into another frame reparents the element; dropping onto empty workspace retains its current frame. The Properties panel's Parent frame selector can explicitly move elements between frames or to the canvas. Moving a frame, including through its X/Y properties, moves its children together. Frame visibility and locking apply to descendants.

Canvas interaction coalesces pointer events to animation frames, indexes parent relationships once per document update, precomputes snap targets for each drag, and saves/history-commits after a completed gesture. Unchanged frames reuse cached rasters during panning, selection, and edits elsewhere; offscreen frames are culled and raster memory is bounded. Export always renders from document elements at full frame resolution. Layers avoids rerendering its tree for transient geometry previews. Escape cancels an active transform, and drag cancellation restores its starting document.

## Direct placement

Every built-in preset and element has a semantic `identifier`, separate from its stable Canvas `id`. Image slots use `searchable-name-color-facing`, such as `laptop-computer-blue-front` or `owl-student-mascot-using-laptop-happy-blue-front`. Appearance > Identifier accepts normal text and converts it to a lowercase slug on blur/Enter. Editing an image identifier applies its matching library image; the inspector also offers Use matching asset. Picking an asset manually stores its canonical identifier.

Templates and object presets resolve missing image sources before being added or replacing a frame, preserving slot geometry, rotation, opacity, and fit. The initial page also resolves named empty slots. Matching considers meaningful subject/activity words and ranks color and facing deterministically; it does not substitute unrelated images. Unavailable subjects, photos, brand marks, and social logos stay editable slots. Existing uploaded or embedded images are kept when loading a saved preset. Four loading workers and the shared asset cache bound concurrent work. Identifier edits never alter element IDs or parent-frame references.

Editor > Assets > Library lists images and green-screen animations from a connected external asset pack, with searchable names and category filters. Its grid renders only visible rows and a small overscan area; thumbnails load lazily and decode asynchronously. Asset cards stay memoized during unrelated canvas interactions. Drag an asset onto the canvas, or click one and then click the canvas to place it. Escape or the placement banner cancels click placement. Clicking an asset with a single unlocked image slot selected fills that slot, keeping its position, size, rotation, corner radius, opacity, and fit. Dropping onto an image slot also replaces its image.

New assets keep their aspect ratio, never upscale beyond their prepared dimensions, and have a maximum side of 320 canvas units, further limited to 40% of the target frame and 45% of the visible viewport. Selected images are embedded in document JSON so saved projects and exports remain independent of asset-library URLs.

`npm run assets:prepare` prepares a separate pack from `asset-packs/siswa-juara/source/`, including 192px thumbnails, optimized WebP images, compressed MP4 clips, and a versioned `manifest.json`. `npm run assets:pack` creates a standalone ZIP for distribution. Neither the catalog nor video sources are included in app builds. Users choose the extracted asset folder in Setting > Assets; desktop remembers its location in local `config.json`. Browser mode can select a local folder for the current session. Placed assets are embedded in canvas documents and remain portable. See [asset pack setup and metadata](../asset-packs/README.md).

The library provides Elements, Templates, and Assets. Drop image files, text files, browser images, or text directly onto the canvas. Ctrl/Cmd-V places clipboard images, text, or copied canvas elements. Content dropped inside an unlocked frame becomes a child of that frame; content dropped onto empty workspace stays on the canvas. Clipboard copy/cut also carries canvas elements between pages. Input fields and inline text editing retain normal clipboard behavior. The context-menu Paste action reads the system clipboard when the WebView supports it and otherwise falls back to the editor clipboard.

The React build, native check, version checks, and workflow YAML validation pass. The app also blocks installation if it cannot save the canvases .

The remaining one-time setup is to generate the updater signing key and add it to GitHub Actions. I’ve documented that, along with patch/minor/major release commands and prerelease handling.
Implemented automatic update checks/downloads, install/restart controls, and signed six-platform GitHub releases from v\* tags.

Version scripts synchronize all manifests and support patch, minor, major, and prereleases.

One-time setup:

npm run updater:setup

Then configure the GitHub signing secrets. After committing your changes, release a patch with:

npm run release:patch -- --tag --push

Build and native checks pass. Full setup guide (docs/updates.md).
