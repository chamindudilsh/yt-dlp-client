/**
 * yt-dlp Client - Website Interactive Logic
 * Zero external dependencies. Pure vanilla JS.
 */

document.addEventListener('DOMContentLoaded', () => {
  initReleaseInfo();
  initCliGenerator();
  initCopyActions();
});

/* ==========================================================================
   1. Dynamic GitHub Release Fetcher
   ========================================================================== */
async function initReleaseInfo() {
  const repo = 'chamindudilsh/yt-dlp-client';
  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

  const tagEl = document.getElementById('release-tag');
  const dateEl = document.getElementById('release-date');
  const primaryBtn = document.getElementById('primary-download-btn');
  const portableBtn = document.getElementById('portable-download-btn');
  const exeSizeEl = document.getElementById('exe-size');
  const zipSizeEl = document.getElementById('zip-size');

  try {
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      cache: 'default'
    });

    if (!response.ok) return;

    const data = await response.json();
    const tagName = data.tag_name || 'v1.0.0';

    if (tagEl) {
      tagEl.textContent = `Latest: ${tagName}`;
    }

    if (dateEl && data.published_at) {
      const pubDate = new Date(data.published_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      dateEl.textContent = `Released ${pubDate}`;
    }

    if (Array.isArray(data.assets)) {
      // Find standalone .exe
      const exeAsset = data.assets.find(a => a.name.endsWith('.exe'));
      if (exeAsset && primaryBtn) {
        primaryBtn.href = exeAsset.browser_download_url;
        if (exeSizeEl) {
          exeSizeEl.textContent = formatBytes(exeAsset.size);
        }
      }

      // Find portable .zip
      const zipAsset = data.assets.find(a => a.name.endsWith('.zip') || a.name.includes('portable'));
      if (zipAsset && portableBtn) {
        portableBtn.href = zipAsset.browser_download_url;
        if (zipSizeEl) {
          zipSizeEl.textContent = formatBytes(zipAsset.size);
        }
      }
    }
  } catch {
    // Graceful offline fallback: keep static fallback links intact
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/* ==========================================================================
   2. Interactive CLI Command Generator Widget
   ========================================================================== */
function initCliGenerator() {
  const state = {
    format: 'mp3-320k',
    sponsorblock: 'skip',
    subtitles: 'embed-en',
    crop: 'center'
  };

  const outputEl = document.getElementById('cli-output');
  if (!outputEl) return;

  function renderCommand() {
    const parts = ['yt-dlp'];

    // Format selection
    if (state.format === 'mp3-320k') {
      parts.push('-x --audio-format mp3 --audio-quality 320k');
    } else if (state.format === 'flac') {
      parts.push('-x --audio-format flac');
    } else if (state.format === 'opus') {
      parts.push('-x --audio-format opus');
    } else if (state.format === 'mp4-best') {
      parts.push('-f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b" --merge-output-format mp4');
    }

    // SponsorBlock selection
    if (state.sponsorblock === 'skip') {
      parts.push('--sponsorblock-remove sponsor');
    } else if (state.sponsorblock === 'all') {
      parts.push('--sponsorblock-remove sponsor,intro,outro,selfpromo');
    }

    // Subtitles selection
    if (state.subtitles === 'embed-en') {
      parts.push('--write-sub --sub-lang "en.*" --embed-subs');
    } else if (state.subtitles === 'auto-subs') {
      parts.push('--write-auto-sub --sub-lang "en.*" --embed-subs');
    }

    // 1:1 Album Art Crop selection
    if (state.crop === 'center') {
      parts.push('--embed-thumbnail --ppa "ThumbnailsConvertor+ffmpeg_o:-filter:v crop=ih:ih"');
    } else if (state.crop === 'left') {
      parts.push('--embed-thumbnail --ppa "ThumbnailsConvertor+ffmpeg_o:-filter:v crop=ih:ih:0:0"');
    } else if (state.crop === 'right') {
      parts.push('--embed-thumbnail --ppa "ThumbnailsConvertor+ffmpeg_o:-filter:v crop=ih:ih:iw-ih:0"');
    } else if (state.crop === 'none') {
      parts.push('--embed-thumbnail');
    }

    // Dummy target URL
    parts.push('"https://www.youtube.com/watch?v=dQw4w9WgXcQ"');

    outputEl.textContent = parts.join(' \\\n  ');
  }

  // Handle pill button clicks
  const optionGroups = document.querySelectorAll('.cli-option-group');
  optionGroups.forEach(group => {
    const category = group.dataset.category;
    const buttons = group.querySelectorAll('.cli-pill-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state[category] = btn.dataset.value;
        renderCommand();
      });
    });
  });

  // Initial render
  renderCommand();
}

/* ==========================================================================
   3. Copy Clipboard Actions & Toast
   ========================================================================== */
function initCopyActions() {
  const toast = document.getElementById('toast');
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2200);
  }

  // Copy CLI command
  const copyCliBtn = document.getElementById('copy-cli-btn');
  const cliOutput = document.getElementById('cli-output');
  if (copyCliBtn && cliOutput) {
    copyCliBtn.addEventListener('click', async () => {
      // Format as single line without backslashes for direct terminal execution
      const singleLine = cliOutput.textContent.replace(/ \\\n\s+/g, ' ');
      try {
        await navigator.clipboard.writeText(singleLine);
        showToast('✓ Command copied to clipboard');
      } catch {
        showToast('Unable to copy to clipboard');
      }
    });
  }

  // Copy WinGet setup command
  const copySetupBtn = document.getElementById('copy-setup-btn');
  const setupCmd = document.getElementById('setup-cmd-text');
  if (copySetupBtn && setupCmd) {
    copySetupBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(setupCmd.textContent.trim());
        showToast('✓ WinGet command copied to clipboard');
      } catch {
        showToast('Unable to copy command');
      }
    });
  }
}
