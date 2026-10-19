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
