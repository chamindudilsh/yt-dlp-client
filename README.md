# yt-dlp Client (Native Windows & Web)

An ultra-lightweight, high-performance desktop GUI and manager for **yt-dlp** and **FFmpeg**. Built with **React 19**, **Tailwind CSS**, and **Tauri v2 (Rust)** for native Windows execution with near-zero resource consumption.

---

## 🚀 Why Native (Tauri + Rust) vs. Electron?

| Metric | Traditional Electron App | yt-dlp Client (Native Tauri) |
| :--- | :--- | :--- |
| **RAM Footprint** | ~300 MB – 500 MB | **~30 MB – 50 MB** |
| **Executable Size** | ~90 MB – 140 MB | **~10 MB – 15 MB** |
| **Background Server** | Requires a running Node.js process | **None** (Compiled native Rust machine code) |
| **Browser Engine** | Bundles duplicate Chromium | Uses native Windows **WebView2** (pre-installed in Windows 10/11) |
| **Startup Speed** | 2 – 4 seconds | **Instant (< 300 ms)** |

---

## ✨ Features

- **High-Fidelity Video & Audio Downloads**: Single video or playlist queuing with format and quality selectors (up to 4K/8K, 1080p60, MP4, MKV, MP3, FLAC, AAC, Opus).
- **SponsorBlock Integration**: Automatically skip, remove, or chapter-mark sponsorships, intros, self-promotions, and endcards.
- **Advanced Subtitle Suite**: Multi-language selection (`en.*`, `all`), embedding directly into MKV/MP4 (`--embed-subs`), and optional retention of external `.srt`/`.vtt` files.
- **YouTube Bot Bypass & Cookies**:
  - Built-in **Web Client PO Token** generator to bypass *"Sign in to confirm you’re not a bot"* blocks.
  - Automatic cookies extraction directly from installed browsers (`Chrome`, `Firefox`, `Edge`, `Brave`, etc.) or custom `cookies.txt`.
  - Alternative player client personas (e.g. **iOS Client**, which bypasses bot challenges on cloud and datacenter IP ranges).
- **Interactive Error Inspector**: Instantly inspect exact `yt-dlp` non-zero exit codes, stderr traces, and diagnostic tips with one-click retry.
- **Portable Mode**: Zero registry writes. All configuration, logs, and cookies are stored in `./portable_data/`.

---

## 🛠️ How to Build the Native Windows App (`.exe` / `.msi`)

### Method 1: Automated GitHub Actions (No local compilers needed!)

A ready-to-run GitHub Actions workflow is included in `.github/workflows/build-windows.yml`:

1. Push this repository to your **GitHub** account.
2. Go to the **Actions** tab in your GitHub repository.
3. Click **Build Native Windows App** -> **Run workflow**.
4. Once completed (~3-4 minutes), download the pre-compiled `.exe`, `.msi`, or portable `.zip` (with `yt-dlp.exe` and `ffmpeg.exe` pre-packaged) directly from the **Artifacts** section!
5. *Bonus:* Pushing a tag (e.g. `git tag v1.0.0 && git push --tags`) automatically publishes a complete GitHub Release with the installer, binaries, and portable archive attached.

---

### Method 2: Building Locally on Windows

#### Prerequisites:
1. **Node.js** (v18 or higher): [nodejs.org](https://nodejs.org)
2. **Rust & C++ Build Tools**:
   - Install **Rust** via [rustup.rs](https://rustup.rs).
   - In the Visual Studio Installer, ensure **Desktop development with C++** is checked.
3. **yt-dlp** and **ffmpeg**:
   - Place `yt-dlp.exe` and `ffmpeg.exe` into `src-tauri/bin/` (or `portable_data/` or system `PATH`) so Tauri bundles them into the installer.

#### Step-by-Step Build Commands:

```cmd
# 1. Clone the repository and navigate into the folder
git clone https://github.com/your-username/yt-dlp-client.git
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

## 📁 Portable Directory Structure

```
yt-dlp-client/
├── downloads/           # Default output folder for all completed media
├── portable_data/       # Portable configuration, custom cookies.txt, and local logs
│   ├── cookies.txt      # Authenticated session cookies (if imported)
│   ├── yt-dlp.exe       # Optional standalone binary placement
│   └── ffmpeg.exe       # Optional standalone binary placement
├── src/                 # React UI frontend
├── src-tauri/           # Native Rust backend (Tauri v2)
│   ├── Cargo.toml       # Rust dependencies and binary configuration
│   ├── tauri.conf.json  # Window configuration and app capabilities
│   └── src/main.rs      # Native command implementations and process manager
└── server.ts            # Optional Express server for web/container mode
```

---

## 🙏 Credits & Acknowledgements

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**: Powered by the exceptional command-line audio and video download tool. Sincere credit and gratitude to the yt-dlp maintainers and open-source contributors for their tireless development.
- **[FFmpeg](https://ffmpeg.org/)**: The industry-standard multimedia framework utilized for post-processing, audio extraction, square album art cropping, and container packaging.
- **Inspired by [YTDLnis](https://github.com/deniscerri/ytdlnis)**: Heartfelt inspiration and appreciation to **YTDLnis** (by Denis Cerri), whose outstanding open-source interface, feature-rich customization, and streamlined downloading workflows served as a key inspiration for this project.

---

## 📄 License
MIT License. Open source and free to customize.
