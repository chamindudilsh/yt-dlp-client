// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::State;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
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
    pub full_error: Option<String>,
    pub logs: Vec<String>,
    pub file_path: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<u64>,
    pub thumbnail: Option<String>,
    pub channel: Option<String>,
    pub duration: Option<u64>,
    pub media_type: Option<String>,
    pub naming_template: Option<String>,
    pub embed_metadata: Option<bool>,
    pub crop_thumbnail: Option<bool>,
    pub crop_focus: Option<String>,
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

fn create_hidden_command<S: AsRef<OsStr>>(program: S) -> Command {
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

pub fn get_app_root() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.to_path_buf();
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn get_config_path() -> PathBuf {
    get_app_root().join("config.json")
}

pub fn get_cookies_path() -> PathBuf {
    let root_cookie = get_app_root().join("cookies.txt");
    if root_cookie.exists() {
        return root_cookie;
    }
    let cwd_cookie = PathBuf::from("cookies.txt");
    if cwd_cookie.exists() {
        return cwd_cookie;
    }
    let legacy_cookie = PathBuf::from("portable_data/cookies.txt");
    if legacy_cookie.exists() {
        return legacy_cookie;
    }
    root_cookie
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
// 1. Checks alongside executable (in exe directory, ./bin, ./resources/bin, ./resources)
// 2. Checks current working directory (cwd, ./bin)
// 3. Queries direct OS command resolution (where.exe on Windows, which on Unix)
// 4. Searches every directory in the system PATH environment variable (cleaning quotes)
// 5. On Windows, searches well-known package manager & tool directories (WinGet links, Scoop shims, Chocolatey, Python Scripts)
// 6. Fallback command string so the OS can attempt runtime resolution via PATH before failing
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

    // 3. Direct OS lookup using system which / where.exe
    #[cfg(windows)]
    {
        if let Ok(output) = std::process::Command::new("where.exe").arg(name).output() {
            if output.status.success() {
                if let Ok(stdout) = String::from_utf8(output.stdout) {
                    for line in stdout.lines() {
                        let trimmed = line.trim().trim_matches('"');
                        let p = Path::new(trimmed);
                        if p.is_file() {
                            return p.to_path_buf();
                        }
                    }
                }
            }
        }
    }
    #[cfg(not(windows))]
    {
        if let Ok(output) = std::process::Command::new("which").arg(name).output() {
            if output.status.success() {
                if let Ok(stdout) = String::from_utf8(output.stdout) {
                    let trimmed = stdout.trim().trim_matches('"');
                    let p = Path::new(trimmed);
                    if p.is_file() {
                        return p.to_path_buf();
                    }
                }
            }
        }
    }

    // 4. Search system PATH directories (handling quotes and variations)
    if let Some(path_os) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_os) {
            let clean_dir_str = dir.to_string_lossy().trim_matches('"').to_string();
            let clean_dir = Path::new(&clean_dir_str);
            #[cfg(windows)]
            {
                let with_exe = clean_dir.join(format!("{}.exe", name));
                if with_exe.is_file() {
                    return with_exe;
                }
                let with_cmd = clean_dir.join(format!("{}.cmd", name));
                if with_cmd.is_file() {
                    return with_cmd;
                }
                let with_bat = clean_dir.join(format!("{}.bat", name));
                if with_bat.is_file() {
                    return with_bat;
                }
            }
            let direct = clean_dir.join(name);
            if direct.is_file() {
                return direct;
            }
        }
    }

    // 5. Check well-known package manager and system locations on Windows
    #[cfg(windows)]
    {
        let mut extra_dirs = Vec::new();
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            let base = Path::new(&local_appdata);
            extra_dirs.push(base.join("Microsoft").join("WinGet").join("Links"));
            extra_dirs.push(base.join("Programs").join("yt-dlp"));
            extra_dirs.push(base.join("Programs").join("ffmpeg").join("bin"));

            // Check Python Scripts folders
            let py_programs = base.join("Programs").join("Python");
            if py_programs.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&py_programs) {
                    for entry in entries.flatten() {
                        if entry.path().is_dir() {
                            extra_dirs.push(entry.path().join("Scripts"));
                        }
                    }
                }
            }
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            let base = Path::new(&appdata);
            let py_appdata = base.join("Python");
            if py_appdata.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&py_appdata) {
                    for entry in entries.flatten() {
                        if entry.path().is_dir() {
                            extra_dirs.push(entry.path().join("Scripts"));
                        }
                    }
                }
            }
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let base = Path::new(&userprofile);
            extra_dirs.push(base.join("scoop").join("shims"));
            extra_dirs.push(base.join("scoop").join("apps").join(name).join("current"));
            extra_dirs.push(base.join("scoop").join("apps").join(name).join("current").join("bin"));
        }
        extra_dirs.push(PathBuf::from(r"C:\ProgramData\chocolatey\bin"));
        extra_dirs.push(PathBuf::from(r"C:\ffmpeg\bin"));
        extra_dirs.push(PathBuf::from(r"C:\yt-dlp"));
        extra_dirs.push(PathBuf::from(r"C:\Program Files\ffmpeg\bin"));
        extra_dirs.push(PathBuf::from(r"C:\Program Files\yt-dlp"));
        extra_dirs.push(PathBuf::from(r"C:\Program Files (x86)\ffmpeg\bin"));
        extra_dirs.push(PathBuf::from(r"C:\Program Files (x86)\yt-dlp"));

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

    // 6. Fallback command string for dynamic OS PATH lookup
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
                let out = cmd.output().await;
                match out {
                    Ok(o) if o.status.success() => {
                        String::from_utf8_lossy(&o.stdout).trim().to_string()
                    }
                    _ => {
                        #[cfg(windows)]
                        {
                            let mut sh = create_hidden_command("cmd.exe");
                            sh.args(["/c", "yt-dlp", "--version"]);
                            if let Ok(o) = sh.output().await {
                                if o.status.success() {
                                    String::from_utf8_lossy(&o.stdout).trim().to_string()
                                } else {
                                    "Not detected".to_string()
                                }
                            } else {
                                "Not detected".to_string()
                            }
                        }
                        #[cfg(not(windows))]
                        {
                            "Not detected".to_string()
                        }
                    }
                }
            };

            let f_ver = {
                let mut cmd = create_hidden_command(&ffmpeg);
                cmd.arg("-version");
                let out = cmd.output().await;
                match out {
                    Ok(o) if o.status.success() => {
                        let s = String::from_utf8_lossy(&o.stdout);
                        s.lines().next().unwrap_or("FFmpeg active").to_string()
                    }
                    _ => {
                        #[cfg(windows)]
                        {
                            let mut sh = create_hidden_command("cmd.exe");
                            sh.args(["/c", "ffmpeg", "-version"]);
                            if let Ok(o) = sh.output().await {
                                if o.status.success() {
                                    let s = String::from_utf8_lossy(&o.stdout);
                                    s.lines().next().unwrap_or("FFmpeg active").to_string()
                                } else {
                                    "Not detected".to_string()
                                }
                            } else {
                                "Not detected".to_string()
                            }
                        }
                        #[cfg(not(windows))]
                        {
                            "Not detected".to_string()
                        }
                    }
                }
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

    let config_dir = get_app_root().to_string_lossy().to_string();

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
async fn extract_info(
    url: String,
    auth: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let clean_url = url.trim().to_string();
    if clean_url.is_empty() {
        return Err("URL is required".to_string());
    }

    let ytdlp_path = get_ytdlp_path();
    let ffmpeg_path = get_ffmpeg_path();

    let mut cmd = create_hidden_command(&ytdlp_path);
    cmd.args([
        "--dump-single-json",
        "--flat-playlist",
        "--no-warnings",
        "--no-check-certificates",
        "--socket-timeout",
        "15",
    ]);

    if ffmpeg_path.is_file() || (ffmpeg_path.is_dir() && ffmpeg_path.exists()) {
        cmd.arg("--ffmpeg-location");
        cmd.arg(&ffmpeg_path);
    }

    if let Some(ref a) = auth {
        let cookie_source = a.get("cookieSource").or_else(|| a.get("cookie_source")).and_then(|v| v.as_str());
        let browser = a.get("browser").and_then(|v| v.as_str());
        let browser_profile = a.get("browserProfile").or_else(|| a.get("browser_profile")).and_then(|v| v.as_str());

        if cookie_source == Some("browser") {
            if let Some(b) = browser {
                if let Some(prof) = browser_profile {
                    cmd.arg("--cookies-from-browser");
                    cmd.arg(format!("{}:{}", b, prof));
                } else {
                    cmd.arg("--cookies-from-browser");
                    cmd.arg(b);
                }
            }
        }

        let player_client = a.get("playerClient").or_else(|| a.get("player_client")).and_then(|v| v.as_str());
        let enable_po_token = a.get("enablePoToken").or_else(|| a.get("enable_po_token")).and_then(|v| v.as_bool()).unwrap_or(false);
        let po_token = a.get("poToken").or_else(|| a.get("po_token")).and_then(|v| v.as_str());
        let visitor_data = a.get("visitorData").or_else(|| a.get("visitor_data")).and_then(|v| v.as_str());

        let mut extractor_parts = Vec::new();
        if let Some(client) = player_client {
            if client != "default" && !client.is_empty() {
                extractor_parts.push(format!("player_client={}", client));
            }
        }
        if enable_po_token {
            if let Some(po) = po_token {
                let clean = if po.starts_with("web+") { po.to_string() } else { format!("web+{}", po) };
                extractor_parts.push(format!("po_token={}", clean));
            }
            if let Some(vis) = visitor_data {
                extractor_parts.push(format!("visitor_data={}", vis));
            }
        }
        if !extractor_parts.is_empty() {
            cmd.args(["--extractor-args", &format!("youtube:{}", extractor_parts.join(";"))]);
        }
    }

    let cookies_path = get_cookies_path();
    if cookies_path.is_file() {
        cmd.arg("--cookies");
        cmd.arg(cookies_path.to_string_lossy().as_ref());
    }

    cmd.arg(&clean_url);

    let output = cmd.output().await.map_err(|e| format!("Failed to run yt-dlp: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err_str = stderr.trim();
        return Err(if err_str.is_empty() {
            format!("yt-dlp exited with status {:?}", output.status.code())
        } else {
            err_str.to_string()
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let info: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse metadata from yt-dlp: {}", e))?;

    let is_playlist = info.get("_type").and_then(|v| v.as_str()) == Some("playlist")
        || info.get("entries").and_then(|v| v.as_array()).is_some();

    if is_playlist {
        let entries_raw = info.get("entries").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let entries: Vec<serde_json::Value> = entries_raw
            .iter()
            .enumerate()
            .map(|(idx, item)| {
                let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let title = item.get("title").and_then(|v| v.as_str()).unwrap_or(&format!("Track {}", idx + 1)).to_string();
                let item_url = item.get("url").and_then(|v| v.as_str())
                    .or_else(|| item.get("webpage_url").and_then(|v| v.as_str()))
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| if !id.is_empty() { format!("https://www.youtube.com/watch?v={}", id) } else { clean_url.clone() });
                let duration_string = item.get("duration_string").and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| item.get("duration").and_then(|v| v.as_u64()).map(|d| format!("{}:{:02}", d / 60, d % 60)))
                    .unwrap_or_else(|| "0:00".to_string());
                let uploader = item.get("uploader").and_then(|v| v.as_str())
                    .or_else(|| item.get("channel").and_then(|v| v.as_str()))
                    .or_else(|| info.get("uploader").and_then(|v| v.as_str()))
                    .unwrap_or("Unknown Artist")
                    .to_string();
                let thumbnail = item.get("thumbnails").and_then(|v| v.as_array())
                    .and_then(|arr| arr.last())
                    .and_then(|t| t.get("url"))
                    .and_then(|v| v.as_str())
                    .or_else(|| item.get("thumbnail").and_then(|v| v.as_str()))
                    .or_else(|| info.get("thumbnail").and_then(|v| v.as_str()))
                    .unwrap_or("")
                    .to_string();

                serde_json::json!({
                    "id": if id.is_empty() { format!("track_{}", idx + 1) } else { id },
                    "title": title,
                    "url": item_url,
                    "duration_string": duration_string,
                    "uploader": uploader,
                    "thumbnail": thumbnail,
                    "selected": true
                })
            })
            .collect();

        let pl_title = info.get("title").and_then(|v| v.as_str()).unwrap_or("Extracted Playlist");
        let pl_uploader = info.get("uploader").and_then(|v| v.as_str())
            .or_else(|| info.get("channel").and_then(|v| v.as_str()))
            .unwrap_or("Unknown Curator");
        let pl_thumb = entries.first().and_then(|e| e.get("thumbnail")).and_then(|v| v.as_str()).unwrap_or("");

        return Ok(serde_json::json!({
            "isPlaylist": true,
            "title": pl_title,
            "uploader": pl_uploader,
            "entriesCount": entries.len(),
            "entries": entries,
            "thumbnail": pl_thumb
        }));
    }

    // Single item formats mapping
    let formats_raw = info.get("formats").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let formats: Vec<serde_json::Value> = formats_raw
        .iter()
        .map(|f| {
            let vcodec = f.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
            let acodec = f.get("acodec").and_then(|v| v.as_str()).unwrap_or("none");
            let is_audio = vcodec == "none" || vcodec.is_empty() || f.get("resolution").and_then(|v| v.as_str()) == Some("audio only");
            let height = f.get("height").and_then(|v| v.as_u64()).unwrap_or(if is_audio { 0 } else { 720 });
            let res_label = if let Some(res) = f.get("resolution").and_then(|v| v.as_str()) {
                res.to_string()
            } else if height > 0 {
                format!("{}p", height)
            } else if is_audio {
                "Audio Only".to_string()
            } else {
                "Standard".to_string()
            };

            serde_json::json!({
                "format_id": f.get("format_id").and_then(|v| v.as_str()).unwrap_or(""),
                "ext": f.get("ext").and_then(|v| v.as_str()).unwrap_or("mp4"),
                "resolution": res_label,
                "height": height,
                "fps": f.get("fps").and_then(|v| v.as_f64()),
                "filesize": f.get("filesize").and_then(|v| v.as_u64()).or_else(|| f.get("filesize_approx").and_then(|v| v.as_u64())),
                "vcodec": vcodec,
                "acodec": acodec,
                "format_note": f.get("format_note").and_then(|v| v.as_str()).unwrap_or(""),
                "isAudioOnly": is_audio
            })
        })
        .collect();

    let mut map = info.as_object().cloned().unwrap_or_default();
    map.insert("isPlaylist".to_string(), serde_json::json!(false));
    map.insert("formats".to_string(), serde_json::json!(formats));
    if !map.contains_key("thumbnail") || map.get("thumbnail").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
        if let Some(thumbs) = map.get("thumbnails").and_then(|v| v.as_array()) {
            if let Some(last) = thumbs.last().and_then(|t| t.get("url")).and_then(|v| v.as_str()) {
                map.insert("thumbnail".to_string(), serde_json::json!(last));
            }
        }
    }

    Ok(serde_json::Value::Object(map))
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

        let media_type = item.get("type")
            .or_else(|| global_options.as_ref().and_then(|g| g.get("type")))
            .or_else(|| global_options.as_ref().and_then(|g| g.get("defaultMediaType")))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let naming_template = item.get("namingTemplate")
            .or_else(|| global_options.as_ref().and_then(|g| g.get("namingTemplate")))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let embed_metadata = item.get("embedMetadata")
            .or_else(|| global_options.as_ref().and_then(|g| g.get("embedMetadata")))
            .and_then(|v| v.as_bool());
        let crop_thumbnail = item.get("audioCropThumbnailSquare")
            .or_else(|| global_options.as_ref().and_then(|g| g.get("audioCropThumbnailSquare")))
            .and_then(|v| v.as_bool());
        let crop_focus = item.get("cropFocus")
            .or_else(|| global_options.as_ref().and_then(|g| g.get("cropFocus")))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

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
            full_error: None,
            logs: vec!["[Task Created] Queued in desktop client".to_string()],
            file_path: None,
            file_name: None,
            file_size: None,
            thumbnail,
            channel,
            duration: None,
            media_type,
            naming_template,
            embed_metadata,
            crop_thumbnail,
            crop_focus,
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

        // Naming template: default to title - artist
        let template = task.naming_template.as_deref().unwrap_or("%(title)s - %(artist,uploader)s.%(ext)s");
        cmd.args(["-o", template]);

        // Link FFmpeg binary if found in same location, PATH, or well-known location
        if ffmpeg_path.is_file() || (ffmpeg_path.is_dir() && ffmpeg_path.exists()) {
            cmd.arg("--ffmpeg-location");
            cmd.arg(&ffmpeg_path);
        }

        let is_audio = task.media_type.as_deref() == Some("audio")
            || task.format.starts_with("mp3")
            || task.format == "m4a"
            || task.format == "opus"
            || task.format == "flac"
            || task.format == "wav"
            || task.format == "audio";

        // Format & Extraction
        if is_audio {
            cmd.arg("-x");
            let is_format_direct = !task.format.starts_with("mp3") 
                && !["m4a", "opus", "flac", "wav", "best", "audio"].contains(&task.format.as_str());

            if is_format_direct {
                cmd.args(["-f", &task.format]);
            } else {
                let audio_fmt = if task.format.starts_with("mp3") {
                    "mp3"
                } else if task.format == "best" || task.format.is_empty() || task.format == "audio" {
                    "m4a"
                } else {
                    task.format.as_str()
                };
                cmd.args(["--audio-format", audio_fmt]);
                if task.format == "mp3_320" {
                    cmd.args(["--audio-quality", "320k"]);
                } else if task.format == "mp3_256" {
                    cmd.args(["--audio-quality", "256k"]);
                } else if task.format == "mp3_192" {
                    cmd.args(["--audio-quality", "192k"]);
                } else if task.format == "flac" {
                    cmd.args(["--audio-quality", "0"]);
                }
            }

            let should_crop = task.crop_thumbnail.unwrap_or(true);
            cmd.arg("--embed-thumbnail");
            cmd.args(["--convert-thumbnails", "jpg"]);
            if should_crop {
                let focus = task.crop_focus.as_deref().unwrap_or("center");
                let filter = match focus {
                    "left" => r#"ThumbnailsConvertor+ffmpeg_o:-vf crop="'min(iw,ih)':'min(iw,ih)':0:0""#,
                    "right" => r#"ThumbnailsConvertor+ffmpeg_o:-vf crop="'min(iw,ih)':'min(iw,ih)':(in_w-out_w):0""#,
                    _ => r#"ThumbnailsConvertor+ffmpeg_o:-vf crop="'min(iw,ih)':'min(iw,ih)'""#,
                };
                cmd.args(["--ppa", filter]);
            }
        } else {
            // YTDLnis format sorting: prioritize standard MP4 video and M4A audio containers
            cmd.args(["-S", "res,ext:mp4:m4a"]);

            if task.format == "4k" || task.format == "2160p" {
                cmd.args(["-f", "bestvideo[height<=2160]+bestaudio/best[height<=2160]/best"]);
            } else if task.format == "1440p" || task.format == "2k" {
                cmd.args(["-f", "bestvideo[height<=1440]+bestaudio/best[height<=1440]/best"]);
            } else if task.format == "1080p" {
                cmd.args(["-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"]);
            } else if task.format == "720p" {
                cmd.args(["-f", "bestvideo[height<=720]+bestaudio/best[height<=720]/best"]);
            } else if task.format == "480p" {
                cmd.args(["-f", "bestvideo[height<=480]+bestaudio/best[height<=480]/best"]);
            } else if task.format != "best" && !task.format.is_empty() {
                cmd.args(["-f", &task.format]);
            } else {
                cmd.args(["-f", "bestvideo+bestaudio/best"]);
            }
            cmd.args(["--merge-output-format", "mp4"]);
        }

        // Metadata embedding for both video and audio
        if task.embed_metadata.unwrap_or(true) {
            cmd.arg("--embed-metadata");
            cmd.arg("--embed-chapters");
            cmd.args(["--parse-metadata", "%(artist,uploader)s:%(meta_artist)s"]);
        }

        // Auto-detect cookies.txt in application root
        let cookies_path = get_cookies_path();
        if cookies_path.is_file() {
            cmd.arg("--cookies");
            cmd.arg(cookies_path.to_string_lossy().as_ref());
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
                    t.full_error = Some(format!("Failed to start process: {}", e));
                    t.logs.push(format!("[Process Error] {}", e));
                }
                continue;
            }
        };

        if let Some(pid) = child.id() {
            let mut procs = procs_arc.lock().await;
            procs.insert(task.id.clone(), pid);
        }

        let stderr_lines_arc = Arc::new(Mutex::new(Vec::<String>::new()));
        let stderr_lines_for_stderr = Arc::clone(&stderr_lines_arc);

        if let Some(stderr) = child.stderr.take() {
            let mut reader = BufReader::new(stderr).lines();
            let task_id = task.id.clone();
            let tasks_for_stderr = Arc::clone(&tasks_arc);

            tokio::spawn(async move {
                while let Ok(Some(line)) = reader.next_line().await {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        {
                            let mut s_lines = stderr_lines_for_stderr.lock().await;
                            s_lines.push(trimmed.to_string());
                        }
                        let mut tasks = tasks_for_stderr.lock().await;
                        if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
                            t.logs.push(format!("[stderr] {}", trimmed));
                            if t.logs.len() > 400 {
                                t.logs.remove(0);
                            }
                        }
                    }
                }
            });
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
                        if t.logs.len() > 400 {
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
                            let s_lines = stderr_lines_arc.lock().await;
                            let full_err = s_lines.join("\n");
                            let specific_err = s_lines
                                .iter()
                                .rev()
                                .find(|l| l.contains("ERROR:") || l.contains("HTTP Error"))
                                .cloned()
                                .or_else(|| s_lines.last().cloned())
                                .unwrap_or_else(|| format!("Process exited with code {:?}", exit_status.code()));

                            t.error = Some(specific_err.clone());
                            t.full_error = if full_err.is_empty() {
                                Some(format!("Process exited with code {:?}", exit_status.code()))
                            } else {
                                Some(full_err)
                            };
                            t.logs.push(format!("[Error] Process exited with code {:?}", exit_status.code()));
                        }
                    }
                    Err(e) => {
                        t.status = "error".to_string();
                        t.error = Some(e.to_string());
                        t.full_error = Some(e.to_string());
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
        task.full_error = None;
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
async fn get_settings() -> Result<serde_json::Value, String> {
    let cfg_path = get_config_path();
    if cfg_path.exists() {
        let content = fs::read_to_string(&cfg_path).map_err(|e| e.to_string())?;
        let val: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(val)
    } else {
        Ok(serde_json::json!({}))
    }
}

#[tauri::command]
async fn save_settings(settings: serde_json::Value, state: State<'_, AppState>) -> Result<bool, String> {
    let cfg_path = get_config_path();
    let mut current_map = if cfg_path.exists() {
        fs::read_to_string(&cfg_path)
            .ok()
            .and_then(|c| serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&c).ok())
            .unwrap_or_default()
    } else {
        serde_json::Map::new()
    };

    if let Some(obj) = settings.as_object() {
        for (k, v) in obj {
            current_map.insert(k.clone(), v.clone());
        }
    }

    // Also sync download_dir if present in settings
    if let Some(dl_val) = current_map.get("downloadDir").and_then(|v| v.as_str()) {
        let resolved = resolve_download_path(dl_val);
        let mut dl = state.download_dir.lock().await;
        *dl = resolved;
    }

    let json_str = serde_json::to_string_pretty(&current_map).map_err(|e| e.to_string())?;
    fs::write(&cfg_path, json_str).map_err(|e| e.to_string())?;
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

    // Persist to config.json in application root
    let cfg_path = get_config_path();
    let mut current_map = if cfg_path.exists() {
        fs::read_to_string(&cfg_path)
            .ok()
            .and_then(|c| serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&c).ok())
            .unwrap_or_default()
    } else {
        serde_json::Map::new()
    };
    current_map.insert("downloadDir".to_string(), serde_json::Value::String(dir));
    if let Ok(json_str) = serde_json::to_string_pretty(&current_map) {
        let _ = fs::write(&cfg_path, json_str);
    }

    Ok(resolved)
}

