use serde_json::{Value, json};
use std::{
    io::Write,
    process::Stdio,
    sync::{Arc, Mutex},
};
use tauri::{Manager, State};
const DEFAULT_API_URL: &str = "https://siswajuara.com/api/genie-social";
#[derive(Default)]
pub struct SocialLock(pub Arc<Mutex<()>>);
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.siswajuara.genie.social-api", "connection")
        .map_err(|_| "Could not access the credential vault.".into())
}
fn load() -> Result<Value, String> {
    match entry()?.get_password() {
        Ok(value) => {
            serde_json::from_str(&value).map_err(|_| "Invalid website API connection.".into())
        }
        Err(keyring::Error::NoEntry) => Ok(json!({"url":DEFAULT_API_URL,"token":""})),
        Err(_) => Err("Unlock your credential vault to connect the website API.".into()),
    }
}
fn public(config: &Value) -> Value {
    json!({"url":config["url"].as_str().filter(|url|!url.is_empty()).unwrap_or(DEFAULT_API_URL),"configured":!config["token"].as_str().unwrap_or("").is_empty(),"storage":"keychain"})
}
#[tauri::command]
pub async fn social_settings(
    lock: State<'_, SocialLock>,
    payload: Option<Value>,
) -> Result<Value, String> {
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|_| "Connection is busy.")?;
        let mut config = load()?;
        if let Some(payload) =
            payload.filter(|p| p.get("url").is_some() || p.get("remove").is_some())
        {
            if payload["remove"].as_bool() == Some(true) {
                config = json!({"url":DEFAULT_API_URL,"token":""});
            } else {
                let raw = payload["url"]
                    .as_str()
                    .ok_or("Enter your website API URL.")?
                    .trim();
                let url = tauri::Url::parse(raw).map_err(|_| "Enter a valid website API URL.")?;
                let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
                if (url.scheme() != "https" && !(local && url.scheme() == "http"))
                    || !url.username().is_empty()
                    || url.password().is_some()
                    || url.query().is_some()
                    || url.fragment().is_some()
                {
                    return Err("Use HTTPS, or HTTP localhost for development.".into());
                }
                if config["url"]
                    .as_str()
                    .is_some_and(|saved| !saved.is_empty() && saved != raw.trim_end_matches('/'))
                    && payload["token"].as_str().is_none()
                {
                    return Err("Enter a token for the new API URL.".into());
                }
                config["url"] = json!(raw.trim_end_matches('/'));
                if let Some(token) = payload["token"].as_str() {
                    if token.is_empty() || token.len() > 8192 || token.contains(['\r', '\n']) {
                        return Err("Enter a valid website API token.".into());
                    }
                    config["token"] = json!(token);
                }
            }
            entry()?
                .set_password(&config.to_string())
                .map_err(|_| "Could not save the website API connection.".to_string())?;
        }
        Ok(public(&config))
    })
    .await
    .map_err(|_| "Could not access connection settings.".to_string())?
}
#[tauri::command]
pub async fn social_request(
    app: tauri::AppHandle,
    lock: State<'_, SocialLock>,
    action: String,
    payload: Option<Value>,
) -> Result<Value, String> {
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let config = {
            let _guard = lock.lock().map_err(|_| "Connection is busy.")?;
            load()?
        };
        let base = crate::bridge_command(&app)?;
        let script = if cfg!(debug_assertions) {
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../sidecar/social-bridge.mjs")
        } else {
            app.path()
                .resource_dir()
                .map_err(|e| e.to_string())?
                .join("sidecar/social-bridge.mjs")
        };
        let mut command =
            crate::node_bridge::command(std::path::Path::new(base.get_program()), &script);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        let mut child = command
            .spawn()
            .map_err(|_| "Could not start the website API bridge.".to_string())?;
        child
            .stdin
            .take()
            .ok_or("Missing input.")?
            .write_all(
                json!({"config":config,"action":action,"payload":payload.unwrap_or(json!({}))})
                    .to_string()
                    .as_bytes(),
            )
            .map_err(|_| "Could not send the API request.")?;
        let output = child.wait_with_output().map_err(
            |_| "Website API request interrupted. Check submission status before retrying.",
        )?;
        let body: Value =
            serde_json::from_slice(&output.stdout).map_err(|_| "Invalid website API response.")?;
        if let Some(error) = body["error"].as_str() {
            return Err(error.into());
        }
        Ok(body["data"].clone())
    })
    .await
    .map_err(|_| "Website API bridge stopped.".to_string())?
}
