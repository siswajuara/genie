# Siswa Juara Marketing Workspace

React editor ported from `reference/siswa-juara-editor.html`. The built-in templates live in `editor/presets.json`; the reference drawing routines live in `editor/reference-renderer.js`.

## Marketing modules

The app opens in **Idea** with a fresh chat. Its icon sidebar contains **Idea, Publish, Schedule, Insight, Community, and Setting**. Idea combines new conversations and chat history: choose Conversations to view the list, or New chat to start another. Hover or focus a sidebar icon to read its label and purpose. **Canvas** opens from Idea or a conversation; it has no marketing sidebar, and its Back to Idea button returns to the conversation list. The page editor stays mounted across module changes, preserving the current document and undo history.

Ownership is **conversation → canvas → pages → frames**. New chat creates a separate canvas; opening Canvas reopens that conversation's canvas. All conversations appear together in Idea, with no project selector. Switching pages keeps the same chat thread. Legacy chats that shared a page are migrated to independent canvases with copies of the existing pages; legacy storage remains readable for backup compatibility.

The Canvas header's **Versions** menu saves and restores snapshots of every page and frame. Applied chat edits create versions automatically; manual checkpoints use **Save current version**. The most recent 20 versions are retained in the canvas backup. Restoring saves the current state first. Chat artifact revisions also remember their original page, so restoring an artifact cannot overwrite a different page by accident. Version history is separate from the editor's Undo stack.

Idea uses the existing desktop assistant with marketing prompt starters and a preview of the current Canvas. Its conversation list indexes both Idea and Canvas conversations, including previously saved page chats. Conversations retain links to their project/page and can reopen in Idea or Canvas. Starting a new conversation archives the previous one. Idea views use `#idea/new`, `#idea/list`, and `#idea/conversation`; old `#chat` links open the Idea conversation list.

Publish supports multiple Canvas frames, uploaded images/videos, public HTTPS media URLs, captions, connected accounts, previews, and scheduling. Unsaved composer state stays in memory; explicitly saved social drafts are stored by the website. Publish requests go through the website to Buffer or Zernio after confirmation. Schedule reads saved drafts and provider delivery records from the website database. Selected media files are capped at 8 MB in the desktop composer and uploaded directly to signed website storage URLs.

Setting connects to the website API using a user-scoped token. Provider keys are encrypted by the website; only the website token is stored in the desktop credential vault. Browser previews keep that token in memory until reload. Publishing and replies are forwarded by the website, while schedules, insights, and comments are read from its database and refreshed by its cron worker. Codex, chat, Canvas, pages, frames, and Canvas versions remain local. The copyable Next.js implementation and SQL migration have moved to `website/genie-references/social-api`; see [social integration details](../docs/social.md).

Marketing components live in `marketing/`. Marketing state uses `genie.marketing.*`; archived conversations use `genie.conversation.*` alongside the existing `genie.chat.<project>-<page>` page conversation pointer. Existing Canvas storage formats are unchanged.

## Run

```sh
npm install
npm install --prefix sidecar
npm run dev          # browser editor
codex login          # existing official CLI login
npm run tauri dev    # desktop editor and chat
```

Development requires Node and an installed official Codex CLI. Packaged desktop builds include their own Node runtime and pinned Codex CLI for the target platform. `NODE_BIN`, Chat settings, and `CODEX_PATH` allow explicit overrides. On macOS, the bridge verifies the CLI signature before launch. The SDK's older transitive executable is excluded from the release payload. `Check installation` reports the selected path without starting Codex. See [desktop builds](../docs/builds.md) for the six-platform Actions workflow and signing setup.

## Projects and pages

Inside Canvas, the tabs are **Chat | Editor | Debug**. Editor contains Elements, Templates, and Assets.

Use the header selector to switch projects and `+ Project` to create one. Project settings support rename, duplicate, deletion, and a JSON export of all projects. Each project has pages in the bar below the header. `+ Page` creates an empty canvas; Page settings support rename, duplicate, and deletion. The final project or page cannot be deleted. Deletion requires confirmation.

Each page owns a separate canvas and chat conversation. Every canvas supports multiple frames. Add formats from Editor, apply templates as new frames, or duplicate the active frame with all its children. Frame copies receive fresh element and group IDs and appear to the right. Drag a frame label to move the entire slide. `Fit all` shows the carousel; select a frame in Editor to focus it. PNG export saves the active slide.

