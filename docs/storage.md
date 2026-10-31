# Local storage and recovery

Canvases, pages, versions, personal templates, saved social drafts, and content plans stay on the device. Delivery receipts and request history stay local too. Frame narration drafts, embedded audio tracks, subtitle cues, and caption style belong to canvas documents and their versions.

Content Studio tasks, questions, references, AI draft history, and canvas/page links also stay local under `genie.content.v1`. Their JSON backup is separate from canvas exports; see [Content Studio](content.md).

Provider keys and settings use local `config.json` outside the library database and project exports; no website social API is used.

## Why the old warning appeared

The old app stored complete canvas JSON in `localStorage`, including embedded images repeated in page versions and chat revisions. Browser storage limits can be reached while the computer still has plenty of disk space. The old message also incorrectly described any write failure as full storage.

## Desktop library

The app now uses bundled SQLite through `rusqlite`, with SHA-256 image deduplication through `sha2`. `fs2` reports available disk space. No database server is required.

The library is under Tauri's application data directory, inside `library/library.sqlite3`. Open the exact location from **Settings > Storage > Open storage folder**. Typical locations are:

- macOS: `~/Library/Application Support/<app identifier>/library/`
- Windows: `%APPDATA%/<app identifier>/library/`
- Linux: `~/.local/share/<app identifier>/library/`

Records are saved in atomic transactions with WAL and full synchronization. Changes are queued in memory and persisted in the background. Native window close and update installation wait for pending saves; a failed save keeps the window open. Abrupt process termination can still lose edits that have not reached the database.

The database stores each identical embedded image once across documents and versions. Loaded documents and JSON exports still contain their original image data, so canvas files remain portable. The previous saved value of each changed record is retained for recovery.

## Migration

On first launch the app imports existing large Genie storage records. Existing database records take precedence. Desktop migration first writes `legacy-import.json`, then imports missing records transactionally, reads them back, and verifies their JSON contents before removing matching old storage entries. Conflicting old entries are retained. Initialization failures show a retry screen instead of creating an empty replacement library.

## Storage controls

- **Save now / retry** flushes queued changes and reports write errors.
- **Create library backup** saves a complete SQLite snapshot under `library/backups/`.
- **Reclaim unused space** removes image blobs that are no longer referenced by either current or previous records and compacts SQLite. It preserves conversations, canvases, versions, and backups.
- **Open storage folder** opens the location containing the database and backups. Remove old backup files here only when you no longer need them. No automatic backup deletion is performed.
- **Canvases → Backup** exports all canvases, pages, and versions as JSON. Canvases also supports deleting individual designs. Workspace exports are useful for moving designs; database backups also include personal templates, local publishing records, and retained legacy records.

Workspace JSON backups include canvas pages, versions, and embedded media, including audio and captions. The separate personal-template library is not part of that workspace JSON: export its templates individually or preserve it with a database backup. Provider keys and the external pack catalog are outside both the workspace export and the library database. A saved frame template carries layout and scene/layer animation settings but omits frame narration/audio/caption fields. See the [canvas guide](canvas.md#save-recover-and-move-your-work).

Usage shows the library, backups, archived working files, and free space on its disk. Archived working files are not removed by library optimization.

For recovery, close Genie and preserve the entire library directory before changing files. A generated backup is a standalone SQLite database. Restore it by replacing `library.sqlite3` while the app is closed, after moving the original database and any `-wal`/`-shm` files aside. There is no in-app database restore control. `legacy-import.json` preserves the original imported records for manual recovery.

## Browser preview

The browser version uses IndexedDB instead of localStorage for large documents and requests persistent storage when supported. Browser storage remains subject to browser quotas and website-data clearing. Native disk controls are available only in the desktop app; keep JSON exports before clearing browser data. Small preferences such as theme remain in localStorage.
