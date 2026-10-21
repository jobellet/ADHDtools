pub mod audio;
pub mod oauth;
pub mod speech;
pub mod storage;

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, Emitter};
use tauri::tray::{TrayIconBuilder, MouseButton};
use tauri::menu::{Menu, MenuItem};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState, Shortcut};
use keepawake::KeepAwake;

use audio::{native_play_sound, play_sound, native_start_alarm, native_stop_alarm};
use storage::{native_save_storage, native_load_storage, native_save_secrets, native_load_secrets};
use oauth::{native_open_url, native_oauth_listen, native_oauth_wait, native_read_mcp_client};
use speech::{native_start_speech, native_poll_speech, native_stop_speech};

#[cfg(target_os = "macos")]
extern "C" {
    fn macos_bring_app_to_front();
}

struct AppState {
    target_end_timestamp: Mutex<Option<i64>>,
    tray_running: Mutex<bool>,
    keep_awake: Mutex<Option<KeepAwake>>,
}

#[tauri::command]
fn native_bring_to_front(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    #[cfg(target_os = "macos")]
    unsafe {
        macos_bring_app_to_front();
    }
    Ok(())
}

#[tauri::command]
fn native_notify(app: AppHandle, title: String, body: String, sound: Option<String>) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())?;

    if let Some(snd) = sound {
        play_sound(&snd);
    } else {
        play_sound("bell");
    }

    Ok(())
}

#[tauri::command]
fn native_update_tray(app: AppHandle, label: String, remaining_seconds: i64, is_running: bool) -> Result<(), String> {
    let state = app.state::<AppState>();

    // Update system tray tooltip and title based on arguments
    let tooltip = if is_running && remaining_seconds >= 0 {
        let minutes = remaining_seconds / 60;
        let seconds = remaining_seconds % 60;
        format!("{:02}:{:02} — {}", minutes, seconds, label)
    } else {
        "ADHD Tools".to_string()
    };

    let title = if is_running && remaining_seconds >= 0 {
        let minutes = remaining_seconds / 60;
        let seconds = remaining_seconds % 60;
        format!("{:02}:{:02}", minutes, seconds)
    } else {
        "".to_string()
    };

    if let Some(tray) = app.tray_by_id("main_tray") {
        let _ = tray.set_tooltip(Some(tooltip));
        let _ = tray.set_title(Some(title));
    }

    let mut tray_running = state.tray_running.lock().unwrap();
    let mut target = state.target_end_timestamp.lock().unwrap();

    if is_running {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
        *target = Some(now + remaining_seconds);
        *tray_running = true;
    } else {
        *target = None;
        *tray_running = false;
    }

    Ok(())
}

#[tauri::command]
fn native_set_keep_awake(app: AppHandle, active: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut keep_awake = state.keep_awake.lock().unwrap();

    if active {
        if keep_awake.is_none() {
            *keep_awake = keepawake::Builder::default().display(true).create().ok();
        }
    } else {
        *keep_awake = None;
    }

    Ok(())
}

/// The desktop web view keeps running in the background and rings its own alarms, so the list
/// the web app sends is not needed here. The Android app sets real alarms with it
/// (android/app/src/main/java/com/adhdtools/app/Alarms.java).
#[tauri::command]
fn native_schedule_alarms(alarms: serde_json::Value, style: Option<String>) -> Result<(), String> {
    let _ = (alarms, style);
    Ok(())
}

#[tauri::command]
fn native_toggle_mini_player(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let is_mini = window.is_always_on_top().unwrap_or(false);
        if is_mini {
            let _ = window.set_always_on_top(false);
            let _ = window.set_decorations(true);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1100.0, height: 800.0 }));
        } else {
            let _ = window.set_always_on_top(true);
            let _ = window.set_decorations(false);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 340.0, height: 200.0 }));
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    let alt_space: Shortcut = "Alt+Space".parse().unwrap();
                    let ctrl_shift_a: Shortcut = "CmdOrCtrl+Shift+A".parse().unwrap();
                    if shortcut == &alt_space || shortcut == &ctrl_shift_a {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("native:quick-capture", ());
                        }
                    }
                }
            })
            .build()
        )
        .manage(AppState {
            target_end_timestamp: Mutex::new(None),
            tray_running: Mutex::new(false),
            keep_awake: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            native_notify,
            native_play_sound,
            native_start_alarm,
            native_stop_alarm,
            native_bring_to_front,
            native_update_tray,
            native_schedule_alarms,
            native_set_keep_awake,
            native_toggle_mini_player,
            native_save_storage,
            native_save_secrets,
            native_load_secrets,
            native_open_url,
            native_oauth_listen,
            native_oauth_wait,
            native_read_mcp_client,
            native_start_speech,
            native_poll_speech,
            native_stop_speech,
            native_load_storage
        ])
        .setup(|app| {
            let alt_space: Shortcut = "Alt+Space".parse().unwrap();
            let ctrl_shift_a: Shortcut = "CmdOrCtrl+Shift+A".parse().unwrap();
            let _ = app.global_shortcut().register(alt_space);
            let _ = app.global_shortcut().register(ctrl_shift_a);

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let open_i = MenuItem::with_id(app, "open", "Open ADHD Tools", true, None::<&str>)?;
            let quick_capture_i = MenuItem::with_id(app, "quick_capture", "Quick Capture", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &quick_capture_i, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("main_tray")
                .menu(&menu)
                .tooltip("ADHD Tools")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quick_capture" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("native:quick-capture", ());
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        if button == MouseButton::Left {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(1));
                    let state = app_handle.state::<AppState>();
                    let is_running = *state.tray_running.lock().unwrap();
                    let mut target = state.target_end_timestamp.lock().unwrap();

                    if is_running {
                        if let Some(end_time) = *target {
                            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
                            if now >= end_time {
                                *target = None;
                                *state.tray_running.lock().unwrap() = false;

                                let _ = app_handle.notification()
                                    .builder()
                                    .title("Timer Complete!")
                                    .body("Your countdown has finished.")
                                    .show();
                                play_sound("bell");
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let state = window.app_handle().state::<AppState>();
                let is_running = *state.tray_running.lock().unwrap();

                if is_running {
                    window.hide().unwrap();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}