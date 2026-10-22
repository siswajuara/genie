# Social connections

The integration follows the working `integration-with-buffer-and-zernio-for-social-media` reference. It uses Buffer GraphQL and Zernio REST through a backend bridge. Organization IDs and channel IDs are discovered from the user's keys rather than copied from the reference.

1. Open **Setting → Social accounts**. Paste a Buffer or Zernio API key and choose **Save & test connection**.
2. Choose your Buffer organization or Zernio profile and save the selection. Create a Zernio profile if needed. Use **Manage Buffer channels** or **Connect channel** to authorize accounts in your browser, then **Refresh accounts**.
3. Open **Publish**, select connected accounts, add a caption and media, and choose now or a future date. Review and confirm the submission.
4. Check **Schedule** for provider status. Local drafts appear separately and are not automatically submitted.

Desktop API keys live in macOS Keychain, Windows Credential Manager, or Linux Secret Service. A locked or unavailable vault produces an error; there is no plaintext fallback. Keys are never returned to the frontend, stored in project JSON, or included in Canvas backups. The local Vite development server keeps keys only in memory, so restarting it requires entering them again. A static browser preview cannot use the social backend.

## Media and delivery

Both providers require public HTTPS media. Public media URLs work directly. Local uploads and rendered Canvas frames are uploaded through Zernio's presigned media endpoint, so those require a Zernio key even when publishing through Buffer. Provider authorization is never sent to the storage upload URL. Canvas frames export at their original dimensions; drafts retain the existing 8 MB local-file limit and uploaded media is capped at 32 MB.

Publishing records an ID per submission and account. Repeating the same request reuses the recorded result rather than creating another post. If a provider response is interrupted, the app reports an uncertain result and prevents automatic resubmission. Check Schedule or the provider dashboard before deliberately creating another submission. Editing a draft creates a new submission; it does not edit or cancel a previously scheduled provider post. A provider accepting a post is distinct from the social network completing delivery.

## Coverage

| Module | Buffer | Zernio |
| --- | --- | --- |
| Connections | Organizations and channels; channel management in Buffer | Profiles, accounts, browser authorization |
| Publish | Immediate and scheduled posts | Immediate and scheduled posts |
| Schedule | Latest 50 provider posts | Provider posts with pagination |
| Insight | Aggregate post metrics | Up to 50 posts with available analytics |
| Community | Not available through the public API | Inbox posts, comments, nested replies, and confirmed reply submission |

Metrics and Inbox availability depend on provider plan, account permissions, and social platform support. Buffer aggregates and Zernio post metrics are shown separately. Missing metrics are not represented as zero. Zernio Inbox may cache results for up to ten minutes; ads comments remain in Zernio. Refreshes are manual rather than periodic polling.

Buffer requests respect the reference's rolling request budgets and provider retry headers. Desktop request receipts persist under the application's social data directory; development receipts last until server restart.

## Focused validation

Run `node --test tests/social.test.mjs` for mocked account discovery, permissions, credential redaction, schedule payloads, duplicate prevention, media uploads, and replies. These checks do not contact providers or publish real posts. Live authorization and delivery require the user's API keys and provider permissions.
