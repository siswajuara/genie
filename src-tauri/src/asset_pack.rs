use serde_json::{Value, json};
use std::{
    collections::{HashMap, HashSet},
    fs,
    hash::{Hash, Hasher},
    io::Read,
    path::{Component, Path, PathBuf},
    sync::Mutex,
};
use tauri::State;

#[derive(Clone)]
struct ConnectedPack {
    root: PathBuf,
    token: String,
    manifest: Value,
    files: HashMap<String, (String, String, u64)>,
}
#[derive(Default)]
pub struct AssetPackState(Mutex<Option<ConnectedPack>>);
fn relative(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 512
        && !value
            .chars()
            .any(|c| c.is_control() || "\\:?#%".contains(c))
        && value
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
        && Path::new(value)
            .components()
            .all(|part| matches!(part, Component::Normal(_)))
}
fn contained(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    if !relative(relative_path) {
        return Err("Asset paths must stay inside the selected folder.".into());
    }
    let path = root
        .join(relative_path)
        .canonicalize()
        .map_err(|_| format!("Missing asset file: {relative_path}."))?;
    if !path.starts_with(root) || !path.is_file() {
        return Err("Asset paths must stay inside the selected folder.".into());
    }
    Ok(path)
}
fn read_limited(path: &Path, limit: u64) -> Result<Vec<u8>, String> {
    let file = fs::File::open(path).map_err(|_| "Could not open the asset file.")?;
    if file
        .metadata()
        .map_err(|_| "Could not inspect the asset file.")?
        .len()
        > limit
    {
        return Err("Asset file exceeds the supported size.".into());
    }
    let mut data = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut data)
        .map_err(|_| "Could not read the asset file.")?;
    if data.len() as u64 > limit {
        return Err("Asset file exceeds the supported size.".into());
    }
    Ok(data)
}
fn image_extension(value: &str) -> bool {
    matches!(
        Path::new(value)
            .extension()
            .and_then(|part| part.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "webp"
    )
}
fn load_pack(directory: &Path) -> Result<ConnectedPack, String> {
    let root = directory
        .canonicalize()
        .map_err(|_| "The asset folder is unavailable. Reconnect it in Setting > Assets.")?;
    let bytes = read_limited(&contained(&root, "manifest.json")?, 4 * 1024 * 1024)?;
    let manifest: Value =
        serde_json::from_slice(&bytes).map_err(|_| "Could not read manifest.json.")?;
    if manifest["version"] != 1
        || manifest["id"]
            .as_str()
            .filter(|id| {
                !id.is_empty()
                    && id.len() <= 80
                    && id
                        .chars()
                        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
            })
            .is_none()
        || manifest["name"]
            .as_str()
            .filter(|name| !name.trim().is_empty())
            .is_none()
    {
        return Err("Choose an asset folder with a version 1 manifest.json.".into());
    }
    let assets = manifest["assets"]
        .as_array()
        .filter(|assets| assets.len() <= 10000)
        .ok_or("Invalid asset listing.")?;
    let mut files = HashMap::new();
    let mut ids = HashSet::new();
    for asset in assets {
        let id = asset["id"].as_str().ok_or("Missing asset ID.")?;
        if id.is_empty()
            || id.len() > 120
            || !id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
            || !ids.insert(id)
        {
            return Err("Invalid or duplicate asset ID.".into());
        }
        let media = asset["path"].as_str().ok_or("Missing asset path.")?;
        let thumbnail = asset["thumbnail"]
            .as_str()
            .ok_or("Missing thumbnail path.")?;
        let bytes = asset["bytes"]
            .as_u64()
            .filter(|bytes| *bytes > 0)
            .ok_or("Missing asset size.")?;
        let ext = Path::new(media)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        let mime = asset["mime"].as_str().unwrap_or("");
        let valid = match (asset["type"].as_str(), mime) {
            (Some("image"), "image/png") => ext == "png",
            (Some("image"), "image/jpeg") => ext == "jpg" || ext == "jpeg",
            (Some("image"), "image/webp") => ext == "webp",
            (Some("image"), "image/gif") => ext == "gif",
            (Some("image"), "image/svg+xml") => ext == "svg",
            (Some("video"), "video/mp4") => ext == "mp4" || ext == "m4v",
            (Some("video"), "video/webm") => ext == "webm",
            _ => false,
        };
        let limit = if asset["type"] == "video" { 64 } else { 32 } * 1024 * 1024;
        if !valid || !image_extension(thumbnail) || bytes > limit {
            return Err("Unsupported asset format or size.".into());
        }
        if fs::metadata(contained(&root, media)?)
            .map_err(|_| "Could not inspect the asset file.")?
            .len()
            != bytes
        {
            return Err(format!("Asset size does not match manifest: {media}."));
        }
        if fs::metadata(contained(&root, thumbnail)?)
            .map_err(|_| "Could not inspect the thumbnail.")?
            .len()
            > 1024 * 1024
        {
            return Err("Thumbnail exceeds 1 MB.".into());
        }
        files.insert(
            id.to_string(),
            (media.to_string(), thumbnail.to_string(), bytes),
        );
    }
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    root.hash(&mut hasher);
    bytes.hash(&mut hasher);
    Ok(ConnectedPack {
        root,
        token: format!("{:x}", hasher.finish()),
        manifest,
        files,
    })
}
fn summary(pack: &ConnectedPack) -> Value {
    json!({"directory":pack.root.to_string_lossy(), "token":pack.token, "manifest":pack.manifest})
}
#[tauri::command]
pub async fn asset_pack_status(
    app: tauri::AppHandle,
    state: State<'_, AssetPackState>,
) -> Result<Option<Value>, String> {
    let config = crate::social::load(&app)?;
    let Some(directory) = config["assets"]["directory"].as_str() else {
        return Ok(None);
    };
    let directory = directory.to_owned();
    let pack = tauri::async_runtime::spawn_blocking(move || load_pack(Path::new(&directory)))
        .await
        .map_err(|e| e.to_string())??;
    let result = summary(&pack);
    *state.0.lock().map_err(|_| "Asset library is busy.")? = Some(pack);
    Ok(Some(result))
}
#[tauri::command]
pub async fn asset_pack_choose(
    app: tauri::AppHandle,
    state: State<'_, AssetPackState>,
    social_lock: State<'_, crate::social::SocialLock>,
) -> Result<Option<Value>, String> {
    use tauri_plugin_dialog::DialogExt;
    let picker = app.clone();
    let pack = tauri::async_runtime::spawn_blocking(move || {
        let Some(folder) = picker
            .dialog()
            .file()
            .set_title("Choose the asset folder containing manifest.json")
            .blocking_pick_folder()
        else {
            return Ok(None);
        };
        load_pack(&folder.into_path().map_err(|e| e.to_string())?).map(Some)
    })
    .await
    .map_err(|e| e.to_string())??;
    let Some(pack) = pack else {
        return Ok(None);
    };
    let result = summary(&pack);
    {
        let _guard = social_lock.0.lock().map_err(|_| "Settings are busy.")?;
        let mut config = crate::social::load(&app)?;
        config["assets"] = json!({"directory":pack.root.to_string_lossy()});
        crate::social::save(&app, &config)?;
    }
    *state.0.lock().map_err(|_| "Asset library is busy.")? = Some(pack);
    Ok(Some(result))
}
#[tauri::command]
pub fn asset_pack_disconnect(
    app: tauri::AppHandle,
    state: State<'_, AssetPackState>,
    social_lock: State<'_, crate::social::SocialLock>,
) -> Result<(), String> {
    let _guard = social_lock.0.lock().map_err(|_| "Settings are busy.")?;
    let mut config = crate::social::load(&app)?;
    if let Some(config) = config.as_object_mut() {
        config.remove("assets");
    }
    crate::social::save(&app, &config)?;
    *state.0.lock().map_err(|_| "Asset library is busy.")? = None;
    Ok(())
}
#[tauri::command]
pub async fn asset_pack_read(
    state: State<'_, AssetPackState>,
    token: String,
    id: String,
    thumbnail: bool,
) -> Result<tauri::ipc::Response, String> {
    let (root, relative, limit) = {
        let guard = state.0.lock().map_err(|_| "Asset library is busy.")?;
        let pack = guard.as_ref().ok_or("Connect an asset folder first.")?;
        if pack.token != token {
            return Err("The asset folder changed. Select the asset again.".into());
        }
        let (media, thumb, bytes) = pack
            .files
            .get(&id)
            .ok_or("Asset is not listed in manifest.json.")?;
        (
            pack.root.clone(),
            if thumbnail {
                thumb.clone()
            } else {
                media.clone()
            },
            if thumbnail { 1024 * 1024 } else { *bytes },
        )
    };
    tauri::async_runtime::spawn_blocking(move || {
        read_limited(&contained(&root, &relative)?, limit).map(tauri::ipc::Response::new)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn paths_reject_traversal_absolute_paths_and_url_syntax() {
        for path in [
            "../secret",
            "/etc/passwd",
            "C:/secret",
            "a\\b",
            "a/../b",
            "a//b",
            "a/%2e%2e/b",
            "a?x",
            "./a",
            "a\0b",
        ] {
            assert!(!relative(path), "{path}");
        }
        assert!(relative("video/owl-typing.mp4"));
    }
    #[test]
    fn manifest_files_are_checked_and_duplicate_ids_are_rejected() {
        let root = std::env::temp_dir().join(format!("genie-manifest-test-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("owl.mp4"), b"video").unwrap();
        fs::write(root.join("owl.webp"), b"poster").unwrap();
        let asset = json!({"id":"owl", "type":"video", "path":"owl.mp4", "thumbnail":"owl.webp", "mime":"video/mp4", "bytes":5});
        let mut manifest =
            json!({"version":1,"id":"test-pack","name":"Test pack","assets":[asset.clone()]});
        fs::write(
            root.join("manifest.json"),
            serde_json::to_vec(&manifest).unwrap(),
        )
        .unwrap();
        let pack = load_pack(&root).unwrap();
        assert_eq!(pack.files["owl"].2, 5);
        assert_eq!(
            read_limited(&contained(&pack.root, "owl.mp4").unwrap(), 5).unwrap(),
            b"video"
        );
        assert!(read_limited(&contained(&pack.root, "owl.mp4").unwrap(), 4).is_err());
        manifest["assets"].as_array_mut().unwrap().push(asset);
        fs::write(
            root.join("manifest.json"),
            serde_json::to_vec(&manifest).unwrap(),
        )
        .unwrap();
        assert!(load_pack(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn symlinks_cannot_escape_the_asset_folder() {
        let base = std::env::temp_dir().join(format!("genie-pack-test-{}", std::process::id()));
        let root = base.join("pack");
        fs::create_dir_all(&root).unwrap();
        fs::write(base.join("outside.png"), b"outside").unwrap();
        let root = root.canonicalize().unwrap();
        std::os::unix::fs::symlink(base.join("outside.png"), root.join("escape.png")).unwrap();
        assert!(contained(&root, "escape.png").is_err());
        fs::remove_dir_all(base).unwrap();
    }
}
