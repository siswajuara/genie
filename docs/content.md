# Content Studio in Genie

Open **Content** from the workspace navigation. The module brings the standalone app in `content/` into Genie: the eight-stage board, table and monthly calendar, search and filters, priorities and dates, question library, framework guides, references, coverage, bulk task creation, task dialogs, imports, and JSON export. Columns retain their independent lazy loading. Task dialogs keep the current board filters and save fields on blur. Failed saves keep the dialog and edits available.

A fresh library includes the supplied 50 content-plan tasks, 50 mathematics questions, 30 Bahasa Indonesia questions, and storytelling reference. Original source files remain unchanged. Excel and Markdown imports run locally and skip duplicate source records without replacing edits. Mark answer/accuracy verification before moving a task to Review or a later stage. Changing linked questions invalidates that verification. Scheduled and Published remain local workflow stages when changed manually; changing them sends no publishing request. Confirmed Tebar schedules and delivered posts also update the linked task stage through the shared publishing flow.

## Generate a task's frames

1. Configure OpenCode in **Setting → AI generation** and optionally connect an illustration/animation pack in **Setting → Assets**. Content's Pengaturan dialog opens the same AI settings.
2. Open a task and edit its framework, script, caption, visual/accuracy notes, audience, and linked material. **Draft dengan AI** optionally writes a script with the framework's exact beats, caption, and hashtags. Prompt, response, date, and actual model stay in local task history. A task changed during writing keeps its edits and receives the response in history.
3. Choose **Canvas tujuan** to use a new canvas or a page in an existing canvas, then **Generate frames di Canvas**. Genie saves the task, creates its canvas on first use, and opens Generate with the task material and an ordered scene for each framework beat. Opening the canvas moves a Backlog task to Researching. Reopening the task uses its linked canvas and page. A deleted target creates a new canvas. No model request happens merely by opening the dialog.
4. Adjust scene intent, direction, timing, context, and narration; choose **Generate frames**. The request includes the task's script, caption, linked questions with answers/explanations, reference notes, and accuracy/visual direction. Keep context within 12,000 characters; remove unrelated material when several linked sources exceed that limit.
5. Edit the generated review, choose **Scene motion** per scene if needed, pick the destination (**Current page**, **New page in this canvas**, or **New canvas**), and add the frames. The current page destination appends; the other destinations keep the existing page untouched. The task records the destination canvas/page and added frame IDs; adding frames moves a Backlog/Researching task to Scripting, so it leaves Semua konten/Backlog and appears under Dalam proses. Subsequent generations default to the linked page. Audio remains an explicit ElevenLabs operation through the existing account selection flow.

Drafts use Genie's stateless OpenCode SDK connection, Beam Free selection, saved model override, timeouts, and errors. They do not start a CLI agent session. Unavailable models fail without fallback. Model usage remains `null` when OpenCode supplies no counts.

## Publish through Tebar

1. Open a Content task and choose **Buka Publish**. This saves the task and opens Genie's existing Publish composer with its title, caption plus hashtags, and exact linked frames in their recorded order. A due date pre-fills the schedule date; review the date and device time before submitting. The active canvas/page stays unchanged.
2. Choose connected Tebar accounts and review the media, caption, per-platform options, and timing. Existing task drafts reopen with composer edits, selected accounts, and submission receipts intact. Another in-progress composer is saved locally before switching tasks. Use **Back to Content task** to save composer edits and return to the source.
3. **Save draft** and **Save local plan** keep the content on this device. Verify the task's answer/accuracy check before publishing; Genie rechecks it before uploading any media. Removed tasks and missing frame media block submission.
4. Choose **Publish now** or **Schedule post**, then explicitly confirm. The same Tebar account selection, upload pipeline, request ID, and delivery receipts used by ordinary Publish posts apply. Opening Publish or changing a task stage never uploads media or creates a provider post.
5. Content displays the linked draft and delivery results separately from its workflow stage. An accepted `pending`/`publishing` submission is not marked Published. All successful scheduled targets advance the verified task to Scheduled. Open **Schedule → Published & scheduled** and use **Refresh** to retrieve actual delivery results; all published targets advance it to Published and expose their published links. Partial failures and uncertain results stay visible without advancing the stage.

Status reconciliation consumes the existing Schedule response and uses both Tebar post ID and account ID. It makes no additional provider requests or recurring polls. Reopening the same unchanged draft retains its submission ID and receipts, so the composer blocks accidental resubmission. Publishing records and the `contentTaskId` relationship use the existing `genie.marketing.posts` library record, separate from the Content-only JSON backup; preserve the full local library to move both together. Provider keys and secrets remain in Genie's existing configuration flow.

## Local storage and moving existing work

Tasks, questions, references, AI history, and canvas links use `genie.content.v1` in Genie's document library: SQLite on desktop and IndexedDB in the browser. They are separate from canvas JSON backups and provider configuration. Export or restore them in **Content → Pengaturan**. Restoring a Content Studio JSON backup replaces Content's records after confirmation and leaves canvases intact. Export files contain no provider settings or keys. Old standalone JSON exports are accepted, including their original task/question IDs.

For this checkout, a read-only snapshot of the existing `content/.data/studio.sqlite` is prepared under the ignored `.genie-content/legacy-backup.json`. Vite imports this snapshot only when Content has no saved library. Existing Genie content takes precedence; repeat launches do not reimport it. The snapshot is not bundled into production builds. Import that file through Content's settings to move existing work to a desktop installation. Refresh it explicitly with:

```sh
bun scripts/export-content-legacy.ts
```

This reads the original SQLite database, including committed WAL data, and leaves it unchanged. It excludes the standalone app's model settings, because Genie owns its own local OpenCode configuration.

The distributable baseline is `src/content/seed.json`, prepared from the original workbook sources, without production progress or personal edits. Rebuild that baseline and the reference image with `bun scripts/prepare-content-seed.ts`. Bun is needed for these authoring/migration scripts; the integrated app uses Genie's existing Vite/Tauri/Node runtime.

## Verification

```sh
node tests/content-draft.check.mjs
node tests/generate.check.mjs
node tests/narration.check.mjs
npm run test:ui -- tests/content.spec.ts tests/content-publishing.spec.ts tests/social.spec.ts tests/generate.spec.ts
node --test tests/social-api.test.mjs
npm run build
npm run sidecar:prepare
npm run sidecar:check
cargo test --manifest-path src-tauri/Cargo.toml --lib disk::tests
```

Provider responses are mocked in the checks. Ordinary local editing, importing, moving workflow stages, and restoring backups make no inference, audio, or social publishing calls.
