use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use serde::Serialize;
use tauri::State;

#[derive(Serialize, Clone, Debug)]
pub struct LocalAiStatus {
    pub available: bool,
    pub running: bool,
    pub port: u16,
    pub binary_path: Option<String>,
    pub model_path: Option<String>,
}

pub struct LocalAiState {
    pub child: Mutex<Option<Child>>,
}

impl LocalAiState {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }
}

fn find_llama_server() -> Option<PathBuf> {
    // 1. Check local app data (%LOCALAPPDATA%\llama-cpp\llama-server.exe)
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let p = PathBuf::from(local_app_data).join("llama-cpp").join(if cfg!(windows) { "llama-server.exe" } else { "llama-server" });
        if p.is_file() {
            return Some(p);
        }
    }
    // 2. Check user home ~/.local/share/llama-cpp or ~/.llama-cpp
    if let Some(home) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
        let p1 = PathBuf::from(&home).join(".local").join("share").join("llama-cpp").join(if cfg!(windows) { "llama-server.exe" } else { "llama-server" });
        if p1.is_file() {
            return Some(p1);
        }
        let p2 = PathBuf::from(&home).join(".llama-cpp").join(if cfg!(windows) { "llama-server.exe" } else { "llama-server" });
        if p2.is_file() {
            return Some(p2);
        }
    }
    // 3. Check current dir or exe dir
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let p = parent.join(if cfg!(windows) { "llama-server.exe" } else { "llama-server" });
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

fn find_gguf_model() -> Option<PathBuf> {
    if let Some(server) = find_llama_server() {
        if let Some(dir) = server.parent() {
            // Check specific LFM3 file
            let preferred = dir.join("LFM3-1.7B-QAD-Q4_0.gguf");
            if preferred.is_file() {
                return Some(preferred);
            }
            let preferred_models = dir.join("models").join("LFM3-1.7B-QAD-Q4_0.gguf");
            if preferred_models.is_file() {
                return Some(preferred_models);
            }
            // Any .gguf in dir
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_file() && p.extension().map_or(false, |ext| ext == "gguf") {
                        return Some(p);
                    }
                }
            }
            // Any .gguf in models/
            let models_dir = dir.join("models");
            if let Ok(entries) = std::fs::read_dir(models_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_file() && p.extension().map_or(false, |ext| ext == "gguf") {
                        return Some(p);
                    }
                }
            }
        }
    }
    None
}

fn is_server_listening(port: u16) -> bool {
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(150)).is_ok()
}

#[tauri::command]
pub fn native_local_ai_status(state: State<LocalAiState>) -> Result<LocalAiStatus, String> {
    let binary = find_llama_server();
    let model = find_gguf_model();
    let available = binary.is_some() && model.is_some();

    let mut child_guard = state.child.lock().unwrap();
    let mut running = false;
    if let Some(child) = child_guard.as_mut() {
        match child.try_wait() {
            Ok(None) => running = true,
            _ => *child_guard = None,
        }
    }
    if !running && is_server_listening(11434) {
        running = true;
    }

    Ok(LocalAiStatus {
        available,
        running,
        port: 11434,
        binary_path: binary.map(|p| p.to_string_lossy().to_string()),
        model_path: model.map(|p| p.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub fn native_local_ai_start(state: State<LocalAiState>) -> Result<LocalAiStatus, String> {
    let binary = find_llama_server().ok_or_else(|| "Local AI server binary (llama-server) not found".to_string())?;
    let model = find_gguf_model().ok_or_else(|| "Local GGUF model not found".to_string())?;

    let mut child_guard = state.child.lock().unwrap();
    if is_server_listening(11434) {
        return Ok(LocalAiStatus {
            available: true,
            running: true,
            port: 11434,
            binary_path: Some(binary.to_string_lossy().to_string()),
            model_path: Some(model.to_string_lossy().to_string()),
        });
    }

    let mut cmd = Command::new(&binary);
    cmd.arg("-m").arg(&model)
       .arg("--port").arg("11434")
       .arg("--host").arg("127.0.0.1")
       .arg("-c").arg("4096")
       .arg("-t").arg("4")
       .arg("--reasoning").arg("off")
       .arg("--reasoning-budget").arg("0");

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn local AI server: {}", e))?;
    *child_guard = Some(child);

    // Give it a brief moment to bind port
    std::thread::sleep(Duration::from_millis(600));

    Ok(LocalAiStatus {
        available: true,
        running: is_server_listening(11434),
        port: 11434,
        binary_path: Some(binary.to_string_lossy().to_string()),
        model_path: Some(model.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub fn native_local_ai_stop(state: State<LocalAiState>) -> Result<LocalAiStatus, String> {
    let mut child_guard = state.child.lock().unwrap();
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    // If server was started externally or detached, terminate process listening on 11434
    #[cfg(windows)]
    {
        if is_server_listening(11434) {
            let _ = Command::new("taskkill")
                .args(["/F", "/IM", "llama-server.exe"])
                .output();
        }
    }
    #[cfg(not(windows))]
    {
        if is_server_listening(11434) {
            let _ = Command::new("pkill")
                .args(["-f", "llama-server"])
                .output();
        }
    }

    let binary = find_llama_server();
    let model = find_gguf_model();
    let available = binary.is_some() && model.is_some();

    Ok(LocalAiStatus {
        available,
        running: false,
        port: 11434,
        binary_path: binary.map(|p| p.to_string_lossy().to_string()),
        model_path: model.map(|p| p.to_string_lossy().to_string()),
    })
}
