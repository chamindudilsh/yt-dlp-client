// Unified API Bridge supporting both Native Tauri Windows App and Web/Server mode

export const isNativeTauri = (): boolean => {
  return typeof window !== 'undefined' && Boolean(
    (window as any).__TAURI_INTERNALS__ || 
    (window as any).__TAURI__
  );
};

// Safe invoke wrapper that only attempts Tauri calls when native runtime exists
async function nativeInvoke<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// Safe helper to parse JSON response without throwing SyntaxError on HTML / non-JSON responses
async function safeFetchJson<T>(url: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new Error(`Unexpected non-JSON response from ${url}: ${text.slice(0, 100)}`);
    }
  } catch (err) {
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
        return await nativeInvoke('get_system_status');
      } catch (err) {
        console.warn('Native status fetch failed, trying HTTP fallback', err);
      }
    }
    return safeFetchJson('/api/system-status', undefined, defaultStatus);
  },

  // Task List
  async getTasks(): Promise<any[]> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke('get_tasks');
      } catch (err) {
        console.warn('Native getTasks failed, trying HTTP fallback', err);
      }
    }
    return safeFetchJson<any[]>('/api/tasks', undefined, []);
  },

  // Queue Tasks
  async queueTasks(items: any[], globalOptions: any): Promise<{ success: boolean; tasks: any[] }> {
    if (isNativeTauri()) {
      try {
        return await nativeInvoke('queue_tasks', { items, globalOptions });
      } catch (err) {
        console.warn('Native queueTasks fallback to HTTP', err);
      }
    }
    return safeFetchJson<{ success: boolean; tasks: any[] }>('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, globalOptions }),
    }, { success: false, tasks: [] });
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
          current,
          configured: current,
          defaultDir: '%USERPROFILE%\\Downloads',
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
      configured: '%USERPROFILE%\\Downloads',
      defaultDir: '%USERPROFILE%\\Downloads',
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
  }
};
