# Desktop builds with GitHub Actions

After committing and pushing the project and workflow to GitHub, trigger the build from any machine with GitHub CLI installed and authenticated:

```sh
gh auth login
npm run build:ci -- --repo OWNER/REPO --ref main
```

Equivalent command:

```sh
gh workflow run build-desktop.yml --repo OWNER/REPO --ref main
```

The workflow must be on the repository's default branch before GitHub enables manual dispatch. `--ref` selects the branch or tag to build. Manual dispatch produces preview artifacts; a pushed `v*` tag builds and publishes a complete signed GitHub release. To list and watch manual runs:

```sh
gh run list --repo OWNER/REPO --workflow build-desktop.yml
gh run watch RUN_ID --repo OWNER/REPO
gh run download RUN_ID --repo OWNER/REPO --dir installers
```

Pushing a `v*` tag builds installers, signed update artifacts, and the updater feed. The tag must match all application manifests. Use `npm run release:patch` to synchronize version files and prepare release notes. See [automatic updates and release commands](updates.md) for signing keys, patch/minor/major scripts, and publication.

## Native build matrix

The workflow runs builds on each operating system and CPU architecture, following Tauri's [GitHub Actions guidance](https://v2.tauri.app/distribute/pipelines/github/) and GitHub's [supported native runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

| Platform            | Runner           | Rust target               | Installer     |
| ------------------- | ---------------- | ------------------------- | ------------- |
| macOS Apple Silicon | macos-15         | aarch64-apple-darwin      | DMG           |
| macOS Intel         | macos-15-intel   | x86_64-apple-darwin       | DMG           |
| Windows x64         | windows-2022     | x86_64-pc-windows-msvc    | NSIS EXE      |
| Windows ARM64       | windows-11-arm   | aarch64-pc-windows-msvc   | NSIS EXE      |
| Linux x64           | ubuntu-22.04     | x86_64-unknown-linux-gnu  | DEB, AppImage |
| Linux ARM64         | ubuntu-22.04-arm | aarch64-unknown-linux-gnu | DEB, AppImage |

These are six native builds dispatched from one command. There is no emulation or cross-compiling macOS from Linux. The preparation script rejects mismatched Rust/Node targets to prevent packaging an executable for the wrong architecture. Linux is built on Ubuntu 22.04 to avoid unnecessarily raising the runtime glibc requirement. Windows ARM64 uses NSIS instead of MSI.

## Self-contained chat sidecar

`npm run build:desktop` invokes Tauri. Its before-build hook stages the native sidecar and builds React. Run `npm ci` and `npm ci --prefix sidecar --include=optional` first when building locally.

The generated `src-tauri/resources/sidecar` contains:

- The current build's Node executable, copied from the official Node installation.
- The pinned official Codex CLI (`0.163.0`) and its native resources/helpers for that platform.
- The SDK, bridge, canvas schema, and executable resolver.
- Third-party licenses and a manifest containing architecture, versions, and SHA-256 hashes.

The SDK's older transitive CLI is deliberately excluded from the payload. Release builds locate Node through Tauri's resource directory and resolve Codex from the sidecar manifest. Users need no separate Node/Codex installation or PATH setup. Their Codex authentication remains in their user profile, outside the application bundle. Users without a Codex login can find the bundled executable in Chat's installation check, then run that executable with `login --device-auth` in a terminal.

`NODE_BIN` and Chat's executable setting/`CODEX_PATH` remain explicit overrides. Development mode still discovers an installed Node/Codex. Windows npm `.cmd` launchers resolve to the native `.exe`; paths with spaces are passed as process arguments without a shell. Codex receives its helper directories and the bundled Node directory on its child PATH.

The native launcher simplifies Windows resource paths before starting either Node bridge, avoiding Node 22's startup failure on `\\?\` paths. Both Windows build jobs run a native startup regression check using canonical paths, spaces, and Unicode in the script path, covering installation checks, settings requests, and chat input without model or provider calls.

`npm run sidecar:check` starts the staged Node and Codex from an unrelated working directory with global Node/Codex removed from PATH. It verifies versions, architecture, hashes, SDK loading, bridge status, and streaming flag support. It does not authenticate or make a model call. CI repeats the check using resources extracted from the actual macOS application, Linux DEB, or silently installed Windows NSIS payload.

Generated sidecar files are ignored by Git. Install dependencies independently on each runner; never commit or copy a macOS `node_modules` directory into Windows/Linux builds.

## macOS signing and the malware dialog

Manual dispatch defaults to an unsigned preview. These artifacts are for development; they are not a substitute for signed distribution. The embedded official executables retain their signatures, and the bridge verifies Codex before launch. The workflow never removes quarantine flags or disables Gatekeeper.

For signed and notarized macOS builds, set these repository secrets:

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application P12 certificate.
- `APPLE_CERTIFICATE_PASSWORD`: certificate password.
- `APPLE_SIGNING_IDENTITY`: Developer ID Application identity.
- `APPLE_ID`, `APPLE_PASSWORD`: Apple ID and app-specific password for notarization.
- `APPLE_TEAM_ID`: Apple developer team ID.

These are the credentials supported by [Tauri's macOS signing/notarization process](https://v2.tauri.app/distribute/sign/macos/). Tagged builds fail early when credentials are missing. To require them on a manual run:

```sh
npm run build:ci -- --repo OWNER/REPO --ref main -f sign_macos=true
```

Windows artifacts are unsigned unless Windows signing is configured separately. CI's startup checks establish that the packaged executables launch on their native runner; they do not establish SmartScreen reputation or replace a real authenticated model turn.

To upgrade Codex, update its exact version in `sidecar/package.json` and the preparation script together, regenerate `sidecar/package-lock.json`, and rerun all six jobs. Keep Node's pinned Actions version consistent with the runtime you intend to distribute.
