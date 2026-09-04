// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskOptions {
    pub format: Option<String>,
    pub quality: Option<String>,
    pub audio_format: Option<String>,
    pub sponsorblock: Option<SponsorBlockOptions>,
    pub naming: Option<NamingOptions>,
    pub subtitles: Option<SubtitleOptions>,
    pub auth: Option<AuthOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SponsorBlockOptions {
    pub enabled: Option<bool>,
    pub categories: Option<Vec<String>>,
    pub actions: Option<HashMap<String, String>>,
    pub mark_only: Option<bool>,
    pub api_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamingOptions {
    pub template: Option<String>,
    pub restrict_filenames: Option<bool>,
    pub windows_filenames: Option<bool>,
    pub trim_filenames: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleOptions {
    pub enabled: Option<bool>,
    pub langs: Option<String>,
    pub embed: Option<bool>,
    pub keep_subs: Option<bool>,
    pub auto_subs: Option<bool>,
    pub format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthOptions {
    pub cookie_source: Option<String>,
    pub browser: Option<String>,
    pub browser_profile: Option<String>,
    pub player_client: Option<String>,
    pub enable_po_token: Option<bool>,
    pub po_token: Option<String>,
    pub visitor_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub id: String,
    pub title: String,
    pub url: String,
    pub format: String,
    pub quality: String,
    pub status: String, // 'queued' | 'downloading' | 'completed' | 'error' | 'cancelled'
    pub progress: f64,
    pub speed: String,
    pub eta: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub error: Option<String>,
    pub logs: Vec<String>,
    pub file_path: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<u64>,
    pub thumbnail: Option<String>,
    pub channel: Option<String>,
    pub duration: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub ytdlp_installed: bool,
    pub ytdlp_version: String,
    pub ffmpeg_installed: bool,
    pub ffmpeg_version: String,
    pub portable_mode: bool,
    pub download_dir: String,
    pub config_dir: String,
    pub platform: String,
}

pub struct AppState {
    pub tasks: Arc<Mutex<Vec<DownloadTask>>>,
    pub active_processes: Arc<Mutex<HashMap<String, u32>>>, // taskId -> PID
    pub download_dir: Arc<Mutex<String>>,
}

fn get_default_download_dir() -> String {
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        if !userprofile.trim().is_empty() {
            let win_dl = Path::new(&userprofile).join("Downloads");
            return win_dl.to_string_lossy().to_string();
        }
    }
    
    // Fallback to /downloads in project location
    std::env::current_dir()
        .map(|d| d.join("downloads").to_string_lossy().to_string())
        .unwrap_or_else(|_| "downloads".to_string())
}

// Locate yt-dlp binary (checks portable folder first, then PATH)
fn get_ytdlp_path() -> PathBuf {
    let win_exe = Path::new("portable_data/yt-dlp.exe");
    if win_exe.exists() {
        return win_exe.to_path_buf();
    }
    let local_bin = Path::new("yt-dlp");
    if local_bin.exists() {
        return local_bin.to_path_buf();
    }
    PathBuf::from(if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" })
}

// Locate ffmpeg binary
fn get_ffmpeg_path() -> PathBuf {
    let win_exe = Path::new("portable_data/ffmpeg.exe");
    if win_exe.exists() {
        return win_exe.to_path_buf();
    }
    PathBuf::from(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" })
}

#[tauri::command]
async fn get_system_status(state: State<'_, AppState>) -> Result<SystemStatus, String> {
    let ytdlp = get_ytdlp_path();
    let ffmpeg = get_ffmpeg_path();

    let ytdlp_ver = Command::new(&ytdlp)
        .arg("--version")
        .output()
        .await
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "Not detected".to_string());

    let ffmpeg_ver = Command::new(&ffmpeg)
        .arg("-version")
        .output()
        .await
        .map(|o| {
            let s = String::from_utf8_lossy(&o.stdout);
            s.lines().next().unwrap_or("FFmpeg detected").to_string()
        })
        .unwrap_or_else(|_| "Not detected".to_string());

    let ytdlp_ok = !ytdlp_ver.contains("Not detected");
    let ffmpeg_ok = !ffmpeg_ver.contains("Not detected");

    let download_dir = {
        let dl = state.download_dir.lock().await;
        dl.clone()
    };

    let config_dir = std::env::current_dir()
        .map(|d| d.join("portable_data").to_string_lossy().to_string())
        .unwrap_or_else(|_| "portable_data".to_string());

    Ok(SystemStatus {
        ytdlp_installed: ytdlp_ok,
        ytdlp_version: ytdlp_ver,
        ffmpeg_installed: ffmpeg_ok,
        ffmpeg_version: ffmpeg_ver,
        portable_mode: true,
        download_dir,
        config_dir,
        platform: std::env::consts::OS.to_string(),
    })
}

#[tauri::command]
async fn get_tasks(state: State<'_, AppState>) -> Result<Vec<DownloadTask>, String> {
    let tasks = state.tasks.lock().await;
    Ok(tasks.clone())
}

#[tauri::command]
async fn cancel_task(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let mut procs = state.active_processes.lock().await;
    if let Some(pid) = procs.remove(&id) {
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .output()
                .await;
        }
        #[cfg(not(windows))]
        {
            let _ = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output()
                .await;
        }
    }

    let mut tasks = state.tasks.lock().await;
    if let Some(task) = tasks.iter_mut().find(|t| t.id == id) {
        task.status = "cancelled".to_string();
    }
    Ok(true)
}

#[tauri::command]
async fn retry_task(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let mut tasks = state.tasks.lock().await;
    if let Some(task) = tasks.iter_mut().find(|t| t.id == id) {
        task.status = "queued".to_string();
        task.progress = 0.0;
        task.error = None;
    }
    Ok(true)
}

#[tauri::command]
async fn clear_completed(state: State<'_, AppState>) -> Result<bool, String> {
    let mut tasks = state.tasks.lock().await;
    tasks.retain(|t| t.status == "downloading" || t.status == "queued");
    Ok(true)
}

#[tauri::command]
async fn get_download_dir(state: State<'_, AppState>) -> Result<String, String> {
    let dl = state.download_dir.lock().await;
    Ok(dl.clone())
}

#[tauri::command]
async fn set_download_dir(dir: String, state: State<'_, AppState>) -> Result<String, String> {
    let mut dl = state.download_dir.lock().await;
    *dl = dir.clone();
    let _ = fs::create_dir_all(&dir);
    Ok(dl.clone())
}

#[tauri::command]
async fn reset_download_dir(state: State<'_, AppState>) -> Result<String, String> {
    let mut dl = state.download_dir.lock().await;
    let def = get_default_download_dir();
    *dl = def.clone();
    let _ = fs::create_dir_all(&def);
    Ok(def)
}

#[tauri::command]
async fn open_download_folder(state: State<'_, AppState>) -> Result<bool, String> {
    let dl_path = {
        let dl = state.download_dir.lock().await;
        PathBuf::from(dl.clone())
    };

    let _ = fs::create_dir_all(&dl_path);

    #[cfg(windows)]
    {
        let _ = Command::new("explorer")
            .arg(dl_path.to_string_lossy().as_ref())
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .arg(dl_path.to_string_lossy().as_ref())
            .spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open")
            .arg(dl_path.to_string_lossy().as_ref())
            .spawn();
    }
    Ok(true)
}

#[tauri::command]
async fn save_cookies_file(content: String) -> Result<usize, String> {
    let dir = Path::new("portable_data");
    let _ = fs::create_dir_all(dir);
    let cookie_file = dir.join("cookies.txt");
    fs::write(&cookie_file, &content).map_err(|e| e.to_string())?;
    Ok(content.lines().count())
}

#[tauri::command]
async fn get_cookies_file() -> Result<Option<String>, String> {
    let cookie_file = Path::new("portable_data/cookies.txt");
    if cookie_file.exists() {
        fs::read_to_string(cookie_file).map(Some).map_err(|e| e.to_string())
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn clear_cookies_file() -> Result<bool, String> {
    let cookie_file = Path::new("portable_data/cookies.txt");
    if cookie_file.exists() {
        let _ = fs::remove_file(cookie_file);
    }
    Ok(true)
}

fn main() {
    let default_dl = get_default_download_dir();
    let _ = fs::create_dir_all(&default_dl);
    let _ = fs::create_dir_all("downloads");
    let _ = fs::create_dir_all("portable_data");

    let initial_state = AppState {
        tasks: Arc::new(Mutex::new(Vec::new())),
        active_processes: Arc::new(Mutex::new(HashMap::new())),
        download_dir: Arc::new(Mutex::new(default_dl)),
    };

    tauri::Builder::default()
        .manage(initial_state)
        .invoke_handler(tauri::generate_handler![
            get_system_status,
            get_tasks,
            cancel_task,
            retry_task,
            clear_completed,
            get_download_dir,
            set_download_dir,
            reset_download_dir,
            open_download_folder,
            save_cookies_file,
            get_cookies_file,
            clear_cookies_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
