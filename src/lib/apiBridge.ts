// Unified API Bridge supporting both Native Tauri Windows App and Web/Server mode
import { DownloadTask, MediaType, TaskOptions } from '../types';

export const isNativeTauri = (): boolean => {
  return typeof window !== 'undefined' && Boolean(
    (window as any).__TAURI_INTERNALS__ || 
    (window as any).__TAURI__
  );
};

// Normalize any raw task (from Tauri Rust or Express backend) into a complete, safe DownloadTask
export function normalizeTask(raw: any): DownloadTask {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'task_' + Math.random().toString(36).slice(2, 8),
      url: '',
      title: 'Unknown Media',
      uploader: 'Unknown',
      type: 'video',
      format: 'best',
      status: 'queued',
      progress: 0,
      speed: '0 KB/s',
      eta: '--:--',
      totalSize: '-- MB',
      downloadedSize: '0 MB',
      logs: [],
      createdAt: Date.now(),
      options: {
        namingTemplate: '%(title)s - %(artist,uploader)s.%(ext)s',
        subtitles: { enabled: false, langs: 'en', embed: false, autoSubs: false },
        sponsorblock: { enabled: false, categories: ['sponsor'], action: 'remove', categoryActions: {} },
        audioCropThumbnailSquare: true,
        embedMetadata: true,
      }
    };
  }

  const formatStr = String(raw.format || raw.quality || 'best');
  const isAudio = raw.type === 'audio' || 
    formatStr.startsWith('mp3') || 
    formatStr === 'm4a' || 
    formatStr === 'opus' || 
    formatStr === 'flac' || 
    formatStr === 'wav' || 
    formatStr === 'audio';

  const rawOpts = raw.options || {};
  const sponsorblockOpts = rawOpts.sponsorblock || {};
  const subtitlesOpts = rawOpts.subtitles || {};

  const defaultOptions: TaskOptions = {
    namingTemplate: rawOpts.namingTemplate || '%(title)s - %(artist,uploader)s.%(ext)s',
    subtitles: {
      enabled: Boolean(subtitlesOpts.enabled),
      langs: subtitlesOpts.langs || 'en',
      embed: Boolean(subtitlesOpts.embed),
      autoSubs: Boolean(subtitlesOpts.autoSubs),
      format: subtitlesOpts.format,
      keepSubs: subtitlesOpts.keepSubs,
    },
    sponsorblock: {
      enabled: Boolean(sponsorblockOpts.enabled),
      categories: Array.isArray(sponsorblockOpts.categories) ? sponsorblockOpts.categories : ['sponsor'],
      action: sponsorblockOpts.action || 'remove',
      categoryActions: sponsorblockOpts.categoryActions || {},
      apiUrl: sponsorblockOpts.apiUrl,
    },
    audioCropThumbnailSquare: rawOpts.audioCropThumbnailSquare !== false,
    embedMetadata: rawOpts.embedMetadata !== false,
    customMetadata: rawOpts.customMetadata,
    auth: rawOpts.auth,
  };

  // Safe logs
  const logs = Array.isArray(raw.logs) ? raw.logs.map(String) : [];

  // Compute totalSize and downloadedSize if bytes are present
  let totalSize = raw.totalSize || '-- MB';
  if ((!raw.totalSize || raw.totalSize === '-- MB') && typeof raw.total_bytes === 'number' && raw.total_bytes > 0) {
    totalSize = (raw.total_bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  let downloadedSize = raw.downloadedSize || '0 MB';
  if ((!raw.downloadedSize || raw.downloadedSize === '0 MB') && typeof raw.downloaded_bytes === 'number' && raw.downloaded_bytes > 0) {
    downloadedSize = (raw.downloaded_bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return {
    id: String(raw.id || 'dl_' + Math.random().toString(36).slice(2, 9)),
    url: String(raw.url || ''),
    title: String(raw.title || raw.url || 'Download Task'),
    uploader: String(raw.uploader || raw.channel || 'Unknown'),
    thumbnail: raw.thumbnail || undefined,
    duration: raw.duration ? String(raw.duration) : undefined,
    type: (raw.type as MediaType) || (isAudio ? 'audio' : 'video'),
    format: formatStr,
    status: raw.status || 'queued',
    progress: typeof raw.progress === 'number' && !isNaN(raw.progress) ? raw.progress : 0,
    speed: String(raw.speed || '0 KB/s'),
    eta: String(raw.eta || '--:--'),
    totalSize: String(totalSize),
    downloadedSize: String(downloadedSize),
    filename: raw.filename || raw.file_name,
    filepath: raw.filepath || raw.file_path,
    logs,
    error: raw.error || undefined,
    fullError: raw.fullError || raw.full_error || undefined,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    completedAt: typeof raw.completedAt === 'number' ? raw.completedAt : undefined,
    options: defaultOptions,
  };
}

// Safe invoke wrapper that only attempts Tauri calls when native runtime exists
async function nativeInvoke<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// Safe helper to parse JSON response without throwing SyntaxError on HTML / non-JSON responses
export async function safeFetchJson<T>(url: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, options);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const rawText = await res.text();
    const trimmed = rawText.trim();

    // Guard against HTML responses (warmup pages, 502 Bad Gateway, SPA fallback index.html)
    if (
      contentType.includes('text/html') ||
      trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<html') ||
      (trimmed.startsWith('<') && !trimmed.startsWith('<?xml'))
    ) {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new Error(`Server returned HTML (${res.status} ${res.statusText}) instead of JSON. Service may be initializing.`);
    }

    try {
      return JSON.parse(rawText) as T;
    } catch (parseErr: any) {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new Error(`Failed to parse response from ${url} as JSON (${parseErr.message})`);
    }
  } catch (err: any) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw err;
  }
}

