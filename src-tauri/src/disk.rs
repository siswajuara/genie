use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::Path,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, State};

#[derive(Default)]
pub struct LocalDisk(pub Arc<Mutex<()>>);
#[derive(Deserialize, Serialize, Clone)]
pub struct Record {
    key: String,
    value: Option<String>,
}
fn allowed(key: &str) -> bool {
    [
        "genie.workspace.",
        "genie.chat.",
        "genie.conversation.",
        "genie.revisions.",
        "genie.marketing.composer.",
    ]
    .iter()
    .any(|prefix| key.starts_with(prefix))
        || matches!(
            key,
            "genie.canvas" | "genie.presets" | "genie.marketing.posts"
        )
}
fn open(directory: &Path) -> Result<Connection, String> {
    fs::create_dir_all(directory)
        .map_err(|e| format!("Could not create the local library: {e}"))?;
    let path = directory.join("library.sqlite3");
    let connection =
        Connection::open(&path).map_err(|e| format!("Could not open the local library: {e}"))?;
    connection
        .busy_timeout(Duration::from_secs(10))
        .map_err(|e| e.to_string())?;
    connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS documents(key TEXT PRIMARY KEY,value TEXT NOT NULL,is_json INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS previous(key TEXT PRIMARY KEY,value TEXT NOT NULL,is_json INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,value TEXT NOT NULL);").map_err(|e|e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
        fs::set_permissions(directory, fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
    }
    Ok(connection)
}
fn pack(value: &mut Value, connection: &Connection) -> Result<(), String> {
    match value {
        Value::String(src) if src.starts_with("data:image/") || src.starts_with("data:video/") => {
            let id = format!("{:x}", Sha256::digest(src.as_bytes()));
            connection
                .execute(
                    "INSERT OR IGNORE INTO assets(id,value) VALUES(?1,?2)",
                    params![id, src.as_str()],
                )
                .map_err(|e| e.to_string())?;
            *value = json!({"__genie_local_asset":id});
        }
        Value::Array(items) => {
            for item in items {
                pack(item, connection)?;
            }
        }
        Value::Object(object) => {
            let needs_escape = object.contains_key("__genie_local_asset")
                || object.contains_key("__genie_local_object");
            for item in object.values_mut() {
                pack(item, connection)?;
            }
            if needs_escape {
                let original = std::mem::take(object);
                *value = json!({"__genie_local_object": original});
            }
        }
        _ => {}
    }
    Ok(())
}
fn unpack(value: &mut Value, assets: &HashMap<String, String>) -> Result<(), String> {
    if let Some(object) = value.as_object_mut() {
        if object.len() == 1
            && object
                .get("__genie_local_object")
                .is_some_and(Value::is_object)
        {
            let mut original = object.remove("__genie_local_object").unwrap();
            for item in original.as_object_mut().unwrap().values_mut() {
                unpack(item, assets)?;
            }
            *value = original;
            return Ok(());
        }
    }
    if let Some(object) = value.as_object() {
        if object.len() == 1 {
            if let Some(id) = object.get("__genie_local_asset").and_then(Value::as_str) {
                *value = json!(assets.get(id).ok_or(
                    "An image in the local library is missing. Keep the library files for recovery."
                )?);
                return Ok(());
            }
        }
    }
    match value {
        Value::Array(items) => {
            for item in items {
                unpack(item, assets)?;
            }
        }
        Value::Object(object) => {
            for item in object.values_mut() {
                unpack(item, assets)?;
            }
        }
        _ => {}
    }
    Ok(())
}
fn write_records(
    connection: &mut Connection,
    records: &[Record],
    only_missing: bool,
) -> Result<(), String> {
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    for record in records {
        if !allowed(&record.key) {
            return Err("Unsupported local library key.".into());
        }
        if only_missing
            && transaction
                .query_row(
                    "SELECT 1 FROM documents WHERE key=?1",
                    [&record.key],
                    |row| row.get::<_, i64>(0),
                )
                .optional()
                .map_err(|e| e.to_string())?
                .is_some()
        {
            continue;
        }
        if let Some(value) = &record.value {
            let (value, is_json) = match serde_json::from_str::<Value>(value) {
                Ok(mut document) => {
                    pack(&mut document, &transaction)?;
                    (document.to_string(), true)
                }
                Err(_) => (value.clone(), false),
            };
            let current: Option<(String, bool)> = transaction
                .query_row(
                    "SELECT value,is_json FROM documents WHERE key=?1",
                    [&record.key],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional()
                .map_err(|e| e.to_string())?;
            if current.as_ref() == Some(&(value.clone(), is_json)) {
                continue;
            }
            transaction.execute("INSERT OR REPLACE INTO previous SELECT key,value,is_json FROM documents WHERE key=?1",[&record.key]).map_err(|e|e.to_string())?;
            transaction
                .execute(
                    "INSERT OR REPLACE INTO documents(key,value,is_json) VALUES(?1,?2,?3)",
                    params![record.key, value, is_json],
                )
                .map_err(|e| e.to_string())?;
        } else {
            transaction
                .execute("DELETE FROM documents WHERE key=?1", [&record.key])
                .map_err(|e| e.to_string())?;
            transaction
                .execute("DELETE FROM previous WHERE key=?1", [&record.key])
                .map_err(|e| e.to_string())?;
        }
    }
    transaction.commit().map_err(|e| {
        format!(
            "Could not save the local library. Check free disk space and folder permissions: {e}"
        )
    })
}
fn read_records(connection: &Connection) -> Result<Vec<Record>, String> {
    let assets = connection
        .prepare("SELECT id,value FROM assets")
        .map_err(|e| e.to_string())?
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<HashMap<_, _>, _>>()
        .map_err(|e| e.to_string())?;
    let mut statement = connection
        .prepare("SELECT key,value,is_json FROM documents")
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, bool>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    rows.map(|row| {
        let (key, value, is_json) = row.map_err(|e| e.to_string())?;
        let value = if is_json {
            let mut document: Value = serde_json::from_str(&value).map_err(|e| e.to_string())?;
            unpack(&mut document, &assets)?;
            document.to_string()
        } else {
            value
        };
        Ok(Record {
            key,
            value: Some(value),
        })
    })
    .collect()
}
async fn operation<T: Send + 'static>(
    app: tauri::AppHandle,
    lock: Arc<Mutex<()>>,
    run: impl FnOnce(&mut Connection, &Path) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|_| "The local library is busy.")?;
        let directory = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("library");
        let mut connection = open(&directory)?;
        run(&mut connection, &directory)
    })
    .await
    .map_err(|_| "The local library operation stopped.".to_string())?
}
#[tauri::command]
pub async fn disk_load(
    app: tauri::AppHandle,
    lock: State<'_, LocalDisk>,
) -> Result<Vec<Record>, String> {
    operation(app, lock.0.clone(), |connection, _| {
        let check: String = connection
            .query_row("PRAGMA quick_check", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        if check != "ok" {
            return Err(
                "The local library needs recovery. Your existing files have been kept.".into(),
            );
        }
        read_records(connection)
    })
    .await
}
#[tauri::command]
pub async fn disk_write(
    app: tauri::AppHandle,
    lock: State<'_, LocalDisk>,
    records: Vec<Record>,
    migration: Option<bool>,
) -> Result<(), String> {
    operation(app, lock.0.clone(), move |connection, directory| {
        if migration == Some(true) {
            let backup = directory.join("legacy-import.json");
            if !backup.exists() {
                let file = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(backup)
                    .map_err(|e| e.to_string())?;
                serde_json::to_writer(&file, &records).map_err(|e| e.to_string())?;
                file.sync_all().map_err(|e| e.to_string())?;
            }
        }
        write_records(connection, &records, migration == Some(true))
    })
    .await
}
fn bytes(path: &Path) -> u64 {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return 0;
    };
    if metadata.is_symlink() {
        return 0;
    }
    if metadata.is_file() {
        return metadata.len();
    }
    fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| bytes(&entry.path()))
                .sum()
        })
        .unwrap_or(0)
}
#[tauri::command]
pub async fn disk_stats(
    app: tauri::AppHandle,
    lock: State<'_, LocalDisk>,
) -> Result<Value, String> {
    operation(app,lock.0.clone(),|connection,directory|{
 let count:i64=connection.query_row("SELECT COUNT(*) FROM assets",[],|row|row.get(0)).map_err(|e|e.to_string())?;
 let image_bytes:i64=connection.query_row("SELECT COALESCE(SUM(length(value)),0) FROM assets",[],|row|row.get(0)).map_err(|e|e.to_string())?;
 let documents:i64=connection.query_row("SELECT COALESCE(SUM(length(value)),0) FROM documents",[],|row|row.get(0)).map_err(|e|e.to_string())?;
 Ok(json!({"directory":directory.to_string_lossy(),"databaseBytes":bytes(&directory.join("library.sqlite3"))+bytes(&directory.join("library.sqlite3-wal")),"imageBytes":image_bytes,"imageCount":count,"documentBytes":documents,"backupBytes":bytes(&directory.join("backups"))+bytes(&directory.join("legacy-import.json")),"assistantBytes":bytes(&directory.parent().unwrap_or(directory).join("workspace")),"freeBytes":fs2::available_space(directory).ok()}))
}).await
}
#[tauri::command]
pub async fn disk_backup(
    app: tauri::AppHandle,
    lock: State<'_, LocalDisk>,
) -> Result<String, String> {
    operation(app, lock.0.clone(), |connection, directory| {
        let backups = directory.join("backups");
        fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis();
        let file = backups.join(format!("library-{timestamp}.sqlite3"));
        connection
            .execute("VACUUM INTO ?1", [file.to_string_lossy().as_ref()])
            .map_err(|e| e.to_string())?;
        Ok(file.to_string_lossy().into_owned())
    })
    .await
}
fn references(value: &Value, used: &mut HashSet<String>) {
    if let Some(id) = value.get("__genie_local_asset").and_then(Value::as_str) {
        used.insert(id.to_string());
    }
    match value {
        Value::Array(items) => {
            for item in items {
                references(item, used);
            }
        }
        Value::Object(object) => {
            for item in object.values() {
                references(item, used);
            }
        }
        _ => {}
    }
}
#[tauri::command]
pub async fn disk_optimize(
    app: tauri::AppHandle,
    lock: State<'_, LocalDisk>,
) -> Result<Value, String> {
    operation(app,lock.0.clone(),|connection,directory|{
 let before=bytes(&directory.join("library.sqlite3"))+bytes(&directory.join("library.sqlite3-wal"));let mut used=HashSet::new();
 {let mut statement=connection.prepare("SELECT value FROM documents WHERE is_json=1 UNION ALL SELECT value FROM previous WHERE is_json=1").map_err(|e|e.to_string())?;for row in statement.query_map([],|row|row.get::<_,String>(0)).map_err(|e|e.to_string())?{let document:Value=serde_json::from_str(&row.map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;references(&document,&mut used);}}
 let ids:Vec<String>=connection.prepare("SELECT id FROM assets").map_err(|e|e.to_string())?.query_map([],|row|row.get(0)).map_err(|e|e.to_string())?.collect::<Result<_,_>>().map_err(|e|e.to_string())?;
 let transaction=connection.transaction().map_err(|e|e.to_string())?;for id in ids {if !used.contains(&id){transaction.execute("DELETE FROM assets WHERE id=?1",[id]).map_err(|e|e.to_string())?;}}transaction.commit().map_err(|e|e.to_string())?;
 connection.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;").map_err(|e|e.to_string())?;let after=bytes(&directory.join("library.sqlite3"))+bytes(&directory.join("library.sqlite3-wal"));Ok(json!({"reclaimedBytes":before.saturating_sub(after)}))
}).await
}
#[tauri::command]
pub fn disk_reveal(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("library");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn image_deduplication_preserves_versions_and_roundtrips() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE documents(key TEXT PRIMARY KEY,value TEXT,is_json INTEGER);CREATE TABLE previous(key TEXT PRIMARY KEY,value TEXT,is_json INTEGER);CREATE TABLE assets(id TEXT PRIMARY KEY,value TEXT);").unwrap();
        let value=json!({"pages":[{"src":"data:image/png;base64,AAAA"}],"versions":[{"src":"data:image/png;base64,AAAA"}],"custom":{"__genie_local_asset":"original user metadata"}}).to_string();
        write_records(
            &mut db,
            &[Record {
                key: "genie.workspace.v1".into(),
                value: Some(value.clone()),
            }],
            false,
        )
        .unwrap();
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM assets", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
        let actual: Value =
            serde_json::from_str(read_records(&db).unwrap()[0].value.as_ref().unwrap()).unwrap();
        assert_eq!(actual, serde_json::from_str::<Value>(&value).unwrap());
        write_records(
            &mut db,
            &[Record {
                key: "genie.workspace.v1".into(),
                value: Some("{}".into()),
            }],
            true,
        )
        .unwrap();
        assert_eq!(
            read_records(&db).unwrap()[0].value.as_ref().unwrap(),
            &value
        );
        assert!(
            write_records(
                &mut db,
                &[
                    Record {
                        key: "genie.workspace.v1".into(),
                        value: Some("{}".into())
                    },
                    Record {
                        key: "unsupported.key".into(),
                        value: Some("bad".into())
                    },
                ],
                false
            )
            .is_err()
        );
        assert_eq!(
            read_records(&db).unwrap()[0].value.as_ref().unwrap(),
            &value
        );
    }
}
