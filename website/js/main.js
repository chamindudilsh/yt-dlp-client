/**
 * yt-dlp Client - Website Interactive Logic
 * Zero external dependencies. Pure vanilla JS.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initReleaseInfo();
  initCliGenerator();
  initCopyActions();
});

/* ==========================================================================
   1. Mobile Navigation Drawer Toggle
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (!toggleBtn || !navLinks) return;

  function closeMenu() {
    navLinks.classList.remove('open');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    navLinks.classList.add('open');
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navLinks.classList.contains('open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close drawer when any nav link is tapped
  const links = navLinks.querySelectorAll('.nav-link');
  links.forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  // Close when tapping outside the navbar
  document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('open')) {
      if (!navLinks.contains(e.target) && !toggleBtn.contains(e.target)) {
        closeMenu();
      }
    }
  });

  // Close on Escape key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) {
      closeMenu();
      toggleBtn.focus();
    }
  });
}

/* ==========================================================================
   2. Dynamic GitHub Release Fetcher
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
          exeSizeEl.textContent = `(${formatBytes(exeAsset.size)})`;
        }
      }

      // Find portable .zip
      const zipAsset = data.assets.find(a => a.name.endsWith('.zip') || a.name.includes('portable'));
      if (zipAsset && portableBtn) {
        portableBtn.href = zipAsset.browser_download_url;
        if (zipSizeEl) {
          zipSizeEl.textContent = `(${formatBytes(zipAsset.size)})`;
        }
      }
    }
  } catch {
    // Graceful offline fallback: keep static fallback links intact without size suffix
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/* ==========================================================================
   3. Interactive CLI Command Generator Widget
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
   4. Copy Clipboard Actions, Toast & In-Place Button Feedback
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

  async function copyToClipboard(text, buttonEl, successText = 'Copied!') {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }

    // Fallback using temporary textarea
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        textArea.remove();
      } catch {
        copied = false;
      }
    }

    if (copied) {
      showToast('✓ Copied to clipboard');

      // In-place button feedback
      if (buttonEl) {
        const textSpan = buttonEl.querySelector('.copy-text');
        const icon = buttonEl.querySelector('.copy-icon');
        const origText = textSpan ? textSpan.textContent : '';

        if (textSpan) textSpan.textContent = successText;
        if (icon) {
          icon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
          icon.style.stroke = '#10b981';
        }

        setTimeout(() => {
          if (textSpan) textSpan.textContent = origText;
          if (icon) {
            icon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
            icon.style.stroke = '';
          }
        }, 1800);
      }
    } else {
      showToast('Unable to copy to clipboard');
    }
  }

  // Copy CLI command
  const copyCliBtn = document.getElementById('copy-cli-btn');
  const cliOutput = document.getElementById('cli-output');
  if (copyCliBtn && cliOutput) {
    copyCliBtn.addEventListener('click', () => {
      // Format as single line without backslashes for direct terminal execution
      const singleLine = cliOutput.textContent.replace(/ \\\n\s+/g, ' ');
      copyToClipboard(singleLine, copyCliBtn, 'Copied!');
    });
  }

  // Copy WinGet setup command
  const copySetupBtn = document.getElementById('copy-setup-btn');
  const setupCmd = document.getElementById('setup-cmd-text');
  if (copySetupBtn && setupCmd) {
    copySetupBtn.addEventListener('click', () => {
      copyToClipboard(setupCmd.textContent.trim(), copySetupBtn, 'Copied!');
    });
  }
}
