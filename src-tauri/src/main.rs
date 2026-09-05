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
#[serde(rename_all = "camelCase")]
pub struct SystemStatus {
    pub status: String,
    pub version: String,
    pub ffmpeg: bool,
    pub portable_mode: bool,
    pub download_dir: String,
    pub active_tasks: usize,
    pub queued_tasks: usize,
    pub total_downloads: usize,
    pub os: String,
    // Compatibility fields
    pub ytdlp_installed: bool,
    pub ytdlp_version: String,
    pub ffmpeg_installed: bool,
    pub ffmpeg_version: String,
    pub config_dir: String,
    pub platform: String,
}

pub struct AppState {
    pub tasks: Arc<Mutex<Vec<DownloadTask>>>,
    pub active_processes: Arc<Mutex<HashMap<String, u32>>>, // taskId -> PID
    pub download_dir: Arc<Mutex<String>>,
    pub cached_versions: Arc<Mutex<Option<(String, bool, String, bool)>>>,
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn create_hidden_command<P: AsRef<Path>>(program: P) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn resolve_download_path(p: &str) -> String {
    let mut resolved = p.to_string();
    if resolved.contains("%USERPROFILE%") || resolved.contains("%userprofile%") {
        let user_profile = std::env::var("USERPROFILE")
            .or_else(|_| {
                let drive = std::env::var("HOMEDRIVE").unwrap_or_default();
                let path = std::env::var("HOMEPATH").unwrap_or_default();
                if !drive.is_empty() && !path.is_empty() {
                    Ok(format!("{}{}", drive, path))
                } else {
                    std::env::var("HOME")
                }
            })
            .unwrap_or_default();
        
        if !user_profile.is_empty() {
            resolved = resolved
                .replace("%USERPROFILE%", &user_profile)
                .replace("%userprofile%", &user_profile);
        }
    }
    resolved
}

fn get_default_download_dir() -> String {
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        if !userprofile.trim().is_empty() {
            let win_dl = Path::new(&userprofile).join("Downloads");
            return win_dl.to_string_lossy().to_string();
        }
    }

    if let (Ok(drive), Ok(homepath)) = (std::env::var("HOMEDRIVE"), std::env::var("HOMEPATH")) {
        let win_dl = PathBuf::from(format!("{}{}", drive, homepath)).join("Downloads");
        return win_dl.to_string_lossy().to_string();
    }

    if let Ok(home) = std::env::var("HOME") {
        let dl = Path::new(&home).join("Downloads");
        return dl.to_string_lossy().to_string();
    }
    
    // Fallback to /downloads in project location
    std::env::current_dir()
        .map(|d| d.join("downloads").to_string_lossy().to_string())
        .unwrap_or_else(|_| "downloads".to_string())
}

