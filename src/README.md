# Siswa Juara Canvas Studio

React editor ported from `reference/siswa-juara-editor.html`. The 13 templates and five object presets live in `editor/presets.json`; the reference drawing routines live in `editor/reference-renderer.js`.

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

The tabs are **Chat | Editor | Debug**. Editor contains Elements and Templates.

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

Drag to move; use handles to resize and the upper dot to rotate. Shift constrains movement, proportions, and rotation; Alt resizes around the center. Ctrl/Cmd disables snapping while dragging. Shift-click selects multiple objects. Double-click edits text. Layers provides access to hidden and locked elements.

Space-drag pans; Ctrl/Cmd-wheel zooms. Ctrl/Cmd-0 fits the frame; Ctrl/Cmd-1 sets 100%. Arrow keys nudge (Shift: 10px). Ctrl/Cmd-C/V/D copies/pastes/duplicates; G groups; Shift-G ungroups; brackets reorder (Shift: front/back); Z undoes; Shift-Z/Y redoes. Delete removes selections and frame children. PNG export excludes controls and image placeholders; remote images require CORS permission.

Checks: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `bun test tests/editor.test.ts`.

## Layer hierarchy and canvas rendering

Layers shows expandable frames and groups, with frontmost siblings first. Stack commands and layer-row dragging reorder siblings within their current frame/group. Frame backgrounds stay behind their children, including documents saved with an older global array order. Selecting a layer in the tree works even when another shape covers it on the canvas. Alt-click cycles through overlapping unlocked elements.

Changing stack order or clicking an element never changes its parent frame. Children can extend beyond a frame and remain clipped to it. A deliberate drag into another frame reparents the element; dropping onto empty workspace retains its current frame. The Properties panel's Parent frame selector can explicitly move elements between frames or to the canvas. Moving a frame, including through its X/Y properties, moves its children together. Frame visibility and locking apply to descendants.

Canvas interaction coalesces pointer events to animation frames, indexes parent relationships once per document update, precomputes snap targets for each drag, and saves/history-commits after a completed gesture. Unchanged frames reuse cached rasters during panning, selection, and edits elsewhere; offscreen frames are culled and raster memory is bounded. Export always renders from document elements at full frame resolution. Layers avoids rerendering its tree for transient geometry previews. Escape cancels an active transform, and drag cancellation restores its starting document.

## Direct placement

The left tools are Chat, Editor, and Debug. Drop image files, text files, browser images, or text directly onto the canvas. Ctrl/Cmd-V places clipboard images, text, or copied canvas elements. Content dropped inside an unlocked frame becomes a child of that frame; content dropped onto empty workspace stays on the canvas. Clipboard copy/cut also carries canvas elements between pages. Input fields and inline text editing retain normal clipboard behavior. The context-menu Paste action reads the system clipboard when the WebView supports it and otherwise falls back to the editor clipboard.
