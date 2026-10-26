# Working in Genie

Use applicable installed Codex skills when working in this project. The app's own marketing skills live in `sidecar/skills/`; see `sidecar/skills/catalog.json` for names and descriptions. Read the relevant `SKILL.md` when brainstorming or creating marketing content, campaigns, or editable carousels. These editorial skills do not govern unrelated application engineering tasks.

The source documents for the Siswa Juara editorial adaptation are the two Word documents in `reference-skills/`. Their proposed schedules and content percentages are examples, not verified analytics or current exam policy.

For app implementation, preserve the local ownership model: a canvas has pages; a page contains frames. Keep canvases and versions local. Saved drafts, content plans, and delivery receipts stay local too. Focus the app on canvas creation, publishing, and scheduling; Idea, Chat, Insight, and Community features are removed. Social connections call Buffer and Zernio directly for publishing, provider data, and usage. Do not use the siswajuara.com API or website social tables. Store provider keys and related settings in local config.json; do not use the OS credential vault. Reserve provider sections for ElevenLabs and Soniox alongside Buffer and Zernio. Read actual usage from provider responses, distinguish it from free-plan guidance, and avoid background polling.

Preserve canvas/page context and local edits across navigation. Keep existing canvas backups readable without recreating chat records or assistant sessions.

Keep verification focused on the affected behavior. Do not make paid model calls, publish posts, or run live provider mutations to test ordinary code changes.

Illustrations and animation catalogs are external asset packs under `asset-packs/`, not app bundle imports. See `asset-packs/README.md` for preparation and metadata. Keep browsing lazy, remember the selected desktop folder in local config.json, and embed only placed media into local canvases so designs remain portable.
