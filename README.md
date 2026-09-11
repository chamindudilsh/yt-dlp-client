# yt-dlp Client — Windows Desktop App

[![GitHub Repo](https://img.shields.io/badge/GitHub-chamindudilsh%2Fyt--dlp--client-blue?style=flat-square&logo=github)](https://github.com/chamindudilsh/yt-dlp-client)
[![GitHub Release](https://img.shields.io/github/v/release/chamindudilsh/yt-dlp-client?color=blue&style=flat-square&logo=github)](https://github.com/chamindudilsh/yt-dlp-client/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078d4?style=flat-square&logo=windows)](https://github.com/chamindudilsh/yt-dlp-client)

An ultra-lightweight, high-performance Windows-first native desktop client for **yt-dlp**, **FFmpeg**, and **ffprobe**. Built with **React 19**, **Tailwind CSS**, and **Tauri v2 (Rust)**.

---

## ⚡ Prerequisites & Toolchain

The client automatically detects `yt-dlp`, `ffmpeg`, and `ffprobe` in the application directory, `./bin/`, WinGet locations, or system `PATH`.

| Tool | Role |
| :--- | :--- |
| **`yt-dlp`** | Downloading, format extraction, playlist parsing, and bot verification bypass. |
| **`ffmpeg`** | Stream muxing, audio format conversion (AAC, MP3, OPUS, FLAC), and album art embedding. |
| **`ffprobe`** | Technical stream inspection, codec validation, and integrity checks. |

> [!NOTE]
> **Standalone Binary (`yt-dlp.exe`) vs. Python Script Environments:**
> 
> * **Windows Standalone (`yt-dlp.exe`)**: Bundles its own self-contained Python runtime and core libraries—including **`mutagen`**, `pycryptodomex`, and `brotli`. **No Python installation is required.**
> * **Python / Non-`.exe` Environments**: If running the extensionless `yt-dlp` script via system Python (`python yt-dlp`), ensure Python 3.8+ and **`mutagen`** are installed (required for embedding cover art and tags into Opus/Ogg audio):
>   ```bash
>   python3 -m pip install mutagen pycryptodomex
>   ```

To install FFmpeg (with `ffprobe`) on Windows:
```powershell
winget install Gyan.FFmpeg
```
*(Or download the essentials build from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/))*

---

## 🚀 Why Native (Tauri + Rust) vs. Electron?

| Metric | Traditional Electron App | yt-dlp Client (Native Tauri) |
| :--- | :--- | :--- |
| **RAM Footprint** | ~300 MB – 500 MB | **~30 MB – 50 MB** |
| **Executable Size** | ~90 MB – 140 MB | **~10 MB – 15 MB** |
| **Background Server** | Requires running Node.js process | **None** (Native compiled Rust) |
| **Browser Engine** | Bundles duplicate Chromium | Native Windows **WebView2** |
| **Startup Speed** | 2 – 4 seconds | **Instant (< 300 ms)** |

---

## ✨ Key Features

### 🔎 Multi-Platform Media Search
- Search across **YouTube**, **YouTube Music**, and **SoundCloud** directly in-app.
- **Smart Media Type Defaults**: Searching YouTube Music or SoundCloud automatically defaults to **Audio** (with 1:1 artwork cropping and ID3 tags enabled); YouTube defaults to **Video**.
- Powered by InnerTube protocol scraping and SoundCloud public endpoints (zero API keys required).
- One-click queuing and format inspection for search results.

### 🔍 ffprobe Media Stream Inspector
- **Stream Diagnostics**: Inspect exact video codecs (`H.264`, `VP9`, `AV1`), resolution, framerate, audio codecs (`AAC`, `Opus`, `FLAC`), sample rates, and bitrates.
- **Tag & Artwork Verification**: Inspect embedded ID3 / Vorbis tags and verify attached album artwork.
- **Stream JSON Export**: Export the full `ffprobe` stream metadata for advanced diagnostics.

### 📥 High-Fidelity Audio & Video Downloads
- **Quality & Resolution Selection**: 4K UHD (2160p), 1440p, 1080p, 720p, 480p, or Best Available.
- **Lossless Remuxing**: Prioritizes standard MP4 and M4A containers for universal playback.
- **Audio Extraction**: Direct AAC extraction to `.m4a` without transcoding; optional conversion to `.mp3`, `.opus`, `.flac`, or `.wav`.
- **1:1 Square Album Art Cropper**: Automatically crops horizontal thumbnails to square album covers with adjustable focal point (center, left, right).
- **Metadata Embedding**: Embeds artist, track title, album, year, and chapter markers.
- **Playlist & Batch Queuing**: Extract and selectively queue tracks from full playlists.

### 🌐 Network & User-Agent Controls
- **Custom User-Agent**: Configure custom HTTP headers across searches, metadata queries, and yt-dlp processes.
- **Browser Presets**: Quick-select Chrome, Edge, Firefox, or Safari desktop profiles.

### 🛡️ SponsorBlock Integration
- Automatically skip or chapter-mark sponsored segments, intros, outros, and interaction reminders.
- Configurable actions (`Remove`, `Mark`, `Off`) per category with custom API server support.

### 💬 Subtitle Support
- Multi-language subtitle downloads with direct container embedding (`--embed-subs`).
- Supports auto-generated captions and multiple formats (`srt`, `vtt`, `ass`).

### 🤖 Anti-Bot & Throttling Bypass
- **Web Client PO Token Minting**: Built-in Proof of Origin token generator to resolve *"Sign in to confirm you're not a bot"* challenges.
- **Browser Cookie Extraction**: Read session cookies directly from installed browsers (`Chrome`, `Edge`, `Firefox`, `Brave`, `Vivaldi`, `Opera`).
- **Custom `cookies.txt`**: Import or edit Netscape cookie files.
- **Player Client Personas**: Switch to `iOS`, `Android`, `mweb`, or `tv` client personas to bypass datacenter IP restrictions.

### 📁 Media Library & Preview Player
- Built-in library to preview completed audio and video downloads.
- Direct access to inspect media streams with `ffprobe`.

### 💻 CLI Preview & Diagnostics
- **Command Generator**: View and copy the exact `yt-dlp.exe` command generated for any task.
- **Process Drawer**: Real-time terminal output and exit code explanations for troubleshooting.

---

## 📥 Download Pre-Built Releases

Windows 10 & 11 releases are available on **[GitHub Releases](https://github.com/chamindudilsh/yt-dlp-client/releases)**:
- **Standalone Executable (`.exe`)**: Single-file executable ready to run directly.
- **Setup Installer (`.exe` / `.msi`)**: Standard Windows installer with clean uninstallation.
- **Full Portable Bundle (`.zip`)**: Zero-config archive with `yt-dlp.exe` and `ffmpeg.exe` included.
- **Integrity & Signatures**: All releases include `SHA256SUMS.txt` cryptographic hashes and digital code signatures with RFC 3161 timestamping.

---

## 🛠️ Building from Source on Windows

#### Prerequisites:
1. **Node.js** (v18 or higher): [nodejs.org](https://nodejs.org)
2. **Rust & C++ Build Tools**:
   - Install **Rust** via [rustup.rs](https://rustup.rs).
   - In Visual Studio Installer, ensure **Desktop development with C++** is checked.
3. **Multimedia Binaries (`yt-dlp`, `ffmpeg`, `ffprobe`)**:
   - Install via `winget install Gyan.FFmpeg` or place binaries in `src-tauri/bin/` or `PATH`.

#### Build Commands:

```cmd
# 1. Clone the repository
git clone https://github.com/chamindudilsh/yt-dlp-client.git
cd yt-dlp-client

# 2. Install dependencies
npm install

# 3. Run desktop app in development mode
npm run tauri:dev

# 4. Compile production executable and installer
npm run tauri:build
```

Compiled binaries will be generated in:
```
src-tauri/target/release/yt-dlp-client.exe
src-tauri/target/release/bundle/nsis/yt-dlp-client_1.0.0_x64-setup.exe
```

---

## 🌐 Running in Web / Server Mode

To run as a local web service (e.g., home media server or NAS):

```bash
npm install
npm run dev        # Development server on http://localhost:3000
npm run build      # Production build
npm start          # Production server
```

---

## 🙏 Credits & Acknowledgements

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**: Powered by the command-line audio and video download tool. Sincere credit and gratitude to the yt-dlp maintainers and contributors.
- **[FFmpeg](https://ffmpeg.org/) & [ffprobe](https://ffmpeg.org/ffprobe.html)**: Multimedia framework utilized for post-processing, audio extraction, album art cropping, and stream inspection.
- **[gyan.dev](https://www.gyan.dev/ffmpeg/builds/)**: Sincere credit for providing reliable Windows builds of the FFmpeg essentials suite.
- **Inspired by [YTDLnis](https://github.com/deniscerri/ytdlnis)**: Heartfelt inspiration and appreciation to **YTDLnis** (by Denis Cerri), whose open-source interface and downloading workflows served as a key inspiration for this project.

---

## 📄 License
MIT License. Open source and free to customize.
