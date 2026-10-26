# Genie by SiswaJuara

React canvas editor with projects, pages, carousel frames, JSON documents, 13 reference templates, editable text and images, and desktop agent chat. Tools are organized as Chat | Editor | Debug.

```sh
npm install
npm install --prefix sidecar
npm run dev
```

For Chat, install the official Codex CLI, run `codex login`, then `npm run tauri dev`. Node must be available on PATH, or supplied through `NODE_BIN`. Chat uses the installed CLI and checks its macOS signature before launch; configure its path in Chat settings if needed.

Packaged builds include Node and Codex for macOS, Windows, and Linux (x64 and ARM64). After pushing to GitHub, trigger all six builds with:

```sh
npm run build:ci -- --repo OWNER/REPO --ref main
```

See [desktop build instructions](docs/builds.md) for installer downloads and macOS signing secrets.

Automatic updates use signed GitHub releases. Run `npm run updater:setup` once, configure the signing secret, and prepare releases with `npm run release:patch`. See [versioning and auto-update setup](docs/updates.md).

See [editor and integration documentation](src/README.md) for the JSON contract, controls, packaging, and checks.

Local canvases and chats use a managed desktop library with image deduplication, verified migration, and storage controls. See [storage and recovery](docs/storage.md).

Idea and Canvas chat include built-in skills for brainstorming, ideas, carousels, campaigns, and content review. See [assistant skills](docs/skills.md) for usage, source documents, and packaging.

The chat model control opens model, reasoning, web search, account, and usage settings. See [assistant controls](docs/assistant.md).

Connect Buffer and Zernio directly in **Setting → Social accounts** to publish, schedule, and fetch actual API usage. Drafts, plans, and delivery history stay local; the website social API is not used. See [social connections and usage](docs/social.md).
