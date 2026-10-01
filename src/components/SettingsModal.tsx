import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Settings, 
  ShieldAlert, 
  Crop, 
  FileText, 
  Subtitles, 
  HardDrive, 
  Check, 
  RotateCcw, 
  Scissors, 
  Bookmark, 
  PowerOff, 
  Info, 
  Server, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Copy, 
  Film, 
  Music, 
  Cookie, 
  KeyRound, 
  Fingerprint, 
  RefreshCw, 
  Upload, 
  FolderDown, 
  FolderOpen,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Globe,
  Github,
  Tag,
  Smartphone,
  Zap,
  Gauge,
  Layers,
  Bell,
  Monitor,
  Send,
  Archive,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  Eye,
  CheckCheck
} from 'lucide-react';
import { 
  TaskOptions, 
  SponsorBlockAction, 
  SystemStatus,
  DownloadDirInfo,
  PostDownloadAction
} from '../types';
import { 
  SPONSORBLOCK_CATEGORIES, 
  SPONSORBLOCK_PRESETS 
} from '../constants/sponsorblock';
import { api, isNativeWindowsDesktop, isNativeTauri } from '../lib/apiBridge';
import { 
  APP_NAME, 
  APP_VERSION, 
  APP_REPO, 
  APP_HOMEPAGE_URL,
  APP_PRIVACY_URL,
  APP_DISCLAIMER,
  APP_RELEASES_URL,
  DEFAULT_USER_AGENT
} from '../constants/app';
import { PLAYER_CLIENTS, getPlayerClientInfo } from '../constants/playerClients';

export type SettingsTab = 
  | 'storage'
  | 'formats'
  | 'downloads'
  | 'subtitles'
  | 'cookies'
  | 'desktop'
  | 'info'
  // Backward compatibility aliases
  | 'general' 
  | 'download' 
  | 'selection' 
  | 'audio' 
  | 'naming' 
  | 'sponsorblock' 
  | 'advanced'
  | 'network'
  | 'auth'
  | 'power'
  | 'about';

type CoreTabId = 'storage' | 'formats' | 'downloads' | 'subtitles' | 'cookies' | 'desktop' | 'info';

interface CoreTabDef {
  id: CoreTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  keywords: string;
}

const CORE_TABS: CoreTabDef[] = [
  {
    id: 'storage',
    label: 'Storage & Naming',
    icon: FolderDown,
    description: 'Download location, filename templates & archive',
    color: 'text-sky-400',
    keywords: 'storage folder directory path naming template rename collision duplicate archive download-archive explorer location',
  },
  {
    id: 'formats',
    label: 'Media & Quality',
    icon: Sliders,
    description: 'Video resolution, audio presets & album art',
    color: 'text-violet-400',
    keywords: 'format media quality resolution video 4k 1080p 720p audio mp3 m4a opus flac wav crop album art thumbnail id3 metadata tags chapters',
  },
  {
    id: 'downloads',
    label: 'Downloads & Engine',
    icon: Zap,
    description: 'Concurrency, speed limits, aria2 & proxy',
    color: 'text-amber-400',
    keywords: 'concurrent parallel queue toast switch aria2 speed limit bandwidth rate user-agent proxy socks5 network engine simplify connections',
  },
  {
    id: 'subtitles',
    label: 'SponsorBlock & Subtitles',
    icon: ShieldAlert,
    description: 'SponsorBlock skipping, captions & subtitles',
    color: 'text-amber-400',
    keywords: 'sponsorblock sponsor skip mark intro outro ajay segments categories subtitles captions write-auto-subs embed keep-subs delete clean standalone',
  },
  {
    id: 'cookies',
    label: 'Auth & Anti-Bot',
    icon: Cookie,
    description: 'BotGuard bypass, player clients & cookies',
    color: 'text-emerald-400',
    keywords: 'cookies auth botguard 429 bypass po-token visitor player client persona android ios tv web netscape session login account rate limit',
  },
  {
    id: 'desktop',
    label: 'Desktop & Power',
    icon: Monitor,
    description: 'System tray, alerts, taskbar & sleep/shutdown',
    color: 'text-rose-400',
    keywords: 'desktop tray minimize close taskbar progress notification alert bell sleep wakelock shutdown hibernate power post-download countdown',
  },
  {
    id: 'info',
    label: 'About & Diagnostics',
    icon: Info,
    description: 'App version, toolchain health & diagnostics',
    color: 'text-cyan-400',
    keywords: 'about info version diagnostic system ytdlp ffmpeg ffprobe aria2 runtime github license updates dependencies credits',
  },
];

