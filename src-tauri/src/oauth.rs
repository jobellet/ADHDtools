//! Native Google sign-in helpers: the web view cannot open Google's popup, so the app opens
//! the system browser and listens for the redirect on a loopback port (RFC 8252).
//! The token exchange itself happens in JS (services/google-auth.js).
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};

static LISTENER: Mutex<Option<TcpListener>> = Mutex::new(None);

const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>ADHD Tools</title>\
<body style=\"font-family:-apple-system,sans-serif;text-align:center;margin-top:20vh\">\
<h2>Signed in</h2><p>You can close this tab and go back to ADHD Tools.</p></body>";

/// Open an https URL in the default browser.
#[tauri::command]
pub fn native_open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("Only https URLs can be opened".into());
    }
    #[cfg(target_os = "macos")]
    let mut cmd = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", "start", ""]);
        c
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut cmd = std::process::Command::new("xdg-open");
    cmd.arg(&url).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Start listening on a free 127.0.0.1 port and return it (used as the OAuth redirect URI).
#[tauri::command]
pub fn native_oauth_listen() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    *LISTENER.lock().unwrap() = Some(listener);
    Ok(port)
}

fn read_query(mut stream: TcpStream) -> Option<String> {
    stream.set_nonblocking(false).ok()?;
    stream.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
    let mut buf = [0u8; 8192];
    let n = stream.read(&mut buf).ok()?;
    let request = String::from_utf8_lossy(&buf[..n]);
    let target = request.lines().next()?.split_whitespace().nth(1)?.to_string();
    let query = target.split_once('?').map(|(_, q)| q.to_string())?;
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        DONE_PAGE.len(),
        DONE_PAGE
    );
    let _ = stream.write_all(response.as_bytes());
    Some(query)
}

/// Wait for the browser redirect and return its raw query string (`code=…&state=…`).
#[tauri::command]
pub async fn native_oauth_wait(timeout_secs: u64) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let listener = LISTENER.lock().unwrap().take().ok_or("Sign-in was not started")?;
        let deadline = Instant::now() + Duration::from_secs(timeout_secs.clamp(10, 600));
        while Instant::now() < deadline {
            match listener.accept() {
                Ok((stream, _)) => {
                    // Ignore stray requests (e.g. favicon) that carry no query string.
                    if let Some(query) = read_query(stream) {
                        return Ok(query);
                    }
                }
                Err(_) => std::thread::sleep(Duration::from_millis(100)),
            }
        }
        Err("Timed out waiting for Google sign-in".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Desktop-type OAuth client already set up for the AI assistant (`npm run mcp:auth`), if any.
/// Only the client id and secret are returned, never the refresh token.
#[tauri::command]
pub fn native_read_mcp_client() -> Option<serde_json::Value> {
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).ok()?;
    let path = std::path::Path::new(&home).join(".config/adhd-tools-mcp/credentials.json");
    let data: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
    Some(serde_json::json!({
        "clientId": data.get("client_id")?,
        "clientSecret": data.get("client_secret")?,
    }))
}
