mod disk;
use serde_json::{json, Value};
mod social;
use std::{collections::HashMap, fs, io::{BufRead, BufReader, Read, Write}, path::PathBuf, process::{Child, ChildStdin, Command, Stdio}, sync::{Arc, Mutex}, time::{SystemTime, UNIX_EPOCH}};
use tauri::{ipc::{Channel, InvokeBody, Request}, Manager, State};
#[derive(Default)]
struct Runs(Mutex<HashMap<String, Run>>);
struct Run { child: Arc<Mutex<Child>>, stdin: Arc<Mutex<ChildStdin>> }
#[tauri::command]
async fn save_export(app: tauri::AppHandle, window: tauri::WebviewWindow, request: Request<'_>) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let InvokeBody::Raw(bytes) = request.body() else { return Err("Expected binary export data.".into()); };
    let bytes = bytes.clone();
    let filename: String = request.headers().get("x-export-name").and_then(|v|v.to_str().ok())
        .and_then(|name|serde_json::from_str(name).ok()).ok_or("Missing export filename.")?;
    if filename.is_empty() || filename.contains(['/', '\\']) { return Err("Invalid export filename.".into()); }
    let extension = std::path::Path::new(&filename).extension().and_then(|v|v.to_str()).unwrap_or("").to_lowercase();
    if !matches!(extension.as_str(), "png" | "json") { return Err("Unsupported export format.".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app.dialog().file().set_parent(&window).set_title("Save export")
            .set_file_name(&filename).add_filter(if extension == "png" { "PNG image" } else { "JSON document" }, &[extension.as_str()])
            .blocking_save_file();
        let Some(selected) = selected else { return Ok(None); };
        let path = selected.into_path().map_err(|e|e.to_string())?;
        fs::write(&path, bytes).map_err(|e|format!("Could not save {}: {e}", path.display()))?;
        Ok(Some(path.to_string_lossy().into_owned()))
    }).await.map_err(|e|e.to_string())?
}
fn bridge_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("CODEX_BRIDGE_PATH") { return Ok(PathBuf::from(p)); }
    if cfg!(debug_assertions) { return Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../sidecar/codex-bridge.mjs")); }
    Ok(app.path().resource_dir().map_err(|e|e.to_string())?.join("sidecar/codex-bridge.mjs"))
}
fn bridge_command(app: &tauri::AppHandle) -> Result<Command, String> {
    let node = if let Ok(path) = std::env::var("NODE_BIN") { PathBuf::from(path) }
        else if cfg!(debug_assertions) { PathBuf::from("node") }
        else {
            let filename = if cfg!(windows) { "node.exe" } else { "node" };
            let runtime = app.path().resource_dir().map_err(|e|e.to_string())?.join("sidecar/runtime").join(filename);
            if !runtime.is_file() { return Err("The bundled Node runtime is missing. Reinstall the desktop app.".into()); }
            runtime
        };
    let mut command = Command::new(node);
    command.arg(bridge_path(app)?);
    #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
    Ok(command)
}
#[tauri::command]
async fn codex_status(app: tauri::AppHandle, codex_path: Option<String>) -> Result<Value, String> {
    let mut command = bridge_command(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        command.arg("--status");
        if let Some(path) = codex_path.filter(|p| !p.trim().is_empty()) { command.arg(path); }
        let output = command.output().map_err(|e| format!("Could not start Node: {e}. Set NODE_BIN to your Node executable."))?;
        serde_json::from_slice(&output.stdout).map_err(|_| format!("Could not check Codex: {}", String::from_utf8_lossy(&output.stderr)))
    }).await.map_err(|e|e.to_string())?
}
fn workspace(app: &tauri::AppHandle, key: &str) -> Result<PathBuf,String> {
    let key: String=key.chars().filter(|c|c.is_ascii_alphanumeric()||*c=='-').take(80).collect();
    if key.is_empty(){return Err("Invalid workspace key".into());}
    let dir=app.path().app_data_dir().map_err(|e|e.to_string())?.join("workspace").join(key);
    fs::create_dir_all(&dir).map_err(|e|e.to_string())?; Ok(dir)
}
#[tauri::command]
fn codex_run(app: tauri::AppHandle, runs: State<Runs>, mut request: Value, on_event: Channel<Value>) -> Result<String,String> {
    let dir=workspace(&app,request["key"].as_str().unwrap_or("default"))?;
    request["workingDirectory"]=json!(dir);
    let mut command=bridge_command(&app)?;
    command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child=command.spawn().map_err(|e|format!("Could not start Node: {e}. Install Node or set NODE_BIN."))?;
    let stdin=Arc::new(Mutex::new(child.stdin.take().ok_or("Missing stdin")?));
    let stdout=child.stdout.take().ok_or("Missing stdout")?;
    let mut stderr=child.stderr.take().ok_or("Missing stderr")?;
    let child=Arc::new(Mutex::new(child));
    let id=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos().to_string();
    runs.0.lock().unwrap().insert(id.clone(),Run {child:child.clone(),stdin:stdin.clone()});
    let run_id=id.clone();
    std::thread::spawn(move||{
        let err_task=std::thread::spawn(move||{let mut value=String::new();let _=stderr.read_to_string(&mut value);value});
        let mut finished=false;
        let result=(|| -> Result<(),String>{
            writeln!(stdin.lock().unwrap(),"{}",request).map_err(|e|e.to_string())?;
            for line in BufReader::new(stdout).lines(){
                let line=line.map_err(|e|e.to_string())?;
                if let Ok(event)=serde_json::from_str::<Value>(&line){if event["type"]=="done"||event["type"]=="error"{finished=true;}let _=on_event.send(event);}
            } Ok(())
        })();
        drop(stdin);
        let _=child.lock().unwrap().wait();
        app.state::<Runs>().0.lock().unwrap().remove(&run_id);
        if !finished {let error=err_task.join().unwrap_or_default();let _=on_event.send(json!({"type":"error","message":result.err().unwrap_or_else(||format!("Codex stopped. {}",error.chars().take(1500).collect::<String>()))}));}
    });
    Ok(id)
}
#[tauri::command]
fn cancel_run(runs: State<Runs>, request_id: String) -> Result<(),String> {
    let runs=runs.0.lock().unwrap();
    if let Some(run)=runs.get(&request_id) {writeln!(run.stdin.lock().unwrap(),"{{\"type\":\"cancel\"}}").map_err(|e|e.to_string())?;} Ok(())
}
#[tauri::command]
fn reveal_workspace(app:tauri::AppHandle,key:String)->Result<(),String>{
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_path(workspace(&app,&key)?.to_string_lossy().to_string(),None::<&str>).map_err(|e|e.to_string())
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default().plugin(tauri_plugin_opener::init()).plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build()).plugin(tauri_plugin_process::init()).manage(Runs::default())
        .manage(social::SocialLock::default())
        .manage(disk::LocalDisk::default())
        .invoke_handler(tauri::generate_handler![disk::disk_load,disk::disk_write,disk::disk_stats,disk::disk_backup,disk::disk_optimize,disk::disk_reveal,update_status,prepare_update,save_export,codex_run,codex_status,cancel_run,reveal_workspace,social::social_settings,social::social_request])
        .on_window_event(|window,event|{if matches!(event,tauri::WindowEvent::Destroyed){for run in window.state::<Runs>().0.lock().unwrap().values(){let _=writeln!(run.stdin.lock().unwrap(),"{{\"type\":\"cancel\"}}");let _=run.child.lock().unwrap().kill();}}})
        .run(tauri::generate_context!()).expect("error while running tauri application");
}
#[tauri::command]
fn update_status(app:tauri::AppHandle)->Value {
    let configured=app.config().plugins.0.get("updater").and_then(|v|v["pubkey"].as_str()).is_some_and(|key|!key.trim().is_empty());
    let supported=!cfg!(target_os="linux")||std::env::var_os("APPIMAGE").is_some();
    json!({"enabled":configured&&!cfg!(debug_assertions)&&supported,"version":app.package_info().version.to_string(),"reason":if cfg!(debug_assertions){"Updates are available in installed release builds."}else if !supported{"Automatic Linux updates require the AppImage build. Download DEB updates from GitHub releases."}else if !configured{"This build has no updater signing key. Download a signed release from GitHub."}else{""}})
}
#[tauri::command]
fn prepare_update(runs:State<Runs>)->Result<(),String>{
    if !runs.0.lock().map_err(|_|"Could not check active conversations.")?.is_empty(){return Err("Finish or stop the active assistant response before installing the update.".into());}Ok(())
}