// Comprehensive binary locator:
// 1. Checks alongside executable (in exe directory, ./bin, ./resources/bin, ./resources, ./portable_data)
// 2. Checks current working directory (cwd, ./bin, ./portable_data)
// 3. Searches every directory in the system PATH environment variable
// 4. On Windows, searches well-known package manager & tool directories (WinGet links, Scoop shims, Chocolatey, Python Scripts)
// 5. Fallback command string so the OS can attempt runtime resolution via PATH before failing
fn find_executable(name: &str) -> PathBuf {
    // 1. Same location as executable and local subdirectories
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidates = [
                exe_dir.join(format!("{}.exe", name)),
                exe_dir.join(name),
                exe_dir.join("bin").join(format!("{}.exe", name)),
                exe_dir.join("bin").join(name),
                exe_dir.join("resources").join("bin").join(format!("{}.exe", name)),
                exe_dir.join("resources").join("bin").join(name),
                exe_dir.join("resources").join(format!("{}.exe", name)),
                exe_dir.join("resources").join(name),
                exe_dir.join("portable_data").join(format!("{}.exe", name)),
                exe_dir.join("portable_data").join(name),
            ];
            for cand in candidates {
                if cand.is_file() {
                    return cand;
                }
            }
        }
    }

    // 2. Current working directory
    let cwd_candidates = [
        format!("bin/{}.exe", name),
        format!("bin/{}", name),
        format!("portable_data/{}.exe", name),
        format!("portable_data/{}", name),
        format!("{}.exe", name),
        name.to_string(),
    ];
    for cand_str in cwd_candidates {
        let cand = Path::new(&cand_str);
        if cand.is_file() {
            if let Ok(abs) = cand.canonicalize() {
                return abs;
            }
            return cand.to_path_buf();
        }
    }

    // 3. Search system PATH directories (if same location binaries are not found, search PATH)
    if let Some(path_os) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_os) {
            #[cfg(windows)]
            {
                let with_exe = dir.join(format!("{}.exe", name));
                if with_exe.is_file() {
                    return with_exe;
                }
                let with_cmd = dir.join(format!("{}.cmd", name));
                if with_cmd.is_file() {
                    return with_cmd;
                }
                let with_bat = dir.join(format!("{}.bat", name));
                if with_bat.is_file() {
                    return with_bat;
                }
            }
            let direct = dir.join(name);
            if direct.is_file() {
                return direct;
            }
        }
    }

    // 4. Check well-known package manager and system locations on Windows
    #[cfg(windows)]
    {
        let mut extra_dirs = Vec::new();
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            let base = Path::new(&local_appdata);
            extra_dirs.push(base.join("Microsoft").join("WinGet").join("Links"));
            extra_dirs.push(base.join("Programs").join("yt-dlp"));
            extra_dirs.push(base.join("Programs").join("ffmpeg").join("bin"));
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let base = Path::new(&userprofile);
            extra_dirs.push(base.join("scoop").join("shims"));
            extra_dirs.push(base.join("scoop").join("apps").join(name).join("current"));
            extra_dirs.push(base.join("scoop").join("apps").join(name).join("current").join("bin"));
        }
        extra_dirs.push(PathBuf::from(r"C:\ProgramData\chocolatey\bin"));
        extra_dirs.push(PathBuf::from(r"C:\ffmpeg\bin"));

        for dir in extra_dirs {
            let with_exe = dir.join(format!("{}.exe", name));
            if with_exe.is_file() {
                return with_exe;
            }
            let direct = dir.join(name);
            if direct.is_file() {
                return direct;
            }
        }
    }

    // 5. Fallback command string for dynamic OS PATH lookup
    PathBuf::from(if cfg!(windows) { format!("{}.exe", name) } else { name.to_string() })
}

// Locate yt-dlp binary (local, PATH, or OS fallback)
fn get_ytdlp_path() -> PathBuf {
    find_executable("yt-dlp")
}

// Locate ffmpeg binary (local, PATH, or OS fallback)
fn get_ffmpeg_path() -> PathBuf {
    find_executable("ffmpeg")
}

#[tauri::command]
async fn get_system_status(state: State<'_, AppState>) -> Result<SystemStatus, String> {
    let (ytdlp_ver, ytdlp_ok, ffmpeg_ver, ffmpeg_ok) = {
        let mut cached = state.cached_versions.lock().await;
        if let Some(ref val) = *cached {
            val.clone()
        } else {
            let ytdlp = get_ytdlp_path();
            let ffmpeg = get_ffmpeg_path();

            let y_ver = {
                let mut cmd = create_hidden_command(&ytdlp);
                cmd.arg("--version");
                cmd.output()
                    .await
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                    .unwrap_or_else(|_| "Not detected".to_string())
            };

            let f_ver = {
                let mut cmd = create_hidden_command(&ffmpeg);
                cmd.arg("-version");
                cmd.output()
                    .await
                    .map(|o| {
                        let s = String::from_utf8_lossy(&o.stdout);
                        s.lines().next().unwrap_or("FFmpeg detected").to_string()
                    })
                    .unwrap_or_else(|_| "Not detected".to_string())
            };

            let y_ok = !y_ver.contains("Not detected");
            let f_ok = !f_ver.contains("Not detected");

            let res = (y_ver, y_ok, f_ver, f_ok);
            *cached = Some(res.clone());
            res
        }
    };

    let download_dir = {
        let dl = state.download_dir.lock().await;
        resolve_download_path(&dl)
    };

    let config_dir = std::env::current_dir()
        .map(|d| d.join("portable_data").to_string_lossy().to_string())
        .unwrap_or_else(|_| "portable_data".to_string());

    let (active_count, queued_count, total_count) = {
        let tasks = state.tasks.lock().await;
        let active = tasks.iter().filter(|t| t.status == "downloading" || t.status == "fetching" || t.status == "converting").count();
        let queued = tasks.iter().filter(|t| t.status == "queued").count();
        let total = tasks.len();
        (active, queued, total)
    };

    Ok(SystemStatus {
        status: if ytdlp_ok { "ready".to_string() } else { "missing-dependencies".to_string() },
        version: ytdlp_ver.clone(),
        ffmpeg: ffmpeg_ok,
        portable_mode: true,
        download_dir,
        active_tasks: active_count,
        queued_tasks: queued_count,
        total_downloads: total_count,
        os: format!("Windows Native ({})", std::env::consts::ARCH),
        ytdlp_installed: ytdlp_ok,
        ytdlp_version: ytdlp_ver,
        ffmpeg_installed: ffmpeg_ok,
        ffmpeg_version: ffmpeg_ver,
        config_dir,
        platform: std::env::consts::OS.to_string(),
    })
}

