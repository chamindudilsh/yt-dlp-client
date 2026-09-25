# yt-dlp Client for Windows

[![GitHub Repo](https://img.shields.io/badge/GitHub-chamindudilsh%2Fyt--dlp--client-blue?style=flat-square&logo=github)](https://github.com/chamindudilsh/yt-dlp-client)
[![GitHub Release](https://img.shields.io/github/v/release/chamindudilsh/yt-dlp-client?color=blue&style=flat-square&logo=github)](https://github.com/chamindudilsh/yt-dlp-client/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078d4?style=flat-square&logo=windows)](https://github.com/chamindudilsh/yt-dlp-client)

A lightweight desktop client for **yt-dlp**, **FFmpeg**, and **ffprobe**. Built with **React 19**, **Tailwind CSS**, and **Tauri v2 (Rust)**.

---

## Prerequisites & Toolchain

The client automatically detects `yt-dlp`, `ffmpeg`, `ffprobe`, and `aria2c` in the application folder, `./bin/`, WinGet locations, or system `PATH`.

| Tool | Role |
| :--- | :--- |
| **`yt-dlp`** | Downloading, format extraction, playlist parsing, and bot verification bypass. |
| **`ffmpeg`** | Stream muxing, audio format conversion (AAC, MP3, OPUS, FLAC), and album art embedding. |
| **`ffprobe`** | Technical stream inspection, codec validation, and integrity checks. |
| **`deno`** *(Recommended)* | Native JavaScript runtime for yt-dlp to solve YouTube format extraction and prevent player throttling. |
| **`aria2`** *(Optional)* | Multi-connection downloader (`aria2c`) for accelerated download speeds. |

> [!NOTE]
> * **Windows Standalone (`yt-dlp.exe`)**: Bundles its own Python runtime and core libraries (including `mutagen`, `pycryptodomex`, and `brotli`). No separate Python installation is required.
> * **Python Environments**: If running the script via system Python (`python yt-dlp`), ensure Python 3.8+ and `mutagen` are installed:
>   ```bash
>   python3 -m pip install mutagen pycryptodomex
>   ```

### Recommended Windows Setup (via WinGet)

```powershell
# 1. Install FFmpeg (with ffprobe)
winget install Gyan.FFmpeg

# 2. (Recommended) Install Deno as the JavaScript runtime for yt-dlp
winget install DenoLand.Deno

# 3. (Optional) Install aria2 for multi-connection downloads
winget install aria2.aria2
```
*(FFmpeg can also be downloaded manually from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/))*

---

## Native (Tauri + Rust) vs. Electron

| Metric | Traditional Electron App | yt-dlp Client (Native Tauri) |
| :--- | :--- | :--- |
| **RAM Footprint** | ~300 MB - 500 MB | **~30 MB - 50 MB** |
| **Executable Size** | ~90 MB - 140 MB | **~10 MB - 15 MB** |
| **Background Server** | Requires Node.js runtime process | **None** (Compiled Rust binary) |
| **Web Engine** | Bundles Chromium | Native Windows **WebView2** |
| **Startup Speed** | 2 - 4 seconds | **Instant (< 300 ms)** |

---

## Features

### Search & Queuing
- Search YouTube, YouTube Music, and SoundCloud directly in the app.
- Smart defaults: audio extraction for Music and SoundCloud, video for YouTube.
- Playlist parser with selective item queuing.
- Clipboard detection with one-click analysis.

### Video & Audio Formats
- Resolution options: 4K (2160p), 1440p, 1080p, 720p, 480p, or best available.
- Prioritizes standard MP4 and M4A containers for broad compatibility.
- Direct stream extraction or conversion to MP3 (VBR V0, 320k, 256k, 192k), M4A, Opus, FLAC, and WAV.
- Section downloads (`--download-sections`) and automatic chapter splitting (`--split-chapters`).
- Aria2 multi-connection downloader support.

### 1:1 Album Art Cropper
- Interactive modal with draggable crop box to preview square album art before downloading.
- Quick presets for Left (0%), Center (50%), and Right (100%).
- Custom focal point offsets mapped directly to FFmpeg crop filters.

### SponsorBlock & Subtitles
- Skip or mark sponsored segments, intros, outros, and self-promos with custom category controls.
- Custom SponsorBlock API server configuration.
- Multi-language subtitle downloads with auto-captions and soft container embedding (`--embed-subs`).

### Metadata & Archive
- Embeds tags: title, artist, album, release year, genre, and chapter markers.
- Download archive tracking (`--download-archive`) to prevent duplicate downloads across sessions.
- Safe staging: temporary chunks are isolated and completed files are safely organized without accidental file loss.

### Anti-Bot & Throttling Bypass
- Built-in Proof of Origin (PO) token generator for YouTube bot verification challenges.
- Direct cookie extraction from Chrome, Edge, Firefox, Brave, Vivaldi, and Opera.
- Custom `cookies.txt` import and editor.
- YouTube player client switching (Android, iOS, Web, Mobile Web, TV, YouTube Music) to resolve HTTP 429 and rate-limiting.

### Media Library & Inspector
- Built-in library to view, play, and open completed downloads.
- Integrated `ffprobe` inspector for video/audio codecs, bitrates, sample rates, and tags.
- CLI command preview to copy exact `yt-dlp` arguments.
- Live process logs drawer with detailed exit status messages.

---

## Download Pre-Built Releases

Binaries for Windows 10 and 11 are available on **[GitHub Releases](https://github.com/chamindudilsh/yt-dlp-client/releases)**:
- **`yt-dlp-client.exe`**: Standalone executable.
- **`yt-dlp-client-v1.0.0-portable-x64.zip`**: Portable bundle with `yt-dlp-client.exe` and `yt-dlp.exe` included.
- **`SHA256SUMS.txt`**: SHA-256 integrity checksums for all release binaries.

---

## Building from Source

#### Prerequisites:
1. **Node.js** (v18+): [nodejs.org](https://nodejs.org)
2. **Rust & C++ Build Tools**:
   - Install Rust via [rustup.rs](https://rustup.rs).
   - In Visual Studio Installer, ensure **Desktop development with C++** is installed.
3. **Tools (`yt-dlp`, `ffmpeg`, `ffprobe`, optional `aria2`)**:
   - Install via WinGet or place binaries in `src-tauri/bin/` or your system `PATH`.

#### Build Commands:

```cmd
# 1. Clone the repository
git clone https://github.com/chamindudilsh/yt-dlp-client.git
cd yt-dlp-client

# 2. Install dependencies
npm install

# 3. Run desktop app in development mode
npm run tauri:dev

# 4. Compile standalone executable
npm run tauri:build
```

The compiled binary will be located at:
```
src-tauri/target/release/yt-dlp-client.exe
```

---

## Running in Web / Server Mode

To run as a local web service:

```bash
npm install
npm run dev        # Development server on http://127.0.0.1:3000
npm run build      # Production build
npm start          # Production server
```

The server binds to `127.0.0.1` by default. To allow access from other devices on your local network, set the `HOST` variable:
```bash
HOST=0.0.0.0 npm start
```

---

## Credits

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**: The core command-line download utility.
- **[FFmpeg](https://ffmpeg.org/) & [ffprobe](https://ffmpeg.org/ffprobe.html)**: Multimedia processing, format conversion, and stream inspection.
- **[gyan.dev](https://www.gyan.dev/ffmpeg/builds/)**: Windows builds of FFmpeg.
- **[YTDLnis](https://github.com/deniscerri/ytdlnis)**: Android app by Denis Cerri, which inspired key parts of the feature set and workflow.

---

## License

MIT License. Open source and free to customize.