#[tauri::command]
async fn reset_download_dir(state: State<'_, AppState>) -> Result<String, String> {
    let mut dl = state.download_dir.lock().await;
    let def = get_default_download_dir();
    *dl = def.clone();
    let _ = fs::create_dir_all(&def);

    // Remove or reset downloadDir in config.json in application root
    let cfg_path = get_config_path();
    if cfg_path.exists() {
        if let Ok(content) = fs::read_to_string(&cfg_path) {
            if let Ok(mut map) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&content) {
                map.remove("downloadDir");
                if let Ok(json_str) = serde_json::to_string_pretty(&map) {
                    let _ = fs::write(&cfg_path, json_str);
                }
            }
        }
    }

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
    let cookie_file = get_app_root().join("cookies.txt");
    fs::write(&cookie_file, &content).map_err(|e| e.to_string())?;
    Ok(content.lines().count())
}

#[tauri::command]
async fn get_cookies_file() -> Result<Option<String>, String> {
    let cookie_file = get_cookies_path();
    if cookie_file.exists() {
        fs::read_to_string(cookie_file).map(Some).map_err(|e| e.to_string())
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn clear_cookies_file() -> Result<bool, String> {
    let cookie_file = get_app_root().join("cookies.txt");
    if cookie_file.exists() {
        let _ = fs::remove_file(cookie_file);
    }
    let legacy = Path::new("portable_data/cookies.txt");
    if legacy.exists() {
        let _ = fs::remove_file(legacy);
    }
    Ok(true)
}

fn main() {
    let target_config = get_config_path();

    // Migrate legacy portable_data files to application root if present
    let legacy_config = Path::new("portable_data/config.json");
    if legacy_config.exists() && !target_config.exists() {
        let _ = fs::copy(legacy_config, &target_config);
        let _ = fs::remove_file(legacy_config);
    }

    let legacy_cookies = Path::new("portable_data/cookies.txt");
    let target_cookies = get_app_root().join("cookies.txt");
    if legacy_cookies.exists() && !target_cookies.exists() {
        let _ = fs::copy(legacy_cookies, &target_cookies);
        let _ = fs::remove_file(legacy_cookies);
    }

    // Clean up empty portable_data dir
    let legacy_dir = Path::new("portable_data");
    if legacy_dir.exists() {
        if let Ok(entries) = fs::read_dir(legacy_dir) {
            if entries.count() == 0 {
                let _ = fs::remove_dir(legacy_dir);
            }
        }
    }

    let mut default_dl = get_default_download_dir();
    // Load custom downloadDir from config.json if present
    if target_config.exists() {
        if let Ok(content) = fs::read_to_string(&target_config) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(dl) = val.get("downloadDir").and_then(|v| v.as_str()) {
                    if !dl.trim().is_empty() {
                        default_dl = resolve_download_path(dl.trim());
                    }
                }
            }
        }
    }

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
            get_settings,
            save_settings,
            extract_info,
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
