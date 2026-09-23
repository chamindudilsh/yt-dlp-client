import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { StatusBar } from './components/StatusBar';
import { BatchDownloader } from './components/BatchDownloader';
import { DownloadQueueManager, QueueStatusFilter } from './components/DownloadQueueManager';
import { SavedFilesLibrary } from './components/SavedFilesLibrary';
import { AlbumArtCropperModal } from './components/AlbumArtCropperModal';
import { UpdateModal } from './components/UpdateModal';
import { PortablePrivacyModal } from './components/PortablePrivacyModal';
import { CliCommandModal } from './components/CliCommandModal';
import { SettingsModal, SettingsTab } from './components/SettingsModal';
import { PowerActionCountdownModal } from './components/PowerActionCountdownModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ContextMenu } from './components/ContextMenu';
import { Copy, Scissors, Clipboard, CheckSquare, Trash2 } from 'lucide-react';
import { 
  SystemStatus, 
  DownloadTask, 
  TaskOptions,
  PostDownloadAction
} from './types';
import { api, isNativeWindowsDesktop } from './lib/apiBridge';
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
  playerClient: 'default',
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
  preventSystemSleep: true,
  postDownloadAction: 'none',
  postDownloadGraceSeconds: 60,
  limitRate: '',
  useAria2: false,
  aria2Connections: 16,
  maxConcurrentDownloads: 3,
  proxy: '',
  minimizeToTray: true,
  closeToTray: false,
  taskbarProgress: true,
  desktopNotifications: true,
  notifyOnComplete: true,
  notifyOnError: true,
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
  const [isPowerCountdownOpen, setIsPowerCountdownOpen] = useState(false);
  const [triggeredPowerAction, setTriggeredPowerAction] = useState<PostDownloadAction>('none');
  const wasDownloadingRef = useRef(false);
  const initialTasksLoadedRef = useRef(false);
  const knownTaskStatesRef = useRef<Map<string, string>>(new Map());

  // Cross-view interactivity state
  const [queueInitialFilter, setQueueInitialFilter] = useState<QueueStatusFilter>('all');
  const [initialSearchQuery, setInitialSearchQuery] = useState('');

  // Native input context menu state
  const [inputContextMenu, setInputContextMenu] = useState<{
    x: number;
    y: number;
    target: HTMLInputElement | HTMLTextAreaElement;
  } | null>(null);

  // Global right-click handler targeting inputs and textareas
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isInput = target.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'file', 'button', 'submit'].includes((target as HTMLInputElement).type);
      const isTextarea = target.tagName === 'TEXTAREA';
      if (isInput || isTextarea) {
        e.preventDefault();
        setInputContextMenu({
          x: e.clientX,
          y: e.clientY,
          target: target as HTMLInputElement | HTMLTextAreaElement,
        });
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const handleInputCut = (input: HTMLInputElement | HTMLTextAreaElement) => {
    try {
      const val = input.value;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      if (start !== end) {
        const text = val.substring(start, end);
        navigator.clipboard.writeText(text);
        input.setRangeText('', start, end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (e) {
      console.warn('Cut failed:', e);
    }
  };

  const handleInputCopy = (input: HTMLInputElement | HTMLTextAreaElement) => {
    try {
      const val = input.value;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const text = start !== end ? val.substring(start, end) : val;
      if (text) {
        navigator.clipboard.writeText(text);
      }
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleInputPaste = async (input: HTMLInputElement | HTMLTextAreaElement) => {
    try {
      input.focus();
      const text = await api.readClipboardText();
      if (text) {
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.setRangeText(text, start, end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        document.execCommand('paste');
      }
    } catch (e) {
      console.warn('Paste failed:', e);
    }
  };

  const handleInputClear = (input: HTMLInputElement | HTMLTextAreaElement) => {
    try {
      input.focus();
      input.setRangeText('', 0, input.value.length, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      console.warn('Clear failed:', e);
    }
  };

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

  // Pause task
  const handlePauseTask = async (id: string) => {
    try {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'paused', speed: 'Paused', eta: 'Paused' } : t));
      await api.pauseTask(id);
      await fetchTasks();
    } catch (e) {
      console.error('Pause task error:', e);
    }
  };

  // Resume task
  const handleResumeTask = async (id: string) => {
    try {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'queued', speed: '0.0 MBps', eta: '--:--' } : t));
      await api.resumeTask(id);
      await fetchTasks();
    } catch (e) {
      console.error('Resume task error:', e);
    }
  };

  // Pause all active tasks
  const handlePauseAll = async () => {
    try {
      setTasks(prev => prev.map(t => (t.status === 'downloading' || t.status === 'queued' || t.status === 'fetching') ? { ...t, status: 'paused', speed: 'Paused', eta: 'Paused' } : t));
      await api.pauseAll();
      await fetchTasks();
    } catch (e) {
      console.error('Pause all error:', e);
    }
  };

  // Resume all paused tasks
  const handleResumeAll = async () => {
    try {
      setTasks(prev => prev.map(t => t.status === 'paused' ? { ...t, status: 'queued', speed: '0.0 MBps', eta: '--:--' } : t));
      await api.resumeAll();
      await fetchTasks();
    } catch (e) {
      console.error('Resume all error:', e);
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

  // Retry all failed tasks
  const handleRetryAllFailed = async () => {
    try {
      await api.retryAllFailed();
      await fetchTasks();
    } catch (e) {
      console.error('Retry all failed error:', e);
    }
  };

  // Resume queue
  const handleResumeQueue = async () => {
    try {
      await api.resumeQueue();
      await fetchTasks();
    } catch (e) {
      console.error('Resume queue error:', e);
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

  // Calculate aggregate speed across active downloads in MBps
  const activeDownloads = tasks.filter(t => t.status === 'downloading');
  const totalSpeed = useMemo(() => {
    if (activeDownloads.length === 0) return '0.0 MBps';
    let sumMBps = 0;
    let hasNumericSpeed = false;

    for (const task of activeDownloads) {
      const match = (task.speed || '').match(/^([\d\.]+)\s*MBps$/i);
      if (match) {
        const val = parseFloat(match[1]);
        if (!isNaN(val)) {
          sumMBps += val;
          hasNumericSpeed = true;
        }
      }
    }

    if (hasNumericSpeed) {
      return sumMBps >= 100 ? `${sumMBps.toFixed(1)} MBps` : `${sumMBps.toFixed(2)} MBps`;
    }
    return activeDownloads[0]?.speed || '0.0 MBps';
  }, [activeDownloads]);

  const activeTasksCount = tasks.filter(t => t.status === 'downloading' || t.status === 'fetching' || t.status === 'converting').length;
  const queuedCount = tasks.filter(t => t.status === 'queued' || t.status === 'downloading' || t.status === 'converting').length;

  // Manage WakeLock (OS execution state + browser screen wake lock)
  useEffect(() => {
    const shouldWake = (options.preventSystemSleep ?? true) && activeTasksCount > 0;
    api.setWakeLock(shouldWake).catch(() => {});
  }, [activeTasksCount, options.preventSystemSleep]);

  // Detect queue completion transition to trigger scheduled power action (Windows Desktop Client Only)
  useEffect(() => {
    if (!isNativeWindowsDesktop()) return;
    if (activeTasksCount > 0) {
      wasDownloadingRef.current = true;
    } else if (wasDownloadingRef.current && activeTasksCount === 0) {
      wasDownloadingRef.current = false;
      const action = options.postDownloadAction || 'none';
      if (action !== 'none') {
        setTriggeredPowerAction(action);
        setIsPowerCountdownOpen(true);
      }
    }
  }, [activeTasksCount, options.postDownloadAction]);

  // Windows Taskbar Progress Indicator synchronization
  useEffect(() => {
    if (!isNativeWindowsDesktop()) return;
    if (options.taskbarProgress === false) {
      api.setTaskbarProgress(null, 'none').catch(() => {});
      return;
    }

    const downloadingTasks = tasks.filter(t => t.status === 'downloading');
    const fetchingTasks = tasks.filter(t => t.status === 'fetching' || t.status === 'converting');
    const pausedTasks = tasks.filter(t => t.status === 'paused');

    if (downloadingTasks.length > 0) {
      const totalPct = downloadingTasks.reduce((acc, t) => acc + (t.progress || 0), 0);
      const avgPct = Math.round(totalPct / downloadingTasks.length);
      api.setTaskbarProgress(avgPct, 'normal').catch(() => {});
    } else if (fetchingTasks.length > 0) {
      api.setTaskbarProgress(null, 'indeterminate').catch(() => {});
    } else if (pausedTasks.length > 0) {
      api.setTaskbarProgress(null, 'paused').catch(() => {});
    } else {
      api.setTaskbarProgress(null, 'none').catch(() => {});
    }
  }, [tasks, options.taskbarProgress]);

  // Native In-Process Desktop Notifications on Task Completion/Failure
  useEffect(() => {
    if (!initialTasksLoadedRef.current) {
      if (tasks.length > 0) {
        for (const t of tasks) {
          knownTaskStatesRef.current.set(t.id, t.status);
        }
        initialTasksLoadedRef.current = true;
      }
      return;
    }

    if (options.desktopNotifications === false) {
      for (const t of tasks) {
        knownTaskStatesRef.current.set(t.id, t.status);
      }
      return;
    }

    for (const task of tasks) {
      const prevState = knownTaskStatesRef.current.get(task.id);
      if (prevState && prevState !== task.status) {
        if (task.status === 'completed' && (options.notifyOnComplete ?? true)) {
          const formatLabel = task.format ? ` (${task.format})` : '';
          api.showDesktopNotification({
            title: 'Download Completed',
            body: `${task.title}${formatLabel} finished successfully.`,
            filePath: task.filepath,
            folderPath: options.downloadDir || systemStatus?.downloadDir,
          }).catch(() => {});
        } else if (task.status === 'error' && (options.notifyOnError ?? true)) {
          api.showDesktopNotification({
            title: 'Download Failed',
            body: `Error downloading "${task.title}": ${task.error || 'Check task logs'}`,
          }).catch(() => {});
        }
      }
      knownTaskStatesRef.current.set(task.id, task.status);
    }
  }, [tasks, options.desktopNotifications, options.notifyOnComplete, options.notifyOnError, options.downloadDir, systemStatus?.downloadDir]);

  const handleExecutePowerAction = async () => {
    setIsPowerCountdownOpen(false);
    try {
      await api.executePowerAction(triggeredPowerAction);
    } catch (err) {
      console.error('Failed to execute power action:', err);
    }
  };

  const handleCancelPowerAction = async () => {
    setIsPowerCountdownOpen(false);
    try {
      await api.abortPowerAction();
    } catch {}
    setOptions(prev => ({ ...prev, postDownloadAction: 'none' }));
  };

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
              initialSearchQuery={initialSearchQuery}
              onClearInitialSearchQuery={() => setInitialSearchQuery('')}
            />
          )}

          {activeTab === 'queue' && (
            <DownloadQueueManager
              tasks={tasks}
              onCancelTask={handleCancelTask}
              onRetryTask={handleRetryTask}
              onPauseTask={handlePauseTask}
              onResumeTask={handleResumeTask}
              onPauseAll={handlePauseAll}
              onResumeAll={handleResumeAll}
              onRetryAllFailed={handleRetryAllFailed}
              onResumeQueue={handleResumeQueue}
              onClearCompleted={handleClearCompleted}
              onSwitchToLibrary={() => setActiveTab('library')}
              onOpenSettings={(tab) => {
                if (tab) setSettingsInitialTab(tab as any);
                setIsSettingsModalOpen(true);
              }}
              onSearchArtist={(artist) => {
                setInitialSearchQuery(artist);
                setActiveTab('download');
              }}
              onOpenAlbumArtModal={(url, title, artist) => {
                setAlbumArtData({ url, title, artist });
                setIsAlbumArtModalOpen(true);
              }}
              initialFilter={queueInitialFilter}
              postDownloadAction={options.postDownloadAction}
              onUpdatePostDownloadAction={(act) => setOptions(prev => ({ ...prev, postDownloadAction: act }))}
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
        pausedCount={tasks.filter(t => t.status === 'paused').length}
        totalSpeed={totalSpeed}
        limitRate={options.limitRate}
        onSetLimitRate={(rate) => {
          setOptions(prev => ({ ...prev, limitRate: rate }));
        }}
        onOpenSettingsModal={() => {
          setSettingsInitialTab('download');
          setIsSettingsModalOpen(true);
        }}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onOpenPortableModal={() => setIsPortableModalOpen(true)}
        onSelectTab={(tab, filter) => {
          setActiveTab(tab);
          if (filter) {
            setQueueInitialFilter(filter);
          }
        }}
      />

      {/* 1:1 Aspect Ratio Album Art Cropper Modal */}
      <AlbumArtCropperModal
        isOpen={isAlbumArtModalOpen}
        onClose={() => setIsAlbumArtModalOpen(false)}
        thumbnailUrl={albumArtData.url}
        songTitle={albumArtData.title}
        artistName={albumArtData.artist}
        currentCropFocus={options.cropFocus || 'center'}
        currentCropOffsetPercent={options.cropOffsetPercent}
        onSaveCropFocus={(focus, offsetPercent) => {
          setOptions(prev => ({
            ...prev,
            cropFocus: focus,
            cropOffsetPercent: offsetPercent,
            audioCropThumbnailSquare: true,
          }));
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
        url=""
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

      {/* Post-Download Power Action Countdown Modal (Native Windows Desktop Only) */}
      {isNativeWindowsDesktop() && (
        <PowerActionCountdownModal
          isOpen={isPowerCountdownOpen}
          action={triggeredPowerAction}
          graceSeconds={options.postDownloadGraceSeconds || 60}
          onExecute={handleExecutePowerAction}
          onCancel={handleCancelPowerAction}
        />
      )}

      {/* Native-style Context Menu for Input and Textarea elements */}
      {inputContextMenu && (
        <ContextMenu
          x={inputContextMenu.x}
          y={inputContextMenu.y}
          onClose={() => setInputContextMenu(null)}
          items={[
            {
              id: 'cut',
              label: 'Cut',
              icon: <Scissors size={14} className="text-zinc-400" />,
              shortcut: 'Ctrl+X',
              disabled: (inputContextMenu.target.selectionStart === inputContextMenu.target.selectionEnd) || inputContextMenu.target.readOnly,
              action: () => handleInputCut(inputContextMenu.target),
              onClick: () => handleInputCut(inputContextMenu.target),
            },
            {
              id: 'copy',
              label: 'Copy',
              icon: <Copy size={14} className="text-zinc-400" />,
              shortcut: 'Ctrl+C',
              disabled: (!inputContextMenu.target.value),
              action: () => handleInputCopy(inputContextMenu.target),
              onClick: () => handleInputCopy(inputContextMenu.target),
            },
            {
              id: 'paste',
              label: 'Paste',
              icon: <Clipboard size={14} className="text-blue-400" />,
              shortcut: 'Ctrl+V',
              disabled: inputContextMenu.target.readOnly,
              action: () => handleInputPaste(inputContextMenu.target),
              onClick: () => handleInputPaste(inputContextMenu.target),
            },
            { separator: true },
            {
              id: 'select-all',
              label: 'Select All',
              icon: <CheckSquare size={14} className="text-zinc-400" />,
              shortcut: 'Ctrl+A',
              disabled: !inputContextMenu.target.value,
              action: () => {
                inputContextMenu.target.focus();
                inputContextMenu.target.select();
              },
              onClick: () => {
                inputContextMenu.target.focus();
                inputContextMenu.target.select();
              },
            },
            {
              id: 'clear',
              label: 'Clear',
              icon: <Trash2 size={14} className="text-red-400" />,
              danger: true,
              disabled: !inputContextMenu.target.value || inputContextMenu.target.readOnly,
              action: () => handleInputClear(inputContextMenu.target),
              onClick: () => handleInputClear(inputContextMenu.target),
            },
          ]}
        />
      )}
    </div>
  );
}
