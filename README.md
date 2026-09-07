# yt-dlp Client — Windows Desktop App

[![GitHub Repo](https://img.shields.io/badge/GitHub-chamindudilsh%2Fyt--dlp--client-blue?style=flat-square&logo=github)](https://github.com/chamindudilsh/yt-dlp-client)
[![GitHub Release](https://img.shields.io/github/v/release/chamindudilsh/yt-dlp-client?color=blue&style=flat-square&logo=github)](https://github.com/chamindudilsh/yt-dlp-client/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078d4?style=flat-square&logo=windows)](https://github.com/chamindudilsh/yt-dlp-client)

An ultra-lightweight, high-performance Windows-first native desktop client for **yt-dlp**, **FFmpeg**, and **ffprobe**. Built with **React 19**, **Tailwind CSS**, and **Tauri v2 (Rust)**.

> [!IMPORTANT]
> **Windows-First Native App — No Background Server Needed!**
> 
> This is a **100% self-contained Windows desktop app**. Unlike Web-wrapped tools or Electron apps that demand a background Node.js/Express server, **yt-dlp Client requires NO server running to serve requests**. All media extraction, downloading, process orchestration, and `ffprobe` stream analysis execute natively through Windows APIs and compiled Rust machine code.

---

## ⚡ Recommended Multimedia Toolchain

To unlock the full potential of the application, having the complete trio of tools is strongly recommended:

| Tool | Role in yt-dlp Client |
| :--- | :--- |
| **`yt-dlp`** | Core engine for downloading, URL extraction, format analysis, playlist parsing, and bypassing bot verification. |
| **`ffmpeg`** | High-fidelity stream muxing, audio format conversion (AAC/M4A, MP3, OPUS, FLAC), and 1:1 square album cover art cropping. |
| **`ffprobe`** | Technical stream inspection, video/audio codec validation, true bitrate/sample-rate measurement, metadata verification, and container integrity checks. |

> [!TIP]
> **Installing the FFmpeg Essentials Build is strongly recommended!**
> 
> The official **FFmpeg Essentials Build** (from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/)) packages both `ffmpeg.exe` and `ffprobe.exe` together in a single distribution.
> 
> **Quick Install Options on Windows:**
> - **Windows Package Manager (winget):**
>   ```powershell
>   winget install Gyan.FFmpeg
>   ```
> - **Scoop:**
>   ```powershell
>   scoop install ffmpeg
>   ```
> - **Chocolatey:**
>   ```powershell
>   choco install ffmpeg
>   ```
> - **Manual Download:** Download `ffmpeg-release-essentials.zip` from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/), extract the `bin` folder containing `ffmpeg.exe` and `ffprobe.exe`, and either add it to your system `PATH` or place the binaries alongside the app.
>
> The app automatically detects `yt-dlp`, `ffmpeg`, and `ffprobe` across your executable directory, `./bin/`, WinGet links, Scoop shims, Chocolatey paths, and the system `PATH`.

---

## 🚀 Why Native (Tauri + Rust) vs. Electron?

| Metric | Traditional Electron App | yt-dlp Client (Native Tauri) |
| :--- | :--- | :--- |
| **RAM Footprint** | ~300 MB – 500 MB | **~30 MB – 50 MB** |
| **Executable Size** | ~90 MB – 140 MB | **~10 MB – 15 MB** |
| **Background Server** | Requires a running Node.js process | **None** (Self-contained native Rust machine code) |
| **Browser Engine** | Bundles duplicate Chromium | Uses native Windows **WebView2** (pre-installed in Windows 10/11) |
| **Startup Speed** | 2 – 4 seconds | **Instant (< 300 ms)** |

---

## ✨ Key Features

### 🔍 ffprobe Media Stream Inspector & Integrity Check
- **Deep Technical Analysis**: Inspect any completed download or downloaded library file with a single click.
- **Video Diagnostics**: View exact video codec (`H.264 / AVC`, `VP9`, `AV1`), true resolution (`3840×2160`, `1920×1080`), aspect ratio, framerate (e.g. `60.0 fps`), color profile (pixel format), and video stream bitrate.
- **Audio Diagnostics**: Inspect audio codec (`AAC`, `Opus`, `MP3`, `FLAC`), sample rate (`48.0 kHz`, `44.1 kHz`), channels and layout (`Stereo 2.0`, `5.1 Surround`), and measured bitrate.
- **Embedded Tag & Artwork Verification**: Verify embedded ID3 / Vorbis tags (title, artist, album, date, track, genre) and confirm attached 1:1 square cover art (`attached_pic`).
- **File Integrity Verification**: Confirms valid headers, intact audio/video synchronization, and container health.
- **Raw JSON Stream Export**: Inspect or copy the full `ffprobe` stream structure for advanced diagnostics.

### 📥 High-Fidelity Audio & Video Downloads
- **Resolution & Quality Selectors**: 4K UHD (2160p), 2K QHD (1440p), Full HD (1080p), 720p, 480p, or Best Available.
- **Smart Container Merging**: Prioritizes standard MP4 and M4A containers for universal playback across Windows, macOS, Android, iOS, and smart TVs.
- **Lossless Audio Extraction**: Native AAC extracted directly into `.m4a` without transcoding loss; optional conversion to `.mp3` (320k, 256k, 192k), `.opus`, `.flac`, or `.wav`.
- **1:1 Square Album Art Cropper**: Automatically crops horizontal video thumbnails to square album covers for music players and car infotainment systems, with customizable crop focus (center, left, right).
- **ID3 Tag & Chapter Embedding**: Automatically embeds artist, track title, album name, year, and chapter markers directly into output files.
- **Batch & Playlist Extraction**: Analyze full YouTube playlists with individual track selection and bulk queuing.

### 🛡️ SponsorBlock Segment Skipping
- Automatically remove or chapter-mark sponsored segments, intros, outros, self-promotions, interaction reminders, and preview clips.
- Per-category action controls (`Remove`, `Mark`, or `Off`).
- Custom SponsorBlock API server support with in-app connection testing.

### 💬 Advanced Subtitle Suite
- Multi-language subtitle downloading (`en.*`, `es`, `ja`, `all`).
- Direct subtitle embedding into video containers (`--embed-subs`).
- Support for auto-generated captions and custom subtitle formats (`srt`, `vtt`, `ass`).

### 🤖 YouTube Anti-Bot & Throttling Bypass
- **Web Client PO Token Minting**: Built-in Web Client Proof of Origin token generator to resolve *"Sign in to confirm you're not a bot"* challenges.
- **Direct Browser Cookie Extraction**: Read authenticated cookies directly from installed browsers (`Chrome`, `Edge`, `Firefox`, `Brave`, `Chromium`, `Vivaldi`, `Opera`).
- **Custom `cookies.txt` Support**: Import or edit Netscape cookie files directly in the GUI.
- **Alternative Player Clients**: Switch player persona (e.g. `iOS`, `Android`, `mweb`, `tv`) to bypass datacenter and cloud IP rate limits.

### 📁 Downloaded Files Library & Preview Player
- Built-in library browser for downloaded media.
- In-app preview player for local audio and video playback.
- Instant "Open in Windows File Explorer" shortcut.
- Direct access to inspect media streams with `ffprobe`.

### 💻 Interactive CLI Preview & Error Diagnostics
- **Windows CLI Generator**: View and copy the exact `yt-dlp.exe` command line for any download task.
- **Real-Time Terminal Drawer**: Expandable stdout/stderr logs for every download in the queue.
- **Actionable Error Inspector**: Detailed exit code explanations, specific error causes, and one-click diagnostic report copying.

### ⚙️ Portable & Zero-Bloat Configuration
- Stores application configuration in `config.json` in the application root directory.
- Download directory defaults to Windows `%USERPROFILE%\Downloads`, fully customizable with in-app path picker and quick-reset.
- Zero registry modifications and zero background telemetry.

---

## 📥 Download Pre-Built Releases (Recommended)

Dedicated, ready-to-run Windows releases are published under **[GitHub Releases](https://github.com/chamindudilsh/yt-dlp-client/releases)** for Windows 10 and 11. No compilers, build tools, or manual setup required!

| Package | Description | Recommended For |
| :--- | :--- | :--- |
| **Setup Installer (`.exe` / `.msi`)** | Standard Windows installer with Start Menu and Desktop shortcuts. | Most desktop users |
| **Portable Archive (`.zip`)** | Zero-install standalone archive. Extract anywhere and launch `yt-dlp-client.exe`. | Portable & USB setups |

👉 **[Download the Latest Release from GitHub Releases](https://github.com/chamindudilsh/yt-dlp-client/releases)**

---

## 🛠️ Building from Source on Windows (Developers)

#### Prerequisites:
1. **Node.js** (v18 or higher): [nodejs.org](https://nodejs.org)
2. **Rust & C++ Build Tools**:
   - Install **Rust** via [rustup.rs](https://rustup.rs).
   - In the Visual Studio Installer, ensure **Desktop development with C++** is checked.
3. **Multimedia Binaries (`yt-dlp`, `ffmpeg`, `ffprobe`)**:
   - Install the **FFmpeg essentials build** via `winget install Gyan.FFmpeg` (or place `yt-dlp.exe`, `ffmpeg.exe`, and `ffprobe.exe` into `src-tauri/bin/` or system `PATH`).

#### Step-by-Step Build Commands:

```cmd
# 1. Clone the repository and navigate into the folder
git clone https://github.com/chamindudilsh/yt-dlp-client.git
cd yt-dlp-client

# 2. Install dependencies
npm install

# 3. Run in native desktop development mode (with hot reload)
npm run tauri:dev

# 4. Compile the production native Windows executable
npm run tauri:build
```

The compiled standalone executable and installer will be located in:
```
src-tauri/target/release/yt-dlp-client.exe
src-tauri/target/release/bundle/nsis/yt-dlp-client_1.0.0_x64-setup.exe
```

---

## 🌐 Running in Web / Server Mode

If you prefer running this as a local web service (e.g. on a home media server, NAS, or inside a Docker container):

```bash
# Install dependencies
npm install

# Start local server and web UI on http://localhost:3000
npm run dev

# Build for production
npm run build
npm start
```

---

## 📁 Project Architecture

```
yt-dlp-client/
├── config.json                  # Application settings (naming, formats, sponsorblock, etc.)
├── cookies.txt                  # Optional authenticated session cookies
├── downloads/                   # Fallback download folder
├── public/                      # Static assets, icons, and metadata
├── src/                         # React 19 Frontend
│   ├── components/
│   │   ├── AlbumArtCropperModal.tsx  # 1:1 Aspect ratio thumbnail crop modal
│   │   ├── BatchDownloader.tsx       # Main link analysis and format selector
│   │   ├── CliCommandModal.tsx       # Exact yt-dlp.exe CLI command generator
│   │   ├── DownloadQueueManager.tsx  # Queue monitor, real-time logs, and inspect button
│   │   ├── MediaInspectorModal.tsx   # ffprobe stream analyzer & integrity inspector
│   │   ├── PortablePrivacyModal.tsx  # Privacy and portable mode modal
│   │   ├── SavedFilesLibrary.tsx     # Downloaded media library with preview player
│   │   ├── SettingsModal.tsx         # Full toolchain status, SponsorBlock, storage, auth
│   │   ├── StatusBar.tsx             # Bottom status bar (speed, queue count, folder link)
│   │   ├── TitleBar.tsx              # Windows 11 title bar with window controls
│   │   └── UpdateModal.tsx           # In-app yt-dlp engine updater
│   ├── lib/
│   │   └── apiBridge.ts              # Unified bridge for Tauri Rust and Express backends
│   ├── types.ts                      # TypeScript definitions (MediaProbeInfo, TaskOptions, etc.)
│   ├── App.tsx                       # Main application layout and navigation
│   └── main.tsx                      # React root entry point
├── src-tauri/                   # Native Rust Backend (Tauri v2)
│   ├── Cargo.toml               # Rust dependencies (serde, tokio, regex, tauri)
│   ├── tauri.conf.json          # Windows windowing, capabilities, and bundle configuration
│   └── src/
│       └── main.rs              # Rust commands (inspect_media_file, queue_tasks, etc.)
├── server.ts                    # Express backend for web/server mode with ffprobe inspector
├── package.json                 # Project scripts and dependencies
└── tsconfig.json                # TypeScript compiler configuration
```

---

## 🙏 Credits & Acknowledgements

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**: Powered by the exceptional command-line audio and video download tool. Sincere credit and gratitude to the yt-dlp maintainers and open-source contributors for their tireless development.
- **[FFmpeg](https://ffmpeg.org/) & [ffprobe](https://ffmpeg.org/ffprobe.html)**: The industry-standard multimedia framework utilized for post-processing, audio extraction, square album art cropping, and media stream inspection.
- **[gyan.dev](https://www.gyan.dev/ffmpeg/builds/)**: Sincere credit for providing reliable, high-quality Windows builds of the FFmpeg essentials suite.
- **Inspired by [YTDLnis](https://github.com/deniscerri/ytdlnis)**: Heartfelt inspiration and appreciation to **YTDLnis** (by Denis Cerri), whose outstanding open-source interface, feature-rich customization, and streamlined downloading workflows served as a key inspiration for this project.

---

## 📄 License
MIT License. Open source and free to customize.
