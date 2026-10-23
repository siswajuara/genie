# Built-in assistant skills

The Idea and Canvas chat composer has an **Assistant skill** menu. The default selects a relevant skill automatically; users can also select a specific workflow. Selecting a carousel switches to Draw; the other workflows start in Discuss. Users can change modes afterward. Discuss returns text; Draw can apply canvas changes through the existing preview/revision flow.

| Skill                   | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `genie-brainstorm`      | Compare useful angles, audience needs, hooks, and asset requirements. |
| `genie-create-idea`     | Write a post, caption, script, or production brief.                   |
| `genie-create-carousel` | Create multiple editable frames on the current canvas page.           |
| `genie-create-campaign` | Plan related posts, proposed dates, copy, assets, and measurement.    |
| `genie-content-review`  | Check questions, copy, claims, privacy, and missing evidence.         |

Users can ask naturally or explicitly refer to a skill, for example:

- “Brainstorm lima ide untuk orang tua yang mendampingi anak memahami soal cerita.”
- “Gunakan $genie-create-carousel. Buat carousel lima slide tentang pecahan senilai untuk kelas 5.”
- “Rancang kampanye tujuh hari dari materi ini. Jangan jadwalkan dulu.”

## Source and scope

The guidance is adapted from both user-supplied Word documents in `reference-skills/`. The maintained adaptation is in `sidecar/skills/genie-create-idea/references/`. It preserves the five content segments, parent-facing voice, exercise validation, honest sources, and real-footage requirements. It deliberately treats proposed posting schedules and content mixes as experiments, rather than proven results. The original documents remain unchanged.

Configured brand name, description, and website accompany each assistant turn. Siswa Juara-specific segments apply to Siswa Juara work; another configured business should use its own brief. The bridge sends no social API credentials with that context.

## Runtime and packaging

`sidecar/skills/catalog.json` is shared by the UI and bridge. `sidecar/skills.mjs` installs bundled skills into each conversation's local assistant workspace at `.agents/skills/` before starting or resuming its Codex turn. This follows Codex's repository skill layout. A short catalogue and selected skill path are included in each turn, so resumed conversations can also find skills without injecting every reference into every request.

Only relevant instructions and references should be read. The five `genie-*` skill directories are app-managed and refreshed from the bundle on each turn. To retain a custom skill, put it in a differently named folder under that conversation's `.agents/skills/`; the installer leaves other folders alone. User-level installed skills remain under Codex's normal configuration and are not copied from the developer's computer into app builds. The app does not weaken its sandbox or change account permissions to enable skills.

`scripts/prepare-sidecar.mjs` copies the helper and entire built-in skills directory into Tauri resources for every platform. The native bridge uses that packaged directory in release builds and the source directory during development. No additional npm dependency is needed for skills.

`AGENTS.md` also points repository coding agents to these instructions when the actual task is marketing content. Skills are reusable instructions, not a separate model or service. Existing Codex login and model selection still apply.

## Canvas constraints

The bridge supplies `canvas.json`, `canvas.schema.json`, and `CANVAS.md` for the current page. A carousel uses several frame elements in that one document, with absolute coordinates and a valid `fid` on each child. Skills must preserve stable IDs and unrelated work. The bridge embeds generated image files from the local conversation directory. The app validates and versions applied results through its existing editor flow.

Skills cannot create other app pages through an undocumented API, publish or schedule posts, or claim provider actions succeeded. Campaign plans stay local until a user submits content through Publish.

Official references: [Codex repository skills](https://developers.openai.com/blog/skills-agents-sdk), [skill instruction design](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).