function resolveCoreTab(tab?: string): CoreTabId {
  switch (tab) {
    case 'storage':
    case 'general':
    case 'download':
    case 'naming':
      return 'storage';
    case 'formats':
    case 'selection':
    case 'audio':
      return 'formats';
    case 'downloads':
    case 'advanced':
    case 'network':
      return 'downloads';
    case 'subtitles':
    case 'sponsorblock':
      return 'subtitles';
    case 'cookies':
    case 'auth':
      return 'cookies';
    case 'desktop':
    case 'power':
      return 'desktop';
    case 'info':
    case 'about':
      return 'info';
    default:
      return 'storage';
  }
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: TaskOptions;
  setOptions: React.Dispatch<React.SetStateAction<TaskOptions>>;
  systemStatus: SystemStatus | null;
  initialTab?: SettingsTab;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  options,
  setOptions,
  systemStatus,
  initialTab = 'storage',
}) => {
  const [activeTab, setActiveTab] = useState<CoreTabId>(() => resolveCoreTab(initialTab));
  const [searchQuery, setSearchQuery] = useState('');
  const [apiTestStatus, setApiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [customApiUrl, setCustomApiUrl] = useState(options.sponsorblock?.apiUrl || 'https://sponsor.ajay.app');

  // Download Directory State
  const [downloadDirInfo, setDownloadDirInfo] = useState<DownloadDirInfo | null>(null);
  const [inputDir, setInputDir] = useState('');
  const [savingDir, setSavingDir] = useState(false);
  const [dirFeedback, setDirFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [openingFolder, setOpeningFolder] = useState(false);

  // Auth / Cookies / PO Token State
  const [generatingPoToken, setGeneratingPoToken] = useState(false);
  const [poTokenFeedback, setPoTokenFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [cookiesContent, setCookiesContent] = useState('');
  const [cookiesServerStatus, setCookiesServerStatus] = useState<{ exists: boolean; count: number; content?: string } | null>(null);
  const [savingCookies, setSavingCookies] = useState(false);
  const [testingBypass, setTestingBypass] = useState(false);
  const [bypassResult, setBypassResult] = useState<{ ok: boolean; message: string; isBotGuard?: boolean } | null>(null);

  // Diagnostics & Notification State
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);
  const [copiedAria2Command, setCopiedAria2Command] = useState(false);
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [archiveStats, setArchiveStats] = useState<{ count: number; path: string; exists: boolean } | null>(null);
  const [clearingArchive, setClearingArchive] = useState(false);
  const [confirmClearArchive, setConfirmClearArchive] = useState(false);
  const [archiveClearedFeedback, setArchiveClearedFeedback] = useState(false);

  // Sync initial tab if changed from caller
  useEffect(() => {
    if (initialTab) {
      setActiveTab(resolveCoreTab(initialTab));
    }
  }, [initialTab]);

  const loadArchiveStats = async () => {
    try {
      const stats = await api.getArchiveStats(options.downloadArchivePath);
      setArchiveStats(stats);
    } catch {}
  };

  useEffect(() => {
    if (isOpen && activeTab === 'storage') {
      loadArchiveStats();
    }
  }, [isOpen, activeTab, options.downloadArchivePath]);

  const refreshDownloadDirInfo = async () => {
    try {
      const info = await api.getDownloadDir();
      setDownloadDirInfo(info);
      setInputDir(info.configured || info.current || '%USERPROFILE%\\Downloads');
    } catch (e) {
      console.warn('Failed to load download dir info', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshDownloadDirInfo();
      api.getCookies()
        .then(data => {
          if (data) {
            setCookiesServerStatus(data);
            if (data.content && !cookiesContent) {
              setCookiesContent(data.content);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleClearArchive = async () => {
    setClearingArchive(true);
    await api.clearArchive(options.downloadArchivePath);
    await loadArchiveStats();
    setClearingArchive(false);
    setConfirmClearArchive(false);
    setArchiveClearedFeedback(true);
    setTimeout(() => setArchiveClearedFeedback(false), 3000);
  };

  const handleSendTestNotification = async () => {
    setTestNotificationSent(true);
    await api.requestNotificationPermission();
    await api.showDesktopNotification({
      title: 'yt-dlp Client',
      body: 'Notifications are active and working properly.',
      icon: '/icon.png',
      folderPath: inputDir || '%USERPROFILE%\\Downloads',
    });
    setTimeout(() => setTestNotificationSent(false), 3500);
  };

  const handleCopyDiagnostics = () => {
    const diag = {
      app: {
        name: APP_NAME,
        version: APP_VERSION,
        repo: APP_REPO,
      },
      system: {
        environment: isNativeWindowsDesktop() ? 'Windows Native Desktop' : isNativeTauri() ? 'Desktop Client (Tauri)' : 'Web Browser',
        os: isNativeWindowsDesktop() ? 'Windows Native (Tauri)' : (systemStatus?.os || navigator.platform),
        portableMode: Boolean(systemStatus?.portableMode),
        downloadDir: systemStatus?.downloadDir || '',
      },
      binaries: {
        ytdlpVersion: systemStatus?.version || 'Not detected',
        ytdlpInstalled: Boolean(systemStatus?.ytdlp_installed ?? (systemStatus?.version && systemStatus?.version !== 'Not detected')),
        ffmpegInstalled: Boolean(systemStatus?.ffmpeg ?? systemStatus?.ffmpeg_installed),
        ffprobeInstalled: Boolean(systemStatus?.ffprobe),
        ffprobeVersion: systemStatus?.ffprobeVersion || 'Not detected',
        aria2Installed: Boolean(systemStatus?.aria2c),
        aria2Version: systemStatus?.aria2cVersion || 'Not detected',
      },
      timestamp: new Date().toISOString(),
    };
    try {
      navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
      setCopiedDiagnostics(true);
      setTimeout(() => setCopiedDiagnostics(false), 2500);
    } catch (e) {
      console.warn('Could not copy diagnostics:', e);
    }
  };

  const handleSaveDownloadDir = async (customPath?: string) => {
    const target = (customPath !== undefined ? customPath : inputDir).trim();
    if (!target) {
      setDirFeedback({ type: 'error', message: 'Download path cannot be empty' });
      return;
    }
    setSavingDir(true);
    setDirFeedback(null);
    try {
      const res = await api.setDownloadDir(target);
      if (res.success) {
        setDirFeedback({ type: 'success', message: 'Download location saved' });
        await refreshDownloadDirInfo();
      } else {
        setDirFeedback({ type: 'error', message: res.error || 'Failed to update download location' });
      }
    } catch (e: any) {
      setDirFeedback({ type: 'error', message: e.message || 'Error updating download directory' });
    } finally {
      setSavingDir(false);
    }
  };

  const handleResetDownloadDir = async () => {
    setSavingDir(true);
    setDirFeedback(null);
    try {
      await api.resetDownloadDir();
      setDirFeedback({ type: 'success', message: 'Reset to default (%USERPROFILE%\\Downloads)' });
      await refreshDownloadDirInfo();
    } catch (e: any) {
      setDirFeedback({ type: 'error', message: e.message || 'Failed to reset download location' });
    } finally {
      setSavingDir(false);
    }
  };

  const handleOpenDownloadFolder = async () => {
    setOpeningFolder(true);
    try {
      await api.openDownloadFolder();
    } catch (e) {
      console.warn('Error opening download folder', e);
    } finally {
      setTimeout(() => setOpeningFolder(false), 800);
    }
  };

  const handleGeneratePoToken = async () => {
    setGeneratingPoToken(true);
    setPoTokenFeedback(null);
    try {
      const data = await api.generatePoToken();
      if (data.ok) {
        setOptions(prev => ({
          ...prev,
          auth: {
            ...prev.auth,
            cookieSource: prev.auth?.cookieSource || 'none',
            poToken: data.poToken,
            visitorData: data.visitorData,
            enablePoToken: true,
          }
        }));
        setPoTokenFeedback({
          ok: true,
          msg: `Generated Web Client PO Token & Visitor Data`
        });
      } else {
        setPoTokenFeedback({ ok: false, msg: data.error || 'Failed to generate Web Client PO token.' });
      }
    } catch (e: any) {
      setPoTokenFeedback({ ok: false, msg: e.message || 'Network error generating PO token.' });
    } finally {
      setGeneratingPoToken(false);
    }
  };

  const handleSaveCookies = async () => {
    if (!cookiesContent.trim()) return;
    setSavingCookies(true);
    try {
      const data = await api.saveCookies(cookiesContent);
      if (data.ok) {
        setCookiesServerStatus({ exists: true, count: data.count, content: cookiesContent });
        setOptions(prev => ({
          ...prev,
          auth: {
            ...prev.auth,
            cookieSource: 'text',
            cookieContent: cookiesContent
          }
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingCookies(false);
    }
  };

  const handleClearCookies = async () => {
    try {
      await api.clearCookies();
      setCookiesServerStatus({ exists: false, count: 0, content: '' });
      setCookiesContent('');
      setOptions(prev => ({
        ...prev,
        auth: {
          ...prev.auth,
          cookieSource: 'none',
          cookieContent: ''
        }
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUploadCookies = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      if (text) {
        setCookiesContent(text);
      }
    };
    reader.readAsText(file);
  };

  const handleTestBypass = async () => {
    setTestingBypass(true);
    setBypassResult(null);
    try {
      const data = await api.testBypass(options.auth);
      if (data.ok) {
        setBypassResult({
          ok: true,
          message: 'Connection verified! YouTube stream accessible.'
        });
      } else {
        setBypassResult({
          ok: false,
          message: data.error || 'YouTube returned a restricted response.',
          isBotGuard: data.isBotGuard
        });
      }
    } catch (e: any) {
      setBypassResult({ ok: false, message: e.message || 'Connection test failed.' });
    } finally {
      setTestingBypass(false);
    }
  };

  const handleCategoryActionChange = (categoryId: string, action: SponsorBlockAction) => {
    const updatedActions = {
      ...options.sponsorblock.categoryActions,
      [categoryId]: action,
    };

    const removeCats = Object.entries(updatedActions)
      .filter(([_, act]) => act === 'remove')
      .map(([id]) => id);

    setOptions(prev => ({
      ...prev,
      sponsorblock: {
        ...prev.sponsorblock,
        categoryActions: updatedActions,
        categories: removeCats,
      },
    }));
  };

  const handleApplyPreset = (presetActions: Record<string, SponsorBlockAction>) => {
    const removeCats = Object.entries(presetActions)
      .filter(([_, act]) => act === 'remove')
      .map(([id]) => id);

    setOptions(prev => ({
      ...prev,
      sponsorblock: {
        ...prev.sponsorblock,
        enabled: true,
        categoryActions: { ...presetActions },
        categories: removeCats,
      },
    }));
  };

  const testApiConnection = async () => {
    setApiTestStatus('testing');
    try {
      const data = await api.testSponsorBlock(customApiUrl);
      if (data.ok) {
        setApiTestStatus('success');
        setOptions(prev => ({
          ...prev,
          sponsorblock: {
            ...prev.sponsorblock,
            apiUrl: customApiUrl,
          },
        }));
      } else {
        setApiTestStatus('error');
      }
    } catch {
      setApiTestStatus('error');
    }
  };

  const currentActions = options.sponsorblock?.categoryActions || {};
  const removeList = Object.entries(currentActions).filter(([_, a]) => a === 'remove').map(([k]) => k);
  const markList = Object.entries(currentActions).filter(([_, a]) => a === 'mark').map(([k]) => k);

  const getSponsorBlockCliSnippet = () => {
    if (!options.sponsorblock?.enabled) return '# SponsorBlock is disabled';
    const parts: string[] = [];
    if (removeList.length > 0) {
      parts.push(`--sponsorblock-remove "${removeList.join(',')}"`);
    }
    if (markList.length > 0) {
      parts.push(`--sponsorblock-mark "${markList.join(',')}"`);
    }
    if (customApiUrl && customApiUrl !== 'https://sponsor.ajay.app') {
      parts.push(`--sponsorblock-api "${customApiUrl}"`);
    }
    return parts.length > 0 ? parts.join(' ') : '# No segments selected';
  };

  const previewFilename = (template: string) => {
    const audioExt = options.defaultAudioFormat === 'opus' ? 'opus' : 
      options.defaultAudioFormat === 'flac' ? 'flac' : 
      options.defaultAudioFormat === 'wav' ? 'wav' : 
      options.defaultAudioFormat?.startsWith('mp3') ? 'mp3' : 'm4a';
    return template
      .replace(/%\(title\)s/g, 'Sample Video Title')
      .replace(/%\(artist,uploader\)s/g, 'Artist or Channel')
      .replace(/%\(artist\)s/g, 'Artist Name')
      .replace(/%\(uploader\)s/g, 'Channel Name')
      .replace(/%\(id\)s/g, 'VideoID')
      .replace(/%\(resolution\)s/g, '1080p')
      .replace(/%\(upload_date\)s/g, '20260819')
      .replace(/%\(playlist_index\)s/g, '01')
      .replace(/%\(playlist_index\)02d/g, '01')
      .replace(/%\(ext\)s/g, (options.defaultMediaType === 'audio' ? audioExt : 'mp4'));
  };

  // Filter tabs when search input is used
  const filteredTabs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return CORE_TABS;
    return CORE_TABS.filter(tab => 
      tab.label.toLowerCase().includes(query) ||
      tab.description.toLowerCase().includes(query) ||
      tab.keywords.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#10141d] border border-[#232b3e] rounded-xl w-full max-w-4xl h-[640px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="h-13 bg-[#141824] border-b border-[#232b3e] px-4 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">
                Application Settings
              </h3>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Configure storage, download engines, media presets, bot protection & system automation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
              v{APP_VERSION}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close Settings (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Sidebar with Search */}
          <aside className="w-full md:w-56 bg-[#0c0f16] border-b md:border-b-0 md:border-r border-[#1e2535] p-2.5 flex flex-col shrink-0 overflow-y-auto">
            
            {/* Quick Search Filter */}
            <div className="mb-2 relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search settings..."
                className="w-full bg-[#131722] border border-[#202738] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition font-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="space-y-1 flex-1">
              {filteredTabs.map(tab => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer text-left ${
                      isActive
                        ? 'bg-[#1b2333] text-white border border-sky-500/40 shadow-sm'
                        : 'text-slate-300 hover:bg-[#131722] hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? tab.color : 'text-slate-400'}`} />
                      <span className="truncate">{tab.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0"></span>
                    )}
                  </button>
                );
              })}

              {filteredTabs.length === 0 && (
                <div className="p-3 text-center text-xs text-slate-500 space-y-1">
                  <p>No matching settings</p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-[11px] text-sky-400 hover:underline cursor-pointer"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>

            {/* Quick Engine Status Indicator at bottom of sidebar */}
            <div className="pt-2 mt-auto border-t border-[#1a2130] text-[10px] text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${systemStatus?.version && !systemStatus?.version.includes('Not detected') ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                yt-dlp Core
              </span>
              <span className="font-mono text-slate-400 truncate max-w-[90px]">
                {systemStatus?.version?.split(' ')[0] || 'Ready'}
              </span>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 h-full p-4 md:p-6 overflow-y-auto space-y-4">
            
            {/* ========================================================================= */}
            {/* TAB 1: STORAGE & NAMING */}
            {/* ========================================================================= */}
            {activeTab === 'storage' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                
                {/* Download Destination Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FolderDown className="w-4 h-4 text-sky-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Download Destination
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenDownloadFolder}
                      disabled={openingFolder}
                      className="text-xs bg-[#1a2233] hover:bg-[#222c42] border border-[#2d3a54] text-slate-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 transition cursor-pointer"
                      title="Open folder in File Explorer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                      <span>{openingFolder ? 'Opening...' : 'Open in Explorer'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">
                    Target directory where all downloaded videos, audio files, thumbnails, and subtitles will be saved.
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inputDir}
                        onChange={e => setInputDir(e.target.value)}
                        placeholder="%USERPROFILE%\Downloads"
                        className="flex-1 bg-[#0b0e14] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveDownloadDir()}
                        disabled={savingDir}
                        className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition shrink-0 cursor-pointer"
                      >
                        {savingDir ? 'Saving...' : 'Save'}
                      </button>
                    </div>

                    {dirFeedback && (
                      <div className={`text-[11px] flex items-center gap-1.5 py-1 ${
                        dirFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {dirFeedback.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        <span>{dirFeedback.message}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setInputDir('%USERPROFILE%\\Downloads');
                          handleSaveDownloadDir('%USERPROFILE%\\Downloads');
                        }}
                        className="text-[11px] bg-[#181f2f] hover:bg-[#20293d] border border-slate-700 text-slate-300 px-2.5 py-1 rounded transition cursor-pointer"
                      >
                        Default (%USERPROFILE%\Downloads)
                      </button>
                      <button
                        type="button"
                        onClick={handleResetDownloadDir}
                        className="text-[11px] text-slate-400 hover:text-white px-2 py-1 transition flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* File Naming Template Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-sky-400" />
                        <span>File Naming Template</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Customize output filenames with dynamic metadata tokens
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, namingTemplate: '%(title)s - %(artist,uploader)s.%(ext)s' }))}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={options.namingTemplate || '%(title)s - %(artist,uploader)s.%(ext)s'}
                    onChange={e => setOptions(prev => ({ ...prev, namingTemplate: e.target.value }))}
                    className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500 transition"
                  />

                  {/* Token Quick-Add Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '%(title)s', label: 'Title' },
                      { tag: '%(artist,uploader)s', label: 'Artist' },
                      { tag: '%(uploader)s', label: 'Channel' },
                      { tag: '%(id)s', label: 'ID' },
                      { tag: '%(resolution)s', label: 'Resolution' },
                      { tag: '%(upload_date)s', label: 'Upload Date' },
                      { tag: '%(playlist_index)s', label: 'Index' },
                    ].map(item => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => {
                          const current = options.namingTemplate || '%(title)s - %(artist,uploader)s.%(ext)s';
                          setOptions(prev => ({ ...prev, namingTemplate: current.replace('.%(ext)s', ` - ${item.tag}.%(ext)s`) }));
                        }}
                        className="text-[10px] font-mono bg-[#181f2f] hover:bg-[#20293d] border border-slate-700 text-slate-300 px-2 py-0.5 rounded transition cursor-pointer"
                      >
                        +{item.label}
                      </button>
                    ))}
                  </div>

                  {/* Live Filename Preview */}
                  <div className="p-2.5 rounded-lg bg-[#0b0e14] border border-slate-800 text-[11px] font-mono text-slate-400 truncate flex items-center gap-2">
                    <span className="text-slate-500 font-semibold shrink-0">Live Preview:</span>
                    <span className="text-sky-300 truncate">{previewFilename(options.namingTemplate || '%(title)s - %(artist,uploader)s.%(ext)s')}</span>
                  </div>
                </div>

                {/* File Collision Handling Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Existing File Conflict Handling</h4>
                      <p className="text-xs text-slate-400">
                        When the destination folder already contains a file with the same name
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {(options.fileCollisionAction ?? 'number') === 'number' ? 'Auto-Numbering Active' : 'Overwrite Active'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, fileCollisionAction: 'number' }))}
                      className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                        (options.fileCollisionAction ?? 'number') === 'number'
                          ? 'bg-sky-950/40 border-sky-600/50 text-white'
                          : 'bg-[#181f2f] border-slate-800 text-slate-400 hover:bg-[#20293d]'
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Use Numbering (Default)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Saves duplicate as <code className="text-sky-300 font-mono">Title (1).ext</code>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, fileCollisionAction: 'overwrite' }))}
                      className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                        options.fileCollisionAction === 'overwrite'
                          ? 'bg-amber-950/40 border-amber-600/50 text-white'
                          : 'bg-[#181f2f] border-slate-800 text-slate-400 hover:bg-[#20293d]'
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        Overwrite
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Replaces the existing file in the downloads folder
                      </div>
                    </button>
                  </div>
                </div>

                {/* Download Archive Section */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Archive className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Download Archive Tracking
                      </h4>
                      <code className="text-[10px] text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                        --download-archive
                      </code>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.enableDownloadArchive ?? false}
                        onChange={e => setOptions(prev => ({
                          ...prev,
                          enableDownloadArchive: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Tracks previously downloaded video IDs in a local archive file (<code className="text-slate-300">archive.txt</code>). When syncing large playlists or channels, yt-dlp checks this list and skips already-downloaded videos instantly without re-fetching streams.
                  </p>

                  {/* Active Archive Stats & Actions */}
                  <div className="bg-[#0b0e14] border border-slate-800/80 rounded-lg p-3 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-300 font-medium">Archive Status:</span>
                        {archiveStats?.exists ? (
                          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            {archiveStats.count} {archiveStats.count === 1 ? 'video' : 'videos'} recorded
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                            Empty / Not created yet
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (archiveStats?.path) {
                              api.openFile(archiveStats.path);
                            }
                          }}
                          className="text-xs bg-[#1a2233] hover:bg-[#222c42] border border-[#2d3a54] text-slate-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 transition cursor-pointer"
                          title="Open archive.txt in default text editor"
                        >
                          <FileText className="w-3.5 h-3.5 text-sky-400" />
                          <span>View File</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (archiveStats?.path) {
                              api.openFolder(archiveStats.path);
                            }
                          }}
                          className="text-xs bg-[#1a2233] hover:bg-[#222c42] border border-[#2d3a54] text-slate-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 transition cursor-pointer"
                          title="Reveal archive file in File Explorer"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                          <span>Open Folder</span>
                        </button>

                        {confirmClearArchive ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={handleClearArchive}
                              disabled={clearingArchive}
                              className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium px-2 py-1 rounded transition cursor-pointer"
                            >
                              {clearingArchive ? 'Clearing...' : 'Confirm Clear'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmClearArchive(false)}
                              className="text-xs text-slate-400 hover:text-white px-1.5 py-1 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmClearArchive(true)}
                            className="text-xs bg-[#1e1519] hover:bg-[#2d1b22] border border-rose-900/60 text-rose-300 hover:text-rose-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 transition cursor-pointer"
                            title="Reset all recorded video IDs"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Clear Archive</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {archiveClearedFeedback && (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 animate-in fade-in duration-100">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Download archive cleared successfully!</span>
                      </div>
                    )}

                    {/* Custom Path Override */}
                    <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">
                          Archive File Location (leave blank for automatic storage):
                        </span>
                        {options.downloadArchivePath && (
                          <button
                            type="button"
                            onClick={() => setOptions(prev => ({ ...prev, downloadArchivePath: '' }))}
                            className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Reset to Default</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={options.downloadArchivePath || ''}
                        onChange={e => setOptions(prev => ({ ...prev, downloadArchivePath: e.target.value }))}
                        placeholder={archiveStats?.path || 'Default: archive.txt in app data directory'}
                        className="w-full bg-[#10141f] border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: MEDIA & QUALITY */}
            {/* ========================================================================= */}
            {activeTab === 'formats' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                
                {/* Default Media Mode Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-white">
                    Default Download Mode
                  </h4>
                  <p className="text-xs text-slate-400">
                    Choose whether new media links default to Video download (MP4 container) or Audio-only extraction
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, defaultMediaType: 'video' }))}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-medium transition cursor-pointer ${
                        (options.defaultMediaType || 'video') === 'video'
                          ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                          : 'bg-[#181e2b] text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <Film className="w-4 h-4" />
                      <span>Video Mode (MP4 / MKV)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, defaultMediaType: 'audio' }))}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-medium transition cursor-pointer ${
                        options.defaultMediaType === 'audio'
                          ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                          : 'bg-[#181e2b] text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <Music className="w-4 h-4" />
                      <span>Audio Mode (MP3 / FLAC / OPUS)</span>
                    </button>
                  </div>
                </div>

                {/* Video & Audio Quality Defaults Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-white">
                    Quality & Format Presets
                  </h4>

                  {/* Video Resolution Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-300">
                        Preferred Video Resolution:
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Applied when loading new video items
                      </span>
                    </div>
                    <select
                      value={
                        (options.defaultVideoQuality || options.defaultVideoFormat) === '2160p'
                          ? '4k'
                          : (options.defaultVideoQuality || options.defaultVideoFormat) === '2k'
                          ? '1440p'
                          : (options.defaultVideoQuality || options.defaultVideoFormat || 'best')
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setOptions(prev => ({
                          ...prev,
                          defaultVideoQuality: val,
                          defaultVideoFormat: val,
                        }));
                      }}
                      className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer font-medium transition"
                    >
                      <optgroup label="Standard Quality Presets">
                        <option value="best">Best Available (Auto Resolution + Highest Audio)</option>
                        <option value="4k">4K Ultra HD (2160p)</option>
                        <option value="1440p">2K QHD (1440p)</option>
                        <option value="1080p">Full HD (1080p 60fps)</option>
                        <option value="720p">HD (720p)</option>
                        <option value="480p">SD (480p - Low Data)</option>
                        <option value="360p">Low (360p - Data Saver)</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Audio Format & Quality */}
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-300">
                        Preferred Audio Format:
                      </span>
                      <span className="text-[11px] text-emerald-400">
                        Best Native retains 100% original quality with zero transcode loss
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'best', label: 'Best Native', desc: 'Original Stream, No Bloat' },
                        { id: 'm4a', label: 'M4A (AAC)', desc: 'Fast, Zero Loss' },
                        { id: 'opus', label: 'OPUS', desc: 'High Efficiency' },
                        { id: 'flac', label: 'FLAC', desc: 'Lossless Master' },
                        { id: 'wav', label: 'WAV', desc: 'PCM Master' },
                        { id: 'mp3_auto', label: 'MP3 (VBR V0)', desc: 'Dynamic Match' },
                        { id: 'mp3_320', label: 'MP3 320k', desc: 'Maximum MP3 Quality' },
                        { id: 'mp3_256', label: 'MP3 256k', desc: 'Standard MP3' },
                      ].map(fmt => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setOptions(prev => ({ ...prev, defaultAudioFormat: fmt.id }))}
                          className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-center cursor-pointer ${
                            (options.defaultAudioFormat || 'best') === fmt.id
                              ? 'bg-sky-500/20 text-sky-400 border-sky-500 font-medium'
                              : 'bg-[#181e2b] text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-xs font-semibold">{fmt.label}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">{fmt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Album Art & Tags Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-white">
                    Artwork & ID3 Tags
                  </h4>

                  <div className="space-y-2.5">
                    <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-lg bg-[#181e2b] border border-slate-800 hover:border-slate-700 transition">
                      <div className="flex items-start gap-2.5 pr-4">
                        <Crop className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-semibold text-white block">
                            Crop Thumbnail to 1:1 Square (Album Art)
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Crops wide 16:9 YouTube thumbnails to 1:1 square covers for music players, Apple Music, and car displays
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={options.audioCropThumbnailSquare ?? true}
                        onChange={e => setOptions(prev => ({
                          ...prev,
                          audioCropThumbnailSquare: e.target.checked
                        }))}
                        className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-lg bg-[#181e2b] border border-slate-800 hover:border-slate-700 transition">
                      <div className="flex items-start gap-2.5 pr-4">
                        <FileText className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-semibold text-white block">
                            Embed Metadata & Chapters
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Embeds artist, title, release date, and chapters directly into the output MP4/MP3/M4A file
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={options.embedMetadata ?? true}
                        onChange={e => setOptions(prev => ({
                          ...prev,
                          embedMetadata: e.target.checked
                        }))}
                        className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-4 h-4"
                      />
                    </label>
                  </div>
                </div>

              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: DOWNLOADS & ENGINE */}
            {/* ========================================================================= */}
            {activeTab === 'downloads' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                
                {/* Concurrency & Queue Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          Concurrent Active Downloads
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Maximum number of tasks downloading simultaneously in the queue
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        (options.maxConcurrentDownloads ?? 3) === 1
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      }`}>
                        {(options.maxConcurrentDownloads ?? 3) === 1
                          ? '1 Task (Sequential)'
                          : `${options.maxConcurrentDownloads ?? 3} Parallel Downloads`}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Set how many queued media items can download at the same time. Setting this to <strong className="text-slate-200">1</strong> downloads sequentially one by one (ideal for preventing YouTube HTTP 429 rate-limiting). Higher numbers (2–8) speed up batch downloads on high-bandwidth connections.
                  </p>

                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-300 font-medium">
                        Active Downloads Limit:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={options.maxConcurrentDownloads ?? 3}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setOptions(prev => ({ ...prev, maxConcurrentDownloads: 1 }));
                            return;
                          }
                          const parsed = parseInt(val, 10);
                          if (!isNaN(parsed)) {
                            const clamped = Math.max(1, Math.min(10, parsed));
                            setOptions(prev => ({ ...prev, maxConcurrentDownloads: clamped }));
                          }
                        }}
                        className="w-20 bg-[#0b0e14] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-mono text-white text-center focus:outline-none focus:border-sky-500 transition"
                      />
                      <span className="text-[11px] text-slate-500">simultaneous tasks (1 – 10)</span>
                    </div>

                    {(options.maxConcurrentDownloads ?? 3) !== 3 && (
                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({ ...prev, maxConcurrentDownloads: 3 }))}
                        className="text-xs bg-[#1a2233] hover:bg-[#222c42] border border-[#2d3a54] text-slate-300 hover:text-white px-2.5 py-1 rounded-md flex items-center gap-1.5 transition cursor-pointer"
                        title="Reset to default (3 concurrent downloads)"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                        <span>Reset to 3</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Queue Navigation & UI Experience Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-sky-400" />
                    <h4 className="text-sm font-semibold text-white">
                      Queue Workflow & UI Preferences
                    </h4>
                  </div>

                  <div className="space-y-3 divide-y divide-slate-800/60 pt-1">
                    {/* Auto-switch to Active Queue */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Switch to Active Queue on Download Start
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Automatically jump to the queue when a download starts (keep disabled to stay on downloader and queue more)
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                        <input
                          type="checkbox"
                          checked={options.autoSwitchToQueueOnStart ?? false}
                          onChange={e => setOptions(prev => ({
                            ...prev,
                            autoSwitchToQueueOnStart: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-600"></div>
                      </label>
                    </div>

                    {/* In-App Toast Notification */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          In-App "Added to Queue" Toast Banner
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Shows a subtle non-blocking popup with a "View Queue" button whenever downloads are queued
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                        <input
                          type="checkbox"
                          checked={options.showQueueToast ?? true}
                          onChange={e => setOptions(prev => ({
                            ...prev,
                            showQueueToast: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-600"></div>
                      </label>
                    </div>

                    {/* Simplified Downloader View */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Simplified Downloader View
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Keeps the main screen clean by hiding advanced flags and technical formatting chips
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                        <input
                          type="checkbox"
                          checked={options.simplifyFileSelection ?? true}
                          onChange={e => setOptions(prev => ({
                            ...prev,
                            simplifyFileSelection: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* aria2 Multi-Connection Acceleration Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <span>aria2 Multi-Connection Downloader</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                            --downloader aria2c
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Multi-segmented parallel downloading to bypass single-connection socket throttling
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        systemStatus?.aria2c
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {systemStatus?.aria2c
                          ? `Installed (${systemStatus.aria2cVersion?.split(' ')[1] || 'Ready'})`
                          : 'Not Detected'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Splits standard HTTP/HTTPS downloads into concurrent socket segments (up to 16 connections per server) using aria2 to maximize speed and bypass server bandwidth caps. DASH/HLS playlists automatically stay on yt-dlp native for stream stability.
                  </p>

                  <div className="space-y-3 pt-1 border-t border-slate-800/80">
                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[#181e2b] border border-slate-800">
                      <div className="pr-4">
                        <span className="text-xs font-medium text-white block">
                          Accelerate with aria2
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Enables multi-connection segmented downloads for tasks. If aria2c is not found, downloads gracefully fall back to native yt-dlp.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={options.useAria2 ?? false}
                          onChange={(e) => {
                            setOptions(prev => ({ ...prev, useAria2: e.target.checked }));
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    {/* Connection Count Options */}
                    {options.useAria2 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#181e2b] border border-slate-800 animate-in fade-in duration-150">
                        <div>
                          <span className="text-xs font-medium text-white block">
                            Connections per Server
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Number of concurrent connections used per direct file download (-x / -s flags)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {[4, 8, 16].map((conn) => {
                            const isSelected = (options.aria2Connections ?? 16) === conn;
                            return (
                              <button
                                key={conn}
                                type="button"
                                onClick={() => setOptions(prev => ({ ...prev, aria2Connections: conn }))}
                                className={`text-xs px-2.5 py-1 rounded-md transition font-mono cursor-pointer border ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-400 font-bold'
                                    : 'bg-[#10141e] border-slate-700 text-slate-300 hover:bg-[#151b28]'
                                }`}
                              >
                                {conn}x
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Not Installed Helper */}
                    {!systemStatus?.aria2c && (
                      <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/25 text-xs text-amber-200/90 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <span className="font-semibold text-amber-300 block">
                              aria2 is optional & not installed
                            </span>
                            <p className="text-[11px] text-amber-200/80 leading-relaxed">
                              To activate multi-connection speed boosts, install aria2 via Windows Package Manager:
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between bg-[#0b0e14] border border-amber-500/30 rounded-lg px-3 py-1.5 font-mono text-[11px] text-slate-200">
                          <code>winget install aria2.aria2</code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText('winget install aria2.aria2');
                              setCopiedAria2Command(true);
                              setTimeout(() => setCopiedAria2Command(false), 2000);
                            }}
                            className="ml-2 px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded text-[10px] transition cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            {copiedAria2Command ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedAria2Command ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Download Speed Limiter Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400">
                        <Gauge className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          Download Speed Limiter
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Cap download bandwidth usage per task with yt-dlp native rate limiting
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        options.limitRate && options.limitRate.trim() && options.limitRate.toLowerCase() !== 'unlimited' && options.limitRate !== '0'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {options.limitRate && options.limitRate.trim() && options.limitRate.toLowerCase() !== 'unlimited' && options.limitRate !== '0'
                          ? `Capped: ${options.limitRate}`
                          : 'Unlimited'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Restricts the maximum socket download speed passed via <code className="text-sky-300">--limit-rate</code> to prevent yt-dlp from saturating your internet connection during large media downloads.
                  </p>

                  <div className="space-y-3 pt-1 border-t border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 mr-1">Quick Presets:</span>
                      {[
                        { label: '⚡ Unlimited', val: '' },
                        { label: '500 KB/s', val: '500K' },
                        { label: '1 MB/s', val: '1M' },
                        { label: '2 MB/s', val: '2M' },
                        { label: '5 MB/s', val: '5M' },
                        { label: '10 MB/s', val: '10M' },
                        { label: '25 MB/s', val: '25M' },
                      ].map(preset => {
                        const isSelected = (!options.limitRate && preset.val === '') ||
                          (options.limitRate && options.limitRate.toUpperCase() === preset.val.toUpperCase());

                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setOptions(prev => ({ ...prev, limitRate: preset.val }))}
                            className={`text-[11px] px-2.5 py-1 rounded transition cursor-pointer border ${
                              isSelected
                                ? 'bg-sky-600 text-white border-sky-400 font-medium'
                                : 'bg-[#181f2f] hover:bg-[#20293d] border-slate-700 text-slate-300'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-slate-300 font-medium">Custom Rate:</span>
                      <input
                        type="text"
                        value={options.limitRate || ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setOptions(prev => ({ ...prev, limitRate: val }));
                        }}
                        placeholder="e.g. 5M, 500K, or blank for unlimited"
                        className="w-56 bg-[#0b0e14] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500 transition"
                      />
                      {options.limitRate && (
                        <button
                          type="button"
                          onClick={() => setOptions(prev => ({ ...prev, limitRate: '' }))}
                          className="text-[11px] text-slate-400 hover:text-white px-2 py-1 transition flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* HTTP User-Agent Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          HTTP User-Agent
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Browser identity string used for search requests and media stream downloads
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {options.userAgent && options.userAgent.trim() !== DEFAULT_USER_AGENT ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Custom
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Default
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({ ...prev, userAgent: DEFAULT_USER_AGENT }))}
                        disabled={!options.userAgent || options.userAgent.trim() === DEFAULT_USER_AGENT}
                        className="text-xs bg-[#1a2233] hover:bg-[#222c42] disabled:opacity-40 disabled:cursor-not-allowed border border-[#2d3a54] text-slate-200 hover:text-white px-2.5 py-1 rounded-md flex items-center gap-1.5 transition cursor-pointer"
                        title="Reset User-Agent to default"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={options.userAgent ?? DEFAULT_USER_AGENT}
                      onChange={e => setOptions(prev => ({ ...prev, userAgent: e.target.value }))}
                      placeholder={DEFAULT_USER_AGENT}
                      className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-sky-500 transition resize-none leading-relaxed"
                    />

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({ ...prev, userAgent: DEFAULT_USER_AGENT }))}
                        className="text-[11px] bg-[#181f2f] hover:bg-[#20293d] border border-slate-700 text-slate-300 px-2.5 py-1 rounded transition cursor-pointer"
                      >
                        Chrome 128 (Default)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({
                          ...prev,
                          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0'
                        }))}
                        className="text-[11px] bg-[#181f2f] hover:bg-[#20293d] border border-slate-700 text-slate-300 px-2.5 py-1 rounded transition cursor-pointer"
                      >
                        Firefox 130
                      </button>
                    </div>
                  </div>
                </div>

                {/* Network Proxy Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <span>Network Proxy</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-medium">
                            --proxy
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Route media downloads, metadata queries, and searches via HTTP or SOCKS5 proxy
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {options.proxy && options.proxy.trim() ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 truncate max-w-[180px]">
                          <Check className="w-3 h-3 shrink-0" /> Proxy Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          Direct (No Proxy)
                        </span>
                      )}

                      {options.proxy && (
                        <button
                          type="button"
                          onClick={() => setOptions(prev => ({ ...prev, proxy: '' }))}
                          className="text-xs bg-[#1a2233] hover:bg-[#222c42] border border-[#2d3a54] text-slate-200 hover:text-white px-2.5 py-1 rounded-md flex items-center gap-1.5 transition cursor-pointer"
                          title="Clear proxy configuration"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-1 border-t border-slate-800/80">
                    <input
                      type="text"
                      value={options.proxy || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOptions(prev => ({ ...prev, proxy: val }));
                      }}
                      placeholder="e.g. socks5://127.0.0.1:1080 or http://127.0.0.1:8080"
                      className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 transition placeholder:text-slate-600"
                    />

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({ ...prev, proxy: '' }))}
                        className={`text-[11px] px-2.5 py-1 rounded transition cursor-pointer border ${
                          !options.proxy
                            ? 'bg-sky-600 text-white border-sky-400 font-medium'
                            : 'bg-[#181f2f] hover:bg-[#20293d] border-slate-700 text-slate-300'
                        }`}
                      >
                        ⚡ Direct (No Proxy)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({ ...prev, proxy: 'socks5://127.0.0.1:1080' }))}
                        className={`text-[11px] px-2.5 py-1 rounded transition cursor-pointer border ${
                          options.proxy === 'socks5://127.0.0.1:1080'
                            ? 'bg-indigo-600 text-white border-indigo-400 font-medium'
                            : 'bg-[#181f2f] hover:bg-[#20293d] border-slate-700 text-slate-300'
                        }`}
                      >
                        SOCKS5 (127.0.0.1:1080)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({ ...prev, proxy: 'http://127.0.0.1:8080' }))}
                        className={`text-[11px] px-2.5 py-1 rounded transition cursor-pointer border ${
                          options.proxy === 'http://127.0.0.1:8080'
                            ? 'bg-indigo-600 text-white border-indigo-400 font-medium'
                            : 'bg-[#181f2f] hover:bg-[#20293d] border-slate-700 text-slate-300'
                        }`}
                      >
                        HTTP (127.0.0.1:8080)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({ ...prev, proxy: 'socks5://127.0.0.1:9050' }))}
                        className={`text-[11px] px-2.5 py-1 rounded transition cursor-pointer border ${
                          options.proxy === 'socks5://127.0.0.1:9050'
                            ? 'bg-indigo-600 text-white border-indigo-400 font-medium'
                            : 'bg-[#181f2f] hover:bg-[#20293d] border-slate-700 text-slate-300'
                        }`}
                      >
                        Tor (127.0.0.1:9050)
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: SPONSORBLOCK & SUBTITLES */}
            {/* ========================================================================= */}
            {activeTab === 'subtitles' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                
                {/* SponsorBlock Skipping Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>SponsorBlock Segment Skipping</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Automatically skip or mark sponsors, intros, credits, and non-music portions using community timestamps
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.sponsorblock?.enabled ?? false}
                        onChange={e => setOptions(prev => ({
                          ...prev,
                          sponsorblock: {
                            ...prev.sponsorblock,
                            enabled: e.target.checked
                          }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {!options.sponsorblock?.enabled && (
                    <div className="p-3 bg-[#181e2b] rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                      <span>Enable SponsorBlock above to configure segment skipping, chapters, and custom API mirrors.</span>
                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({
                          ...prev,
                          sponsorblock: {
                            ...prev.sponsorblock,
                            enabled: true
                          }
                        }))}
                        className="text-xs text-amber-400 hover:text-amber-300 font-medium px-2.5 py-1 rounded bg-amber-950/50 border border-amber-800/50 transition shrink-0 ml-3 cursor-pointer"
                      >
                        Enable SponsorBlock
                      </button>
                    </div>
                  )}

                  {options.sponsorblock?.enabled && (
                    <div className="space-y-4 pt-3 border-t border-slate-800 animate-in fade-in">
                      {/* Presets */}
                      <div>
                        <span className="text-xs font-semibold text-slate-300 block mb-2">
                          Quick Presets:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {SPONSORBLOCK_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleApplyPreset(preset.actions)}
                              className="p-2 rounded-lg bg-[#181e2b] hover:bg-[#20293d] border border-slate-700 text-left transition cursor-pointer"
                            >
                              <span className="text-xs font-medium text-white block truncate">
                                {preset.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {preset.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Categories List */}
                      <div>
                        <span className="text-xs font-semibold text-slate-300 block mb-2">
                          Segment Actions:
                        </span>
                        <div className="space-y-2">
                          {SPONSORBLOCK_CATEGORIES.map(category => {
                            const action = (options.sponsorblock?.categoryActions || {})[category.id] || 'off';
                            return (
                              <div
                                key={category.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-[#181e2b] border border-slate-800 gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: category.color }}
                                  />
                                  <div>
                                    <span className="text-xs font-medium text-white block">
                                      {category.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block line-clamp-1">
                                      {category.description}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                                  <button
                                    type="button"
                                    onClick={() => handleCategoryActionChange(category.id, 'remove')}
                                    className={`text-[11px] px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer ${
                                      action === 'remove'
                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 font-medium'
                                        : 'bg-[#10141d] text-slate-400 border border-slate-800 hover:text-white'
                                    }`}
                                  >
                                    <Scissors className="w-3 h-3" />
                                    <span>Skip (Cut)</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCategoryActionChange(category.id, 'mark')}
                                    className={`text-[11px] px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer ${
                                      action === 'mark'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 font-medium'
                                        : 'bg-[#10141d] text-slate-400 border border-slate-800 hover:text-white'
                                    }`}
                                  >
                                    <Bookmark className="w-3 h-3" />
                                    <span>Mark Chapter</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCategoryActionChange(category.id, 'off')}
                                    className={`text-[11px] px-2 py-1 rounded transition cursor-pointer ${
                                      action === 'off'
                                        ? 'bg-slate-700/50 text-slate-300 border border-slate-600'
                                        : 'bg-[#10141d] text-slate-500 border border-slate-800 hover:text-white'
                                    }`}
                                  >
                                    Off
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom API */}
                      <div className="p-3 rounded-lg bg-[#0f131d] border border-slate-800 space-y-2 text-xs">
                        <span className="text-slate-400 font-medium block">
                          SponsorBlock API Endpoint URL:
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={customApiUrl}
                            onChange={e => setCustomApiUrl(e.target.value)}
                            placeholder="https://sponsor.ajay.app"
                            className="flex-1 bg-[#0b0e14] border border-slate-700/80 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={testApiConnection}
                            disabled={apiTestStatus === 'testing'}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded transition shrink-0 cursor-pointer"
                          >
                            {apiTestStatus === 'testing' ? 'Testing...' : 'Test'}
                          </button>
                        </div>
                        {apiTestStatus === 'success' && (
                          <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> API Mirror Verified
                          </span>
                        )}
                        {apiTestStatus === 'error' && (
                          <span className="text-rose-400 text-[11px] flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Could not reach mirror
                          </span>
                        )}
                      </div>

                      {/* Collapsible CLI Snippet */}
                      <details className="group p-2 rounded-lg bg-[#0b0e14] border border-slate-800 text-[11px] font-mono text-slate-400 cursor-pointer">
                        <summary className="flex items-center justify-between text-slate-400 select-none">
                          <span className="flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-amber-400" />
                            <span>Preview Generated SponsorBlock CLI Arguments</span>
                          </span>
                          <span className="text-[10px] text-slate-500 group-open:hidden">Click to expand</span>
                        </summary>
                        <div className="mt-2 pt-2 border-t border-slate-800/80 text-amber-300 font-mono break-all">
                          {getSponsorBlockCliSnippet()}
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                {/* Subtitles Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Subtitles className="w-4 h-4 text-indigo-400" />
                        <span>Subtitle Downloads</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Automatically extract and embed multi-language captions or creator-provided subtitles
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.subtitles?.enabled ?? false}
                        onChange={e => setOptions(prev => ({
                          ...prev,
                          subtitles: {
                            ...prev.subtitles,
                            enabled: e.target.checked
                          }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {!options.subtitles?.enabled && (
                    <div className="p-3 bg-[#181e2b] rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                      <span>Enable subtitles to configure language filters, automatic captions, and video embedding.</span>
                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({
                          ...prev,
                          subtitles: {
                            ...prev.subtitles,
                            enabled: true
                          }
                        }))}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2.5 py-1 rounded bg-indigo-950/50 border border-indigo-800/50 transition shrink-0 ml-3 cursor-pointer"
                      >
                        Enable Subtitles
                      </button>
                    </div>
                  )}

                  {options.subtitles?.enabled && (
                    <div className="space-y-3 pt-3 border-t border-slate-800 text-xs animate-in fade-in">
                      <div>
                        <span className="text-slate-400 font-medium block mb-1">
                          Preferred Languages (comma separated):
                        </span>
                        <input
                          type="text"
                          value={options.subtitles.langs || 'en.*'}
                          onChange={e => setOptions(prev => ({
                            ...prev,
                            subtitles: { ...prev.subtitles, langs: e.target.value }
                          }))}
                          placeholder="en.*, es, ja, all"
                          className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex gap-1.5 pt-1.5">
                          {['en.*', 'all', 'es', 'ja', 'fr', 'de'].map(l => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => setOptions(prev => ({
                                ...prev,
                                subtitles: { ...prev.subtitles, langs: l }
                              }))}
                              className="text-[10px] font-mono bg-[#181f2f] hover:bg-[#20293d] border border-slate-700 text-slate-300 px-2 py-0.5 rounded transition cursor-pointer"
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-lg bg-[#181e2b] border border-slate-800 hover:border-slate-700">
                          <div>
                            <span className="text-slate-200 font-medium block">
                              Include Auto-Generated Subtitles (--write-auto-subs)
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Fetches automated speech recognition captions if manual subtitles are not available
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={options.subtitles.writeAutoSubs ?? true}
                            onChange={e => setOptions(prev => ({
                              ...prev,
                              subtitles: { ...prev.subtitles, writeAutoSubs: e.target.checked }
                            }))}
                            className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
                          />
                        </label>

                        <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-lg bg-[#181e2b] border border-slate-800 hover:border-slate-700">
                          <div>
                            <span className="text-slate-200 font-medium block">
                              Embed Subtitles into Video (--embed-subs)
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Embeds subtitles as soft selectable tracks inside the MP4/MKV container
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={options.subtitles.embed ?? true}
                            onChange={e => setOptions(prev => ({
                              ...prev,
                              subtitles: { ...prev.subtitles, embed: e.target.checked }
                            }))}
                            className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
                          />
                        </label>

                        <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-lg bg-[#181e2b] border border-slate-800 hover:border-slate-700">
                          <div className="pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-200 font-medium block">
                                Keep Original Subtitle Files
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700/60">
                                Default: Deleted
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              When embedding is enabled, original subtitle files (both manual subtitles and auto-captions) are deleted by default after embedding. Enable this to keep standalone .srt / .vtt files in the download folder alongside the video.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={options.subtitles.keepSubs ?? false}
                            onChange={e => setOptions(prev => ({
                              ...prev,
                              subtitles: { ...prev.subtitles, keepSubs: e.target.checked }
                            }))}
                            className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: AUTH & ANTI-BOT */}
            {/* ========================================================================= */}
            {activeTab === 'cookies' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                
                {/* BotGuard & PO Token Bypass Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Fingerprint className="w-4 h-4 text-emerald-400" />
                      <span>YouTube BotGuard & PO Token Bypass</span>
                    </h4>
                    <button
                      type="button"
                      onClick={handleTestBypass}
                      disabled={testingBypass}
                      className="text-xs bg-[#1a2233] hover:bg-[#222c42] border border-[#2d3a54] text-slate-200 px-2.5 py-1 rounded-md transition cursor-pointer"
                    >
                      {testingBypass ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">
                    Bypasses YouTube HTTP 429 and "Sign in to confirm you're not a bot" errors by generating Proof of Origin (PO) tokens.
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[#181e2b] border border-slate-800">
                      <div>
                        <span className="text-xs font-medium text-white block">
                          Web Client PO Token
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {options.auth?.poToken ? `Token Active: ${options.auth.poToken.slice(0, 20)}...` : 'Not generated yet'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleGeneratePoToken}
                        disabled={generatingPoToken}
                        className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{generatingPoToken ? 'Generating...' : 'Generate PO Token'}</span>
                      </button>
                    </div>

                    {poTokenFeedback && (
                      <div className={`text-[11px] flex items-center gap-1.5 ${
                        poTokenFeedback.ok ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {poTokenFeedback.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        <span>{poTokenFeedback.msg}</span>
                      </div>
                    )}

                    {bypassResult && (
                      <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                        bypassResult.ok 
                          ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300' 
                          : 'bg-rose-950/30 border-rose-800 text-rose-300'
                      }`}>
                        {bypassResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                        <span>{bypassResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* YouTube Player Client Persona Selection Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-red-500/15 text-red-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <span>YouTube Player Client Persona</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-mono font-medium">
                            --extractor-args
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Switches the client persona yt-dlp impersonates on YouTube. Highly effective for bypassing HTTP 429, bot checks, and speed throttling.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                      <span className="text-[11px] text-slate-400">Active:</span>
                      <span className="text-[11px] font-semibold text-sky-300 bg-sky-950/60 border border-sky-800/60 px-2.5 py-0.5 rounded-md">
                        {getPlayerClientInfo(options.playerClient || options.auth?.playerClient).name}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                    {PLAYER_CLIENTS.map((client) => {
                      const activeId = options.playerClient || options.auth?.playerClient || 'default';
                      const isSelected = activeId === client.id;
                      return (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setOptions(prev => ({
                              ...prev,
                              playerClient: client.id,
                              auth: {
                                ...(prev.auth || { cookieSource: 'none' }),
                                playerClient: client.id,
                              }
                            }));
                          }}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-sky-500/10 border-sky-500/70 shadow-sm'
                              : 'bg-[#10141e] border-slate-800 hover:border-slate-700 hover:bg-[#151b28]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center space-x-2 min-w-0">
                              <span className={`text-xs font-semibold truncate ${isSelected ? 'text-sky-300 font-bold' : 'text-slate-200'}`}>
                                {client.name}
                              </span>
                            </div>
                            {client.badge && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium shrink-0 ${client.badgeColor || 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                                {client.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {client.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Browser Cookie Extraction Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Cookie className="w-4 h-4 text-amber-400" />
                    <span>Browser Cookie Extraction</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Directly extract session cookies from your installed browser to download age-restricted videos or private playlists.
                  </p>

                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {[
                        { id: 'chrome', name: 'Chrome' },
                        { id: 'firefox', name: 'Firefox' },
                        { id: 'edge', name: 'Edge' },
                        { id: 'brave', name: 'Brave' },
                        { id: 'vivaldi', name: 'Vivaldi' },
                        { id: 'opera', name: 'Opera' },
                      ].map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setOptions(prev => ({
                            ...prev,
                            auth: {
                              ...prev.auth,
                              cookieSource: 'browser',
                              browser: b.id as any
                            }
                          }))}
                          className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                            options.auth?.cookieSource === 'browser' && options.auth?.browser === b.id
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-medium'
                              : 'bg-[#181e2b] text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>

                    {options.auth?.cookieSource === 'browser' && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f131d] border border-amber-900/30">
                        <span className="text-amber-300 text-xs">
                          Active: Reading cookies directly from <strong>{options.auth.browser}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setOptions(prev => ({
                            ...prev,
                            auth: { ...prev.auth, cookieSource: 'none', browser: undefined }
                          }))}
                          className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                        >
                          Disable
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Netscape cookies.txt Editor Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">
                      Custom cookies.txt File
                    </h4>
                    <label className="text-xs bg-[#1a2233] hover:bg-[#222c42] border border-[#2d3a54] text-slate-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                      <span>Upload File</span>
                      <input
                        type="file"
                        accept=".txt"
                        onChange={handleFileUploadCookies}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <p className="text-xs text-slate-400">
                    Paste raw Netscape HTTP cookie lines or export from extensions like "Get cookies.txt LOCALLY".
                  </p>

                  <textarea
                    value={cookiesContent}
                    onChange={e => setCookiesContent(e.target.value)}
                    placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1789012345&#9;SID&#9;ABCDEF1234..."
                    rows={3}
                    className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[11px] text-slate-400">
                      {cookiesContent.trim() ? `${cookiesContent.split('\n').filter(l => l.trim() && !l.startsWith('#')).length} cookie entries detected` : 'No cookies loaded'}
                    </div>

                    <div className="flex items-center gap-2">
                      {cookiesContent && (
                        <button
                          type="button"
                          onClick={handleClearCookies}
                          className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 transition cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveCookies}
                        disabled={savingCookies || !cookiesContent.trim()}
                        className="text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        {savingCookies ? 'Saving...' : 'Save Cookies'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 6: DESKTOP & POWER */}
            {/* ========================================================================= */}
            {activeTab === 'desktop' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                
                {/* System Tray & Taskbar Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Monitor className="w-4 h-4 text-sky-400" />
                      <h4 className="text-sm font-semibold text-white">
                        System Tray & Background Operation
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-sky-400 bg-sky-950/40 border border-sky-500/30 px-2 py-0.5 rounded-full">
                      Windows Desktop
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Configure window minimization, background task persistence, and taskbar progress indicators.
                  </p>

                  <div className="space-y-3 divide-y divide-slate-800/60 pt-1">
                    {/* Minimize to System Tray */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Minimize to System Tray
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Adds quick minimize to tray action and keeps downloads running seamlessly in the background
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                        <input
                          type="checkbox"
                          checked={options.minimizeToTray ?? true}
                          onChange={e => setOptions(prev => ({
                            ...prev,
                            minimizeToTray: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-600"></div>
                      </label>
                    </div>

                    {/* Close to System Tray */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Close Window to System Tray
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Clicking the window close (X) button hides to tray instead of quitting the application
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                        <input
                          type="checkbox"
                          checked={options.closeToTray ?? false}
                          onChange={e => setOptions(prev => ({
                            ...prev,
                            closeToTray: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-600"></div>
                      </label>
                    </div>

                    {/* Windows Taskbar Progress Bar */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Windows Taskbar Progress Indicator
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Displays live download percentage directly over the Windows taskbar icon (green, yellow on pause)
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                        <input
                          type="checkbox"
                          checked={options.taskbarProgress ?? true}
                          onChange={e => setOptions(prev => ({
                            ...prev,
                            taskbarProgress: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Notifications Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white block">
                          Desktop & System Notifications
                        </span>
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                          Toast Alerts
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        Receive desktop alerts when downloads finish or fail (clicking notification opens folder)
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                      <input
                        type="checkbox"
                        checked={options.desktopNotifications ?? true}
                        onChange={e => {
                          const checked = e.target.checked;
                          if (checked) {
                            api.requestNotificationPermission().catch(() => {});
                          }
                          setOptions(prev => ({
                            ...prev,
                            desktopNotifications: checked
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-600"></div>
                    </label>
                  </div>

                  {/* Granular notification filters */}
                  {(options.desktopNotifications ?? true) && (
                    <div className="pl-3.5 pr-2 py-2.5 bg-[#0c0f16] border border-slate-800/60 rounded-lg space-y-2 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Download Completed alerts
                        </span>
                        <input
                          type="checkbox"
                          checked={options.notifyOnComplete ?? true}
                          onChange={e => setOptions(prev => ({ ...prev, notifyOnComplete: e.target.checked }))}
                          className="accent-sky-500 rounded cursor-pointer w-3.5 h-3.5"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          Download Error / Failure alerts
                        </span>
                        <input
                          type="checkbox"
                          checked={options.notifyOnError ?? true}
                          onChange={e => setOptions(prev => ({ ...prev, notifyOnError: e.target.checked }))}
                          className="accent-sky-500 rounded cursor-pointer w-3.5 h-3.5"
                        />
                      </div>
                    </div>
                  )}

                  {/* Send Test Notification Button */}
                  <div className="pt-1 flex items-center justify-between bg-[#0e121b] border border-slate-800/80 rounded-lg p-2.5">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="text-xs text-slate-300">Test Notification System</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendTestNotification}
                      disabled={testNotificationSent}
                      className="text-xs bg-[#192131] hover:bg-[#222c42] border border-[#2b3850] text-sky-300 hover:text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {testNotificationSent ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Notification Sent</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-sky-400" />
                          <span>Send Test Notification</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* System WakeLock & Power Automation Card */}
                {isNativeWindowsDesktop() && (
                  <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400">
                          <PowerOff className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">
                            Power Automation & WakeLock
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Manage Windows idle sleep prevention and post-download shutdown/suspend triggers
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-1 border-t border-slate-800/80">
                      {/* WakeLock Toggle */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#181e2b] border border-slate-800">
                        <div className="pr-4">
                          <span className="text-xs font-medium text-white block">
                            Prevent PC Sleep During Downloads (WakeLock)
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Acquires a Windows system execution lock while active downloads run so tasks are never interrupted by PC idle sleep.
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={options.preventSystemSleep ?? true}
                            onChange={(e) => {
                              setOptions(prev => ({ ...prev, preventSystemSleep: e.target.checked }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {/* Post-Download Action */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#181e2b] border border-slate-800">
                        <div>
                          <span className="text-xs font-medium text-white block">
                            When Queue Completes
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Action to take automatically once all items in the queue finish downloading.
                          </span>
                        </div>
                        <select
                          value={options.postDownloadAction || 'none'}
                          onChange={(e) => {
                            setOptions(prev => ({ ...prev, postDownloadAction: e.target.value as PostDownloadAction }));
                          }}
                          className="bg-[#0b0e14] border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 transition cursor-pointer font-medium"
                        >
                          <option value="none">Do Nothing (Default)</option>
                          <option value="sleep">🌙 Put PC to Sleep</option>
                          <option value="hibernate">💾 Hibernate System</option>
                          <option value="shutdown">⚡ Shut Down PC</option>
                          <option value="close_app">🚪 Close yt-dlp Client</option>
                        </select>
                      </div>

                      {/* Grace Period Selector */}
                      {options.postDownloadAction && options.postDownloadAction !== 'none' && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-950/20 border border-amber-800/40">
                          <div>
                            <span className="text-xs font-medium text-amber-300 block">
                              Safety Countdown Grace Period
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Displays an on-screen countdown and plays an alert chime allowing you to cancel the action.
                            </span>
                          </div>
                          <select
                            value={options.postDownloadGraceSeconds || 60}
                            onChange={(e) => {
                              setOptions(prev => ({ ...prev, postDownloadGraceSeconds: Number(e.target.value) }));
                            }}
                            className="bg-[#0b0e14] border border-amber-700/60 text-xs text-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer font-medium"
                          >
                            <option value="30">30 Seconds</option>
                            <option value="60">60 Seconds (Recommended)</option>
                            <option value="120">2 Minutes</option>
                            <option value="300">5 Minutes</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 7: ABOUT & DIAGNOSTICS */}
            {/* ========================================================================= */}
            {activeTab === 'info' && (
              <div className="space-y-4 animate-in fade-in duration-150 text-xs">
                
                {/* Hero Branding Card */}
                <div className="bg-gradient-to-br from-[#161c2b] via-[#121624] to-[#0e121c] border border-[#232c3f] rounded-xl p-4 sm:p-4.5 relative overflow-hidden shadow-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-[#141824] border border-[#252e42] flex items-center justify-center shadow-lg shadow-black/40 shrink-0 p-2">
                        <img src="/icon.png" alt="yt-dlp Client Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white tracking-wide">{APP_NAME}</h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            v{APP_VERSION}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Modern desktop media downloader powered by yt-dlp.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0 w-full sm:w-28">
                      <button
                        type="button"
                        onClick={() => api.openExternalUrl(APP_HOMEPAGE_URL)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 hover:text-sky-200 transition flex items-center justify-between text-xs font-medium cursor-pointer"
                        title="Open Official Website"
                      >
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>Website</span>
                        </span>
                        <ExternalLink className="w-3 h-3 text-sky-400/60 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => api.openExternalUrl(`https://github.com/${APP_REPO}`)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#1a2233] hover:bg-[#232c42] border border-[#2d3a54] text-slate-200 hover:text-white transition flex items-center justify-between text-xs font-medium cursor-pointer"
                        title="Open GitHub Repository"
                      >
                        <span className="flex items-center gap-1.5">
                          <Github className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>GitHub</span>
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => api.openExternalUrl(APP_RELEASES_URL)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-sky-600/15 hover:bg-sky-600/25 border border-sky-500/30 text-sky-300 hover:text-sky-200 transition flex items-center justify-between text-xs font-medium cursor-pointer"
                        title="View Releases & Changelogs"
                      >
                        <span className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>Releases</span>
                        </span>
                        <ExternalLink className="w-3 h-3 text-sky-400/60 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Engine & Dependency Status Cards */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-sky-400" />
                      Engine & Dependency Status
                    </h5>
                    <button
                      type="button"
                      onClick={handleCopyDiagnostics}
                      className="text-[11px] text-slate-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer"
                      title="Copy diagnostic information to clipboard"
                    >
                      {copiedDiagnostics ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy System Diagnostics</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {/* yt-dlp */}
                    <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400">yt-dlp Core</span>
                        {systemStatus?.version && systemStatus.version !== 'Not detected' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Installed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> Missing
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-mono font-bold text-white truncate">
                          {systemStatus?.version || 'Ready'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Media stream extractor</p>
                      </div>
                    </div>

                    {/* FFmpeg */}
                    <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400">FFmpeg</span>
                        {systemStatus?.ffmpeg || systemStatus?.ffmpeg_installed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Detected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> Not Found
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-mono font-bold text-white truncate">
                          {systemStatus?.ffmpegVersion || (systemStatus?.ffmpeg ? 'Active' : 'Optional')}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Muxing & conversion</p>
                      </div>
                    </div>

                    {/* FFprobe */}
                    <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400">FFprobe</span>
                        {systemStatus?.ffprobe ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Detected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> Not Found
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-mono font-bold text-white truncate">
                          {systemStatus?.ffprobeVersion || (systemStatus?.ffprobe ? 'Active' : 'Not installed')}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Stream inspection</p>
                      </div>
                    </div>

                    {/* aria2 */}
                    <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400">aria2</span>
                        {systemStatus?.aria2c ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            Optional
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-mono font-bold text-white truncate">
                          {systemStatus?.aria2cVersion || (systemStatus?.aria2c ? 'Active' : 'Not installed')}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Multi-socket acceleration</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommended Multimedia Toolchain Callout */}
                <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs text-indigo-200/90 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-indigo-300 block mb-0.5">Recommended Multimedia Toolchain</span>
                    <span>Installing the <strong>FFmpeg essentials build</strong> (via winget: <code>winget install Gyan.FFmpeg</code>) bundles both <code>ffmpeg</code> and <code>ffprobe</code> together, unlocking full audio extraction, video muxing, and accurate media stream probing.</span>
                  </div>
                </div>

                {/* Runtime & Storage Environment */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <h5 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                    Runtime & Storage Details
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400">Platform OS & Runtime:</span>
                      <p className="font-mono text-white font-medium">
                        {isNativeWindowsDesktop()
                          ? 'Windows Native (Tauri Desktop)'
                          : isNativeTauri()
                          ? 'Desktop Client (Tauri)'
                          : `Web Browser (${navigator.platform || 'Client'})`}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400">Execution Mode:</span>
                      <p className="font-mono text-sky-300 font-medium">
                        {isNativeWindowsDesktop()
                          ? 'Standalone Native Desktop'
                          : isNativeTauri()
                          ? 'Tauri Native App'
                          : 'Web Client (Node Server Backend)'}
                      </p>
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-[11px] text-slate-400">Active Download Directory:</span>
                      <p className="font-mono text-slate-200 text-[11px] break-all bg-[#0c0f16] p-2.5 rounded-lg border border-[#1e2535]">
                        {systemStatus?.downloadDir || inputDir || '%USERPROFILE%\\Downloads'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Open Source & Legal Notice */}
                <div className="bg-[#121624] border border-[#202738] rounded-xl p-4 space-y-2.5 text-xs">
                  <h5 className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Open Source Credits & Legal Notice
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Powered by the community-driven <span className="text-slate-300 font-medium">yt-dlp</span> extractor engine, <span className="text-slate-300 font-medium">FFmpeg</span> multimedia framework, <span className="text-slate-300 font-medium">Tauri v2</span>, React 19, and Tailwind CSS.
                  </p>
                  <p className="text-[10px] text-slate-500 leading-relaxed border-t border-[#1f2738] pt-2">
                    {APP_DISCLAIMER}
                  </p>
                  <div className="pt-2 border-t border-[#1f2738] flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => api.openExternalUrl(APP_HOMEPAGE_URL)}
                        className="text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer font-mono"
                      >
                        <Globe className="w-3 h-3" />
                        <span>ytdlpc.chamindu.lk</span>
                      </button>
                      <span className="text-slate-600">•</span>
                      <button
                        type="button"
                        onClick={() => api.openExternalUrl(APP_PRIVACY_URL)}
                        className="text-slate-400 hover:text-slate-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldCheck className="w-3 h-3 text-slate-500" />
                        <span>Privacy Policy</span>
                      </button>
                      <span className="text-slate-600">•</span>
                      <span>Licensed under the MIT License</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => api.openExternalUrl(`https://github.com/${APP_REPO}/issues`)}
                      className="text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Report an issue or request a feature</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-12 bg-[#141824] border-t border-[#232c3f] px-4 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Settings saved automatically to config.json</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