Desktop PNG and JSON exports use the operating system's Save dialog and write bytes through Rust, avoiding WebView blob downloads. Browser mode uses a standard download. The footer reports the saved path, cancellation, or a write error. PNG export waits for images and fonts before encoding.

Projects, pages, canvases, and project uploads persist in `genie.workspace.v1` in local storage. The previous single canvas is migrated into the first project's first page. Place images and text by dragging or pasting onto the canvas; images are embedded in their elements. Undo history belongs to the current page editing session and resets when switching pages; saved canvas contents survive switches and reloads. Export all projects for a portable backup, particularly when embedded images approach the browser storage limit.

## JSON contract

A canvas is `{ version: 1, metadata: { name, updatedAt }, elements: [...] }`. Every element has a stable `id`, type `t`, name `n`, and absolute coordinates `x,y,w,h`. Frames use `t: "frame"`; children reference their frame through `fid`. `gid` groups elements and array order defines layer order. Images embed their content in `src`. Missing reference illustrations remain labeled image slots.

Debug reads and applies complete workspaces, individual canvases, frame templates, and selection presets. It also supports the reference format `{name,kind,W,H,objects}`, arrays of presets, and `{presets:[...]}`. Runtime validation checks IDs, frame links, geometry, types, image sources, and styles. `sidecar/canvas.schema.json` describes the canvas structure; `editor/model.ts` also checks relationships.

Workspace JSON is `{ version: 1, projects: [{ id, name, pages: [{ id, name, canvas }], uploads: [...] }], activeProjectId, activePageId }`. Importing a workspace replaces the current workspace; export a backup first to preserve existing projects.

## Chat integration

Chat sends the current page canvas and selection through Tauri's `codex_run` command. Rust launches the Node sidecar and streams JSONL events to React. Chat uses the installed CLI with the [official Codex SDK](https://developers.openai.com/codex/sdk/) and the existing login.

Each conversation owns an app-data folder (`workspace/<chat-id>`). Before a turn the sidecar writes `canvas.json`, `canvas.schema.json`, and `CANVAS.md`. Codex edits the document in `workspace-write` mode. The bridge embeds local workspace images and returns the canvas for validation. Successful edits are undoable. If the canvas changes during a turn, the agent result stays pending for review. Switching pages cancels an active turn, keeping results from reaching another page. Stop cancels the turn; Open workspace & artifacts reveals generated files.

Browser mode supports editing and Debug; Chat requires the desktop app. Chat settings provide a CLI path override and installation check. If macOS rejects an installation, the app reports that failure without changing macOS security settings.

## Controls and checks

Shared controls live in `components/ui`: Hugeicons, keyboard-accessible selects and popovers, number fields with minus/plus buttons, react-colorful hex/alpha colors, and single-date/range calendars. Page settings saves optional `metadata.date` and `metadata.dateRange` values as local calendar dates in JSON.

The searchable Google Fonts picker uses `react-fontpicker-ts` with bundled previews and no API key. Nunito and Baloo 2 are packaged locally. `lib/fonts.ts` caches font loading, loads selected Google Fonts before applying them, and loads imported document fonts before PNG export. Additional Google Fonts require a connection on first use. Inline text editing has a transparent background and preserves font family, weight, size, alignment, spacing, opacity, and inline word colors.

Drag to move; use handles to resize and the upper dot to rotate. Shift constrains movement, proportions, and rotation; Alt resizes around the center. Ctrl/Cmd disables snapping while dragging. Shift-click selects multiple objects. Double-click edits text. Layers provides access to hidden and locked elements.

Space-drag pans; Ctrl/Cmd-wheel zooms. Ctrl/Cmd-0 fits the frame; Ctrl/Cmd-1 sets 100%. Arrow keys nudge (Shift: 10px). Ctrl/Cmd-C/V/D copies/pastes/duplicates; G groups; Shift-G ungroups; brackets reorder (Shift: front/back); Z undoes; Shift-Z/Y redoes. Delete removes selections and frame children. PNG export excludes controls and image placeholders; remote images require CORS permission.

Checks: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `bun test tests/editor.test.ts`.

## Layer hierarchy and canvas rendering

Layers shows expandable frames and groups, with frontmost siblings first. Stack commands and layer-row dragging reorder siblings within their current frame/group. Frame backgrounds stay behind their children, including documents saved with an older global array order. Selecting a layer in the tree works even when another shape covers it on the canvas. Alt-click cycles through overlapping unlocked elements.

