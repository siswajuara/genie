use serde_json::{Value, json};
use std::{
    fs,
    io::Write,
    process::{Command, Stdio},
    sync::{Arc, Mutex},
};
use tauri::{Manager, State};

#[derive(Default)]
pub struct SocialLock(pub Arc<Mutex<()>>);
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.siswajuara.genie.social", "providers")
        .map_err(|_| "Could not access the operating system credential vault.".into())
}
fn load() -> Result<Value, String> {
    match entry()?.get_password() {
        Ok(value) => {
            serde_json::from_str(&value).map_err(|_| "Social credentials could not be read.".into())
        }
        Err(keyring::Error::NoEntry) => {
            Ok(json!({"buffer":{"key":"","organizationId":""},"zernio":{"key":"","profileId":""}}))
        }
        Err(_) => {
            Err("Unlock your operating system credential vault to use social connections.".into())
        }
    }
}
fn public(config: &Value) -> Value {
    json!({"storage":"keychain","buffer":{"configured":!config["buffer"]["key"].as_str().unwrap_or("").is_empty(),"organizationId":config["buffer"]["organizationId"].as_str().unwrap_or("")},"zernio":{"configured":!config["zernio"]["key"].as_str().unwrap_or("").is_empty(),"profileId":config["zernio"]["profileId"].as_str().unwrap_or("")}})
}
#[tauri::command]
pub async fn social_settings(
    lock: State<'_, SocialLock>,
    payload: Option<Value>,
) -> Result<Value, String> {
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|_| "Social settings are busy.")?;
        let mut config = load()?;
        if let Some(payload) = payload.filter(|value| value.get("provider").is_some()) {
            let provider = payload["provider"].as_str().ok_or("Choose a provider.")?;
            if !["buffer", "zernio"].contains(&provider) {
                return Err("Unknown social provider.".into());
            }
            if payload["removeKey"].as_bool() == Some(true) {
                config[provider]["key"] = json!("");
            } else if let Some(key) = payload["key"].as_str() {
                if key.trim().is_empty() || key.len() > 8192 || key.contains(['\n', '\r']) {
                    return Err("Enter a valid API key.".into());
                }
                config[provider]["key"] = json!(key.trim());
            }
            for field in ["organizationId", "profileId"] {
                if let Some(value) = payload[field].as_str() {
                    if value.len() > 300 {
                        return Err("The selected resource ID is too long.".into());
                    }
                    config[provider][field] = json!(value);
                }
            }
            entry()?.set_password(&config.to_string()).map_err(|_| {
                "Could not save API keys in the operating system credential vault.".to_string()
            })?;
        }
        Ok(public(&config))
    })
    .await
    .map_err(|_| "Could not access social settings.".to_string())?
}
#[tauri::command]
pub async fn social_request(
    app: tauri::AppHandle,
    lock: State<'_, SocialLock>,
    action: String,
    payload: Option<Value>,
) -> Result<Value, String> {
    if ![
        "accounts",
        "test",
        "connect",
        "createProfile",
        "posts",
        "upload",
        "publish",
        "insights",
        "inbox",
        "comments",
        "reply",
    ]
    .contains(&action.as_str())
    {
        return Err("Unknown social action.".into());
    }
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move||{
    let _guard=lock.lock().map_err(|_|"Social connections are busy.")?;let config=load()?;
    let base=crate::bridge_command(&app)?;let mut command=Command::new(base.get_program());
    let script=if cfg!(debug_assertions){std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../sidecar/social-bridge.mjs")}else{app.path().resource_dir().map_err(|e|e.to_string())?.join("sidecar/social-bridge.mjs")};
    let directory=app.path().app_data_dir().map_err(|e|e.to_string())?.join("social");fs::create_dir_all(&directory).map_err(|_|"Could not create social request history.")?;
    command.arg(script).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
    #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
    let mut child=command.spawn().map_err(|_|"Could not start the bundled social integration runtime.".to_string())?;
    let request=json!({"config":config,"action":action,"payload":payload.unwrap_or(json!({})),"statePath":directory.join("requests.json")});
    child.stdin.take().ok_or("Missing social request input.")?.write_all(request.to_string().as_bytes()).map_err(|_|"Could not send the social request.")?;
    let output=child.wait_with_output().map_err(|_|"The social request stopped. Check provider posts before retrying a publish action.")?;
    let body:Value=serde_json::from_slice(&output.stdout).map_err(|_|"The provider response was interrupted. Check provider posts before retrying.")?;
    if let Some(error)=body["error"].as_str(){return Err(error.into());}Ok(body["data"].clone())
  }).await.map_err(|_|"The social integration stopped.".to_string())?
}
