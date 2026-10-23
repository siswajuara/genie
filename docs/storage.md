# Local storage and recovery

Chats, canvases, pages, versions, and personal templates stay on the device. Social publishing data still uses the configured website API. Credentials continue to use the operating system keyring.

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
- **Canvases** supports JSON export and deletion of individual designs. JSON exports are useful for moving designs; database backups also include chat history and personal templates.

Usage shows the library, backups, assistant working files, and free space on its disk. Assistant working files are not removed by library optimization.

For recovery, close Genie and preserve the entire library directory before changing files. A generated backup is a standalone SQLite database. Restore it by replacing `library.sqlite3` while the app is closed, after moving the original database and any `-wal`/`-shm` files aside. There is no in-app database restore control. `legacy-import.json` preserves the original imported records for manual recovery.

## Browser preview

The browser version uses IndexedDB instead of localStorage for large documents and requests persistent storage when supported. Browser storage remains subject to browser quotas and website-data clearing. Native disk controls are available only in the desktop app; keep JSON exports before clearing browser data. Small preferences such as theme remain in localStorage.
