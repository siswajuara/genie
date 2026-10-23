# GitHub releases and automatic updates

Genie uses signed Tauri update packages from `siswajuara/genie` GitHub releases. The app checks five seconds after startup and every six hours, downloads available updates in the background by default, and asks the user to install/restart. Both automatic checks and automatic downloads can be disabled in **Setting → Preferences → App updates**.

The update provider stays mounted while navigating between Idea, Canvas, and the social modules. It shows download progress, release notes, errors/retry, and a restart action. It flushes local canvas persistence before installation and refuses to install while an assistant response is active. Users must save unfinished social drafts before choosing Install; the composer itself is transient. The updater replaces application files, including the bundled Node/Codex sidecar, while user data and Codex login remain outside the application bundle.

## One-time signing setup

After installing dependencies:

```sh
npm run updater:setup
```

This creates `.keys/updater.key` and `.keys/updater.key.pub`, writes the public key into `src-tauri/tauri.conf.json`, and never prints the private key. `.keys/` is ignored by Git. The setup refuses to replace an existing private key or an already configured public key. Back up the private key securely; installed clients trust its corresponding public key. Losing or casually rotating it breaks updates for those clients.

Add these GitHub Actions secrets under repository Settings → Secrets and variables → Actions:

| Name | Value |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `.keys/updater.key`, not its filename |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Private-key password if using an encrypted imported key; leave unset for the setup script's key |

Commit only the public key/configuration. Alternatively, CI supports a public repository variable named `TAURI_UPDATER_PUBLIC_KEY`; it must match a nonempty committed public key. The tag build checks for missing signing material before building updater artifacts.

Updater signatures are separate from OS signing. Tagged macOS releases still require `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID`, as described in [builds.md](builds.md). An updater signature does not replace Apple notarization or Windows code signing.

No signing key has been generated or uploaded by implementing this workflow. Run setup and configure repository secrets before the first tagged release.

## Version numbers

The version format is `MAJOR.MINOR.PATCH`, optionally followed by a prerelease such as `-beta.1`. Git tags add a `v` prefix:

- Patch: `0.1.0` → `0.1.1` for fixes.
- Minor: `0.1.1` → `0.2.0` for features.
- Major: `0.2.0` → `1.0.0` for a new major release.
- Prerelease: explicitly choose `0.2.0-beta.1`, then `0.2.0-beta.2`.
- Running a patch bump on `0.2.0-beta.2` promotes it to stable `0.2.0`.

The scripts synchronize `package.json`, both root versions in `package-lock.json`, the app entry in `src-tauri/Cargo.lock`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. They reject mismatched versions, malformed SemVer, and explicit downgrades. Build metadata (`+...`) is intentionally not used in release numbers.

```sh
npm run version:check
npm run version:patch -- --dry-run
npm run version:patch
npm run version:minor
npm run version:major
node scripts/version.mjs 0.2.0-beta.1
```

Version bump commands edit manifests only; they do not commit, tag, or push.

## Prepare a patch release

```sh
# Preview without modifying files
npm run release:patch -- --dry-run

# Update manifests and add release notes to CHANGELOG.md for review
npm run release:patch
```

The second command leaves changes uncommitted. Review and commit them, then create/push the matching tag using your normal Git process. Release notes are generated from commit subjects since the previous `v*` tag and should be edited before distribution when needed.

For an automated release commit/tag, first commit all feature/fix changes and start with a clean working tree:

```sh
# Bump, create release commit and annotated tag locally
npm run release:patch -- --tag

# Or bump, commit, tag, and push the branch + tag atomically
npm run release:patch -- --tag --push
```

Do not run the second command after the first for the same release: it would prepare another patch. If you already created the local tag, push that existing branch/tag with Git instead. The release script never commits unrelated dirty work and never pushes unless `--tag --push` is explicitly supplied. The remote is `origin`, inferred from this repository's existing Git configuration.

Minor/major commands work the same way:

```sh
npm run release:minor -- --tag --push
npm run release:major -- --tag --push
npm run release -- 0.3.0-beta.1 --tag --push
```

## What a `v*` tag does

The existing desktop workflow runs six native builds: macOS ARM64/x64, Windows ARM64/x64, Linux ARM64/x64. Each build:

