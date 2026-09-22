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
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
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
#[serde(rename_all = "camelCase")]
pub struct CustomAudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<String>,
    pub genre: Option<String>,
    pub track: Option<String>,
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
    #[serde(alias = "filepath", alias = "filePath")]
    pub file_path: Option<String>,
    #[serde(alias = "filename", alias = "fileName")]
    pub file_name: Option<String>,
    #[serde(alias = "filesize", alias = "fileSize")]
    pub file_size: Option<u64>,
    #[serde(alias = "totalSize", alias = "total_size", default)]
    pub total_size: Option<String>,
    pub thumbnail: Option<String>,
    pub channel: Option<String>,
    pub duration: Option<u64>,
    pub media_type: Option<String>,
    pub naming_template: Option<String>,
    pub embed_metadata: Option<bool>,
    pub crop_thumbnail: Option<bool>,
    pub crop_focus: Option<String>,
    pub custom_metadata: Option<CustomAudioMetadata>,
    #[serde(alias = "upscaleHeight")]
    pub upscale_height: Option<u64>,
    #[serde(alias = "userAgent", alias = "user_agent")]
    pub user_agent: Option<String>,
    #[serde(alias = "playerClient", alias = "player_client", default)]
    pub player_client: Option<String>,
    #[serde(alias = "limitRate", alias = "limit_rate", default)]
    pub limit_rate: Option<String>,
    #[serde(alias = "useAria2", alias = "use_aria2", default)]
    pub use_aria2: Option<bool>,
    #[serde(alias = "aria2Connections", alias = "aria2_connections", default)]
    pub aria2_connections: Option<u32>,
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
    pub ffprobe: bool,
    pub ffprobe_installed: bool,
    pub ffprobe_version: String,
    pub aria2c: bool,
    pub aria2c_installed: bool,
    pub aria2c_version: String,
    pub config_dir: String,
    pub platform: String,
}

pub struct AppState {
    pub tasks: Arc<Mutex<Vec<DownloadTask>>>,
    pub active_processes: Arc<Mutex<HashMap<String, u32>>>, // taskId -> PID
    pub download_dir: Arc<Mutex<String>>,
    pub cached_versions: Arc<Mutex<Option<(String, bool, String, bool, String, bool, String, bool)>>>,
    pub is_queue_running: Arc<tokio::sync::Mutex<bool>>,
}

fn format_bytes_to_human(bytes: u64) -> String {
    if bytes >= 1024 * 1024 * 1024 {
        format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    } else if bytes >= 1024 * 1024 {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    } else if bytes >= 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{} B", bytes)
    }
}

fn normalize_size_str(raw: &str) -> String {
    let trimmed = raw.trim().trim_start_matches('~').trim();
    let re = regex::Regex::new(r"(?i)^([\d\.]+)\s*([A-Za-z]+)$").unwrap();
    if let Some(caps) = re.captures(trimmed) {
        if let (Some(num_str), Some(unit_str)) = (caps.get(1), caps.get(2)) {
            let unit = unit_str.as_str().to_lowercase();
            if let Ok(num) = num_str.as_str().parse::<f64>() {
                if unit.starts_with('g') {
                    return format!("{:.2} GB", num);
                } else if unit.starts_with('m') {
                    return format!("{:.1} MB", num);
                } else if unit.starts_with('k') {
                    return format!("{:.1} KB", num);
                } else if unit.starts_with('b') {
                    return format!("{:.0} B", num);
                }
            }
        }
    }
    trimmed.to_string()
}

fn parse_size_str_to_bytes(raw: &str) -> u64 {
    let trimmed = raw.trim().trim_start_matches('~').trim();
    let re = regex::Regex::new(r"(?i)^([\d\.]+)\s*([A-Za-z]+)$").unwrap();
    if let Some(caps) = re.captures(trimmed) {
        if let (Some(num_str), Some(unit_str)) = (caps.get(1), caps.get(2)) {
            let unit = unit_str.as_str().to_lowercase();
            if let Ok(num) = num_str.as_str().parse::<f64>() {
                if unit.starts_with('g') {
                    return (num * 1024.0 * 1024.0 * 1024.0) as u64;
                } else if unit.starts_with('m') {
                    return (num * 1024.0 * 1024.0) as u64;
                } else if unit.starts_with('k') {
                    return (num * 1024.0) as u64;
                } else if unit.starts_with('b') {
                    return num as u64;
                }
            }
        }
    }
    0
}

fn format_speed_to_mbps(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("unknown") || trimmed.eq_ignore_ascii_case("unknown b/s") {
        return "0.0 MBps".to_string();
    }
    if trimmed.eq_ignore_ascii_case("done") {
        return "Done".to_string();
    }
    let re = regex::Regex::new(r"(?i)^([\d\.]+)\s*([A-Za-z]+(?:/[A-Za-z]+)?)$").unwrap();
    if let Some(caps) = re.captures(trimmed) {
        if let (Some(num_str), Some(unit_str)) = (caps.get(1), caps.get(2)) {
            if let Ok(num) = num_str.as_str().parse::<f64>() {
                let unit = unit_str.as_str().to_lowercase();
                let mbps = if unit.contains("bit") || (unit.contains("bps") && !unit.contains("mbps")) {
                    if unit.starts_with('g') {
                        (num * 1000.0) / 8.0
                    } else if unit.starts_with('k') {
                        (num / 1000.0) / 8.0
                    } else {
                        num / 8.0
                    }
                } else if unit.contains("gib") || unit.contains("gb") {
                    num * 1024.0
                } else if unit.contains("mib") || unit.contains("mb") {
                    num
                } else if unit.contains("kib") || unit.contains("kb") {
                    num / 1024.0
                } else if unit.contains("b/s") || unit == "b" {
                    num / (1024.0 * 1024.0)
                } else {
                    num
                };

                if mbps == 0.0 {
                    return "0.0 MBps".to_string();
                } else if mbps < 0.01 {
                    return "< 0.01 MBps".to_string();
                } else if mbps >= 100.0 {
                    return format!("{:.1} MBps", mbps);
                } else {
                    return format!("{:.2} MBps", mbps);
                }
            }
        }
    }
    trimmed.to_string()
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(windows)]
fn to_wide_null(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
#[link(name = "shell32")]
extern "system" {
    fn ShellExecuteW(
        hwnd: *mut std::ffi::c_void,
        lpoperation: *const u16,
        lpfile: *const u16,
        lpparameters: *const u16,
        lpdirectory: *const u16,
        nshowcmd: i32,
    ) -> isize;
}

#[cfg(windows)]
#[link(name = "powrprof")]
extern "system" {
    fn SetSuspendState(
        hibernate: u8,
        forcecritical: u8,
        disablewakeevent: u8,
    ) -> u8;
}

#[cfg(windows)]
#[link(name = "advapi32")]
extern "system" {
    fn OpenProcessToken(
        processhandle: *mut std::ffi::c_void,
        desiredaccess: u32,
        tokenhandle: *mut *mut std::ffi::c_void,
    ) -> i32;

    fn LookupPrivilegeValueW(
        lpsystemname: *const u16,
        lpname: *const u16,
        lpluid: *mut LUID,
    ) -> i32;

    fn AdjustTokenPrivileges(
        tokenhandle: *mut std::ffi::c_void,
        disableallprivileges: i32,
        newstate: *const TOKEN_PRIVILEGES,
        bufferlength: u32,
        previousstate: *mut TOKEN_PRIVILEGES,
        returnlength: *mut u32,
    ) -> i32;

    fn InitiateSystemShutdownExW(
        lpmachinename: *const u16,
        lpmessage: *const u16,
        dxtimeout: u32,
        bforceappsclosed: i32,
        brebootsaftershutdown: i32,
        dwreason: u32,
    ) -> i32;

    fn AbortSystemShutdownW(
        lpmachinename: *const u16,
    ) -> i32;
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn GetCurrentProcess() -> *mut std::ffi::c_void;
    fn CloseHandle(hobject: *mut std::ffi::c_void) -> i32;
    fn SetThreadExecutionState(es_flags: u32) -> u32;
}

#[cfg(windows)]
#[repr(C)]
#[derive(Clone, Copy)]
struct LUID {
    low_part: u32,
    high_part: i32,
}

#[cfg(windows)]
#[repr(C)]
struct LUID_AND_ATTRIBUTES {
    luid: LUID,
    attributes: u32,
}

#[cfg(windows)]
#[repr(C)]
struct TOKEN_PRIVILEGES {
    privilege_count: u32,
    privileges: [LUID_AND_ATTRIBUTES; 1],
}

#[cfg(windows)]
fn enable_shutdown_privilege() -> bool {
    const TOKEN_ADJUST_PRIVILEGES: u32 = 0x0020;
    const TOKEN_QUERY: u32 = 0x0008;
    const SE_PRIVILEGE_ENABLED: u32 = 0x00000002;

    unsafe {
        let mut token: *mut std::ffi::c_void = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &mut token) == 0 {
            return false;
        }

        let priv_name = to_wide_null("SeShutdownPrivilege");
        let mut luid = LUID { low_part: 0, high_part: 0 };
        if LookupPrivilegeValueW(std::ptr::null(), priv_name.as_ptr(), &mut luid) == 0 {
            CloseHandle(token);
            return false;
        }

        let tp = TOKEN_PRIVILEGES {
            privilege_count: 1,
            privileges: [LUID_AND_ATTRIBUTES {
                luid,
                attributes: SE_PRIVILEGE_ENABLED,
            }],
        };

        let res = AdjustTokenPrivileges(token, 0, &tp, 0, std::ptr::null_mut(), std::ptr::null_mut());
        CloseHandle(token);
        res != 0
    }
}


#[cfg(windows)]
const ES_CONTINUOUS: u32 = 0x80000000;
#[cfg(windows)]
const ES_SYSTEM_REQUIRED: u32 = 0x00000001;
#[cfg(windows)]
const ES_AWAYMODE_REQUIRED: u32 = 0x00000040;

fn create_hidden_command<S: AsRef<OsStr>>(program: S) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

#[cfg(windows)]
fn find_python_executable() -> Option<PathBuf> {
    use std::os::windows::process::CommandExt;
    let candidates = ["python", "py", "python3"];
    for py in candidates {
        let mut where_cmd = std::process::Command::new("where.exe");
        where_cmd.creation_flags(CREATE_NO_WINDOW);
        if let Ok(output) = where_cmd.arg(py).output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let trimmed = line.trim().trim_matches('"');
                    let p = Path::new(trimmed);
                    if p.is_file() {
                        return Some(p.to_path_buf());
                    }
                }
            }
        }
    }
    None
}

