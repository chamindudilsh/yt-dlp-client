import { 
  DownloadTask, 
  MediaType, 
  TaskOptions, 
  MediaProbeInfo,
  AppUpdateInfo,
  AppReleaseAsset,
  EngineUpdateInfo,
  UpdateInfo,
  SearchEngine,
  SearchResultItem,
  PostDownloadAction
} from '../types';
import { 
  APP_VERSION, 
  APP_RELEASES_API, 
  APP_RELEASES_URL, 
  YTDLP_RELEASES_API, 
  YTDLP_RELEASES_URL 
} from '../constants/app';
import { isNewerVersion, formatBytes } from './versionUtils';
import { searchInnerTube } from './innertubeSearch';
import { searchSoundCloud } from './soundcloudSearch';

export const isNativeTauri = (): boolean => {
  return typeof window !== 'undefined' && Boolean(
    (window as any).__TAURI_INTERNALS__ || 
    (window as any).__TAURI__
  );
};

export const isNativeWindowsDesktop = (): boolean => {
  if (!isNativeTauri()) return false;
  if (typeof window === 'undefined') return false;
  const nav = window.navigator;
  const ua = nav.userAgent || '';
  const platform = nav.platform || '';
  return ua.includes('Windows') || platform.includes('Win');
};

// Format any speed string (or number) into clean MBps (Megabytes per second)
export function formatSpeedToMBps(speedStr?: string): string {
  if (!speedStr) return '0.0 MBps';
  const trimmed = String(speedStr).trim();
  if (trimmed === 'Done' || trimmed === 'Completed') return 'Done';
  if (trimmed === 'Paused') return 'Paused';
  if (
    trimmed.toLowerCase().includes('unknown') ||
    trimmed === '0' ||
    trimmed === '0 KB/s' ||
    trimmed === '0.0 KB/s' ||
    trimmed === '0 MBps' ||
    trimmed === '0.0 MBps'
  ) {
    return '0.0 MBps';
  }

  // If already in MBps format e.g. "5.20 MBps" or "5.2 MBps"
  const mbpsMatch = trimmed.match(/^([\d\.]+)\s*MBps$/i);
  if (mbpsMatch) {
    const v = parseFloat(mbpsMatch[1]);
    if (!isNaN(v)) {
      return v >= 100 ? `${v.toFixed(1)} MBps` : `${v.toFixed(2)} MBps`;
    }
  }

  // Match general value and unit: e.g. "5.20MiB/s", "876KiB/s", "100Mbps", "1.5GiB/s"
  const match = trimmed.match(/^~?\s*([\d\.]+)\s*([A-Za-z]+(?:\/[a-zA-Z]+)?)$/);
  if (!match) return trimmed;

  const val = parseFloat(match[1]);
  if (isNaN(val)) return trimmed;

  const rawUnit = match[2];
  const unit = rawUnit.toLowerCase();
  let mbps = 0;

  // Distinguish bits (Mbps, Kbps, Mbit/s, kbit/s) from bytes (MBps, KBps, MiB/s, MB/s)
  const isBits = unit.includes('bit') || (rawUnit.includes('bps') && !rawUnit.includes('Bps')) || rawUnit === 'mbps' || rawUnit === 'kbps' || rawUnit === 'gbps';

  if (isBits) {
    if (unit.startsWith('g')) {
      mbps = (val * 1000) / 8;
    } else if (unit.startsWith('k')) {
      mbps = (val / 1000) / 8;
    } else {
      mbps = val / 8;
    }
  } else if (unit.includes('gib') || unit.includes('gb')) {
    mbps = val * 1024;
  } else if (unit.includes('mib') || unit.includes('mb')) {
    mbps = val;
  } else if (unit.includes('kib') || unit.includes('kb')) {
    mbps = val / 1024;
  } else if (unit.includes('b/s') || unit === 'b') {
    mbps = val / (1024 * 1024);
  } else {
    mbps = val;
  }

  if (mbps === 0) return '0.0 MBps';
  if (mbps < 0.01) return '< 0.01 MBps';
  if (mbps >= 100) return `${mbps.toFixed(1)} MBps`;
  return `${mbps.toFixed(2)} MBps`;
}