1. Verifies that the tag equals every manifest version; a `v0.2.1` tag cannot silently package an app reporting `0.1.0`.
2. Requires updater signing material and, on macOS, Developer ID/notarization credentials.
3. Generates an ignored Tauri release configuration with `createUpdaterArtifacts:true` and the correct GitHub release endpoint.
4. Builds installers and signed update packages, then checks the actual packaged Node/Codex runtime.
5. Stages platform-specific assets with collision-free names, `.sig` signatures, and per-platform checksums.

A final publish job runs only after all six builds succeed. It validates all six platform records and asset checksums, generates `latest.json` and `SHA256SUMS`, creates a draft GitHub release, uploads the complete set, and then publishes it. A failed build cannot publish a partial update manifest. A failed upload leaves a draft, and retrying the publish job can finish that draft. Already published releases are not overwritten; publish a new patch instead.

Stable releases newer than the current stable release become GitHub's latest release. Older maintenance releases do not move the stable feed backward. Tags containing prerelease suffixes become GitHub prereleases and are excluded from automatic stable updates. No prerelease channel is enabled in the app.

Manual Actions dispatch still produces preview installer artifacts and does not publish a GitHub release. Use tag pushes for production releases.

## Downloads and updater feed

Manual downloads:

```text
https://github.com/siswajuara/genie/releases
```

Stable updater endpoint:

```text
https://github.com/siswajuara/genie/releases/latest/download/latest.json
```

Manifest format:

```json
{
  "version":"0.2.1",
  "notes":"Release notes",
  "pub_date":"2026-10-23T00:00:00.000Z",
  "platforms":{
    "darwin-aarch64":{"signature":"signed artifact signature","url":"https://github.com/siswajuara/genie/releases/download/v0.2.1/PLATFORM_ASSET.app.tar.gz"},
    "darwin-x86_64":{"signature":"...","url":"https://github.com/..."},
    "windows-x86_64":{"signature":"...","url":"https://github.com/..."},
    "windows-aarch64":{"signature":"...","url":"https://github.com/..."},
    "linux-x86_64":{"signature":"...","url":"https://github.com/..."},
    "linux-aarch64":{"signature":"...","url":"https://github.com/..."}
  }
}
```

The updater verifies the signature of the artifact against the public key embedded in the installed app. `SHA256SUMS` is also provided for manual download checks. It does not replace signature verification. Patch releases download a complete signed application bundle; these scripts do not implement binary delta patches.

Downloads must be publicly reachable without a GitHub login. If the source repository is private, use a public release repository or an authenticated download proxy designed for your users; do not embed a GitHub personal access token in the app. This workflow currently publishes into the same repository, so public distribution requires making its release downloads public or adapting the destination/feed together.

macOS updates use signed `.app.tar.gz`; users download DMG for a fresh installation. Windows uses NSIS EXE updates/installers. Linux automatic installation is supported for the AppImage build; DEB users download a new package through GitHub or their package manager. Development builds and builds without a configured public key show an explanation and link to releases instead of issuing failing checks.

## Source map and focused checks

| File | Purpose |
| --- | --- |
| `src/components/AppUpdates.tsx` | Persistent update state, preferences, progress, install/restart UI |
| `src-tauri/src/lib.rs` | Plugin initialization, build availability, active-chat install guard |
| `scripts/version.mjs` | SemVer validation and synchronized manifest changes |
| `scripts/release.mjs` | Changelog, optional release commit/tag/push |
| `scripts/setup-updater.mjs` | One-time key generation and public-key configuration |
| `scripts/prepare-release.mjs` | Signing preflight and Tauri build override |
| `scripts/stage-release.mjs` | Platform installers, update artifacts and metadata |
| `scripts/publish-release.mjs` | Completeness checks, stable feed, draft/upload/publish |
| `.github/workflows/build-desktop.yml` | Native matrix and final publication job |

```sh
node --test tests/version.test.mjs
npm run version:check
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Release publication and real installation require configured GitHub/Apple secrets and signed built artifacts. They are not exercised by the mocked/version checks above.

Implementation follows the official [Tauri updater documentation](https://v2.tauri.app/plugin/updater/) and its [JavaScript update lifecycle](https://v2.tauri.app/reference/javascript/updater/).
