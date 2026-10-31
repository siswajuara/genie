# Tebar publishing and local ownership

Tebar is Genie's only social provider. Under **Setting → Social accounts**, save a Tebar API key and choose **Save & test**. Create a key in the Tebar account menu → API key; publishing requires read and write access. A read-only key can browse accounts and posts. Genie calls `https://api.tebar.app/v1` from the Node sidecar with `Authorization: Bearer …`. See the [official API introduction](https://docs.tebar.app/api/) and [OpenAPI specification](https://api.tebar.app/v1/openapi.json).

## Configuration and workspaces

Keys and settings live in local `config.json`: the application data directory on desktop (`~/Library/Application Support/com.siswajuara.genie/config.json` on macOS), or the project root through same-origin localhost Vite middleware during browser development. Use `config.example.json`. The social section is `tebar: { key, profileId }`; OpenCode, ElevenLabs, reserved Soniox, and unrelated settings remain intact. Public settings expose configured flags, never keys. Keys are excluded from canvas exports and the library database; the OS credential vault is not used. Static production previews need the desktop app for provider access.

Owner keys can list and create workspaces (called profiles in the API). Selecting a workspace adds `Tebar-Profile` to scoped requests. Without selection, discovery sees all workspaces; a submission must use up to 10 accounts from a single workspace, and media and post creation use that workspace. Workspace keys already have their scope and cannot list or create profiles; that permission limit does not prevent account discovery or publishing.

**Connect account** creates a single-use Tebar connect link for the selected or default workspace with an owner key. It expires after 30 minutes. No redirect URL is needed; Tebar shows its completion page. Workspace keys open the Tebar dashboard instead. Complete authorization there, then explicitly **Refresh accounts** in Genie. No callback query is treated as proof of connection. Expired, revoked, or plan-suspended accounts cannot be selected for publication. See [profiles](https://docs.tebar.app/api/profile/) and [connect links](https://docs.tebar.app/api/connect-link/).

## Drafts, media, and confirmation

Canvases, versions, drafts, dated content plans, and delivery receipts stay in the local library (SQLite on desktop and IndexedDB in the browser). Drafts use `genie.marketing.posts`. Saving a local draft or plan sends no provider request and uploads no media. Canvas references retain their canvas/page/frame ownership; keep the source canvas available.

Publishing and provider scheduling require confirmation. Only then does Genie render Canvas frames, send local file bytes to `POST /media/upload`, or import public HTTPS references with `POST /media/from-url`. Every media item becomes a Tebar media ID in the original order. JPEG/PNG images are limited to 8 MB. The current local file picker accepts files up to 8 MB, and the backend accepts videos up to 32 MB, below Tebar's direct-upload ceiling. MP4/MOV video encoding and platform-specific media limits still apply. Genie does not implement chunked uploads. See [media](https://docs.tebar.app/api/media/).

`POST /posts` receives `content`, `media_ids`, `targets[].account_id`, any per-account `options`, and `scheduled_at` for schedules. YouTube requires an explicit audience choice and title; TikTok visibility choices are fetched on demand and explicitly selected; Pinterest requires a board ID or name. See [platform options](https://docs.tebar.app/api/posts/). Local drafts are never uploaded as provider drafts. Confirmed schedules run on Tebar even when Genie is closed; local plans do not run automatically.

A Tebar post can initially be publishing or pending: acceptance does not mean every platform has published it. **Schedule → Published & scheduled** reads target delivery status, errors, and published links directly from Tebar with cursor pagination and manual refresh. Genie's saved receipt records the submission outcome. There is no background delivery polling.

Desktop request history in `social/requests.json` holds discovery cache, usage observations, and submission receipts outside canvas exports. Browser development uses `.genie-social/requests.json` for the same history. Post creation sends a stable `Idempotency-Key`; receipts prevent accidental duplicate writes and reject reused IDs with different content. Uncertain writes are not automatically retried. Check Tebar posts before starting another submission. Existing local drafts and historical delivery labels remain readable; old account selections must be replaced with connected Tebar accounts. Switching providers does not cancel schedules already created elsewhere.

## Content task handoff

**Content → task → Buka Publish (Tebar)** opens the shared Publish composer. It carries the task's title, caption, hashtags, and ordered canvas/page/frame references into a local post tagged with `contentTaskId`. Reopening preserves the saved composer edits, account selections, request ID, and receipts. The source canvas does not need to be the active editor canvas; the media picker follows the draft's canvas. Answer/accuracy verification and valid frame references are checked again before uploads.

Content displays draft, local plan, acceptance, scheduling, failures, and published delivery separately. Provider-confirmed schedules advance verified tasks to Scheduled; all targets must report published before a task advances to Published. Schedule's existing reads reconcile saved results by Tebar post and account IDs, including target errors and permalinks. There are no extra provider reads or background polls. Manually changing the local task stage never publishes or schedules a post. See the [Content workflow](content.md#publish-through-tebar).

## Usage and quota

**Fetch usage** makes one read request to `GET /me`. Tebar's response headers `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` supply request throughput; reset is seconds from the response. `Retry-After` and known exhausted windows block premature calls. Values are timestamped observations shared across all the account's keys, REST, and MCP; other clients can consume them too. Missing quota headers show unavailable values. **Check posting quota** separately requests `GET /accounts/{id}/publishing-limit` for an account's platform limit. Genie does not invent a plan, spend estimate, or free-tier quota.

Account discovery is reused for five minutes. **Refresh accounts** and **Save & test** explicitly refetch. Cached usage reads cost no provider call. No recurring provider polling, website social tables, or siswajuara.com API is used. Analytics, inbox, comments, and webhooks are outside the current workflow.

Verification uses mocked Tebar responses for discovery, workspace scoping, raw media uploads, publishing, schedules, cursor pagination, quotas, errors, and duplicate prevention. Do not use live publishing or provider mutations as ordinary code tests.
