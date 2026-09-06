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
import { 
  SystemStatus, 
  DownloadTask, 
  TaskOptions 
} from './types';
import { api } from './lib/apiBridge';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'download' | 'queue' | 'library'>('download');

  // Core System & Queue States
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  // Configurable Options
  const [options, setOptions] = useState<TaskOptions>({
    namingTemplate: '%(title)s [%(id)s].%(ext)s',
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
  });

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
      if (data.success) {
        await fetchTasks();
        setActiveTab('queue'); // Switch to active queue to monitor
      }
    } catch (e) {
      console.error('Queue task error:', e);
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
    <div className="flex flex-col h-screen w-screen bg-[#090b10] text-slate-100 font-sans overflow-hidden select-none">
      {/* Windows 11 Fluent Dark Title Bar */}
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
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-b from-[#0e1118] to-[#090b10]">
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

      {/* Auto-Update Engine Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentVersion={systemStatus?.version || '2026.08.19'}
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
