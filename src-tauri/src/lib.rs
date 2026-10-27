mod asset_pack;
mod disk;
mod node_bridge;
mod social;
use serde_json::{Value, json};
use std::{fs, path::PathBuf};
use tauri::{
    Manager,
    ipc::{InvokeBody, Request},
};
pub(crate) fn node_runtime(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("NODE_BIN") {
        return Ok(PathBuf::from(path));
    }
    if cfg!(debug_assertions) {
        return Ok(PathBuf::from("node"));
    }
    let filename = if cfg!(windows) { "node.exe" } else { "node" };
    let runtime = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("sidecar/runtime")
        .join(filename);
    if !runtime.is_file() {
        return Err("The bundled social runtime is missing. Reinstall the desktop app.".into());
    }
    Ok(runtime)
}
#[tauri::command]
async fn save_export(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    request: Request<'_>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected binary export data.".into());
    };
    let bytes = bytes.clone();
    let filename: String = request
        .headers()
        .get("x-export-name")
        .and_then(|v| v.to_str().ok())
        .and_then(|name| serde_json::from_str(name).ok())
        .ok_or("Missing export filename.")?;
    if filename.is_empty() || filename.contains(['/', '\\']) {
        return Err("Invalid export filename.".into());
    }
    let extension = std::path::Path::new(&filename)
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "mp4" | "zip" | "json" | "srt" | "wav"
    ) {
        return Err("Unsupported export format.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("Save export")
            .set_file_name(&filename)
            .add_filter(
                match extension.as_str() {
                    "png" => "PNG image",
                    "jpg" | "jpeg" => "JPEG image",
                    "mp4" => "MP4 video",
                    "zip" => "Image archive",
                    "srt" => "SubRip subtitles",
                    "wav" => "WAV audio",
                    _ => "JSON document",
                },
                &[extension.as_str()],
            )
            .blocking_save_file();
        let Some(selected) = selected else {
            return Ok(None);
        };
        let path = selected.into_path().map_err(|e| e.to_string())?;
        fs::write(&path, bytes).map_err(|e| format!("Could not save {}: {e}", path.display()))?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(social::SocialLock::default())
        .manage(disk::LocalDisk::default())
        .manage(asset_pack::AssetPackState::default())
        .invoke_handler(tauri::generate_handler![
            asset_pack::asset_pack_status,
            asset_pack::asset_pack_choose,
            asset_pack::asset_pack_read,
            asset_pack::asset_pack_read_preset,
            asset_pack::asset_pack_disconnect,
            disk::disk_load,
            disk::disk_write,
            disk::disk_stats,
            disk::disk_backup,
            disk::disk_optimize,
            disk::disk_reveal,
            update_status,
            save_export,
            social::social_settings,
            social::social_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
#[tauri::command]
fn update_status(app: tauri::AppHandle) -> Value {
    let configured = app
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|v| v["pubkey"].as_str())
        .is_some_and(|key| !key.trim().is_empty());
    let supported = !cfg!(target_os = "linux") || std::env::var_os("APPIMAGE").is_some();
    json!({"enabled":configured&&!cfg!(debug_assertions)&&supported,"version":app.package_info().version.to_string(),"reason":if cfg!(debug_assertions){"Updates are available in installed release builds."}else if !supported{"Automatic Linux updates require the AppImage build. Download DEB updates from GitHub releases."}else if !configured{"This build has no updater signing key. Download a signed release from GitHub."}else{""}})
}