Changing stack order or clicking an element never changes its parent frame. Children can extend beyond a frame and remain clipped to it. A deliberate drag into another frame reparents the element; dropping onto empty workspace retains its current frame. The Properties panel's Parent frame selector can explicitly move elements between frames or to the canvas. Moving a frame, including through its X/Y properties, moves its children together. Frame visibility and locking apply to descendants.

Canvas interaction coalesces pointer events to animation frames, indexes parent relationships once per document update, precomputes snap targets for each drag, and saves/history-commits after a completed gesture. Unchanged frames reuse cached rasters during panning, selection, and edits elsewhere; offscreen frames are culled and raster memory is bounded. Export always renders from document elements at full frame resolution. Layers avoids rerendering its tree for transient geometry previews. Escape cancels an active transform, and drag cancellation restores its starting document.

## Direct placement

Every built-in preset and element has a semantic `identifier`, separate from its stable Canvas `id`. Image slots use `searchable-name-color-facing`, such as `laptop-computer-blue-front` or `owl-student-mascot-using-laptop-happy-blue-front`. Appearance > Identifier accepts normal text and converts it to a lowercase slug on blur/Enter. Editing an image identifier applies its matching library image; the inspector also offers Use matching asset. Picking an asset manually stores its canonical identifier.

Templates and object presets resolve missing image sources before being added or replacing a frame, preserving slot geometry, rotation, opacity, and fit. The initial page also resolves named empty slots. Matching considers meaningful subject/activity words and ranks color and facing deterministically; it does not substitute unrelated images. Unavailable subjects, photos, brand marks, and social logos stay editable slots. Existing uploaded or embedded images are kept when loading a saved preset. Four loading workers and the shared asset cache bound concurrent work. Identifier edits never alter element IDs or parent-frame references.

Editor > Assets lists the images in `src/assets/elements`, with searchable names and category filters. Its grid renders only visible rows and a small overscan area; thumbnails load lazily and decode asynchronously. Asset cards stay memoized during unrelated canvas interactions. Drag an asset onto the canvas, or click one and then click the canvas to place it. Escape or the placement banner cancels click placement. Clicking an asset with a single unlocked image slot selected fills that slot, keeping its position, size, rotation, corner radius, opacity, and fit. Dropping onto an image slot also replaces its image.

New assets keep their aspect ratio, never upscale beyond their prepared dimensions, and have a maximum side of 320 canvas units, further limited to 40% of the target frame and 45% of the visible viewport. Selected images are embedded in document JSON so saved projects and exports remain independent of asset-library URLs.

`npm run assets:prepare` creates 192px WebP thumbnails and optimized images up to 1600px from the original sources. It runs automatically before `npm run dev` and `npm run build`, including desktop/CI builds. Generation is incremental, uses four workers with bounded Sharp caching, and leaves originals unchanged. Generated files in `src/assets/generated` are ignored by Git and rebuilt from source. Run the command again after adding assets to an already-running dev server. This source library has 159 images; its prepared images and thumbnails total approximately 27 MB instead of the originals' 254 MB.

The left tools are Chat, Editor, and Debug. Drop image files, text files, browser images, or text directly onto the canvas. Ctrl/Cmd-V places clipboard images, text, or copied canvas elements. Content dropped inside an unlocked frame becomes a child of that frame; content dropped onto empty workspace stays on the canvas. Clipboard copy/cut also carries canvas elements between pages. Input fields and inline text editing retain normal clipboard behavior. The context-menu Paste action reads the system clipboard when the WebView supports it and otherwise falls back to the editor clipboard.

The React build, native check, version checks, and workflow YAML validation pass. The app also blocks installation if it cannot save the canvases or if an assistant response is still running.

The remaining one-time setup is to generate the updater signing key and add it to GitHub Actions. I’ve documented that, along with patch/minor/major release commands and prerelease handling.
Implemented automatic update checks/downloads, install/restart controls, and signed six-platform GitHub releases from v* tags.

Version scripts synchronize all manifests and support patch, minor, major, and prereleases.

One-time setup:

npm run updater:setup

Then configure the GitHub signing secrets. After committing your changes, release a patch with:

npm run release:patch -- --tag --push

Build and native checks pass. Full setup guide (docs/updates.md).