// Normalize file size into clean human string (e.g. 12.3 MB, 218.5 KB, 1.50 GB)
export function formatFileSize(sizeInput?: string | number): string {
  if (sizeInput === undefined || sizeInput === null || sizeInput === '') return '-- MB';

  if (typeof sizeInput === 'number') {
    if (sizeInput <= 0) return '-- MB';
    if (sizeInput >= 1024 * 1024 * 1024) {
      return `${(sizeInput / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (sizeInput >= 1024 * 1024) {
      return `${(sizeInput / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (sizeInput >= 1024) {
      return `${(sizeInput / 1024).toFixed(1)} KB`;
    }
    return `${sizeInput} B`;
  }

  const trimmed = String(sizeInput).trim();
  if (trimmed === '-- MB' || trimmed === '--' || !trimmed) return '-- MB';

  // Parse strings like "218.53KiB", "~ 12.34MiB", "1.50GiB", "500B", "12.5 MB"
  const match = trimmed.match(/^~?\s*([\d\.]+)\s*([A-Za-z]+)$/);
  if (!match) return trimmed;

  const num = parseFloat(match[1]);
  if (isNaN(num)) return trimmed;

  const unit = match[2].toLowerCase();
  if (unit.startsWith('g')) {
    return `${num.toFixed(2)} GB`;
  } else if (unit.startsWith('m')) {
    return `${num.toFixed(1)} MB`;
  } else if (unit.startsWith('k')) {
    return `${num.toFixed(1)} KB`;
  } else if (unit.startsWith('b')) {
    return `${Math.round(num)} B`;
  }

  return `${num} ${match[2]}`;
}

// Extract detected file size from raw logs if totalSize wasn't provided directly
export function extractSizeFromLogs(logs: string[]): string | undefined {
  if (!Array.isArray(logs) || logs.length === 0) return undefined;

  // Scan in reverse order (most recent logs first)
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i];
    if (!line) continue;

    // Pattern 1: [download]  45.2% of ~ 120.50MiB at ... or [download] 100% of 561.35KiB in ...
    const dlMatch = line.match(/\[download\]\s+[\d\.]+(?:%)?\s+of\s+~?\s*([\d\.]+[A-Za-z]+)/i);
    if (dlMatch && dlMatch[1]) {
      return formatFileSize(dlMatch[1]);
    }

    // Pattern 2: [download] 561.35KiB at ... (total size line without of)
    const dlAtMatch = line.match(/\[download\]\s+([\d\.]+[A-Za-z]+)\s+at\s+/i);
    if (dlAtMatch && dlAtMatch[1] && !dlAtMatch[1].endsWith('/s')) {
      return formatFileSize(dlAtMatch[1]);
    }

    // Pattern 3: Total file size / File size: ...
    const sizeMatch = line.match(/(?:total file size|file size|size):\s*~?\s*([\d\.]+[A-Za-z]+)/i);
    if (sizeMatch && sizeMatch[1]) {
      return formatFileSize(sizeMatch[1]);
    }

    // Pattern 4: Destination with size e.g. "Destination: ... (12.34MiB)"
    const destSizeMatch = line.match(/Destination:\s*.*\(([\d\.]+[A-Za-z]+)\)/i);
    if (destSizeMatch && destSizeMatch[1]) {
      return formatFileSize(destSizeMatch[1]);
    }
  }

  return undefined;
}

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
      speed: '0.0 MBps',
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
    cropFocus: rawOpts.cropFocus,
    cropOffsetPercent: typeof rawOpts.cropOffsetPercent === 'number' ? rawOpts.cropOffsetPercent : undefined,
    embedMetadata: rawOpts.embedMetadata !== false,
    customMetadata: rawOpts.customMetadata,
    auth: rawOpts.auth,
    userAgent: rawOpts.userAgent,
    fileCollisionAction: rawOpts.fileCollisionAction || 'number',
    limitRate: rawOpts.limitRate || raw.limit_rate || raw.limitRate,
    useAria2: rawOpts.useAria2 ?? raw.use_aria2 ?? raw.useAria2,
    aria2Connections: rawOpts.aria2Connections || raw.aria2_connections || raw.aria2Connections,
  };

  // Safe logs
  const logs = Array.isArray(raw.logs) ? raw.logs.map(String) : [];

  // Compute totalSize and downloadedSize
  let totalSize = raw.totalSize || raw.total_size;
  if (!totalSize || totalSize === '-- MB') {
    if (typeof raw.file_size === 'number' && raw.file_size > 0) {
      totalSize = formatFileSize(raw.file_size);
    } else if (typeof raw.fileSize === 'number' && raw.fileSize > 0) {
      totalSize = formatFileSize(raw.fileSize);
    } else if (typeof raw.total_bytes === 'number' && raw.total_bytes > 0) {
      totalSize = formatFileSize(raw.total_bytes);
    } else {
      // Fallback: search logs for size
      const fromLogs = extractSizeFromLogs(logs);
      totalSize = fromLogs || '-- MB';
    }
  } else {
    totalSize = formatFileSize(totalSize);
  }

  let downloadedSize = raw.downloadedSize;
  if (!downloadedSize || downloadedSize === '0 MB') {
    if (typeof raw.downloaded_bytes === 'number' && raw.downloaded_bytes > 0) {
      downloadedSize = formatFileSize(raw.downloaded_bytes);
    } else {
      downloadedSize = '0 MB';
    }
  } else {
    downloadedSize = formatFileSize(downloadedSize);
  }

  // Format speed in MBps
  let speed = formatSpeedToMBps(raw.speed);
  // If task is currently downloading and speed is still '0.0 MBps', check latest log
  if (raw.status === 'downloading' && speed === '0.0 MBps' && logs.length > 0) {
    for (let i = logs.length - 1; i >= 0; i--) {
      const line = logs[i];
      const spMatch = line.match(/at\s+([^\s]+(?:\/s|\s+B\/s)?)/i);
      if (spMatch && spMatch[1] && !spMatch[1].toLowerCase().includes('unknown')) {
        speed = formatSpeedToMBps(spMatch[1]);
        break;
      }
    }
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
    speed,
    eta: String(raw.eta || '--:--'),
    totalSize: String(totalSize),
    downloadedSize: String(downloadedSize),
    filename: raw.filename || raw.fileName || raw.file_name,
    filepath: raw.filepath || raw.filePath || raw.file_path,
    logs,
    error: raw.error || undefined,
    fullError: raw.fullError || raw.full_error || undefined,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    completedAt: typeof raw.completedAt === 'number' ? raw.completedAt : undefined,
    options: defaultOptions,
    upscaleHeight: raw.upscaleHeight || raw.upscale_height || rawOpts.upscaleHeight || undefined,
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
  ffprobe: true,
  ffprobeVersion: 'ffprobe active',
  ffmpegVersion: 'FFmpeg active',
  portableMode: true,
  downloadDir: './downloads',
  activeTasks: 0,
  queuedTasks: 0,
  totalDownloads: 0,
  os: 'Windows 11 Client GUI (Virtual Environment)'
};