#[tauri::command]
async fn get_tasks(state: State<'_, AppState>) -> Result<Vec<DownloadTask>, String> {
    let tasks = state.tasks.lock().await;
    Ok(tasks.clone())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueResponse {
    pub success: bool,
    pub tasks: Vec<DownloadTask>,
}

#[tauri::command]
async fn queue_tasks(
    items: Vec<serde_json::Value>,
    global_options: Option<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<QueueResponse, String> {
    let mut created_tasks = Vec::new();
    let mut tasks_guard = state.tasks.lock().await;

    for item in items {
        let url = item.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if url.trim().is_empty() {
            continue;
        }
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or(&url).to_string();
        let format = item.get("format")
            .or_else(|| global_options.as_ref().and_then(|g| g.get("format")))
            .and_then(|v| v.as_str())
            .unwrap_or("best")
            .to_string();
        let thumbnail = item.get("thumbnail").and_then(|v| v.as_str()).map(|s| s.to_string());
        let channel = item.get("uploader").and_then(|v| v.as_str()).map(|s| s.to_string());
        let id = format!("dl_{}", &uuid::Uuid::new_v4().to_string()[..8]);

        let task = DownloadTask {
            id: id.clone(),
            title,
            url,
            format: format.clone(),
            quality: format,
            status: "queued".to_string(),
            progress: 0.0,
            speed: "0 KB/s".to_string(),
            eta: "--:--".to_string(),
            downloaded_bytes: 0,
            total_bytes: 0,
            error: None,
            logs: vec!["[Task Created] Queued in desktop client".to_string()],
            file_path: None,
            file_name: None,
            file_size: None,
            thumbnail,
            channel,
            duration: None,
        };

        tasks_guard.push(task.clone());
        created_tasks.push(task);
    }

    // Trigger background runner
    let tasks_clone = Arc::clone(&state.tasks);
    let procs_clone = Arc::clone(&state.active_processes);
    let dl_clone = Arc::clone(&state.download_dir);

    tokio::spawn(async move {
        run_download_queue(tasks_clone, procs_clone, dl_clone).await;
    });

    Ok(QueueResponse {
        success: true,
        tasks: created_tasks,
    })
}

async fn run_download_queue(
    tasks_arc: Arc<Mutex<Vec<DownloadTask>>>,
    procs_arc: Arc<Mutex<HashMap<String, u32>>>,
    dl_arc: Arc<Mutex<String>>,
) {
    loop {
        let next_task = {
            let mut tasks = tasks_arc.lock().await;
            if let Some(t) = tasks.iter_mut().find(|t| t.status == "queued") {
                t.status = "downloading".to_string();
                t.logs.push("[Download Started] Launching yt-dlp...".to_string());
                Some(t.clone())
            } else {
                None
            }
        };

        let task = match next_task {
            Some(t) => t,
            None => break,
        };

        let ytdlp_path = get_ytdlp_path();
        let ffmpeg_path = get_ffmpeg_path();
        let download_dir = {
            let d = dl_arc.lock().await;
            resolve_download_path(&d)
        };

        // Only ensure the specific target directory exists right before running the download
        let _ = fs::create_dir_all(&download_dir);

        let mut cmd = create_hidden_command(&ytdlp_path);
        cmd.arg("--newline");
        cmd.arg("--no-mtime");
        cmd.arg("--no-warnings");
        cmd.arg("-P");
        cmd.arg(&download_dir);

        // Link FFmpeg binary if found in same location, PATH, or well-known location
        if ffmpeg_path.exists() || ffmpeg_path.to_string_lossy().contains("ffmpeg") {
            cmd.arg("--ffmpeg-location");
            cmd.arg(&ffmpeg_path);
        }

        // Format
        if task.format.starts_with("mp3") || task.format == "audio" {
            cmd.arg("-x");
            cmd.arg("--audio-format");
            cmd.arg("mp3");
            if task.format == "mp3_320" {
                cmd.args(["--audio-quality", "320k"]);
            }
        } else if task.format == "1080p" {
            cmd.args(["-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"]);
            cmd.args(["--merge-output-format", "mp4"]);
        } else if task.format == "720p" {
            cmd.args(["-f", "bestvideo[height<=720]+bestaudio/best[height<=720]/best"]);
            cmd.args(["--merge-output-format", "mp4"]);
        } else if task.format != "best" {
            cmd.args(["-f", &task.format]);
            cmd.args(["--merge-output-format", "mp4"]);
        } else {
            cmd.args(["-f", "bestvideo+bestaudio/best"]);
            cmd.args(["--merge-output-format", "mp4"]);
        }

        cmd.arg(&task.url);

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let mut tasks = tasks_arc.lock().await;
                if let Some(t) = tasks.iter_mut().find(|t| t.id == task.id) {
                    t.status = "error".to_string();
                    t.error = Some(format!("Failed to start process: {}", e));
                    t.logs.push(format!("[Process Error] {}", e));
                }
                continue;
            }
        };

        if let Some(pid) = child.id() {
            let mut procs = procs_arc.lock().await;
            procs.insert(task.id.clone(), pid);
        }

        if let Some(stdout) = child.stdout.take() {
            let mut reader = BufReader::new(stdout).lines();
            let task_id = task.id.clone();
            let tasks_for_stdout = Arc::clone(&tasks_arc);

            tokio::spawn(async move {
                let re_prog = regex::Regex::new(r"\[download\]\s+([\d\.]+)%\s+of\s+~?([\d\.]+[A-Za-z]+)\s+at\s+([\d\.]+[A-Za-z]+/s)\s+ETA\s+([\d:]+)").ok();
                while let Ok(Some(line)) = reader.next_line().await {
                    let mut tasks = tasks_for_stdout.lock().await;
                    if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
                        t.logs.push(line.clone());
                        if t.logs.len() > 60 {
                            t.logs.remove(0);
                        }
                        if let Some(ref re) = re_prog {
                            if let Some(caps) = re.captures(&line) {
                                if let Some(p_str) = caps.get(1) {
                                    if let Ok(p) = p_str.as_str().parse::<f64>() {
                                        t.progress = p;
                                    }
                                }
                                if let Some(sp) = caps.get(3) {
                                    t.speed = sp.as_str().to_string();
                                }
                                if let Some(eta) = caps.get(4) {
                                    t.eta = eta.as_str().to_string();
                                }
                                t.status = "downloading".to_string();
                            }
                        }
                        if line.contains("[ExtractAudio]") || line.contains("[ffmpeg]") {
                            t.status = "converting".to_string();
                        }
                    }
                }
            });
        }

        let status = child.wait().await;
        {
            let mut procs = procs_arc.lock().await;
            procs.remove(&task.id);
        }

        {
            let mut tasks = tasks_arc.lock().await;
            if let Some(t) = tasks.iter_mut().find(|t| t.id == task.id) {
                match status {
                    Ok(exit_status) if exit_status.success() => {
                        t.status = "completed".to_string();
                        t.progress = 100.0;
                        t.speed = "Done".to_string();
                        t.eta = "00:00".to_string();
                        t.logs.push("[Download Finished] Process exited successfully.".to_string());
                    }
                    Ok(exit_status) => {
                        if t.status != "cancelled" {
                            t.status = "error".to_string();
                            t.error = Some(format!("Exit code: {:?}", exit_status.code()));
                            t.logs.push(format!("[Error] Process exited with code {:?}", exit_status.code()));
                        }
                    }
                    Err(e) => {
                        t.status = "error".to_string();
                        t.error = Some(e.to_string());
                        t.logs.push(format!("[Error] {}", e));
                    }
                }
            }
        }
    }
}

#[tauri::command]
async fn cancel_task(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let mut procs = state.active_processes.lock().await;
    if let Some(pid) = procs.remove(&id) {
        #[cfg(windows)]
        {
            let mut cmd = create_hidden_command("taskkill");
            cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
            let _ = cmd.output().await;
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
    Ok(resolve_download_path(&dl))
}

#[tauri::command]
async fn set_download_dir(dir: String, state: State<'_, AppState>) -> Result<String, String> {
    let resolved = resolve_download_path(&dir);
    let mut dl = state.download_dir.lock().await;
    *dl = resolved.clone();
    let _ = fs::create_dir_all(&resolved);
    Ok(resolved)
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
        let resolved = resolve_download_path(&dl);
        PathBuf::from(resolved)
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

    let initial_state = AppState {
        tasks: Arc::new(Mutex::new(Vec::new())),
        active_processes: Arc::new(Mutex::new(HashMap::new())),
        download_dir: Arc::new(Mutex::new(default_dl)),
        cached_versions: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .manage(initial_state)
        .invoke_handler(tauri::generate_handler![
            get_system_status,
            get_tasks,
            queue_tasks,
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
