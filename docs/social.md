# Direct social connections and local ownership

Genie connects directly to Buffer and Zernio. It does not call the siswajuara.com API or save to website social tables. Connect provider keys under **Setting → Social accounts**, save and test, then choose a Buffer organization or Zernio profile. Channel authorization opens the provider flow in your browser.

Desktop keys and provider settings live in `config.json` in the application data directory (on macOS, `~/Library/Application Support/com.siswajuara.genie/config.json`). Browser development uses `config.json` at the project root through the same-origin localhost Vite middleware, and persists settings across restarts. Copy `config.example.json` for the format. Both files use top-level `buffer`, `zernio`, `elevenlabs`, and `soniox` sections with a `key` field and optional provider settings. Unrelated configuration is preserved when social settings are saved. ElevenLabs and Soniox sections reserve configuration for future audio integration; no audio requests are implemented here. Public settings expose configured flags, never keys. The OS credential vault is no longer accessed; re-enter previously saved keys once. The Node sidecar makes provider requests. Production static previews need the desktop app for connections.

## Local data and publishing

Canvases, versions, drafts, dated content plans, and delivery results stay in the local library (SQLite on desktop, IndexedDB in browser development). Drafts use `genie.marketing.posts`. Saving a draft or plan sends no provider request and uploads no media. Canvas media keeps its project/page/frame reference; keep that source canvas available.

Publish requires connected channels and a confirmation before sending directly to a provider. Local plans do not publish automatically; confirmed provider schedules run on the provider even when Genie is closed. Delivery outcomes and submission IDs are saved locally. Native request history in `social/requests.json` holds cached discovery, usage observations, and duplicate-submission receipts, outside project exports. An uncertain write is not automatically retried. Check the provider before starting another submission.

Local media and rendered frames upload through Zernio's presigned storage API when confirming publication. Buffer accepts public media URLs, so Buffer-only setups need a stable public HTTPS media link. Website storage and social tables are not involved. Provider queues and API usage are read directly; provider permissions and plan capabilities still apply. Insight analytics and Community comments/replies are outside the current workflow. Existing remote website jobs are not cancelled or imported.

## Fetching actual usage

Each provider card has **Fetch usage**, which makes one read request for that provider:

- **Buffer:** a small `account { id }` query to `https://api.buffer.com`; `RateLimit` and `RateLimit-Policy` headers report remaining requests, quotas, window lengths, and reset timing. All ordinary Buffer responses also update these observations.
- **Zernio:** `GET https://zernio.com/api/v1/usage` without metering parameters returns the plan/quota/usage snapshot. Genie shows connected accounts, uploads/profiles and their reported limits, and current-period spend when supplied. `X-RateLimit-*` response headers supply request throughput; analytics windows are kept separately.

Values are timestamped observations, not a continuously live counter. Other integrations consume shared quotas too. Missing headers are shown as unavailable. Known exhausted windows and `Retry-After` cooldowns prevent premature requests. Cache reads cost no provider calls. Discovery is reused for five minutes; **Refresh accounts** and **Save & test** explicitly re-fetch. There is no recurring social polling.

## Free account reference

Checked October 25, 2026; actual response headers and account plan take precedence.

| Provider    | Request windows                                            | Account/post limits                                             |
| ----------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Buffer Free | 100 / 15 minutes, 250 / 24 hours, 3,000 / 30 days, rolling | 3 channels, 10 queued posts per channel                         |
| Zernio Free | 60 / minute; analytics 6 / second                          | 2 connected accounts; hourly and platform daily publishing caps |

Buffer personal keys share a pool. Zernio legacy plans can differ; extra accounts and metered services can incur charges. Reads use requests too: one request each minute would consume 1,440/day, exceeding Buffer Free's daily budget.

Official references:

- [Buffer response headers and rate limits](https://developers.buffer.com/guides/api-limits.html)
- [Buffer free plan](https://buffer.com/pricing)
- [Zernio usage snapshot](https://docs.zernio.com/usage/get-usage)
- [Zernio request/posting limits](https://docs.zernio.com/guides/rate-limits)
- [Zernio media upload contract](https://docs.zernio.com/media/get-media-presigned-url)

Verification uses mocked provider responses, including publishing, media uploads, and quota exhaustion. Do not make live provider mutations as a code test.
