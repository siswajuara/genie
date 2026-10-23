# Working in Genie

Use applicable installed Codex skills when working in this project. The app's own marketing skills live in `sidecar/skills/`; see `sidecar/skills/catalog.json` for names and descriptions. Read the relevant `SKILL.md` when brainstorming or creating marketing content, campaigns, or editable carousels. These editorial skills do not govern unrelated application engineering tasks.

The source documents for the Siswa Juara editorial adaptation are the two Word documents in `reference-skills/`. Their proposed schedules and content percentages are examples, not verified analytics or current exam policy.

For app implementation, preserve the local ownership model: a conversation owns one canvas; a canvas has pages; a page contains frames. Keep chats, canvases, versions, and assistant state local. Publish, Schedule, Insight, and Community use the website API. Provider credentials belong on the website, not in desktop settings.

Keep verification focused on the affected behavior. Do not make paid model calls, publish posts, or run live provider mutations to test ordinary code changes.
