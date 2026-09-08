import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { StatusBar } from './components/StatusBar';
import { BatchDownloader } from './components/BatchDownloader';
import { DownloadQueueManager } from './components/DownloadQueueManager';
import { SavedFilesLibrary } from './components/SavedFilesLibrary';
import { AlbumArtCropperModal } from './components/AlbumArtCropperModal';
import { UpdateModal } from './components/UpdateModal';
import { PortablePrivacyModal } from './components/PortablePrivacyModal';
import { CliCommandModal } from './components/CliCommandModal';
import { SettingsModal, SettingsTab } from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  SystemStatus, 
  DownloadTask, 
  TaskOptions 
} from './types';
import { api } from './lib/apiBridge';
import { APP_VERSION, DEFAULT_USER_AGENT } from './constants/app';

const YTDL_SETTINGS_KEY = 'ytdl_windows_settings';

const defaultOptions: TaskOptions = {
  namingTemplate: '%(title)s - %(artist,uploader)s.%(ext)s',
  defaultAudioFormat: 'best',
  defaultMediaType: 'video',
  userAgent: DEFAULT_USER_AGENT,
  subtitles: {
    enabled: false,
    langs: 'en.*',
    embed: false,
    keepSubs: false,
    autoSubs: true,
    format: 'best',
  },
  auth: {
    cookieSource: 'none',
    browser: 'chrome',
    browserProfile: 'Default',
    playerClient: 'default',
    enablePoToken: false,
  },
  sponsorblock: {
    enabled: true,
    categories: ['sponsor', 'intro', 'outro', 'selfpromo', 'interaction'],
    action: 'remove',
    categoryActions: {
      sponsor: 'remove',
      intro: 'remove',
      outro: 'remove',
      selfpromo: 'remove',
      interaction: 'remove',
      music_offtopic: 'off',
      preview: 'off',
      filler: 'off',
      poi_highlight: 'off',
    },
    apiUrl: 'https://sponsor.ajay.app',
  },
  audioCropThumbnailSquare: true, // "crop thumbnail by 1:1 aspect ratio"
  cropFocus: 'center',
  embedMetadata: true, // "tags, titles, and artist info for every audio file"
  fileCollisionAction: 'number',
};

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'download' | 'queue' | 'library'>('download');

  // Core System & Queue States
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  // Configurable Options with Local Storage + Application Root config.json persistence
  const [options, setOptions] = useState<TaskOptions>(() => {
    try {
      const cached = localStorage.getItem(YTDL_SETTINGS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return { ...defaultOptions, ...parsed };
      }
    } catch (e) {
      console.warn('Local storage parse error:', e);
    }
    return defaultOptions;
  });

  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  // Modals state
  const [isAlbumArtModalOpen, setIsAlbumArtModalOpen] = useState(false);
  const [albumArtData, setAlbumArtData] = useState<{ url: string; title?: string; artist?: string }>({
    url: '',
    title: '',
    artist: ''
  });

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isPortableModalOpen, setIsPortableModalOpen] = useState(false);
  const [isCliModalOpen, setIsCliModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('selection');

  // 1. Initial Load of settings from application root config.json
  useEffect(() => {
    let active = true;
    api.getSettings()
      .then(saved => {
        if (!active) return;
        if (saved && saved.options && typeof saved.options === 'object') {
          setOptions(prev => {
            const merged = { ...prev, ...saved.options };
            try {
              localStorage.setItem(YTDL_SETTINGS_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(err => {
        console.warn('Failed to load settings from config.json:', err);
      })
      .finally(() => {
        if (active) setIsSettingsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  // 2. Persist settings whenever options change (debounced to avoid excessive writes)
  useEffect(() => {
    if (!isSettingsLoaded) return;

    try {
      localStorage.setItem(YTDL_SETTINGS_KEY, JSON.stringify(options));
    } catch {}

    const timer = setTimeout(() => {
      api.saveSettings(options).catch(err => {
        console.warn('Auto-save settings to config.json failed:', err);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [options, isSettingsLoaded]);

  // Fetch System Status
  const fetchStatus = async () => {
    try {
      const data = await api.getSystemStatus();
      if (data && typeof data === 'object') {
        setSystemStatus(data);
      }
    } catch (e) {
      console.warn('Status fetch notice:', e);
    }
  };

  // Fetch Tasks
  const fetchTasks = async () => {
    try {
      const data = await api.getTasks();
      if (Array.isArray(data)) {
        setTasks(data);
      }
    } catch (e) {
      console.warn('Tasks fetch notice:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchTasks();

    const interval = setInterval(() => {
      fetchTasks();
      fetchStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Queue new items
  const handleQueueTasks = async (items: any[], globalOptions: TaskOptions) => {
    try {
      const data = await api.queueTasks(items, globalOptions);
      if (data && data.success && Array.isArray(data.tasks) && data.tasks.length > 0) {
        setTasks(prev => {
          const map = new Map(prev.map(t => [t.id, t]));
          for (const t of data.tasks) {
            map.set(t.id, t);
          }
          return Array.from(map.values());
        });
      }
      await fetchTasks();
      setActiveTab('queue'); // Switch to active queue to monitor
    } catch (e) {
      console.error('Queue task error:', e);
      await fetchTasks();
      setActiveTab('queue');
    }
  };

  // Cancel task
  const handleCancelTask = async (id: string) => {
    try {
      await api.cancelTask(id);
      await fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  // Retry task
  const handleRetryTask = async (id: string) => {
    try {
      await api.retryTask(id);
      await fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  // Clear completed
  const handleClearCompleted = async () => {
    try {
      await api.clearCompleted();
      await fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Portable Mode
  const handleTogglePortable = async (enabled: boolean) => {
    try {
      const data = await api.togglePortable(enabled);
      if (systemStatus) {
        setSystemStatus({
          ...systemStatus,
          portableMode: data.portableMode,
          downloadDir: data.downloadDir,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Open 1:1 Album Art Cropper Modal
  const handleOpenAlbumArtModal = (url: string, title?: string, artist?: string) => {
    setAlbumArtData({ url, title, artist });
    setIsAlbumArtModalOpen(true);
  };

  // Calculate aggregate speed
  const activeDownloads = tasks.filter(t => t.status === 'downloading');
  const totalSpeed = activeDownloads.length > 0 
    ? activeDownloads[0].speed 
    : '0.0 KB/s';

  const queuedCount = tasks.filter(t => t.status === 'queued' || t.status === 'downloading' || t.status === 'converting').length;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0e14] text-slate-100 font-sans overflow-hidden select-none antialiased">
      {/* Title Bar */}
      <TitleBar
        systemStatus={systemStatus}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onOpenPortableModal={() => setIsPortableModalOpen(true)}
        onOpenCliModal={() => setIsCliModalOpen(true)}
        onOpenSettingsModal={() => {
          setSettingsInitialTab('download');
          setIsSettingsModalOpen(true);
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        queuedCount={queuedCount}
      />

      {/* Main Client Workspace */}
      <main className="flex-1 overflow-y-auto p-4 md:p-5 bg-[#0e1219]">
        <ErrorBoundary fallbackTitle="View Rendering Issue" onReset={() => setActiveTab('download')}>
          {activeTab === 'download' && (
            <BatchDownloader
              onQueueTasks={handleQueueTasks}
              onOpenAlbumArtModal={handleOpenAlbumArtModal}
              onOpenSettings={(tab) => {
                if (tab) setSettingsInitialTab(tab);
                setIsSettingsModalOpen(true);
              }}
              options={options}
              setOptions={setOptions}
              downloadDir={systemStatus?.downloadDir}
            />
          )}

          {activeTab === 'queue' && (
            <DownloadQueueManager
              tasks={tasks}
              onCancelTask={handleCancelTask}
              onRetryTask={handleRetryTask}
              onClearCompleted={handleClearCompleted}
              onSwitchToLibrary={() => setActiveTab('library')}
              onOpenSettings={(tab) => {
                if (tab) setSettingsInitialTab(tab as any);
                setIsSettingsModalOpen(true);
              }}
            />
          )}

          {activeTab === 'library' && (
            <SavedFilesLibrary
              downloadDir={systemStatus?.downloadDir || '%USERPROFILE%\\Downloads'}
              onSwitchToDownloader={() => setActiveTab('download')}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Windows 11 Bottom Status Bar */}
      <StatusBar
        systemStatus={systemStatus}
        activeCount={activeDownloads.length}
        queuedCount={tasks.filter(t => t.status === 'queued').length}
        totalSpeed={totalSpeed}
        onOpenSettingsModal={() => {
          setSettingsInitialTab('download');
          setIsSettingsModalOpen(true);
        }}
        onSelectTab={setActiveTab}
      />

      {/* 1:1 Aspect Ratio Album Art Cropper Modal */}
      <AlbumArtCropperModal
        isOpen={isAlbumArtModalOpen}
        onClose={() => setIsAlbumArtModalOpen(false)}
        thumbnailUrl={albumArtData.url}
        songTitle={albumArtData.title}
        artistName={albumArtData.artist}
        currentCropFocus={options.cropFocus || 'center'}
        onSaveCropFocus={(focus) => {
          setOptions(prev => ({ ...prev, cropFocus: focus, audioCropThumbnailSquare: true }));
        }}
      />

      {/* Auto-Update Engine and Software Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentVersion={systemStatus?.version || '2026.08.19'}
        appVersion={APP_VERSION}
      />

      {/* Portable Mode & Data Privacy Modal */}
      <PortablePrivacyModal
        isOpen={isPortableModalOpen}
        onClose={() => setIsPortableModalOpen(false)}
        systemStatus={systemStatus}
        onTogglePortable={handleTogglePortable}
      />

      {/* Windows CLI Command Inspector Modal */}
      <CliCommandModal
        isOpen={isCliModalOpen}
        onClose={() => setIsCliModalOpen(false)}
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        type="video"
        format="best"
        options={options}
      />

      {/* Full Client Settings Modal (YTDLnis-style Segment Selector & Configuration) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        options={options}
        setOptions={setOptions}
        systemStatus={systemStatus}
        initialTab={settingsInitialTab}
      />
    </div>
  );
}
