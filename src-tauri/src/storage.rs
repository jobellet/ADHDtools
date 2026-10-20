use std::fs;
use tauri::{AppHandle, Manager};

const STORE_FILE: &str = "adhd-local-store.json";

#[tauri::command]
pub fn native_save_storage(app: AppHandle, data: String) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let path = app_dir.join(STORE_FILE);
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn native_load_storage(app: AppHandle) -> Result<Option<String>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = app_dir.join(STORE_FILE);
    if path.exists() {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}

const SECRETS_FILE: &str = "adhd-secrets.json";

/// Keys, tokens and Google connection state, kept in the app data folder (outside the repo)
/// and readable only by the current user, so they survive cache clears and rebuilds.
#[tauri::command]
pub fn native_save_secrets(app: AppHandle, data: String) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let path = app_dir.join(SECRETS_FILE);
    let tmp = app_dir.join(format!("{}.tmp", SECRETS_FILE));
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .write(true).create(true).truncate(true).mode(0o600)
            .open(&tmp).map_err(|e| e.to_string())?;
        file.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    }
    #[cfg(not(unix))]
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(tmp, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn native_load_secrets(app: AppHandle) -> Result<Option<String>, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join(SECRETS_FILE);
    if path.exists() {
        fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
    } else {
        Ok(None)
    }
}