const defaultStatus = {
  status: 'ready',
  version: '2026.08.19',
  ffmpeg: true,
  portableMode: true,
  downloadDir: './portable_data/downloads',
  activeTasks: 0,
  queuedTasks: 0,
  totalDownloads: 0,
  os: 'Windows 11 Client GUI (Virtual Environment)'
};

export const api = {
  // System Status
  async getSystemStatus(): Promise<any> {
    if (isNativeTauri()) {
      try {
        const raw: any = await nativeInvoke('get_system_status');
        if (raw) {
          const dl = raw.downloadDir || raw.download_dir || '';
          return {
            status: raw.status || (raw.ytdlp_installed || raw.ytdlpInstalled ? 'ready' : 'missing-dependencies'),
            version: raw.version || raw.ytdlp_version || raw.ytdlpVersion || 'Unknown',
            ffmpeg: raw.ffmpeg !== undefined ? raw.ffmpeg : (raw.ffmpeg_installed || raw.ffmpegInstalled || false),
            portableMode: raw.portableMode !== undefined ? raw.portableMode : (raw.portable_mode !== undefined ? raw.portable_mode : true),
            downloadDir: dl || defaultStatus.downloadDir,
            configDir: raw.configDir || raw.config_dir || '',
            activeTasks: raw.activeTasks !== undefined ? raw.activeTasks : (raw.active_tasks || 0),
            queuedTasks: raw.queuedTasks !== undefined ? raw.queuedTasks : (raw.queued_tasks || 0),
            totalDownloads: raw.totalDownloads !== undefined ? raw.totalDownloads : (raw.total_downloads || 0),
            os: raw.os || raw.platform || 'Windows Native'
          };
        }
      } catch (err) {
        console.warn('Native status fetch failed, trying HTTP fallback', err);
      }
    }
    return safeFetchJson('/api/system-status', undefined, defaultStatus);
  },

  // Task List
  async getTasks(): Promise<DownloadTask[]> {
    if (isNativeTauri()) {
      try {
        const nativeTasks = await nativeInvoke<any[]>('get_tasks');
        if (Array.isArray(nativeTasks)) {
          return nativeTasks.map(normalizeTask);
        }
      } catch (err) {
        console.warn('Native getTasks failed, trying HTTP fallback', err);
      }
    }
    const res = await safeFetchJson<any[]>('/api/tasks', undefined, []);
    return Array.isArray(res) ? res.map(normalizeTask) : [];
  },

  // Queue Tasks
  async queueTasks(items: any[], globalOptions: any): Promise<{ success: boolean; tasks: DownloadTask[] }> {
    if (isNativeTauri()) {
      try {
        const res = await nativeInvoke<{ success: boolean; tasks: any[] }>('queue_tasks', { items, globalOptions });
        if (res && res.success && Array.isArray(res.tasks)) {
          return {
            success: true,
            tasks: res.tasks.map(normalizeTask)
          };
        }
      } catch (err) {
        console.warn('Native queueTasks fallback to HTTP', err);
      }
    }
    const res = await safeFetchJson<{ success: boolean; tasks: any[] }>('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, globalOptions }),
    }, { success: false, tasks: [] });

    return {
      success: Boolean(res && res.success),
      tasks: Array.isArray(res?.tasks) ? res.tasks.map(normalizeTask) : []
    };
  },

  // Cancel Task
  async cancelTask(id: string): Promise<boolean> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke('cancel_task', { id });
      } catch (err) {
        console.warn('Native cancelTask fallback', err);
      }
    }
    const res = await fetch(`/api/tasks/${id}/cancel`, { method: 'POST' });
    return res.ok;
  },

  // Retry Task
  async retryTask(id: string): Promise<boolean> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke('retry_task', { id });
      } catch (err) {
        console.warn('Native retryTask fallback', err);
      }
    }
    const res = await fetch(`/api/tasks/${id}/retry`, { method: 'POST' });
    return res.ok;
  },

  // Clear Completed
  async clearCompleted(): Promise<boolean> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke('clear_completed');
      } catch (err) {
        console.warn('Native clearCompleted fallback', err);
      }
    }
    const res = await fetch('/api/tasks/clear-completed', { method: 'POST' });
    return res.ok;
  },

  // Open Downloads Folder in Windows Explorer
  async openDownloadFolder(): Promise<void> {
    if (isNativeTauri()) {
      try {
        await nativeInvoke('open_download_folder');
        return;
      } catch (err) {
        console.warn('Native open folder fallback', err);
      }
    }
    await fetch('/api/open-downloads', { method: 'POST' });
  },

  // Get current and configured download directory
  async getDownloadDir(): Promise<{
    current: string;
    configured: string;
    defaultDir: string;
    fallbackDir: string;
    isCustom: boolean;
    exists: boolean;
  }> {
    if (isNativeTauri()) {
      try {
        const current = await nativeInvoke<string>('get_download_dir');
        return {
          current: current || 'Downloads',
          configured: current || 'Downloads',
          defaultDir: current || 'Downloads',
          fallbackDir: 'downloads',
          isCustom: false,
          exists: true
        };
      } catch (err) {
        console.warn('Native getDownloadDir fallback', err);
      }
    }
    return safeFetchJson('/api/download-dir', undefined, {
      current: './downloads',
      configured: 'Downloads',
      defaultDir: 'Downloads',
      fallbackDir: './downloads',
      isCustom: false,
      exists: true
    });
  },

  // Set custom download directory
  async setDownloadDir(dir: string): Promise<{
    success: boolean;
    current?: string;
    configured?: string;
    defaultDir?: string;
    fallbackDir?: string;
    isCustom?: boolean;
    exists?: boolean;
    error?: string;
  }> {
    if (isNativeTauri()) {
      try {
        const updated = await nativeInvoke<string>('set_download_dir', { dir });
        return {
          success: true,
          current: updated,
          configured: updated,
          isCustom: true,
          exists: true
        };
      } catch (err: any) {
        console.warn('Native setDownloadDir fallback', err);
      }
    }
    return safeFetchJson('/api/download-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir }),
    }, { success: false, error: 'Failed to update download directory' });
  },

  // Reset download directory to %USERPROFILE%\Downloads default
  async resetDownloadDir(): Promise<{
    success: boolean;
    current?: string;
    configured?: string;
    defaultDir?: string;
    fallbackDir?: string;
    isCustom?: boolean;
    exists?: boolean;
  }> {
    if (isNativeTauri()) {
      try {
        const def = await nativeInvoke<string>('reset_download_dir');
        return {
          success: true,
          current: def,
          configured: def,
          isCustom: false,
          exists: true
        };
      } catch (err) {
        console.warn('Native resetDownloadDir fallback', err);
      }
    }
    return safeFetchJson('/api/download-dir/reset', {
      method: 'POST'
    }, { success: false });
  },

  // Extract Media & Playlist Information
  async extractInfo(url: string, auth?: any, signal?: AbortSignal): Promise<any> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke('extract_info', { url, auth });
      } catch (err: any) {
        const fullErrStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
        const lines = fullErrStr.split('\n').map((l: string) => l.trim()).filter(Boolean);
        const specificLine = lines.find((l: string) => l.includes('ERROR:') || l.includes('HTTP Error')) || lines[0] || 'Extraction failed';
        return {
          error: specificLine.replace(/^ERROR:\s*/, '').trim(),
          fullError: fullErrStr
        };
      }
    }

    // Web / HTTP Mode with protection against HTML responses, warmup timeouts, and unexpected tokens
    const maxRetries = 3;
    let lastError = '';
    let lastFullError = '';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      try {
        const res = await fetch('/api/extract-info', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ url, auth }),
          signal,
        });

        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        const rawText = await res.text();
        const trimmed = rawText.trim();

        // Check if response is HTML (e.g. server starting warmup page, 502/504 Bad Gateway, SPA fallback)
        const isHtml =
          contentType.includes('text/html') ||
          trimmed.startsWith('<!doctype') ||
          trimmed.startsWith('<!DOCTYPE') ||
          trimmed.startsWith('<html') ||
          (trimmed.startsWith('<') && !trimmed.startsWith('<?xml'));

        if (isHtml) {
          const isWarmup =
            trimmed.includes('Please wait while your application starts') ||
            trimmed.includes('Starting Server...') ||
            trimmed.includes('Your application failed to start');

          // If the container is still warming up, wait 1.2 seconds and retry automatically
          if (isWarmup && attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1200));
            continue;
          }

          if (isWarmup) {
            return {
              error: 'Download engine is warming up. Please try analyzing again in a moment.',
              fullError: 'The application backend container is currently starting up.\n\nPlease wait a few seconds for the service to finish initialization, then click "Analyze Link" again.'
            };
          }

          return {
            error: `Server returned an HTML page (${res.status} ${res.statusText || 'OK'}). The download service may be initializing.`,
            fullError: `Unexpected HTML response from server:\n${trimmed.slice(0, 500)}`
          };
        }

        // Parse JSON safely without letting raw SyntaxError crash the UI
        let data: any;
        try {
          data = JSON.parse(trimmed);
        } catch (jsonErr: any) {
          return {
            error: 'Server returned an invalid non-JSON response.',
            fullError: `Failed to parse response as JSON (${jsonErr?.message}):\n${trimmed.slice(0, 500)}`
          };
        }

        if (!res.ok) {
          return {
            error: data?.error || `Extraction failed with HTTP ${res.status}`,
            fullError: data?.fullError || data?.error || `HTTP error ${res.status}: ${trimmed.slice(0, 300)}`
          };
        }

        return data;
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        lastError = err?.message || 'Network connection failed during extraction';
        lastFullError = err?.stack || err?.message || 'Network connection failed during extraction';

        // Auto-retry once on transient network drop before failing
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }

    return {
      error: lastError || 'Extraction request failed',
      fullError: lastFullError || 'Failed to complete media extraction after retries.'
    };
  },

  // Save cookies.txt
  async saveCookies(content: string): Promise<{ ok: boolean; count: number }> {
    if (isNativeTauri()) {
      try {
        const count = await nativeInvoke<number>('save_cookies_file', { content });
        return { ok: true, count };
      } catch (err) {
        console.warn('Native saveCookies fallback', err);
      }
    }
    return safeFetchJson<{ ok: boolean; count: number }>('/api/auth/save-cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }, { ok: false, count: 0 });
  },

  // Get saved cookies
  async getCookies(): Promise<{ exists: boolean; count: number; content?: string }> {
    if (isNativeTauri()) {
      try {
        const content = await nativeInvoke<string | null>('get_cookies_file');
        if (content) {
          return { exists: true, count: content.split('\n').length, content };
        }
        return { exists: false, count: 0 };
      } catch (err) {
        console.warn('Native getCookies fallback', err);
      }
    }
    return safeFetchJson<{ exists: boolean; count: number; content?: string }>(
      '/api/auth/get-cookies',
      undefined,
      { exists: false, count: 0 }
    );
  },

  // Clear cookies
  async clearCookies(): Promise<boolean> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke('clear_cookies_file');
      } catch (err) {
        console.warn('Native clearCookies fallback', err);
      }
    }
    const res = await fetch('/api/auth/clear-cookies', { method: 'POST' });
    return res.ok;
  },

  // Get downloaded files list safely
  async getDownloadedFiles(): Promise<any[]> {
    return safeFetchJson<any[]>('/api/downloaded-files', undefined, []);
  },

  // Toggle portable mode safely
  async togglePortable(enabled: boolean): Promise<{ portableMode: boolean; downloadDir: string }> {
    return safeFetchJson<{ portableMode: boolean; downloadDir: string }>(
      '/api/toggle-portable',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      },
      { portableMode: enabled, downloadDir: '' }
    );
  },

  // Generate Web Client PO Token safely
  async generatePoToken(): Promise<{ ok: boolean; poToken?: string; visitorData?: string; error?: string }> {
    return safeFetchJson<{ ok: boolean; poToken?: string; visitorData?: string; error?: string }>(
      '/api/auth/generate-potoken',
      { method: 'POST' },
      { ok: false, error: 'Could not connect to authentication token service' }
    );
  },

  // Test anti-bot bypass
  async testBypass(auth: any): Promise<{ ok: boolean; message?: string; error?: string; isBotGuard?: boolean }> {
    return safeFetchJson<{ ok: boolean; message?: string; error?: string; isBotGuard?: boolean }>(
      '/api/auth/test-bypass',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth }),
      },
      { ok: false, error: 'Connection to verification test service timed out' }
    );
  },

  // Test SponsorBlock API
  async testSponsorBlock(apiUrl?: string): Promise<{ ok: boolean }> {
    return safeFetchJson<{ ok: boolean }>(
      '/api/sponsorblock/test',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl }),
      },
      { ok: false }
    );
  },

  // Check engine update safely
  async checkUpdate(): Promise<any> {
    return safeFetchJson(
      '/api/check-update',
      { method: 'POST' },
      { hasUpdate: false, currentVersion: '2026.08.19', latestVersion: '2026.08.19' }
    );
  },

  // Update engine safely
  async updateEngine(): Promise<{ success: boolean; version?: string; error?: string }> {
    return safeFetchJson<{ success: boolean; version?: string; error?: string }>(
      '/api/update-engine',
      { method: 'POST' },
      { success: false, error: 'Update service unavailable' }
    );
  }
};