export const api = {
  // Settings Persistence (config.json in application root)
  async getSettings(): Promise<{ options?: any; downloadDir?: string } | null> {
    if (isNativeTauri()) {
      try {
        const raw: any = await nativeInvoke('get_settings');
        if (raw && typeof raw === 'object') {
          return {
            options: raw.options || (raw.format || raw.naming || raw.sponsorblock ? raw : undefined),
            downloadDir: raw.downloadDir
          };
        }
      } catch (err) {
        console.warn('Native getSettings failed, trying HTTP fallback', err);
      }
    }
    const res = await safeFetchJson<any>('/api/settings', undefined, null);
    if (res && res.success) {
      return {
        options: res.options,
        downloadDir: res.downloadDir
      };
    }
    return null;
  },

  async saveSettings(options: any, downloadDir?: string): Promise<boolean> {
    if (isNativeTauri()) {
      try {
        const payload: Record<string, any> = { options };
        if (downloadDir) payload.downloadDir = downloadDir;
        await nativeInvoke('save_settings', { settings: payload });
        return true;
      } catch (err) {
        console.warn('Native saveSettings failed, trying HTTP fallback', err);
      }
    }
    const res = await safeFetchJson<any>('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options, downloadDir })
    }, { success: false });
    return !!res?.success;
  },

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
            ffprobe: raw.ffprobe !== undefined ? raw.ffprobe : (raw.ffprobe_installed || raw.ffprobeInstalled || false),
            ffprobeVersion: raw.ffprobeVersion || raw.ffprobe_version || '',
            ffmpegVersion: raw.ffmpegVersion || raw.ffmpeg_version || '',
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
    const res = await safeFetchJson<any>('/api/system-status', undefined, defaultStatus);
    if (res && typeof res === 'object') {
      return {
        ...res,
        ffprobe: res.ffprobe !== undefined ? res.ffprobe : (res.ffprobe_installed || res.ffprobeInstalled || false),
        ffprobeVersion: res.ffprobeVersion || res.ffprobe_version || '',
        ffmpeg: res.ffmpeg !== undefined ? res.ffmpeg : (res.ffmpeg_installed || res.ffmpegInstalled || false),
        ffmpegVersion: res.ffmpegVersion || res.ffmpeg_version || '',
      };
    }
    return res;
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

  // Pause Task
  async pauseTask(id: string): Promise<boolean> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke('pause_task', { id });
      } catch (err) {
        console.warn('Native pauseTask fallback', err);
      }
    }
    const res = await fetch(`/api/tasks/${id}/pause`, { method: 'POST' });
    return res.ok;
  },

  // Resume Task
  async resumeTask(id: string): Promise<boolean> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke('resume_task', { id });
      } catch (err) {
        console.warn('Native resumeTask fallback', err);
      }
    }
    const res = await fetch(`/api/tasks/${id}/resume`, { method: 'POST' });
    return res.ok;
  },

  // Pause All Tasks
  async pauseAll(): Promise<number> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke<number>('pause_all');
      } catch (err) {
        console.warn('Native pauseAll fallback', err);
      }
    }
    const res = await safeFetchJson<{ success: boolean; count?: number }>('/api/tasks/pause-all', { method: 'POST' });
    return res?.count || 0;
  },

  // Resume All Tasks
  async resumeAll(): Promise<number> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke<number>('resume_all');
      } catch (err) {
        console.warn('Native resumeAll fallback', err);
      }
    }
    const res = await safeFetchJson<{ success: boolean; count?: number }>('/api/tasks/resume-all', { method: 'POST' });
    return res?.count || 0;
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

  // Retry All Failed Tasks
  async retryAllFailed(): Promise<number> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke<number>('retry_all_failed');
      } catch (err) {
        console.warn('Native retryAllFailed fallback', err);
      }
    }
    const res = await safeFetchJson<{ success: boolean; count?: number }>('/api/tasks/retry-all-failed', { method: 'POST' });
    return res?.count || 0;
  },

  // Resume Queue
  async resumeQueue(): Promise<boolean> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke<boolean>('resume_queue');
      } catch (err) {
        console.warn('Native resumeQueue fallback', err);
      }
    }
    const res = await fetch('/api/tasks/resume-queue', { method: 'POST' });
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
    if (isNativeTauri()) {
      try {
        return await nativeInvoke<any[]>('get_downloaded_files');
      } catch (err) {
        console.warn('Native getDownloadedFiles fallback', err);
      }
    }
    return safeFetchJson<any[]>('/api/downloaded-files', undefined, []);
  },

  // Toggle portable mode safely
  async togglePortable(enabled: boolean): Promise<{ portableMode: boolean; downloadDir: string }> {
    if (isNativeTauri()) {
      return { portableMode: true, downloadDir: './downloads' };
    }
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
    if (isNativeTauri()) {
      try {
        const randId = Math.random().toString(36).substring(2, 13);
        const timestamp = Math.floor(Date.now() / 1000);
        const visitorData = btoa(`\n\u000b${randId}\u0012\n\u0008\u0001\u0010\u0001\u0018\u0001 \u0001(${timestamp}`);
        const tokenRandom = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
        const poToken = `web+Mn${tokenRandom}`;
        return { ok: true, poToken, visitorData };
      } catch (e: any) {
        return { ok: false, error: e?.message || 'Failed to mint PO token' };
      }
    }
    return safeFetchJson<{ ok: boolean; poToken?: string; visitorData?: string; error?: string }>(
      '/api/auth/generate-potoken',
      { method: 'POST' },
      { ok: false, error: 'Could not connect to authentication token service' }
    );
  },

  // Test anti-bot bypass
  async testBypass(auth: any): Promise<{ ok: boolean; message?: string; error?: string; isBotGuard?: boolean }> {
    if (isNativeTauri()) {
      try {
        const res: any = await nativeInvoke('extract_info', {
          url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
          auth
        });
        if (res && (res.title || res.formats)) {
          return { ok: true, message: 'Connection verified! YouTube stream accessible.' };
        }
        const err = res?.error || '';
        const isBot = err.toLowerCase().includes('bot') || err.toLowerCase().includes('sign in') || err.toLowerCase().includes('429');
        return { ok: false, error: err || 'Verification returned unexpected result', isBotGuard: isBot };
      } catch (e: any) {
        const errStr = String(e?.message || e);
        const isBot = errStr.toLowerCase().includes('bot') || errStr.toLowerCase().includes('sign in') || errStr.toLowerCase().includes('429');
        return { ok: false, error: errStr, isBotGuard: isBot };
      }
    }
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
    const base = (apiUrl || 'https://sponsor.ajay.app').replace(/\/+$/, '');
    try {
      const res = await fetch(`${base}/api/status`, { signal: AbortSignal.timeout(5000) });
      return { ok: res.ok };
    } catch {
      try {
        await fetch(base, { mode: 'no-cors', signal: AbortSignal.timeout(5000) });
        return { ok: true };
      } catch {}
      if (!isNativeTauri()) {
        return safeFetchJson<{ ok: boolean }>(
          '/api/sponsorblock/test',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiUrl }),
          },
          { ok: false }
        );
      }
      return { ok: false };
    }
  },

  // Open an external web link or release URL safely in the system default browser
  async openExternalUrl(url: string): Promise<void> {
    if (!url) return;
    if (isNativeTauri()) {
      try {
        await nativeInvoke('open_url', { url });
        return;
      } catch (err) {
        console.warn('Native open_url error, falling back:', err);
      }
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },

  // Delete a downloaded file from the filesystem
  async deleteFile(filename: string): Promise<boolean> {
    if (!filename) return false;
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (err) {
      console.warn('Failed to delete file:', err);
      return false;
    }
  },

  // Open a downloaded media file directly in Windows default installed media player
  async openMediaFile(target: string | { filepath?: string; taskId?: string; filename?: string }): Promise<boolean> {
    if (!target) return false;
    const params = typeof target === 'string'
      ? { filepath: target, taskId: undefined, filename: undefined }
      : target;

    if (isNativeTauri()) {
      try {
        return await nativeInvoke<boolean>('open_media_file', {
          filepath: params.filepath || null,
          taskId: params.taskId || null,
          task_id: params.taskId || null,
          filename: params.filename || null,
        });
      } catch (err: any) {
        console.warn('Native open_media_file error:', err);
        throw new Error(typeof err === 'string' ? err : err?.message || 'File not found on disk: the file may have been moved or deleted.');
      }
    }

    // Web fallback via local server endpoint
    try {
      const res = await fetch('/api/open-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) return true;
        if (data.error) throw new Error(data.error);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'File not found on disk: the file may have been moved or deleted.');
      }
    } catch (err) {
      console.warn('Server open-media error:', err);
      throw err;
    }

    return false;
  },

  // Highlight or select a file inside Windows File Explorer
  async showItemInFolder(target: string | { filepath?: string; taskId?: string; filename?: string }): Promise<boolean> {
    if (!target) return false;
    const params = typeof target === 'string'
      ? { filepath: target, taskId: undefined, filename: undefined }
      : target;

    if (isNativeTauri()) {
      try {
        const ok = await nativeInvoke<boolean>('show_item_in_folder', {
          filepath: params.filepath || null,
          taskId: params.taskId || null,
          task_id: params.taskId || null,
          filename: params.filename || null,
        });
        if (ok) return true;
      } catch (err) {
        console.warn('Native show_item_in_folder error:', err);
      }
    }

    // Web fallback via local server endpoint
    try {
      const res = await fetch('/api/show-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) return true;
      }
    } catch (err) {
      console.warn('Server show-item fallback error:', err);
    }

    // Fall back to opening the downloads folder directly
    try {
      await this.openDownloadFolder();
      return true;
    } catch {
      return false;
    }
  },

  // Check yt-dlp-client desktop software release updates from GitHub
  async checkAppUpdate(): Promise<AppUpdateInfo> {
    const currentVersion = APP_VERSION;
    try {
      const res = await fetch(APP_RELEASES_API, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'yt-dlp-client',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        if (res.status === 404) {
          return {
            currentVersion,
            latestVersion: currentVersion,
            hasUpdate: false,
            releaseName: `yt-dlp Client v${currentVersion}`,
            releaseTag: `v${currentVersion}`,
            releaseUrl: APP_RELEASES_URL,
            releaseNotes: 'Running official release.',
            assets: [],
            checkedAt: new Date().toISOString(),
          };
        }
        throw new Error(`GitHub API returned status ${res.status}`);
      }

      const data = await res.json();
      const tag = (data.tag_name || '').trim();
      const latestVersion = tag.replace(/^v/i, '') || currentVersion;
      const hasUpdate = isNewerVersion(latestVersion, currentVersion);

      const assets: AppReleaseAsset[] = Array.isArray(data.assets)
        ? data.assets.map((a: any) => ({
            name: a.name || 'Package',
            size: typeof a.size === 'number' ? a.size : 0,
            sizeFormatted: a.size ? formatBytes(a.size) : '-- MB',
            downloadUrl: a.browser_download_url || a.html_url || data.html_url,
            contentType: a.content_type,
          }))
        : [];

      return {
        currentVersion,
        latestVersion,
        hasUpdate,
        releaseName: data.name || tag || `v${latestVersion}`,
        releaseTag: tag || `v${latestVersion}`,
        releaseUrl: data.html_url || APP_RELEASES_URL,
        publishedAt: data.published_at,
        releaseNotes: data.body || 'No release notes provided.',
        assets,
        checkedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn('Failed to check app update:', err);
      return {
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        releaseName: `yt-dlp Client v${currentVersion}`,
        releaseTag: `v${currentVersion}`,
        releaseUrl: APP_RELEASES_URL,
        releaseNotes: 'Could not fetch release notes from GitHub.',
        assets: [],
        error: err?.message || 'Failed to check GitHub releases',
        checkedAt: new Date().toISOString(),
      };
    }
  },

  // Check yt-dlp core engine updates
  async checkEngineUpdate(): Promise<EngineUpdateInfo> {
    let currentVersion = '2026.08.19';
    let latestVersion = currentVersion;
    let hasUpdate = false;
    let releaseUrl = YTDLP_RELEASES_URL;
    let releaseNotes = 'Running native yt-dlp release.';

    if (isNativeTauri()) {
      try {
        const nativeData: any = await nativeInvoke<any>('check_update');
        if (nativeData?.currentVersion && nativeData.currentVersion !== 'Not detected') {
          currentVersion = nativeData.currentVersion;
          latestVersion = nativeData.currentVersion;
        }
      } catch (err) {
        console.warn('Native checkUpdate fallback', err);
      }
    } else {
      try {
        const status = await api.getSystemStatus();
        if (status?.version && status.version !== 'Not detected') {
          currentVersion = status.version;
          latestVersion = status.version;
        }
      } catch (e) {
        console.warn('Status check fallback', e);
      }
    }

    try {
      const res = await fetch(YTDLP_RELEASES_API, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'yt-dlp-client',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        const tag = (data.tag_name || '').trim();
        if (tag) {
          latestVersion = tag;
          releaseUrl = data.html_url || releaseUrl;
          releaseNotes = data.body || releaseNotes;
          hasUpdate = isNewerVersion(latestVersion, currentVersion);
        }
      }
    } catch (e) {
      console.warn('Could not query upstream yt-dlp releases:', e);
    }

    return {
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseNotes,
      releaseUrl,
      checkedAt: new Date().toISOString(),
    };
  },

  // Check update (alias for checkEngineUpdate for backward compatibility)
  async checkUpdate(): Promise<EngineUpdateInfo> {
    return this.checkEngineUpdate();
  },

  // Update engine safely
  async updateEngine(): Promise<{ success: boolean; version?: string; error?: string }> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke('update_engine');
      } catch (err) {
        console.warn('Native updateEngine fallback', err);
      }
    }
    return safeFetchJson<{ success: boolean; version?: string; error?: string }>(
      '/api/update-engine',
      { method: 'POST' },
      { success: false, error: 'Update service unavailable' }
    );
  },

  // Inspect media streams and metadata via ffprobe
  async inspectMedia(params: { filepath?: string; taskId?: string; filename?: string }): Promise<MediaProbeInfo> {
    if (isNativeTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<MediaProbeInfo>('inspect_media_file', {
          filepath: params.filepath || null,
          taskId: params.taskId || null,
          filename: params.filename || null,
        });
      } catch (err) {
        console.warn('Tauri inspect_media_file fallback to HTTP:', err);
      }
    }
    return safeFetchJson<MediaProbeInfo>(
      '/api/inspect-media',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      {
        filename: params.filename || 'Unknown',
        filepath: params.filepath || '',
        sizeBytes: 0,
        sizeFormatted: '0 MB',
        formatName: 'unknown',
        formatLongName: 'Unknown format',
        durationSeconds: 0,
        durationFormatted: '00:00',
        bitRateKbps: 0,
        hasCoverArt: false,
        tags: {},
        chapterCount: 0,
        isValid: false,
        error: 'Unable to analyze media streams with ffprobe'
      }
    );
  },

  async searchMedia(query: string, engine: SearchEngine = 'youtube', filter?: string, userAgent?: string): Promise<SearchResultItem[]> {
    const clean = query.trim();
    if (!clean) return [];

    // 1. First attempt HTTP Server backend (/api/search) - runs high-speed InnerTube API with 100% complete artist, album, duration, and studio track metadata
    try {
      const res = await safeFetchJson<{ success: boolean; results: SearchResultItem[] }>('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: clean, engine, filter, userAgent })
      }, { success: false, results: [] });
      if (res && res.success && Array.isArray(res.results) && res.results.length > 0) {
        return res.results;
      }
    } catch {}

    // 2. Native desktop Tauri execution (direct execution in native Windows desktop client)
    if (isNativeTauri()) {
      try {
        const results = await nativeInvoke<SearchResultItem[]>('search_media', {
          query: clean,
          engine,
          filter,
          userAgent
        });
        if (Array.isArray(results) && results.length > 0) {
          return results.map(item => {
            if (!item.thumbnail && item.id && !item.id.startsWith('UC') && !item.id.startsWith('MPRE') && !item.id.startsWith('VL') && !item.id.startsWith('PL')) {
              return { ...item, thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` };
            }
            return item;
          });
        }
      } catch (nativeErr) {
        console.warn('Native search_media fallback:', nativeErr);
      }
    }

    // 3. Direct client-side search fallbacks (InnerTube / SoundCloud direct)
    if (engine === 'soundcloud') {
      try {
        const results = await searchSoundCloud(clean, filter, userAgent);
        if (results && results.length > 0) {
          return results;
        }
      } catch (e) {
        console.warn('SoundCloud direct search fallback error:', e);
      }
    } else {
      try {
        const results = await searchInnerTube(clean, engine, filter, userAgent);
        if (results && results.length > 0) {
          return results;
        }
      } catch (e) {
        console.warn('InnerTube direct search fallback error:', e);
      }
    }

    return [];
  },

  async setWakeLock(enable: boolean): Promise<boolean> {
    // 1. Native desktop OS WakeLock via Tauri Windows API
    if (isNativeTauri()) {
      try {
        await nativeInvoke<boolean>('set_system_wakelock', { enable });
      } catch (e) {
        console.warn('Native wake lock error:', e);
      }
    } else {
      // HTTP server fallback
      try {
        await safeFetchJson('/api/power/wakelock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enable })
        }, { ok: false });
      } catch {}
    }

    // 2. Browser W3C Screen Wake Lock API
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (enable) {
          if (!(window as any).__activeScreenWakeLock) {
            const sentinel = await (navigator as any).wakeLock.request('screen');
            (window as any).__activeScreenWakeLock = sentinel;
            sentinel.addEventListener('release', () => {
              (window as any).__activeScreenWakeLock = null;
            });
          }
        } else {
          if ((window as any).__activeScreenWakeLock) {
            await (window as any).__activeScreenWakeLock.release();
            (window as any).__activeScreenWakeLock = null;
          }
        }
      } catch (err) {
        // WakeLock request can fail if page not visible or battery saver active
      }
    }

    return true;
  },

  async executePowerAction(action: PostDownloadAction): Promise<boolean> {
    if (!action || action === 'none') return true;

    if (isNativeTauri()) {
      try {
        return await nativeInvoke<boolean>('execute_power_action', { action });
      } catch (err) {
        console.error('Failed to execute native power action:', err);
        throw err;
      }
    }

    const res = await safeFetchJson<{ ok: boolean; error?: string }>('/api/power/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    }, { ok: false });

    if (!res.ok && res.error) {
      throw new Error(res.error);
    }
    return res.ok;
  },

  async abortPowerAction(): Promise<boolean> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke<boolean>('abort_power_action');
      } catch (err) {
        console.warn('Failed to abort native power action:', err);
        return false;
      }
    }

    const res = await safeFetchJson<{ ok: boolean }>('/api/power/abort', {
      method: 'POST'
    }, { ok: false });
    return Boolean(res.ok);
  },

  // Multi-tier resilient clipboard text reader:
  // 1. Tries standard navigator.clipboard.readText()
  // 2. Tries native Tauri IPC if available
  // 3. Tries backend server /api/clipboard/read (PowerShell/system fallback)
  async readClipboardText(): Promise<string> {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          return text.trim();
        }
      } catch {
        // Permission denied or document not focused in browser/webview
      }
    }

    if (isNativeTauri()) {
      try {
        const nativeText = await nativeInvoke<string>('read_clipboard');
        if (nativeText && nativeText.trim()) {
          return nativeText.trim();
        }
      } catch {}
    }

    try {
      const res = await safeFetchJson<{ text?: string }>('/api/clipboard/read', { method: 'GET' });
      if (res && typeof res.text === 'string' && res.text.trim()) {
        return res.text.trim();
      }
    } catch {}

    return '';
  }
};