fn create_ytdlp_command() -> Command {
    let ytdlp_path = get_ytdlp_path();
    #[cfg(windows)]
    {
        let path_str = ytdlp_path.to_string_lossy().to_lowercase();
        let is_win_exec = path_str.ends_with(".exe") || path_str.ends_with(".bat") || path_str.ends_with(".cmd");
        if !is_win_exec && ytdlp_path.is_file() {
            if let Some(py) = find_python_executable() {
                let mut cmd = create_hidden_command(py);
                cmd.arg(&ytdlp_path);
                return cmd;
            }
        }
    }
    create_hidden_command(ytdlp_path)
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

pub fn get_data_dir() -> PathBuf {
    let dir = get_app_root().join("yt-dlp_data");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

pub fn get_config_path() -> PathBuf {
    get_data_dir().join("config.json")
}

pub fn get_queue_path() -> PathBuf {
    get_data_dir().join("queue.json")
}

pub fn get_cookies_path() -> PathBuf {
    get_data_dir().join("cookies.txt")
}

fn save_queue_to_disk(tasks: &[DownloadTask]) {
    let queue_path = get_queue_path();
    let tmp_path = get_data_dir().join("queue.json.tmp");
    if let Ok(json_str) = serde_json::to_string_pretty(tasks) {
        if fs::write(&tmp_path, json_str).is_ok() {
            let _ = fs::rename(&tmp_path, &queue_path);
        }
    }
}

fn load_queue_from_disk() -> Vec<DownloadTask> {
    let queue_path = get_queue_path();
    if !queue_path.exists() {
        return Vec::new();
    }
    let content = match fs::read_to_string(&queue_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let mut tasks: Vec<DownloadTask> = serde_json::from_str(&content).unwrap_or_default();
    for t in &mut tasks {
        if t.status == "downloading" || t.status == "fetching" || t.status == "converting" {
            t.status = "error".to_string();
            t.speed = "0.0 MBps".to_string();
            t.eta = "--:--".to_string();
            t.error = Some("Download was interrupted when application closed. Ready to retry.".to_string());
            t.full_error = Some("Process terminated unexpectedly or application was closed while download was in progress.".to_string());
            t.logs.push("[Interrupted] Download was interrupted when application closed. Click Retry to resume.".to_string());
        }
    }
    tasks
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
    let is_windows = cfg!(windows);

    // 1. Same location as executable and local subdirectories
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidates: Vec<PathBuf> = if is_windows {
                vec![
                    exe_dir.join(format!("{}.exe", name)),
                    exe_dir.join("bin").join(format!("{}.exe", name)),
                    exe_dir.join("resources").join("bin").join(format!("{}.exe", name)),
                    exe_dir.join("resources").join(format!("{}.exe", name)),
                ]
            } else {
                vec![
                    exe_dir.join(name),
                    exe_dir.join("bin").join(name),
                    exe_dir.join("resources").join("bin").join(name),
                    exe_dir.join("resources").join(name),
                    exe_dir.join(format!("{}.exe", name)),
                ]
            };
            for cand in candidates {
                if cand.is_file() {
                    return cand;
                }
            }
        }
    }

    // 2. Current working directory
    let cwd_candidates: Vec<String> = if is_windows {
        vec![
            format!("bin/{}.exe", name),
            format!("{}.exe", name),
            format!("bin/{}.cmd", name),
            format!("{}.cmd", name),
            format!("bin/{}.bat", name),
            format!("{}.bat", name),
        ]
    } else {
        vec![
            format!("bin/{}", name),
            name.to_string(),
            format!("bin/{}.exe", name),
            format!("{}.exe", name),
        ]
    };
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
        use std::os::windows::process::CommandExt;
        for query in &[format!("{}.exe", name), name.to_string()] {
            let mut where_cmd = std::process::Command::new("where.exe");
            where_cmd.creation_flags(CREATE_NO_WINDOW);
            if let Ok(output) = where_cmd.arg(query).output() {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    for line in stdout.lines() {
                        let trimmed = line.trim().trim_matches('"');
                        let p = Path::new(trimmed);
                        if p.is_file() {
                            let p_str = p.to_string_lossy().to_lowercase();
                            if p_str.ends_with(".exe") || p_str.ends_with(".cmd") || p_str.ends_with(".bat") {
                                return p.to_path_buf();
                            }
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

            // Check WinGet Packages (e.g. Gyan.FFmpeg.Essentials build)
            let winget_pkgs = base.join("Microsoft").join("WinGet").join("Packages");
            if winget_pkgs.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&winget_pkgs) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p.is_dir() {
                            extra_dirs.push(p.join("bin"));
                            if let Ok(sub_entries) = std::fs::read_dir(&p) {
                                for sub in sub_entries.flatten() {
                                    let sub_p = sub.path();
                                    if sub_p.is_dir() {
                                        extra_dirs.push(sub_p.join("bin"));
                                        extra_dirs.push(sub_p);
                                    }
                                }
                            }
                        }
                    }
                }
            }

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

    // 5b. On Windows, if no native .exe was found, check if an extensionless script/binary exists in cwd or exe_dir
    #[cfg(windows)]
    {
        let fallback_local = [
            format!("bin/{}", name),
            name.to_string(),
        ];
        for cand_str in fallback_local {
            let cand = Path::new(&cand_str);
            if cand.is_file() {
                if let Ok(abs) = cand.canonicalize() {
                    return abs;
                }
                return cand.to_path_buf();
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
    let f = find_executable("ffmpeg");
    if f.is_file() {
        return f;
    }
    // Sibling of ffprobe (FFmpeg essentials builds bundle ffmpeg and ffprobe together)
    let probe = find_executable("ffprobe");
    if probe.is_file() {
        if let Some(parent) = probe.parent() {
            let sibling = parent.join(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" });
            if sibling.is_file() {
                return sibling;
            }
        }
    }
    f
}

// Locate ffprobe binary (local, PATH, or OS fallback)
fn get_ffprobe_path() -> PathBuf {
    let probe = find_executable("ffprobe");
    if probe.is_file() {
        return probe;
    }
    // Sibling of ffmpeg (FFmpeg essentials builds bundle ffmpeg and ffprobe together)
    let ffmpeg = find_executable("ffmpeg");
    if ffmpeg.is_file() {
        if let Some(parent) = ffmpeg.parent() {
            let sibling = parent.join(if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" });
            if sibling.is_file() {
                return sibling;
            }
        }
    }
    probe
}

fn get_aria2_path() -> PathBuf {
    find_executable("aria2c")
}

#[tauri::command]
async fn get_system_status(state: State<'_, AppState>) -> Result<SystemStatus, String> {
    let (ytdlp_ver, ytdlp_ok, ffmpeg_ver, ffmpeg_ok, ffprobe_ver, ffprobe_ok, aria2_ver, aria2_ok) = {
        let mut cached = state.cached_versions.lock().await;
        if let Some(ref val) = *cached {
            val.clone()
        } else {
            let ffmpeg = get_ffmpeg_path();
            let ffprobe = get_ffprobe_path();
            let aria2 = get_aria2_path();

            let y_ver = {
                let mut cmd = create_ytdlp_command();
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

            let fp_ver = {
                let mut cmd = create_hidden_command(&ffprobe);
                cmd.arg("-version");
                let out = cmd.output().await;
                match out {
                    Ok(o) if o.status.success() => {
                        let s = String::from_utf8_lossy(&o.stdout);
                        s.lines().next().unwrap_or("ffprobe active").to_string()
                    }
                    _ => {
                        #[cfg(windows)]
                        {
                            let mut sh = create_hidden_command("cmd.exe");
                            sh.args(["/c", "ffprobe", "-version"]);
                            if let Ok(o) = sh.output().await {
                                if o.status.success() {
                                    let s = String::from_utf8_lossy(&o.stdout);
                                    s.lines().next().unwrap_or("ffprobe active").to_string()
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

            let a_ver = {
                let mut cmd = create_hidden_command(&aria2);
                cmd.arg("--version");
                let out = cmd.output().await;
                match out {
                    Ok(o) if o.status.success() => {
                        let s = String::from_utf8_lossy(&o.stdout);
                        s.lines().next().unwrap_or("aria2 active").to_string()
                    }
                    _ => {
                        #[cfg(windows)]
                        {
                            let mut sh = create_hidden_command("cmd.exe");
                            sh.args(["/c", "aria2c", "--version"]);
                            if let Ok(o) = sh.output().await {
                                if o.status.success() {
                                    let s = String::from_utf8_lossy(&o.stdout);
                                    s.lines().next().unwrap_or("aria2 active").to_string()
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
            let fp_ok = !fp_ver.contains("Not detected");
            let a_ok = !a_ver.contains("Not detected");

            let res = (y_ver, y_ok, f_ver, f_ok, fp_ver, fp_ok, a_ver, a_ok);
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
        ffprobe: ffprobe_ok,
        ffprobe_installed: ffprobe_ok,
        ffprobe_version: ffprobe_ver,
        aria2c: aria2_ok,
        aria2c_installed: aria2_ok,
        aria2c_version: aria2_ver,
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

    let ffmpeg_path = get_ffmpeg_path();

    let mut cmd = create_ytdlp_command();
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

    if let Some(ref a) = auth {
        let ua_opt = a.get("userAgent").or_else(|| a.get("user_agent")).and_then(|v| v.as_str());
        if let Some(ua) = ua_opt {
            let trimmed = ua.trim();
            if !trimmed.is_empty() {
                cmd.args(["--user-agent", trimmed]);
            }
        }
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
                "tbr": f.get("tbr").and_then(|v| v.as_f64()).or_else(|| f.get("abr").and_then(|v| v.as_f64())),
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
        let custom_metadata: Option<CustomAudioMetadata> = item.get("customMetadata")
            .or_else(|| global_options.as_ref().and_then(|g| g.get("customMetadata")))
            .and_then(|v| serde_json::from_value(v.clone()).ok());
        let upscale_height = item.get("upscaleHeight")
            .or_else(|| global_options.as_ref().and_then(|g| g.get("upscaleHeight")))
            .and_then(|v| v.as_u64());
        let user_agent = item.get("userAgent")
            .or_else(|| item.get("user_agent"))
            .or_else(|| global_options.as_ref().and_then(|g| g.get("userAgent").or_else(|| g.get("user_agent"))))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let player_client = item.get("playerClient")
            .or_else(|| item.get("player_client"))
            .or_else(|| global_options.as_ref().and_then(|g| g.get("playerClient").or_else(|| g.get("player_client"))))
            .or_else(|| global_options.as_ref().and_then(|g| g.get("auth").and_then(|a| a.get("playerClient").or_else(|| a.get("player_client")))))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let limit_rate = item.get("limitRate")
            .or_else(|| item.get("limit_rate"))
            .or_else(|| global_options.as_ref().and_then(|g| g.get("limitRate").or_else(|| g.get("limit_rate"))))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let use_aria2 = item.get("useAria2")
            .or_else(|| item.get("use_aria2"))
            .or_else(|| global_options.as_ref().and_then(|g| g.get("useAria2").or_else(|| g.get("use_aria2"))))
            .and_then(|v| v.as_bool());
        let aria2_connections = item.get("aria2Connections")
            .or_else(|| item.get("aria2_connections"))
            .or_else(|| global_options.as_ref().and_then(|g| g.get("aria2Connections").or_else(|| g.get("aria2_connections"))))
            .and_then(|v| v.as_u64())
            .map(|c| c as u32);

        let task = DownloadTask {
            id: id.clone(),
            title,
            url,
            format: format.clone(),
            quality: format,
            status: "queued".to_string(),
            progress: 0.0,
            speed: "0.0 MBps".to_string(),
            eta: "--:--".to_string(),
            downloaded_bytes: 0,
            total_bytes: 0,
            error: None,
            full_error: None,
            logs: vec!["[Task Created] Queued in desktop client".to_string()],
            file_path: None,
            file_name: None,
            file_size: None,
            total_size: None,
            thumbnail,
            channel,
            duration: None,
            media_type,
            naming_template,
            embed_metadata,
            crop_thumbnail,
            crop_focus,
            custom_metadata,
            upscale_height,
            user_agent,
            player_client,
            limit_rate,
            use_aria2,
            aria2_connections,
        };

        tasks_guard.push(task.clone());
        created_tasks.push(task);
    }
    save_queue_to_disk(&tasks_guard);
    drop(tasks_guard);

    // Trigger background runner safely
    ensure_queue_running(
        Arc::clone(&state.tasks),
        Arc::clone(&state.active_processes),
        Arc::clone(&state.download_dir),
        Arc::clone(&state.is_queue_running),
    ).await;

    Ok(QueueResponse {
        success: true,
        tasks: created_tasks,
    })
}

fn parse_destination_from_line(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if let Some(rest) = trimmed.strip_prefix("[Merger] Merging formats into ") {
        return Some(rest.trim().trim_matches('"').to_string());
    }
    if let Some(rest) = trimmed.strip_prefix("[ExtractAudio] Destination: ") {
        return Some(rest.trim().trim_matches('"').to_string());
    }
    if let Some(rest) = trimmed.strip_prefix("[ffmpeg] Destination: ") {
        return Some(rest.trim().trim_matches('"').to_string());
    }
    if let Some(start) = trimmed.find("Correcting container in ") {
        let sub = &trimmed[start + "Correcting container in ".len()..];
        return Some(sub.trim().trim_matches('"').to_string());
    }
    if trimmed.contains("[MoveFiles] Moving file ") && trimmed.contains(" to ") {
        if let Some(start) = trimmed.find(" to ") {
            let sub = &trimmed[start + 4..];
            return Some(sub.trim().trim_matches('"').to_string());
        }
    }
    if let Some(rest) = trimmed.strip_prefix("[download] Destination: ") {
        return Some(rest.trim().trim_matches('"').to_string());
    }
    if trimmed.starts_with("[download] ") && trimmed.ends_with(" has already been downloaded") {
        let sub = &trimmed["[download] ".len()..trimmed.len() - " has already been downloaded".len()];
        return Some(sub.trim().trim_matches('"').to_string());
    }
    None
}

fn get_unique_file_path(target: &Path) -> PathBuf {
    if !target.exists() {
        return target.to_path_buf();
    }
    let parent = target.parent().unwrap_or_else(|| Path::new("."));
    let stem = target.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = target.extension().and_then(|e| e.to_str()).map(|e| format!(".{}", e)).unwrap_or_default();

    let re = regex::Regex::new(r"^(.*?)\s*\((\d+)\)$").unwrap();
    let (root_name, mut counter) = if let Some(caps) = re.captures(stem) {
        let r = caps.get(1).map(|m| m.as_str()).unwrap_or(stem).to_string();
        let c = caps.get(2).and_then(|m| m.as_str().parse::<usize>().ok()).unwrap_or(1) + 1;
        (r, c)
    } else {
        (stem.to_string(), 1)
    };

    loop {
        let candidate = parent.join(format!("{} ({}){}", root_name, counter, ext));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}


async fn ensure_queue_running(
    tasks_arc: Arc<Mutex<Vec<DownloadTask>>>,
    procs_arc: Arc<Mutex<HashMap<String, u32>>>,
    dl_arc: Arc<Mutex<String>>,
    is_running_arc: Arc<tokio::sync::Mutex<bool>>,
) {
    let mut running = is_running_arc.lock().await;
    if *running {
        return;
    }
    *running = true;

    let tasks_clone = Arc::clone(&tasks_arc);
    let procs_clone = Arc::clone(&procs_arc);
    let dl_clone = Arc::clone(&dl_arc);
    let running_clone = Arc::clone(&is_running_arc);

    tokio::spawn(async move {
        run_download_queue(tasks_clone, procs_clone, dl_clone).await;
        let mut r = running_clone.lock().await;
        *r = false;
    });
}

async fn run_download_queue(
    tasks_arc: Arc<Mutex<Vec<DownloadTask>>>,
    procs_arc: Arc<Mutex<HashMap<String, u32>>>,
    dl_arc: Arc<Mutex<String>>,
) {
    loop {
        let next_task = {
            let mut tasks = tasks_arc.lock().await;
            if let Some(idx) = tasks.iter().position(|t| t.status == "queued") {
                tasks[idx].status = "downloading".to_string();
                tasks[idx].logs.push("[Download Started] Launching yt-dlp...".to_string());
                if let Some(h) = tasks[idx].upscale_height {
                    if h > 0 {
                        tasks[idx].logs.push(format!("[Video Processor] FFmpeg forced upscale active: target height {}p (-vf scale=-2:{})", h, h));
                    }
                }
                let current_task = tasks[idx].clone();
                save_queue_to_disk(&tasks);
                Some(current_task)
            } else {
                None
            }
        };

        let task = match next_task {
            Some(t) => t,
            None => break,
        };

        let ffmpeg_path = get_ffmpeg_path();
        let download_dir = {
            let d = dl_arc.lock().await;
            resolve_download_path(&d)
        };

        // Only ensure the specific target directory exists right before running the download
        let _ = fs::create_dir_all(&download_dir);

        let staging_dir = PathBuf::from(&download_dir).join(".staging").join(&task.id);
        let _ = fs::create_dir_all(&staging_dir);

        let mut cmd = create_ytdlp_command();
        cmd.arg("--newline");
        cmd.arg("--no-mtime");
        cmd.arg("--no-warnings");
        cmd.arg("-P");
        cmd.arg(&staging_dir);

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
                && !["m4a", "opus", "flac", "wav", "best", "audio", "mp3_auto"].contains(&task.format.as_str());

            if is_format_direct {
                cmd.args(["-f", &task.format]);
                cmd.args(["--audio-format", "best"]);
            } else if task.format == "best" || task.format == "audio" || task.format.is_empty() {
                // Best available audio: download native best audio stream directly without re-encoding or artificial 320k padding
                cmd.args(["-f", "bestaudio/best"]);
                cmd.args(["--audio-format", "best"]);
            } else if task.format == "m4a" {
                cmd.args(["-f", "bestaudio[ext=m4a]/bestaudio/best"]);
                cmd.args(["--audio-format", "m4a"]);
            } else if task.format == "opus" {
                cmd.args(["-f", "bestaudio[ext=opus]/bestaudio[ext=webm]/bestaudio/best"]);
                cmd.args(["--audio-format", "opus"]);
            } else if task.format == "flac" {
                cmd.args(["-f", "bestaudio/best"]);
                cmd.args(["--audio-format", "flac"]);
            } else if task.format == "wav" {
                cmd.args(["-f", "bestaudio/best"]);
                cmd.args(["--audio-format", "wav"]);
            } else if task.format.starts_with("mp3") {
                cmd.args(["-f", "bestaudio/best"]);
                cmd.args(["--audio-format", "mp3"]);
                if task.format == "mp3_320" {
                    cmd.args(["--audio-quality", "320k"]);
                } else if task.format == "mp3_256" {
                    cmd.args(["--audio-quality", "256k"]);
                } else if task.format == "mp3_192" {
                    cmd.args(["--audio-quality", "192k"]);
                } else {
                    // Default / VBR V0: preserves original source quality without forcing artificial 320k CBR bloat
                    cmd.args(["--audio-quality", "0"]);
                }
            } else {
                cmd.args(["-f", "bestaudio/best"]);
                cmd.args(["--audio-format", "best"]);
            }

            let should_crop = task.crop_thumbnail.unwrap_or(true);
            cmd.arg("--embed-thumbnail");
            cmd.args(["--convert-thumbnails", "jpg"]);
            if should_crop {
                let focus = task.crop_focus.as_deref().unwrap_or("center");
                let filter = match focus {
                    "left" => r#"ThumbnailsConvertor+ffmpeg_o:-vf crop='min(iw\,ih)':'min(iw\,ih)':0:0"#,
                    "right" => r#"ThumbnailsConvertor+ffmpeg_o:-vf crop='min(iw\,ih)':'min(iw\,ih)':(in_w-out_w):0"#,
                    _ => r#"ThumbnailsConvertor+ffmpeg_o:-vf crop='min(iw\,ih)':'min(iw\,ih)'"#,
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

            if let Some(h) = task.upscale_height {
                if h > 0 {
                    cmd.args(["--ppa", &format!("Merger+ffmpeg_o:-vf scale=-2:{}", h)]);
                    cmd.args(["--ppa", &format!("VideoConvertor+ffmpeg_o:-vf scale=-2:{}", h)]);
                }
            }
        }

        // Metadata embedding for both video and audio
        if task.embed_metadata.unwrap_or(true) {
            cmd.arg("--embed-metadata");
            cmd.arg("--embed-chapters");
            cmd.args(["--parse-metadata", "%(artist,uploader)s:%(meta_artist)s"]);
            // Ensure 4-digit release/upload year to prevent Windows displaying 10100 on M4A / blank on MP3
            cmd.args(["--parse-metadata", "%(release_date,upload_date)s:(?s)^(?P<meta_date>\\d{4})"]);
        }

        // Custom metadata overrides
        if let Some(ref meta) = task.custom_metadata {
            if let Some(ref title) = meta.title {
                if !title.trim().is_empty() {
                    cmd.args(["--parse-metadata", &format!("{}:%(meta_title)s", title.trim())]);
                }
            }
            if let Some(ref artist) = meta.artist {
                if !artist.trim().is_empty() {
                    cmd.args(["--parse-metadata", &format!("{}:%(meta_artist)s", artist.trim())]);
                }
            }
            if let Some(ref album) = meta.album {
                if !album.trim().is_empty() {
                    cmd.args(["--parse-metadata", &format!("{}:%(meta_album)s", album.trim())]);
                }
            }
            if let Some(ref year) = meta.year {
                if !year.trim().is_empty() {
                    cmd.args(["--parse-metadata", &format!("{}:%(meta_date)s", year.trim())]);
                }
            }
            if let Some(ref genre) = meta.genre {
                if !genre.trim().is_empty() {
                    cmd.args(["--parse-metadata", &format!("{}:%(meta_genre)s", genre.trim())]);
                }
            }
            if let Some(ref track) = meta.track {
                if !track.trim().is_empty() {
                    cmd.args(["--parse-metadata", &format!("{}:%(meta_track)s", track.trim())]);
                }
            }
        }

        // Auto-detect cookies.txt in application root
        let cookies_path = get_cookies_path();
        if cookies_path.is_file() {
            cmd.arg("--cookies");
            cmd.arg(cookies_path.to_string_lossy().as_ref());
        }

        if let Some(ref ua) = task.user_agent {
            let trimmed = ua.trim();
            if !trimmed.is_empty() {
                cmd.args(["--user-agent", trimmed]);
            }
        }

        let mut extractor_parts = Vec::new();
        if let Some(ref client) = task.player_client {
            if client != "default" && !client.is_empty() {
                extractor_parts.push(format!("player_client={}", client));
            }
        }
        if !extractor_parts.is_empty() {
            cmd.args(["--extractor-args", &format!("youtube:{}", extractor_parts.join(";"))]);
        }

        if let Some(ref rate) = task.limit_rate {
            let r = rate.trim();
            if !r.is_empty() && r != "0" && !r.eq_ignore_ascii_case("unlimited") {
                cmd.args(["--limit-rate", r]);
            }
        }

        if task.use_aria2 == Some(true) {
            let aria2_path = get_aria2_path();
            let aria2_exists = aria2_path.is_file() || {
                #[cfg(windows)]
                {
                    let mut sh = std::process::Command::new("cmd.exe");
                    sh.args(["/c", "aria2c", "--version"]);
                    sh.stdout(Stdio::null());
                    sh.stderr(Stdio::null());
                    sh.status().map(|s| s.success()).unwrap_or(false)
                }
                #[cfg(not(windows))]
                {
                    let mut sh = std::process::Command::new("aria2c");
                    sh.arg("--version");
                    sh.stdout(Stdio::null());
                    sh.stderr(Stdio::null());
                    sh.status().map(|s| s.success()).unwrap_or(false)
                }
            };

            if aria2_exists {
                let conn = task.aria2_connections.unwrap_or(16).clamp(1, 16);
                cmd.args(["--downloader", "aria2c"]);
                cmd.args(["--downloader", "dash,m3u8:native"]);
                
                let mut aria2_args = format!("aria2c:-c -j {} -x {} -s {} -k 1M --file-allocation=none --summary-interval=1", conn, conn, conn);
                if let Some(ref rate) = task.limit_rate {
                    let r = rate.trim();
                    if !r.is_empty() && r != "0" && !r.eq_ignore_ascii_case("unlimited") {
                        aria2_args.push_str(&format!(" --max-download-limit={}", r));
                    }
                }
                cmd.args(["--downloader-args", &aria2_args]);

                let mut tasks = tasks_arc.lock().await;
                if let Some(t) = tasks.iter_mut().find(|t| t.id == task.id) {
                    t.logs.push(format!("[aria2 Multi-Connection] Acceleration active ({} connections/server)", conn));
                }
            } else {
                let mut tasks = tasks_arc.lock().await;
                if let Some(t) = tasks.iter_mut().find(|t| t.id == task.id) {
                    t.logs.push("[aria2 Notice] aria2c executable not detected on system; falling back to yt-dlp native downloader.".to_string());
                }
            }
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
                let _ = fs::remove_dir_all(&staging_dir);
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
            let dl_dir_for_stdout = download_dir.clone();

            tokio::spawn(async move {
                let re_prog = regex::Regex::new(r"(?i)\[download\]\s+([\d\.]+)%\s+of\s+~?\s*([\d\.]+[A-Za-z]+)(?:(?:\s+in\s+[\d:]+)?\s+at\s+([^\s]+(?:/s|\s+B/s)?))?(?:\s+ETA\s+([^\s]+))?").ok();
                let re_100 = regex::Regex::new(r"(?i)\[download\]\s+100(?:\.0)?%\s+of\s+~?\s*([\d\.]+[A-Za-z]+)").ok();
                let re_aria2 = regex::Regex::new(r"\[#[a-f0-9]+\s+([\d\.]+[A-Za-z]+)/([\d\.]+[A-Za-z]+)\((\d+(?:\.\d+)?)%?\)(?:\s+CN:\d+)?(?:\s+DL:([^\s]+))?(?:\s+ETA:([^\s]+))?\]").ok();
                while let Ok(Some(line)) = reader.next_line().await {
                    let mut tasks = tasks_for_stdout.lock().await;
                    if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
                        t.logs.push(line.clone());
                        if t.logs.len() > 400 {
                            t.logs.remove(0);
                        }

                        if let Some(cand) = parse_destination_from_line(&line) {
                            let cand_path = PathBuf::from(&cand);
                            let resolved = if cand_path.is_absolute() {
                                cand_path
                            } else {
                                PathBuf::from(&dl_dir_for_stdout).join(&cand)
                            };
                            let fname = resolved.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                            if !fname.is_empty() {
                                t.file_name = Some(fname);
                                t.file_path = Some(resolved.to_string_lossy().to_string());
                            }
                        }

                        if let Some(ref re) = re_prog {
                            if let Some(caps) = re.captures(&line) {
                                if let Some(p_str) = caps.get(1) {
                                    if let Ok(p) = p_str.as_str().parse::<f64>() {
                                        t.progress = p;
                                    }
                                }
                                if let Some(sz) = caps.get(2) {
                                    let sz_str = sz.as_str();
                                    t.total_size = Some(normalize_size_str(sz_str));
                                    let bytes = parse_size_str_to_bytes(sz_str);
                                    if bytes > 0 {
                                        t.total_bytes = bytes;
                                    }
                                }
                                if let Some(sp) = caps.get(3) {
                                    let sp_str = sp.as_str();
                                    if !sp_str.to_lowercase().contains("unknown") {
                                        t.speed = format_speed_to_mbps(sp_str);
                                    }
                                }
                                if let Some(eta) = caps.get(4) {
                                    let eta_str = eta.as_str();
                                    if !eta_str.to_lowercase().contains("unknown") {
                                        t.eta = eta_str.to_string();
                                    }
                                }
                                t.status = "downloading".to_string();
                            }
                        }
                        if let Some(ref re) = re_aria2 {
                            if let Some(caps) = re.captures(&line) {
                                if let Some(sz) = caps.get(2) {
                                    let sz_str = sz.as_str();
                                    t.total_size = Some(normalize_size_str(sz_str));
                                    let bytes = parse_size_str_to_bytes(sz_str);
                                    if bytes > 0 {
                                        t.total_bytes = bytes;
                                    }
                                }
                                if let Some(p_str) = caps.get(3) {
                                    if let Ok(p) = p_str.as_str().parse::<f64>() {
                                        t.progress = p;
                                    }
                                }
                                if let Some(sp) = caps.get(4) {
                                    let sp_str = sp.as_str();
                                    if !sp_str.to_lowercase().contains("unknown") {
                                        let speed_with_slash = if sp_str.ends_with("/s") {
                                            sp_str.to_string()
                                        } else {
                                            format!("{}/s", sp_str)
                                        };
                                        t.speed = format_speed_to_mbps(&speed_with_slash);
                                    }
                                }
                                if let Some(eta) = caps.get(5) {
                                    let eta_str = eta.as_str();
                                    if !eta_str.to_lowercase().contains("unknown") {
                                        t.eta = eta_str.to_string();
                                    }
                                }
                                t.status = "downloading".to_string();
                            }
                        }
                        if let Some(ref re) = re_100 {
                            if let Some(caps) = re.captures(&line) {
                                t.progress = 100.0;
                                if let Some(sz) = caps.get(1) {
                                    let sz_str = sz.as_str();
                                    t.total_size = Some(normalize_size_str(sz_str));
                                    let bytes = parse_size_str_to_bytes(sz_str);
                                    if bytes > 0 {
                                        t.total_bytes = bytes;
                                    }
                                }
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

                        let dl_path = PathBuf::from(&download_dir);
                        let mut final_path: Option<PathBuf> = None;

                        // Move completed files from staging_dir to download_dir with unique numbering if target exists
                        if let Ok(entries) = fs::read_dir(&staging_dir) {
                            for entry in entries.flatten() {
                                let p = entry.path();
                                if p.is_file() {
                                    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                                    let lower = name.to_lowercase();
                                    if !lower.ends_with(".part") && !lower.ends_with(".ytdl") && !lower.ends_with(".temp") && !lower.ends_with(".aria2") {
                                        let target = dl_path.join(name);
                                        let unique_target = get_unique_file_path(&target);
                                        if unique_target != target {
                                            let final_name = unique_target.file_name().and_then(|n| n.to_str()).unwrap_or("");
                                            t.logs.push(format!("[File Numbering] '{}' already exists in downloads. Saved as '{}' instead.", name, final_name));
                                        }
                                        if fs::rename(&p, &unique_target).is_ok() {
                                            let is_media = lower.ends_with(".mp4") || lower.ends_with(".mkv") || lower.ends_with(".webm")
                                                || lower.ends_with(".opus") || lower.ends_with(".mp3") || lower.ends_with(".m4a")
                                                || lower.ends_with(".flac") || lower.ends_with(".wav");
                                            if final_path.is_none() || is_media {
                                                final_path = Some(unique_target);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        let _ = fs::remove_dir_all(&staging_dir);

                        // Fallback: Check if existing t.file_path is valid on disk
                        if final_path.is_none() {
                            if let Some(ref fp) = t.file_path {
                                let p = PathBuf::from(fp);
                                if p.is_file() {
                                    final_path = Some(p);
                                } else {
                                    let in_dl = dl_path.join(&p);
                                    if in_dl.is_file() {
                                        final_path = Some(in_dl);
                                    }
                                }
                            }
                        }

                        // Fallback 2: Search logs in reverse order for any existing candidate file
                        if final_path.is_none() {
                            for l in t.logs.iter().rev() {
                                if let Some(cand) = parse_destination_from_line(l) {
                                    let p = PathBuf::from(&cand);
                                    if p.is_file() {
                                        final_path = Some(p);
                                        break;
                                    }
                                    let in_dl = dl_path.join(&cand);
                                    if in_dl.is_file() {
                                        final_path = Some(in_dl);
                                        break;
                                    }
                                }
                            }
                        }

                        // Fallback 3: Scan download_dir for the most recently modified media file
                        if final_path.is_none() {
                            if let Ok(entries) = fs::read_dir(&dl_path) {
                                let mut candidates: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
                                for entry in entries.flatten() {
                                    let p = entry.path();
                                    if p.is_file() {
                                        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
                                        if !name.ends_with(".part") && !name.ends_with(".ytdl") && !name.ends_with(".temp") && !name.ends_with(".aria2") {
                                            let mtime = entry.metadata().and_then(|m| m.modified()).unwrap_or(std::time::UNIX_EPOCH);
                                            candidates.push((p, mtime));
                                        }
                                    }
                                }
                                candidates.sort_by(|a, b| b.1.cmp(&a.1));
                                if let Some((best, _)) = candidates.first() {
                                    final_path = Some(best.clone());
                                }
                            }
                        }

                        if let Some(fp) = final_path {
                            let path_str = fp.to_string_lossy().to_string();
                            let name_str = fp.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                            let sz = fs::metadata(&fp).map(|m| m.len()).ok();
                            t.file_path = Some(path_str);
                            t.file_name = Some(name_str);
                            t.file_size = sz;
                            if let Some(bytes) = sz {
                                if bytes > 0 {
                                    t.total_bytes = bytes;
                                    t.total_size = Some(format_bytes_to_human(bytes));
                                }
                            }
                        }
                    }
                    Ok(exit_status) => {
                        let _ = fs::remove_dir_all(&staging_dir);
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
                        let _ = fs::remove_dir_all(&staging_dir);
                        t.status = "error".to_string();
                        t.error = Some(e.to_string());
                        t.full_error = Some(e.to_string());
                        t.logs.push(format!("[Error] {}", e));
                    }
                }
            }
            save_queue_to_disk(&tasks);
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
        task.speed = "0.0 MBps".to_string();
        task.eta = "--:--".to_string();
        task.logs.push("[Cancelled] Download cancelled by user.".to_string());
    }
    save_queue_to_disk(&tasks);

    let dl_dir = {
        let d = state.download_dir.lock().await;
        resolve_download_path(&d)
    };
    let staging = PathBuf::from(dl_dir).join(".staging").join(&id);
    let _ = fs::remove_dir_all(&staging);
    Ok(true)
}

#[tauri::command]
async fn retry_task(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    {
        let mut tasks = state.tasks.lock().await;
        if let Some(task) = tasks.iter_mut().find(|t| t.id == id) {
            task.status = "queued".to_string();
            task.progress = 0.0;
            task.speed = "0.0 MBps".to_string();
            task.eta = "--:--".to_string();
            task.error = None;
            task.full_error = None;
            task.logs.push("[Retried] Re-queued for download.".to_string());
        }
        save_queue_to_disk(&tasks);
    }
    ensure_queue_running(
        Arc::clone(&state.tasks),
        Arc::clone(&state.active_processes),
        Arc::clone(&state.download_dir),
        Arc::clone(&state.is_queue_running),
    ).await;
    Ok(true)
}

#[tauri::command]
async fn retry_all_failed(state: State<'_, AppState>) -> Result<usize, String> {
    let retried = {
        let mut tasks = state.tasks.lock().await;
        let mut count = 0;
        for task in tasks.iter_mut() {
            if task.status == "error" || task.status == "cancelled" {
                task.status = "queued".to_string();
                task.progress = 0.0;
                task.speed = "0.0 MBps".to_string();
                task.eta = "--:--".to_string();
                task.error = None;
                task.full_error = None;
                task.logs.push("[Retried] Re-queued for download.".to_string());
                count += 1;
            }
        }
        if count > 0 {
            save_queue_to_disk(&tasks);
        }
        count
    };
    if retried > 0 {
        ensure_queue_running(
            Arc::clone(&state.tasks),
            Arc::clone(&state.active_processes),
            Arc::clone(&state.download_dir),
            Arc::clone(&state.is_queue_running),
        ).await;
    }
    Ok(retried)
}

#[tauri::command]
async fn resume_queue(state: State<'_, AppState>) -> Result<bool, String> {
    ensure_queue_running(
        Arc::clone(&state.tasks),
        Arc::clone(&state.active_processes),
        Arc::clone(&state.download_dir),
        Arc::clone(&state.is_queue_running),
    ).await;
    Ok(true)
}

#[tauri::command]
async fn clear_completed(state: State<'_, AppState>) -> Result<bool, String> {
    let mut tasks = state.tasks.lock().await;
    tasks.retain(|t| t.status == "downloading" || t.status == "queued" || t.status == "converting" || t.status == "fetching");
    save_queue_to_disk(&tasks);
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
        let clean = dl_path.to_string_lossy().replace('/', "\\");
        let mut cmd = Command::new("explorer");
        cmd.arg(&clean);
        let _ = cmd.spawn();
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
async fn open_url(url: String) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let op = to_wide_null("open");
        let target = to_wide_null(&url);
        let res = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                op.as_ptr(),
                target.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1, // SW_SHOWNORMAL
            )
        };
        if (res as isize) <= 32 {
            let _ = Command::new("explorer").arg(&url).spawn();
        }
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(&url).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open").arg(&url).spawn();
    }
    Ok(true)
}

#[tauri::command]
async fn open_media_file(
    filepath: Option<String>,
    task_id: Option<String>,
    filename: Option<String>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let target = resolve_target_media_file(
        filepath.as_deref(),
        task_id.as_deref(),
        filename.as_deref(),
        &state,
    ).await;

    let p = match target {
        Some(p) if p.is_file() => p,
        _ => return Err("File not found on disk: the file may have been moved, renamed, or deleted.".to_string()),
    };

    let clean = p.to_string_lossy().replace('/', "\\");
    #[cfg(windows)]
    {
        let op = to_wide_null("open");
        let target = to_wide_null(&clean);
        let res = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                op.as_ptr(),
                target.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1, // SW_SHOWNORMAL
            )
        };
        if (res as isize) <= 32 {
            let mut exp = Command::new("explorer.exe");
            exp.arg(&clean);
            let _ = exp.spawn();
        }
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(&clean).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open").arg(&clean).spawn();
    }
    Ok(true)
}

#[tauri::command]
async fn show_item_in_folder(
    filepath: Option<String>,
    task_id: Option<String>,
    filename: Option<String>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let target = resolve_target_media_file(
        filepath.as_deref(),
        task_id.as_deref(),
        filename.as_deref(),
        &state,
    ).await;

    let p = match target {
        Some(p) => p,
        None => {
            let dl = state.download_dir.lock().await;
            PathBuf::from(resolve_download_path(&dl))
        }
    };

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let clean_str = p.to_string_lossy().replace('/', "\\");
        let mut cmd = Command::new("explorer");
        if p.is_file() {
            cmd.raw_arg(format!("/select,\"{}\"", clean_str));
        } else {
            let folder = if p.is_dir() {
                clean_str
            } else {
                p.parent().unwrap_or(&p).to_string_lossy().replace('/', "\\")
            };
            cmd.arg(&folder);
        }
        let _ = cmd.spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let p_str = p.to_string_lossy().to_string();
        if p.is_file() {
            let _ = Command::new("open").args(["-R", &p_str]).spawn();
        } else {
            let _ = Command::new("open").arg(&p_str).spawn();
        }
    }
    #[cfg(target_os = "linux")]
    {
        let folder = if p.is_dir() { p } else { p.parent().unwrap_or(&p).to_path_buf() };
        let _ = Command::new("xdg-open").arg(folder.to_string_lossy().as_ref()).spawn();
    }
    Ok(true)
}

#[tauri::command]
async fn set_system_wakelock(enable: bool) -> Result<bool, String> {
    #[cfg(windows)]
    unsafe {
        if enable {
            SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED);
        } else {
            SetThreadExecutionState(ES_CONTINUOUS);
        }
    }
    Ok(true)
}

#[tauri::command]
async fn execute_power_action(action: String) -> Result<bool, String> {
    let act = action.to_lowercase();
    match act.as_str() {
        "sleep" => {
            #[cfg(windows)]
            {
                unsafe {
                    SetSuspendState(0, 0, 0);
                }
            }
            #[cfg(target_os = "linux")]
            {
                let _ = Command::new("systemctl").arg("suspend").output().await;
            }
            #[cfg(target_os = "macos")]
            {
                let _ = Command::new("pmset").args(["sleepnow"]).output().await;
            }
            Ok(true)
        }
        "hibernate" => {
            #[cfg(windows)]
            {
                unsafe {
                    SetSuspendState(1, 0, 0);
                }
            }
            #[cfg(target_os = "linux")]
            {
                let _ = Command::new("systemctl").arg("hibernate").output().await;
            }
            Ok(true)
        }
        "shutdown" => {
            #[cfg(windows)]
            {
                enable_shutdown_privilege();
                const SHTDN_REASON_MAJOR_APPLICATION: u32 = 0x00040000;
                const SHTDN_REASON_FLAG_PLANNED: u32 = 0x40000000;
                let msg = to_wide_null("yt-dlp client completed download queue");
                let res = unsafe {
                    InitiateSystemShutdownExW(
                        std::ptr::null(),
                        msg.as_ptr(),
                        0,
                        1,
                        0,
                        SHTDN_REASON_MAJOR_APPLICATION | SHTDN_REASON_FLAG_PLANNED,
                    )
                };
                if res == 0 {
                    let _ = Command::new("shutdown.exe").args(["/s", "/t", "0"]).output().await;
                }
            }
            #[cfg(target_os = "linux")]
            {
                let _ = Command::new("shutdown").args(["-h", "now"]).output().await;
            }
            #[cfg(target_os = "macos")]
            {
                let _ = Command::new("osascript").args(["-e", "tell app \"System Events\" to shut down"]).output().await;
            }
            Ok(true)
        }
        "close_app" => {
            std::process::exit(0);
        }
        "none" => Ok(true),
        _ => Err(format!("Unknown power action: {}", action)),
    }
}

#[tauri::command]
async fn abort_power_action() -> Result<bool, String> {
    #[cfg(windows)]
    {
        unsafe {
            AbortSystemShutdownW(std::ptr::null());
        }
        let _ = Command::new("shutdown.exe").args(["/a"]).output().await;
    }
    Ok(true)
}

#[tauri::command]
async fn save_cookies_file(content: String) -> Result<usize, String> {
    let cookie_file = get_cookies_path();
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
    let cookie_file = get_cookies_path();
    if cookie_file.exists() {
        let _ = fs::remove_file(cookie_file);
    }
    Ok(true)
}

async fn resolve_target_media_file(
    filepath: Option<&str>,
    task_id: Option<&str>,
    filename: Option<&str>,
    state: &State<'_, AppState>,
) -> Option<PathBuf> {
    let dl_dir = {
        let g = state.download_dir.lock().await;
        resolve_download_path(&g)
    };
    let dl_path = PathBuf::from(&dl_dir);

    // 1. Direct filepath check
    if let Some(fp) = filepath {
        let mut trimmed = fp.trim().trim_matches('"').trim_matches('\'');
        if let Some(rest) = trimmed.strip_prefix("file:///") {
            trimmed = rest;
        } else if let Some(rest) = trimmed.strip_prefix("file://") {
            trimmed = rest;
        }
        if let Some(rest) = trimmed.strip_prefix("/api/files/") {
            trimmed = rest;
        }
        #[cfg(windows)]
        if trimmed.starts_with('/') && trimmed.len() >= 3 && trimmed.as_bytes()[2] == b':' {
            trimmed = &trimmed[1..];
        }
        let decoded = trimmed.replace("%20", " ");
        let candidates = [trimmed, &decoded];
        for cand in candidates {
            if !cand.is_empty() {
                let direct = PathBuf::from(cand);
                if direct.is_file() {
                    return Some(direct);
                }
                let resolved_direct = PathBuf::from(resolve_download_path(cand));
                if resolved_direct.is_file() {
                    return Some(resolved_direct);
                }
                let in_dl = dl_path.join(cand);
                if in_dl.is_file() {
                    return Some(in_dl);
                }
                if let Some(fname) = direct.file_name() {
                    let in_dl_name = dl_path.join(fname);
                    if in_dl_name.is_file() {
                        return Some(in_dl_name);
                    }
                }
            }
        }
    }

    // 2. Lookup via task_id in state.tasks
    if let Some(tid) = task_id {
        let tasks = state.tasks.lock().await;
        if let Some(t) = tasks.iter().find(|t| t.id == tid) {
            if let Some(ref fp) = t.file_path {
                let clean_fp = fp.trim().trim_matches('"').trim_matches('\'');
                let p = PathBuf::from(clean_fp);
                if p.is_file() {
                    return Some(p);
                }
                let in_dl = dl_path.join(p.file_name().unwrap_or_default());
                if in_dl.is_file() {
                    return Some(in_dl);
                }
            }
            if let Some(ref fn_name) = t.file_name {
                let clean_fn = fn_name.trim().trim_matches('"').trim_matches('\'');
                let in_dl = dl_path.join(clean_fn);
                if in_dl.is_file() {
                    return Some(in_dl);
                }
            }
            for line in t.logs.iter().rev() {
                if let Some(cand_str) = parse_destination_from_line(line) {
                    let clean_cand = cand_str.trim().trim_matches('"').trim_matches('\'');
                    let p = PathBuf::from(clean_cand);
                    if p.is_file() {
                        return Some(p);
                    }
                    let in_dl = dl_path.join(clean_cand);
                    if in_dl.is_file() {
                        return Some(in_dl);
                    }
                }
            }
        }
    }

    // 3. Direct filename check in download_dir
    if let Some(fname) = filename {
        let trimmed = fname.trim().trim_matches('"').trim_matches('\'');
        if !trimmed.is_empty() {
            let in_dl = dl_path.join(trimmed);
            if in_dl.is_file() {
                return Some(in_dl);
            }
            let direct = PathBuf::from(trimmed);
            if direct.is_file() {
                return Some(direct);
            }
        }
    }

    // If file was deleted or moved, strictly return None rather than opening a different file
    None
}

#[tauri::command]
async fn inspect_media_file(
    filepath: Option<String>,
    task_id: Option<String>,
    filename: Option<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let resolved_opt = resolve_target_media_file(
        filepath.as_deref(),
        task_id.as_deref(),
        filename.as_deref(),
        &state,
    ).await;

    let p = match resolved_opt {
        Some(p) => p,
        None => {
            let fallback_name = filename
                .or_else(|| filepath.clone())
                .unwrap_or_else(|| "Unknown".to_string());
            return Ok(serde_json::json!({
                "filename": fallback_name,
                "filepath": filepath.unwrap_or_default(),
                "sizeBytes": 0,
                "sizeFormatted": "0 B",
                "formatName": "unknown",
                "formatLongName": "File not found",
                "durationSeconds": 0,
                "durationFormatted": "00:00",
                "bitRateKbps": 0,
                "hasCoverArt": false,
                "tags": {},
                "chapterCount": 0,
                "isValid": false,
                "error": "Media file not found on disk"
            }));
        }
    };

    let resolved = p.to_string_lossy().to_string();
    let file_size = fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
    let ffprobe_path = get_ffprobe_path();

    let mut cmd = create_hidden_command(&ffprobe_path);
    cmd.args([
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        "-show_chapters",
    ]);
    cmd.arg(&resolved);

    let output = cmd.output().await;
    let stdout = match output {
        Ok(out) if out.status.success() => {
            String::from_utf8_lossy(&out.stdout).to_string()
        }
        _ => {
            #[cfg(windows)]
            {
                let mut sh = create_hidden_command("cmd.exe");
                sh.args(["/c", "ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", "-show_chapters"]);
                sh.arg(&resolved);
                if let Ok(out) = sh.output().await {
                    String::from_utf8_lossy(&out.stdout).to_string()
                } else {
                    String::new()
                }
            }
            #[cfg(not(windows))]
            {
                String::new()
            }
        }
    };

    if stdout.trim().is_empty() {
        return Ok(serde_json::json!({
            "filename": p.file_name().and_then(|n| n.to_str()).unwrap_or("Unknown"),
            "filepath": resolved,
            "sizeBytes": file_size,
            "sizeFormatted": format!("{:.2} MB", (file_size as f64) / (1024.0 * 1024.0)),
            "formatName": "unknown",
            "formatLongName": "Inspection failed",
            "durationSeconds": 0,
            "durationFormatted": "00:00",
            "bitRateKbps": 0,
            "hasCoverArt": false,
            "tags": {},
            "chapterCount": 0,
            "isValid": false,
            "error": "ffprobe was unable to analyze this media stream"
        }));
    }

    let parsed: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse ffprobe json: {}", e))?;

    let streams = parsed.get("streams").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let format = parsed.get("format").and_then(|v| v.as_object()).cloned().unwrap_or_default();
    let chapters = parsed.get("chapters").and_then(|v| v.as_array()).cloned().unwrap_or_default();

    let video_stream = streams.iter().find(|s| {
        s.get("codec_type").and_then(|v| v.as_str()) == Some("video")
            && s.get("disposition").and_then(|d| d.get("attached_pic")).and_then(|v| v.as_i64()) != Some(1)
    });

    let cover_art_stream = streams.iter().find(|s| {
        s.get("disposition").and_then(|d| d.get("attached_pic")).and_then(|v| v.as_i64()) == Some(1)
    });

    let audio_stream = streams.iter().find(|s| {
        s.get("codec_type").and_then(|v| v.as_str()) == Some("audio")
    });

    let format_name = format.get("format_name").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let format_long_name = format.get("format_long_name").and_then(|v| v.as_str()).unwrap_or(&format_name).to_string();

    let duration_sec: u64 = format.get("duration")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .map(|f| f.round() as u64)
        .unwrap_or(0);

    let mins = duration_sec / 60;
    let secs = duration_sec % 60;
    let hours = mins / 60;
    let duration_formatted = if hours > 0 {
        format!("{}:{:02}:{:02}", hours, mins % 60, secs)
    } else {
        format!("{}:{:02}", mins, secs)
    };

    let bit_rate_kbps = format.get("bit_rate")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .map(|b| (b / 1000.0).round() as u64)
        .unwrap_or(0);

    let size_bytes = format.get("size")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(file_size);
    let size_formatted = format!("{:.2} MB", (size_bytes as f64) / (1024.0 * 1024.0));

    let video_obj = video_stream.map(|v| {
        let codec = v.get("codec_name").and_then(|s| s.as_str()).unwrap_or("unknown");
        let codec_long = v.get("codec_long_name").and_then(|s| s.as_str()).unwrap_or(codec);
        let width = v.get("width").and_then(|n| n.as_u64()).unwrap_or(0);
        let height = v.get("height").and_then(|n| n.as_u64()).unwrap_or(0);
        let aspect = v.get("display_aspect_ratio").and_then(|s| s.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("{}:{}", width, height));
        let pix_fmt = v.get("pix_fmt").and_then(|s| s.as_str()).unwrap_or("");
        let mut fps = 0.0;
        if let Some(r_fps) = v.get("r_frame_rate").and_then(|s| s.as_str()) {
            let parts: Vec<&str> = r_fps.split('/').collect();
            if parts.len() == 2 {
                if let (Ok(num), Ok(den)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                    if den > 0.0 {
                        fps = (num / den * 100.0).round() / 100.0;
                    }
                }
            } else if let Ok(val) = r_fps.parse::<f64>() {
                fps = val;
            }
        }
        let bit_rate = v.get("bit_rate")
            .and_then(|s| s.as_str())
            .and_then(|s| s.parse::<f64>().ok())
            .map(|b| (b / 1000.0).round() as u64);

        serde_json::json!({
            "codec": codec,
            "codecLong": codec_long,
            "width": width,
            "height": height,
            "resolution": format!("{}x{}", width, height),
            "aspectRatio": aspect,
            "fps": fps,
            "pixelFormat": pix_fmt,
            "bitRateKbps": bit_rate
        })
    });

    let audio_obj = audio_stream.map(|a| {
        let codec = a.get("codec_name").and_then(|s| s.as_str()).unwrap_or("unknown");
        let codec_long = a.get("codec_long_name").and_then(|s| s.as_str()).unwrap_or(codec);
        let sample_rate = a.get("sample_rate")
            .and_then(|s| s.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let channels = a.get("channels").and_then(|n| n.as_u64()).unwrap_or(0);
        let channel_layout = a.get("channel_layout").and_then(|s| s.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("{} ch", channels));
        let bit_rate = a.get("bit_rate")
            .and_then(|s| s.as_str())
            .and_then(|s| s.parse::<f64>().ok())
            .map(|b| (b / 1000.0).round() as u64);

        serde_json::json!({
            "codec": codec,
            "codecLong": codec_long,
            "sampleRate": sample_rate,
            "channels": channels,
            "channelLayout": channel_layout,
            "bitRateKbps": bit_rate
        })
    });

    let tags = format.get("tags").cloned().unwrap_or_else(|| serde_json::json!({}));
    let has_cover = cover_art_stream.is_some();

    Ok(serde_json::json!({
        "filename": p.file_name().and_then(|n| n.to_str()).unwrap_or("Unknown"),
        "filepath": resolved,
        "sizeBytes": size_bytes,
        "sizeFormatted": size_formatted,
        "formatName": format_name,
        "formatLongName": format_long_name,
        "durationSeconds": duration_sec,
        "durationFormatted": duration_formatted,
        "bitRateKbps": bit_rate_kbps,
        "video": video_obj,
        "audio": audio_obj,
        "hasCoverArt": has_cover,
        "tags": tags,
        "chapterCount": chapters.len(),
        "isValid": !streams.is_empty(),
        "rawStreams": streams,
        "rawFormat": format
    }))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedFileInfo {
    pub name: String,
    pub size: String,
    pub size_bytes: u64,
    pub mtime: String,
    pub r#type: String,
    pub download_url: String,
    pub filepath: String,
}

#[tauri::command]
async fn get_downloaded_files(state: State<'_, AppState>) -> Result<Vec<DownloadedFileInfo>, String> {
    let dl_dir = {
        let dl = state.download_dir.lock().await;
        resolve_download_path(&dl)
    };
    let dir_path = Path::new(&dl_dir);
    if !dir_path.is_dir() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".part") || name.ends_with(".ytdl") || name.starts_with('.') {
                    continue;
                }
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                let is_audio = ["mp3", "m4a", "flac", "opus", "wav", "ogg", "aac", "wma", "aiff"].contains(&ext.as_str());
                let is_video = ["mp4", "mkv", "webm", "avi", "mov", "flv", "wmv", "m4v", "ts", "3gp"].contains(&ext.as_str());
                let file_type = if is_audio { "audio" } else if is_video { "video" } else { "other" };

                let (size_bytes, mtime_str) = if let Ok(meta) = entry.metadata() {
                    let sz = meta.len();
                    let mt = meta.modified().ok()
                        .and_then(|t| {
                            let duration = t.duration_since(std::time::UNIX_EPOCH).ok()?;
                            Some(format!("{}", duration.as_secs() * 1000))
                        })
                        .unwrap_or_else(|| "0".to_string());
                    (sz, mt)
                } else {
                    (0, "0".to_string())
                };

                let size_formatted = format!("{:.2} MB", (size_bytes as f64) / (1024.0 * 1024.0));
                let full_path_str = path.to_string_lossy().to_string();

                files.push(DownloadedFileInfo {
                    name: name.clone(),
                    size: size_formatted,
                    size_bytes,
                    mtime: mtime_str,
                    r#type: file_type.to_string(),
                    download_url: full_path_str.clone(),
                    filepath: full_path_str,
                });
            }
        }
    }

    files.sort_by(|a, b| b.mtime.cmp(&a.mtime));
    Ok(files)
}

#[tauri::command]
async fn check_update() -> Result<serde_json::Value, String> {
    let mut current_ver = "2026.08.19".to_string();
    let mut cmd = create_ytdlp_command();
    cmd.arg("--version");
    if let Ok(out) = cmd.output().await {
        if out.status.success() {
            current_ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
        }
    }

    Ok(serde_json::json!({
        "currentVersion": current_ver,
        "latestVersion": current_ver,
        "hasUpdate": false,
        "releaseNotes": "Running latest native yt-dlp release.",
        "releaseUrl": "https://github.com/yt-dlp/yt-dlp/releases"
    }))
}

#[tauri::command]
async fn update_engine() -> Result<serde_json::Value, String> {
    let mut cmd = create_ytdlp_command();
    cmd.arg("-U");
    let out = cmd.output().await;
    match out {
        Ok(o) if o.status.success() => {
            let mut chk = create_ytdlp_command();
            chk.arg("--version");
            let ver = chk.output().await.map(|v| String::from_utf8_lossy(&v.stdout).trim().to_string()).unwrap_or_default();
            Ok(serde_json::json!({ "success": true, "version": ver }))
        }
        _ => {
            Ok(serde_json::json!({ "success": true, "version": "Up to date" }))
        }
    }
}

fn encode_url_query(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push('+'),
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}

fn parse_music_responsive_item_json(r: &serde_json::Value, filter: Option<&str>) -> Option<serde_json::Value> {
    let col0_runs = r.pointer("/flexColumns/0/musicResponsiveListItemFlexColumnRenderer/text/runs")
        .and_then(|v| v.as_array())?;

    let mut title = String::new();
    for run in col0_runs {
        if let Some(t) = run.get("text").and_then(|v| v.as_str()) {
            title.push_str(t);
        }
    }
    let title = title.trim().to_string();
    if title.is_empty() {
        return None;
    }

    let video_id = r.pointer("/playlistItemData/videoId")
        .or_else(|| col0_runs.get(0).and_then(|run| run.pointer("/navigationEndpoint/watchEndpoint/videoId")))
        .or_else(|| r.pointer("/navigationEndpoint/watchEndpoint/videoId"))
        .or_else(|| r.pointer("/overlay/musicItemThumbnailOverlayRenderer/content/musicPlayButtonRenderer/playNavigationEndpoint/watchEndpoint/videoId"))
        .and_then(|v| v.as_str());

    let browse_id = r.pointer("/navigationEndpoint/browseEndpoint/browseId")
        .or_else(|| col0_runs.get(0).and_then(|run| run.pointer("/navigationEndpoint/browseEndpoint/browseId")))
        .and_then(|v| v.as_str());

    let playlist_id = r.pointer("/navigationEndpoint/watchEndpoint/playlistId")
        .and_then(|v| v.as_str());

    let final_id = video_id.or(playlist_id).or(browse_id)?.to_string();

    let mut artists: Vec<String> = Vec::new();
    let mut unclassified: Vec<String> = Vec::new();
    let mut duration: Option<String> = None;
    let mut year: Option<String> = None;
    let mut views: Option<String> = None;
    let mut detected_type: Option<String> = None;
    let mut album: Option<String> = None;

    if let Some(flex_cols) = r.get("flexColumns").and_then(|v| v.as_array()) {
        for col in flex_cols.iter().skip(1) {
            if let Some(runs) = col.pointer("/musicResponsiveListItemFlexColumnRenderer/text/runs").and_then(|v| v.as_array()) {
                for run in runs {
                    let text = run.get("text").and_then(|v| v.as_str()).unwrap_or("").trim();
                    if text.is_empty() || text == "•" || text == "&" || text == "," {
                        continue;
                    }
                    let page_type = run.pointer("/navigationEndpoint/browseEndpoint/browseEndpointContextSupportedConfigs/browseEndpointContextMusicConfig/pageType")
                        .and_then(|v| v.as_str()).unwrap_or("");
                    let item_browse_id = run.pointer("/navigationEndpoint/browseEndpoint/browseId")
                        .and_then(|v| v.as_str()).unwrap_or("");

                    if text.contains(':') && text.chars().all(|c| c.is_ascii_digit() || c == ':') {
                        duration = Some(text.to_string());
                        continue;
                    }

                    if text.len() == 4 && (text.starts_with("19") || text.starts_with("20")) && text.chars().all(|c| c.is_ascii_digit()) {
                        year = Some(text.to_string());
                        continue;
                    }

                    let lower = text.to_lowercase();
                    if lower.contains("play") || lower.contains("view") || lower.contains("audience") || lower.contains("listener") || lower.contains("subscriber") {
                        views = Some(text.to_string());
                        continue;
                    }

                    if ["song", "video", "album", "single", "ep", "playlist", "artist"].contains(&lower.as_str()) {
                        if lower == "song" { detected_type = Some("song".to_string()); }
                        else if lower == "video" { detected_type = Some("video".to_string()); }
                        else if lower == "album" || lower == "single" || lower == "ep" { detected_type = Some("album".to_string()); }
                        else if lower == "playlist" { detected_type = Some("playlist".to_string()); }
                        else if lower == "artist" { detected_type = Some("artist".to_string()); }
                        continue;
                    }

                    if page_type == "MUSIC_PAGE_TYPE_ARTIST" || page_type == "MUSIC_PAGE_TYPE_USER_CHANNEL" || item_browse_id.starts_with("UC") {
                        artists.push(text.to_string());
                        continue;
                    }
                    if page_type == "MUSIC_PAGE_TYPE_ALBUM" || item_browse_id.starts_with("MPRE") {
                        album = Some(text.to_string());
                        continue;
                    }

                    unclassified.push(text.to_string());
                }
            }
        }
    }

    let mut author = String::new();
    if !artists.is_empty() {
        author = artists.join(", ");
        if album.is_none() && !unclassified.is_empty() {
            album = Some(unclassified[0].clone());
        }
    } else if !unclassified.is_empty() {
        author = unclassified[0].clone();
        if album.is_none() && unclassified.len() > 1 {
            album = Some(unclassified[1].clone());
        }
    }

    let item_type = match filter {
        Some("song") => "song",
        Some("video") => "video",
        Some("album") => "album",
        Some("playlist") => "playlist",
        Some("artist") => "artist",
        _ => {
            if let Some(ref dt) = detected_type {
                dt.as_str()
            } else if video_id.is_some() {
                "song"
            } else if final_id.starts_with("UC") {
                "artist"
            } else if final_id.starts_with("VL") || final_id.starts_with("MPRE") || final_id.starts_with("OLAK") {
                "playlist"
            } else {
                "song"
            }
        }
    };

    if item_type == "artist" && (author.is_empty() || author == title) {
        author = "Artist".to_string();
    }
    if author.is_empty() {
        author = "Unknown Artist".to_string();
    }

    let thumbnail = r.pointer("/thumbnail/musicThumbnailRenderer/thumbnail/thumbnails")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.last())
        .and_then(|t| t.get("url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            if let Some(vid) = video_id {
                Some(format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", vid))
            } else {
                None
            }
        });

    let is_album_or_playlist = item_type == "album" || item_type == "playlist" || final_id.starts_with("VL") || final_id.starts_with("MPRE") || final_id.starts_with("OLAK");
    let final_url = if let Some(vid) = video_id {
        format!("https://music.youtube.com/watch?v={}", vid)
    } else if let Some(pid) = playlist_id {
        format!("https://music.youtube.com/playlist?list={}", pid)
    } else if is_album_or_playlist {
        format!("https://music.youtube.com/playlist?list={}", final_id.trim_start_matches("VL"))
    } else {
        format!("https://music.youtube.com/browse/{}", final_id)
    };

    Some(serde_json::json!({
        "id": final_id,
        "url": final_url,
        "title": title,
        "author": author,
        "album": album,
        "year": year,
        "duration": duration,
        "views": views,
        "thumbnail": thumbnail,
        "type": item_type,
        "engine": "ytmusic"
    }))
}

async fn query_innertube_music(
    query: &str,
    filter: Option<&str>,
    user_agent: Option<&str>,
) -> Result<Vec<serde_json::Value>, String> {
    let ua = user_agent.unwrap_or("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36");

    let params = match filter {
        Some("song") => Some("EgWKAQIIAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D"),
        Some("video") => Some("EgWKAQIQAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D"),
        Some("album") => Some("EgWKAQIYAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D"),
        Some("playlist") => Some("EgWKAQIoAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D"),
        Some("artist") => Some("EgWKAQIgAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D"),
        _ => None,
    };

    let mut req_body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20260908.14.00",
                "hl": "en",
                "gl": "US"
            }
        },
        "query": query
    });
    if let Some(p) = params {
        req_body["params"] = serde_json::Value::String(p.to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client build error: {}", e))?;

    let resp = client
        .post("https://www.youtube.com/youtubei/v1/search?prettyPrint=false")
        .header("Content-Type", "application/json")
        .header("User-Agent", ua)
        .json(&req_body)
        .send()
        .await
        .map_err(|e| format!("InnerTube request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("InnerTube request returned status {}", resp.status()));
    }

    let root: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("failed to parse json: {}", e))?;

    let mut results = Vec::new();
    let sec_list = root.pointer("/contents/tabbedSearchResultsRenderer/tabs/0/tabRenderer/content/sectionListRenderer/contents")
        .and_then(|v| v.as_array());

    if let Some(sections) = sec_list {
        for sec in sections {
            let items = sec.pointer("/musicShelfRenderer/contents")
                .or_else(|| sec.pointer("/itemSectionRenderer/contents"))
                .and_then(|v| v.as_array());

            if let Some(it_arr) = items {
                for it in it_arr {
                    if let Some(r) = it.get("musicResponsiveListItemRenderer") {
                        if let Some(parsed) = parse_music_responsive_item_json(r, filter) {
                            results.push(parsed);
                        }
                    }
                }
            }
        }
    }

    if results.is_empty() {
        return Err("No results found in innertube payload".to_string());
    }

    Ok(results)
}

#[tauri::command]
async fn search_media(
    query: String,
    engine: Option<String>,
    filter: Option<String>,
    user_agent: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let clean_query = query.trim().to_string();
    if clean_query.is_empty() {
        return Ok(Vec::new());
    }

    let eng = engine.as_deref().unwrap_or("youtube");

    // For YouTube Music, first attempt fast native InnerTube extraction via native HTTP to retrieve complete
    // track metadata (accurate studio art track artist names, album titles, durations, and high-res art)
    if eng == "ytmusic" {
        if let Ok(ytm_results) = query_innertube_music(&clean_query, filter.as_deref(), user_agent.as_deref()).await {
            if !ytm_results.is_empty() {
                return Ok(ytm_results);
            }
        }
    }

    let mut cmd = create_ytdlp_command();
    cmd.args([
        "--dump-single-json",
        "--flat-playlist",
        "--playlist-items",
        "1-25",
        "--no-warnings",
        "--no-check-certificates",
        "--socket-timeout",
        "15",
    ]);

    if let Some(ua) = user_agent {
        let trimmed_ua = ua.trim();
        if !trimmed_ua.is_empty() {
            cmd.args(["--user-agent", trimmed_ua]);
        }
    }

    if eng == "ytmusic" {
        cmd.args(["--extractor-args", "youtube:player_client=android_music,web"]);
    }

    let search_target = match eng {
        "soundcloud" => format!("scsearch25:{}", clean_query),
        "ytmusic" => {
            let encoded_q = encode_url_query(&clean_query);
            match filter.as_deref() {
                Some("song") => format!(
                    "https://music.youtube.com/search?q={}&sp=EgWKAQIIAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
                    encoded_q
                ),
                Some("video") => format!(
                    "https://music.youtube.com/search?q={}&sp=EgWKAQIQAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
                    encoded_q
                ),
                Some("album") => format!(
                    "https://music.youtube.com/search?q={}&sp=EgWKAQIYAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
                    encoded_q
                ),
                Some("artist") => format!(
                    "https://music.youtube.com/search?q={}&sp=EgWKAQIgAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
                    encoded_q
                ),
                Some("playlist") => format!(
                    "https://music.youtube.com/search?q={}&sp=EgWKAQIoAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
                    encoded_q
                ),
                _ => format!("https://music.youtube.com/search?q={}", encoded_q),
            }
        }
        _ => {
            // YouTube
            match filter.as_deref() {
                Some("playlist") => format!("ytsearch25:{} playlist", clean_query),
                Some("channel") => format!("ytsearch25:{} channel", clean_query),
                _ => format!("ytsearch25:{}", clean_query),
            }
        }
    };

    cmd.arg(&search_target);

    let output = cmd.output().await.map_err(|e| format!("Failed to run yt-dlp search: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err_str = stderr.trim();
        return Err(if err_str.is_empty() {
            format!("yt-dlp search exited with status {:?}", output.status.code())
        } else {
            err_str.to_string()
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let info: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse search metadata from yt-dlp: {}", e))?;

    let entries_raw = info.get("entries")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut results = Vec::new();
    for item in entries_raw {
        let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if id.is_empty() {
            continue;
        }

        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string();

        let raw_url = item.get("url").and_then(|v| v.as_str())
            .or_else(|| item.get("webpage_url").and_then(|v| v.as_str()));

        let format_url_by_id = |id: &str, eng: &str| -> String {
            if eng == "ytmusic" {
                if id.starts_with("UC") {
                    format!("https://music.youtube.com/browse/{}", id)
                } else if id.starts_with("VL") || id.starts_with("MPRE") || id.starts_with("OLAK") || id.starts_with("PL") {
                    format!("https://music.youtube.com/playlist?list={}", id.trim_start_matches("VL"))
                } else {
                    format!("https://music.youtube.com/watch?v={}", id)
                }
            } else if eng == "soundcloud" {
                format!("https://soundcloud.com/{}", id)
            } else {
                format!("https://www.youtube.com/watch?v={}", id)
            }
        };

        let final_url = if let Some(u) = raw_url {
            if u.starts_with("http://") || u.starts_with("https://") {
                u.to_string()
            } else {
                format_url_by_id(&id, eng)
            }
        } else {
            format_url_by_id(&id, eng)
        };

        let mut author = item.get("uploader").and_then(|v| v.as_str())
            .or_else(|| item.get("channel").and_then(|v| v.as_str()))
            .or_else(|| item.get("artist").and_then(|v| v.as_str()))
            .unwrap_or("Unknown Artist")
            .to_string();

        if (author == "Unknown Artist" || author.is_empty()) && title.contains(" - ") {
            if let Some(first_part) = title.split(" - ").next() {
                let p = first_part.trim();
                if !p.is_empty() {
                    author = p.to_string();
                }
            }
        }

        let duration = item.get("duration_string").and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                item.get("duration").and_then(|v| v.as_f64()).map(|d| {
                    let total_secs = d as u64;
                    let mins = total_secs / 60;
                    let secs = total_secs % 60;
                    if mins >= 60 {
                        format!("{}:{:02}:{:02}", mins / 60, mins % 60, secs)
                    } else {
                        format!("{}:{:02}", mins, secs)
                    }
                })
            });

        let thumbnail = item.get("thumbnails")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.last())
            .and_then(|t| t.get("url"))
            .and_then(|v| v.as_str())
            .or_else(|| item.get("thumbnail").and_then(|v| v.as_str()))
            .map(|s| s.to_string())
            .or_else(|| {
                if !id.is_empty() && !id.starts_with("UC") && !id.starts_with("MPRE") && !id.starts_with("VL") && !id.starts_with("PL") {
                    Some(format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id))
                } else {
                    None
                }
            });

        let ie_key = item.get("ie_key").and_then(|v| v.as_str()).unwrap_or("");
        let entry_type = item.get("_type").and_then(|v| v.as_str()).unwrap_or("");

        let item_type = if ie_key == "YoutubeTab" {
            if final_url.contains("/browse/UC") || final_url.contains("/channel/") || final_url.contains("/@") {
                "artist"
            } else if final_url.contains("MPREb_") || final_url.contains("album") {
                "album"
            } else {
                "playlist"
            }
        } else if entry_type == "playlist" {
            "playlist"
        } else if eng == "ytmusic" {
            match filter.as_deref() {
                Some("video") => "video",
                Some("album") => "album",
                Some("artist") => "artist",
                Some("playlist") => "playlist",
                _ => "song",
            }
        } else if eng == "soundcloud" {
            "song"
        } else {
            "video"
        };

        let album_name = item.get("album").and_then(|v| v.as_str())
            .or_else(|| item.get("release_title").and_then(|v| v.as_str()));

        let release_year = item.get("release_year").and_then(|v| v.as_i64())
            .map(|y| y.to_string())
            .or_else(|| {
                item.get("upload_date").and_then(|v| v.as_str()).and_then(|d| {
                    if d.len() >= 4 { Some(d[0..4].to_string()) } else { None }
                })
            });

        results.push(serde_json::json!({
            "id": id,
            "url": final_url,
            "title": title,
            "author": author,
            "album": album_name,
            "duration": duration,
            "thumbnail": thumbnail,
            "type": item_type,
            "engine": eng,
            "year": release_year,
        }));
    }

    Ok(results)
}

fn main() {
    let target_config = get_config_path();

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

    let initial_tasks = load_queue_from_disk();

    let initial_state = AppState {
        tasks: Arc::new(Mutex::new(initial_tasks)),
        active_processes: Arc::new(Mutex::new(HashMap::new())),
        download_dir: Arc::new(Mutex::new(default_dl)),
        cached_versions: Arc::new(Mutex::new(None)),
        is_queue_running: Arc::new(tokio::sync::Mutex::new(false)),
    };

    tauri::Builder::default()
        .manage(initial_state)
        .invoke_handler(tauri::generate_handler![
            get_system_status,
            get_settings,
            save_settings,
            extract_info,
            search_media,
            get_tasks,
            queue_tasks,
            cancel_task,
            retry_task,
            retry_all_failed,
            resume_queue,
            clear_completed,
            get_download_dir,
            set_download_dir,
            reset_download_dir,
            open_download_folder,
            save_cookies_file,
            get_cookies_file,
            clear_cookies_file,
            inspect_media_file,
            get_downloaded_files,
            check_update,
            update_engine,
            open_url,
            open_media_file,
            show_item_in_folder,
            set_system_wakelock,
            execute_power_action,
            abort_power_action,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
