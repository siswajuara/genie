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

## Self-contained social runtime

`npm run build:desktop` stages the social runtime and builds React. Run `npm ci` and `npm ci --prefix sidecar` before building locally.

The generated `src-tauri/resources/sidecar` contains the current build's Node executable, social and audio provider modules, the Node license, and a manifest with architecture, version, and SHA-256 hash. Assistant executables and SDKs are no longer bundled.

`npm run sidecar:check` checks the staged Node from an unrelated working directory without relying on global Node. It verifies the version, architecture, hash, syntax, module imports, and absence of the old assistant bridge. It makes no provider requests. CI repeats this check on resources extracted from the actual installer.

The native launcher simplifies Windows resource paths before starting the social bridge. Generated resources are ignored by Git and rebuilt on each native runner.

## macOS signing and the malware dialog

Manual dispatch defaults to an unsigned preview. These artifacts are for development; they are not a substitute for signed distribution. The workflow never removes quarantine flags or disables Gatekeeper.

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

Windows artifacts are unsigned unless Windows signing is configured separately. CI's startup checks establish that the packaged executables launch on their native runner; they do not establish SmartScreen reputation or replace a real provider integration check.

Keep Node's pinned Actions version consistent with the runtime you intend to distribute.

## External asset catalog

Desktop installers do not include the illustration/video pack and do not require FFmpeg to build. Prepare and distribute it separately with `npm run assets:pack`; users choose the extracted folder under Setting > Assets. See [asset pack instructions](../asset-packs/README.md).
