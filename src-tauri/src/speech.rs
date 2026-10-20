use serde_json::Value;

#[cfg(not(target_os = "macos"))]
use serde_json::json;

#[cfg(target_os = "macos")]
use std::ffi::{CStr, CString};

#[cfg(target_os = "macos")]
extern "C" {
    fn macos_speech_start(lang_cstr: *const std::os::raw::c_char);
    fn macos_speech_poll(out_buf: *mut std::os::raw::c_char, out_len: usize);
    fn macos_speech_stop(out_buf: *mut std::os::raw::c_char, out_len: usize);
}

#[tauri::command]
pub fn native_start_speech(lang: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let c_lang = CString::new(lang).unwrap_or_else(|_| CString::new("en-US").unwrap());
        unsafe {
            macos_speech_start(c_lang.as_ptr());
        }
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = lang;
        Err("unsupported".to_string())
    }
}

#[tauri::command]
pub fn native_poll_speech() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let mut buf = vec![0u8; 8192];
        unsafe {
            macos_speech_poll(buf.as_mut_ptr() as *mut std::os::raw::c_char, buf.len());
            let c_str = CStr::from_ptr(buf.as_ptr() as *const std::os::raw::c_char);
            let s = c_str.to_string_lossy();
            serde_json::from_str(&s).map_err(|e| e.to_string())
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(json!({ "status": "error", "transcript": "", "error": "unsupported" }))
    }
}

#[tauri::command]
pub fn native_stop_speech() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let mut buf = vec![0u8; 8192];
        unsafe {
            macos_speech_stop(buf.as_mut_ptr() as *mut std::os::raw::c_char, buf.len());
            let c_str = CStr::from_ptr(buf.as_ptr() as *const std::os::raw::c_char);
            let s = c_str.to_string_lossy();
            serde_json::from_str(&s).map_err(|e| e.to_string())
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(json!({ "status": "done", "transcript": "", "error": "" }))
    }
}
