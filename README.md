# Siswa Juara Canvas Studio

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

See [editor and integration documentation](src/README.md) for the JSON contract, controls, packaging, and checks.
