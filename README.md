# Genie by SiswaJuara

Genie creates editable canvases with pages and frames for still designs, carousels, and narrated video. The workspace provides **Content**, **Canvases**, **Publish**, **Schedule**, and **Setting**. Designs, versions, personal templates, drafts, plans, and delivery receipts stay local.

Plan scripts and questions in [Content Studio](docs/content.md), then generate editable frames on a linked canvas. Embedded animation direction guides scene pacing, with motion choices available in review; supplied templates reserve top branding and bottom subtitle space.

Start with the [canvas user guide](docs/canvas.md) for the complete workflow: presets, artwork, editing, narration, captions, animation, export, and recovery.

## Use the editor

1. Connect the extracted external pack in **Setting → Assets** to browse supplied templates, illustrations, and animation clips.
2. Create a canvas, add a frame from Templates or Elements, and edit its layers.
3. Select a frame and open **Narration** for voice generation, recordings, music, and editable captions. Configure ElevenLabs in **Setting → Audio**; generation and transcription use provider credits.
4. Set scene timing in **Animation** and **Timeline**, then export PNG/JPG images, a ZIP of slides, or an MP4 with frame audio and captions.
5. Save checkpoints in **Versions** and editable backups in **Canvas settings**. Publish or schedule through Tebar separately when ready.

Supplied templates and media are external packs under `asset-packs/`; they are excluded from application builds. Only placed media embeds in designs. Desktop remembers the selected folder in local `config.json`; browser folder selections last for the session.

## Run locally

```sh
npm install
npm install --prefix sidecar
npm run dev          # browser development
npm run tauri dev    # desktop development; requires the Tauri/Rust toolchain
```

Development uses Node. Packaged desktop builds include the Node runtime for provider connections. Local canvas editing works without AI. Optional frame generation uses the OpenCode client SDK with Beam Free; install OpenCode 2 and connect OpenCode Go, or supply a running service URL in Setting → AI generation. Browser development provides local provider middleware; a production static browser build can edit local designs but needs the desktop app for provider connections.

A prepared local pack is available automatically in Vite development. For preparing and distributing packs, see [external asset packs](asset-packs/README.md). Keep `design-references/` for rebuilding the supplied presets and artwork.

## Documentation

| Guide                                               | Covers                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Canvas user guide](docs/canvas.md)                 | Pages, frames, presets, branding, assets, narration, captions, shortcuts, export, troubleshooting |
| [Animation and export reference](docs/animation.md) | Timeline, effects, keyframes, scene transitions, rendering, document fields                       |
| [AI generation](docs/ai-generation.md)              | OpenCode setup, Beam Free selection, ordered scene metadata, and mocked verification              |
| [SD–SMP learning models](docs/learning.md)          | Geometry, fractions, graphs, Indonesian language, physics, and AI-added diagrams                  |
| [LaTeX and physics](docs/science.md)                | Editable equations, simulation parameters, worked examples, and AI generation                     |
| [Preset authoring](design-references/README.md)     | Editable template files, source references, cutouts, catalog and preview preparation              |
| [External asset packs](asset-packs/README.md)       | Folder connection, media preparation, manifest, packaging                                         |
| [Storage and recovery](docs/storage.md)             | Local saving, library backups, migration, recovery                                                |
| [Publishing and scheduling](docs/social.md)         | Tebar connections, local drafts, confirmed submissions, actual usage                      |
| [Editor implementation](src/README.md)              | JSON contract, ownership, rendering, local integrations                                           |
| [Desktop builds](docs/builds.md)                    | Installers, build workflow, signing                                                               |
| [Versioning and updates](docs/updates.md)           | Release scripts, updater setup, signed updates                                                    |

AI generation uses OpenCode’s stateless API and keeps canvas/page/frame metadata local; see [generation setup and contract](docs/ai-generation.md). Provider keys and related settings live in local `config.json`, outside canvas exports. Social publishing calls Tebar directly. Narration calls ElevenLabs when requested; Soniox remains reserved in configuration. No siswajuara.com social API or website social tables are used.
