use serde_json::{Value, json};
use std::{
    fs,
    io::Write,
    process::Stdio,
    sync::{Arc, Mutex},
};
use tauri::{Manager, State};

#[derive(Default)]
pub struct SocialLock(pub Arc<Mutex<()>>);
fn config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("config.json"))
}
pub(crate) fn load(app: &tauri::AppHandle) -> Result<Value, String> {
    let mut config: Value = match fs::read(config_path(app)?) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|_| "Could not read config.json.")?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => json!({}),
        Err(_) => return Err("Could not read config.json.".into()),
    };
    if !config.is_object() {
        return Err("config.json must contain an object.".into());
    }
    for provider in ["buffer", "zernio", "elevenlabs", "soniox"] {
        if config.get(provider).is_none() {
            config[provider] = json!({"key":""});
        }
        if !config[provider].is_object() {
            return Err(format!("Invalid {provider} configuration in config.json."));
        }
    }
    Ok(config)
}
pub(crate) fn save(app: &tauri::AppHandle, config: &Value) -> Result<(), String> {
    let path = config_path(app)?;
    fs::create_dir_all(path.parent().ok_or("Missing config directory.")?)
        .map_err(|_| "Could not create config directory.")?;
    let temporary = path.with_extension("json.tmp");
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?,
    )
    .map_err(|_| "Could not write config.json.")?;
    fs::rename(&temporary, &path).map_err(|_| "Could not save config.json.".into())
}
fn public(config: &Value) -> Value {
    let accounts: Vec<Value> = audio_accounts(config).iter().map(|account| json!({"id":account["id"],"name":account["name"],"configured":!account["key"].as_str().unwrap_or("").is_empty(),"enabled":account["enabled"].as_bool().unwrap_or(true)})).collect();
    json!({"storage":"file","elevenlabs":{"configured":accounts.iter().any(|account| account["configured"] == true),"accounts":accounts},"buffer":{"configured":!config["buffer"]["key"].as_str().unwrap_or("").is_empty(),"organizationId":config["buffer"]["organizationId"].as_str().unwrap_or("")},"zernio":{"configured":!config["zernio"]["key"].as_str().unwrap_or("").is_empty(),"profileId":config["zernio"]["profileId"].as_str().unwrap_or("")}})
}
fn audio_accounts(config: &Value) -> Vec<Value> {
    let mut accounts = config["elevenlabs"]["accounts"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    if let Some(key) = config["elevenlabs"]["key"]
        .as_str()
        .filter(|key| !key.is_empty())
    {
        if !accounts
            .iter()
            .any(|account| account["key"].as_str() == Some(key))
        {
            accounts.insert(
                0,
                json!({"id":"legacy","name":"ElevenLabs account","key":key,"enabled":true}),
            );
        }
    }
    accounts
}
fn save_audio_account(config: &mut Value, payload: &Value) -> Result<(), String> {
    let id = payload["accountId"].as_str().unwrap_or("legacy");
    if id.is_empty()
        || id.len() > 80
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("Choose a valid account ID.".into());
    }
    let mut accounts = audio_accounts(config);
    let index = accounts
        .iter()
        .position(|account| account["id"].as_str() == Some(id));
    if payload["removeKey"].as_bool() == Some(true) {
        accounts.remove(index.ok_or("ElevenLabs account not found.")?);
    } else {
        let mut account = index
            .map(|index| accounts[index].clone())
            .unwrap_or(json!({"id":id,"name":"ElevenLabs account","key":"","enabled":true}));
        if let Some(key) = payload.get("key") {
            let key = key.as_str().ok_or("Enter a valid API key.")?;
            if key.trim().is_empty() || key.len() > 8192 || key.contains(['\n', '\r']) {
                return Err("Enter a valid API key.".into());
            }
            account["key"] = json!(key.trim());
        }
        if account["key"].as_str().unwrap_or("").is_empty() {
            return Err("Enter an API key for the new account.".into());
        }
        if accounts
            .iter()
            .any(|other| other["id"].as_str() != Some(id) && other["key"] == account["key"])
        {
            return Err("This API key is already saved.".into());
        }
        if let Some(name) = payload.get("name") {
            let name = name
                .as_str()
                .ok_or("Enter an account name under 100 characters.")?;
            if name.trim().is_empty() || name.chars().count() > 100 {
                return Err("Enter an account name under 100 characters.".into());
            }
            account["name"] = json!(name.trim());
        }
        if let Some(enabled) = payload["enabled"].as_bool() {
            account["enabled"] = json!(enabled);
        }
        if let Some(index) = index {
            accounts[index] = account;
        } else {
            accounts.push(account);
        }
    }
    config["elevenlabs"]["accounts"] = json!(accounts);
    config["elevenlabs"]["key"] = json!("");
    Ok(())
}
#[tauri::command]
pub async fn social_settings(
    app: tauri::AppHandle,
    lock: State<'_, SocialLock>,
    payload: Option<Value>,
) -> Result<Value, String> {
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|_| "Social settings are busy.")?;
        let mut config = load(&app)?;
        if let Some(payload) = payload.filter(|value| value.get("provider").is_some()) {
            let provider = payload["provider"].as_str().ok_or("Choose a provider.")?;
            if !["buffer", "zernio", "elevenlabs"].contains(&provider) {
                return Err("Unknown social provider.".into());
            }
            if provider == "elevenlabs" {
                save_audio_account(&mut config, &payload)?;
            } else {
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
            }
            save(&app, &config)?;
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
        "elevenlabs.usage",
        "elevenlabs.cached",
        "elevenlabs.select",
        "elevenlabs.voices",
        "elevenlabs.speech",
        "elevenlabs.transcribe",
        "usage",
        "usage.cached",
        "accounts",
        "test",
        "connect",
        "createProfile",
        "posts",
        "upload",
        "publish",
    ]
    .contains(&action.as_str())
    {
        return Err("Unknown social action.".into());
    }
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|_| "Social connections are busy.")?;
        let config = load(&app)?;
        let node = crate::node_runtime(&app)?;
        let script = if cfg!(debug_assertions) {
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../sidecar/social-bridge.mjs")
        } else {
            app.path().resource_dir().map_err(|e| e.to_string())?.join("sidecar/social-bridge.mjs")
        };
        let directory = app.path().app_data_dir().map_err(|e| e.to_string())?.join("social");
        fs::create_dir_all(&directory).map_err(|_| "Could not create social request history.")?;
        let mut command = crate::node_bridge::command(&node, &script);
        command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
        let mut child = command.spawn().map_err(|_| "Could not start the bundled social integration runtime.".to_string())?;
        let request = json!({"config":config,"action":action,"payload":payload.unwrap_or(json!({})),"statePath":directory.join("requests.json")});
        child.stdin.take().ok_or("Missing social request input.")?.write_all(request.to_string().as_bytes()).map_err(|_| "Could not send the social request.")?;
        let output = child.wait_with_output().map_err(|_| "The social request stopped. Check provider posts before retrying a publish action.")?;
        let body: Value = serde_json::from_slice(&output.stdout).map_err(|_| "The provider response was interrupted. Check provider posts before retrying.")?;
        if let Some(error) = body["error"].as_str() { return Err(error.into()); }
        Ok(body["data"].clone())
    }).await.map_err(|_| "The social integration stopped.".to_string())?
}
