import React, { useState, useEffect } from 'react';
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
  Lock, 
  Unlock, 
  FolderDown, 
  FolderOpen,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Globe,
  Smartphone,
  Tv,
  Zap,
  Moon,
  Power,
  Gauge,
  Layers,
  Bell,
  Monitor,
  Send,
  Archive,
  Trash2
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
  APP_RELEASES_URL,
  DEFAULT_USER_AGENT
} from '../constants/app';
import { PLAYER_CLIENTS, getPlayerClientInfo } from '../constants/playerClients';

export type SettingsTab = 
  | 'general' 
  | 'download' 
  | 'formats' 
  | 'selection' 
  | 'audio' 
  | 'naming' 
  | 'subtitles' 
  | 'sponsorblock' 
  | 'cookies'
  | 'advanced'
  | 'info';

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
  initialTab = 'general',
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
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
  const [copiedPoToken, setCopiedPoToken] = useState(false);
  const [copiedVisitorData, setCopiedVisitorData] = useState(false);
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);
  const [copiedAria2Command, setCopiedAria2Command] = useState(false);
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [archiveStats, setArchiveStats] = useState<{ count: number; path: string; exists: boolean } | null>(null);
  const [clearingArchive, setClearingArchive] = useState(false);
  const [confirmClearArchive, setConfirmClearArchive] = useState(false);
  const [archiveClearedFeedback, setArchiveClearedFeedback] = useState(false);

  const loadArchiveStats = async () => {
    try {
      const stats = await api.getArchiveStats(options.downloadArchivePath);
      setArchiveStats(stats);
    } catch {}
  };

  useEffect(() => {
    if (isOpen && (activeTab === 'general' || !activeTab)) {
      loadArchiveStats();
    }
  }, [isOpen, activeTab, options.downloadArchivePath]);

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

  // Sync initial tab if changed from outside
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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
      // Check for saved cookies on server safely
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

  if (!isOpen) return null;

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

  // Grouped active tab check
  const isGeneralActive = activeTab === 'general' || activeTab === 'download';
  const isFormatsActive = activeTab === 'formats' || activeTab === 'selection' || activeTab === 'audio' || activeTab === 'naming';
  const isSubtitlesActive = activeTab === 'subtitles';
  const isSponsorBlockActive = activeTab === 'sponsorblock';
  const isCookiesActive = activeTab === 'cookies';
  const isAdvancedActive = activeTab === 'advanced';
  const isInfoActive = activeTab === 'info';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#10141d] border border-[#232b3e] rounded-xl w-full max-w-4xl h-[620px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="h-12 bg-[#141824] border-b border-[#232b3e] px-4 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-sky-500/20 text-sky-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-white">
                Application Settings
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Clean Left Sidebar */}
          <aside className="w-full md:w-52 bg-[#0c0f16] border-b md:border-b-0 md:border-r border-[#1e2535] p-2.5 space-y-1 shrink-0 overflow-y-auto">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isGeneralActive
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <FolderDown className="w-4 h-4 text-sky-400 shrink-0" />
              <span>General & Storage</span>
            </button>

            <button
              onClick={() => setActiveTab('formats')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isFormatsActive
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Media & Formats</span>
            </button>

            <button
              onClick={() => setActiveTab('subtitles')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isSubtitlesActive
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <Subtitles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Subtitles</span>
            </button>

            <button
              onClick={() => setActiveTab('sponsorblock')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isSponsorBlockActive
                  ? 'bg-[#1b2333] text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>SponsorBlock Skipping</span>
            </button>

            <button
              onClick={() => setActiveTab('cookies')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isCookiesActive
                  ? 'bg-[#1b2333] text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <Cookie className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Auth & Player Client</span>
            </button>

            <button
              onClick={() => setActiveTab('advanced')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isAdvancedActive
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Advanced & Network</span>
            </button>

            <button
              onClick={() => setActiveTab('info')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isInfoActive
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>About & Info</span>
            </button>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 h-full p-4 md:p-6 overflow-y-auto space-y-4">
            {/* TAB 1: GENERAL & STORAGE */}
            {isGeneralActive && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Download Location Section */}
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
                      className="text-xs bg-[#1a2233] hover:bg-[#222c42] border border-[#2d3a54] text-slate-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 transition"
                      title="Open folder in File Explorer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                      <span>{openingFolder ? 'Opening...' : 'Open in Explorer'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">
                    Target directory where all downloaded videos, audio files, and subtitles will be saved.
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
                        className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition shrink-0"
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
                        className="text-[11px] bg-[#181f2f] hover:bg-[#20293d] border border-slate-700 text-slate-300 px-2.5 py-1 rounded transition"
                      >
                        Default (%USERPROFILE%\Downloads)
                      </button>
                      <button
                        type="button"
                        onClick={handleResetDownloadDir}
                        className="text-[11px] text-slate-400 hover:text-white px-2 py-1 transition flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Download Archive Section */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Archive className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Download Archive
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
                    Tracks previously downloaded video IDs in a local archive file (<code className="text-slate-300">archive.txt</code>). When downloading large playlists or updating channels, yt-dlp checks this list and skips already-downloaded videos instantly without re-fetching streams.
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

                {/* Interface Preferences */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-sky-400" />
                    <h4 className="text-sm font-semibold text-white">
                      Downloader Interface
                    </h4>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Simplified Downloader View
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Keeps the main screen clean by hiding advanced flags and technical formatting chips
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
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

                {/* Desktop Integration & Notifications */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Monitor className="w-4 h-4 text-sky-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Desktop Integration & Notifications
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-sky-400 bg-sky-950/40 border border-sky-500/30 px-2 py-0.5 rounded-full">
                      System & Background
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Configure background operation, system tray behavior, taskbar progress indicator, and system notifications.
                  </p>

                  <div className="space-y-3 divide-y divide-slate-800/60 pt-1">
                    {/* Minimize to System Tray */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Minimize to System Tray
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Adds quick minimize to tray action and keeps downloads active in the background
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
                          Clicking the window close (X) button hides to tray instead of quitting
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

                    {/* Native Desktop & Browser Notifications */}
                    <div className="pt-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white block">
                              Desktop & Browser Notifications
                            </span>
                            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                              Windows & Web
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Master switch for system and browser notifications when downloads finish or fail (click opens file/folder)
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
                        <div className="pl-3.5 pr-2 py-2 bg-[#0c0f16] border border-slate-800/60 rounded-lg space-y-2 animate-in fade-in duration-100">
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
                    </div>
                  </div>

                  {/* Send Test Notification Button */}
                  <div className="pt-2 flex items-center justify-between bg-[#0e121b] border border-slate-800/80 rounded-lg p-2.5">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="text-xs text-slate-300">Test Notification</span>
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

                {/* Engine Health & System Status */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">
                      System & Engine Health
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 text-xs">
                    <div className="p-2.5 bg-[#181e2b] rounded-lg border border-slate-800 space-y-1">
                      <span className="text-slate-400 text-[11px] block">yt-dlp Engine</span>
                      <span className={`font-mono font-medium block ${systemStatus?.version && !systemStatus?.version.includes('Not detected') ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {systemStatus?.version || 'Ready'}
                      </span>
                    </div>

                    <div 
                      className="p-2.5 bg-[#181e2b] rounded-lg border border-slate-800 space-y-1"
                      title={systemStatus?.ffmpegVersion || (systemStatus?.ffmpeg ? 'FFmpeg active' : 'FFmpeg not detected')}
                    >
                      <span className="text-slate-400 text-[11px] block">FFmpeg Linked</span>
                      <span className={`font-mono font-medium block ${systemStatus?.ffmpeg ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {systemStatus?.ffmpeg ? 'Installed & Active' : 'Not Detected'}
                      </span>
                    </div>

                    <div 
                      className="p-2.5 bg-[#181e2b] rounded-lg border border-slate-800 space-y-1"
                      title={systemStatus?.ffprobeVersion || (systemStatus?.ffprobe ? 'ffprobe active' : 'ffprobe analyzer not detected')}
                    >
                      <span className="text-slate-400 text-[11px] block">ffprobe Analyzer</span>
                      <span className={`font-mono font-medium block ${systemStatus?.ffprobe ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {systemStatus?.ffprobe ? 'Installed & Active' : 'Not Detected'}
                      </span>
                    </div>

                    <div 
                      className="p-2.5 bg-[#181e2b] rounded-lg border border-slate-800 space-y-1"
                      title={systemStatus?.aria2cVersion || (systemStatus?.aria2c ? 'aria2 multi-connection engine active' : 'aria2c not detected (optional)')}
                    >
                      <span className="text-slate-400 text-[11px] block">aria2 Engine</span>
                      <span className={`font-mono font-medium block ${systemStatus?.aria2c ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {systemStatus?.aria2c ? 'Installed & Ready' : 'Optional / Off'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-[#181e2b] rounded-lg border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
                      <span className="text-slate-400 text-[11px] block">App Environment</span>
                      <span className="text-sky-300 font-mono font-medium block truncate">
                        {isNativeWindowsDesktop()
                          ? 'Windows Native'
                          : isNativeTauri()
                          ? 'Desktop Client'
                          : 'Web Browser'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs text-indigo-200/90 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-indigo-300 block mb-0.5">Recommended Multimedia Toolchain</span>
                      <span>Installing the <strong>FFmpeg essentials build</strong> (e.g. from gyan.dev or package managers like winget/scoop) is highly recommended. It bundles both <code>ffmpeg</code> and <code>ffprobe</code> together, unlocking full audio extraction, video muxing, and accurate media stream inspection.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MEDIA & FORMATS */}
            {isFormatsActive && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Default Media Mode */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-white">
                    Default Download Mode
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, defaultMediaType: 'video' }))}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition ${
                        (options.defaultMediaType || 'video') === 'video'
                          ? 'bg-sky-600 text-white border-sky-500'
                          : 'bg-[#181e2b] text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <Film className="w-4 h-4" />
                      <span>Video Mode (MP4)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, defaultMediaType: 'audio' }))}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition ${
                        options.defaultMediaType === 'audio'
                          ? 'bg-sky-600 text-white border-sky-500'
                          : 'bg-[#181e2b] text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <Music className="w-4 h-4" />
                      <span>Audio Mode (MP3 / FLAC)</span>
                    </button>
                  </div>
                </div>

                {/* Video & Audio Quality */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-white">
                    Quality Defaults
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block mb-1.5">
                        Preferred Video Resolution:
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: '2160p', label: '4K (2160p)' },
                          { id: '1080p', label: 'Full HD (1080p)' },
                          { id: '720p', label: 'HD (720p)' },
                          { id: 'best', label: 'Best Available' },
                        ].map(res => (
                          <button
                            key={res.id}
                            type="button"
                            onClick={() => setOptions(prev => ({ ...prev, defaultVideoFormat: res.id }))}
                            className={`py-1.5 px-2 rounded-lg border text-center transition ${
                              (options.defaultVideoFormat || '1080p') === res.id
                                ? 'bg-sky-500/20 text-sky-400 border-sky-500 font-medium'
                                : 'bg-[#181e2b] text-slate-300 border-slate-700 hover:bg-slate-800'
                            }`}
                          >
                            {res.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-400 font-medium block">
                          Preferred Audio Format & Quality:
                        </span>
                        <span className="text-[11px] text-emerald-400">
                          Best Available uses native stream (Zero transcode loss & no size bloat)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'best', label: 'Best Available (Native)', desc: 'Original Stream, Zero Bloat' },
                          { id: 'm4a', label: 'M4A (AAC Native)', desc: 'Fast, Zero Loss' },
                          { id: 'opus', label: 'OPUS (High Efficiency)', desc: 'Native Stream' },
                          { id: 'flac', label: 'FLAC Lossless', desc: 'Master Audio' },
                          { id: 'wav', label: 'WAV Uncompressed', desc: 'PCM Master' },
                          { id: 'mp3_auto', label: 'MP3 (VBR V0)', desc: 'Dynamic Match' },
                          { id: 'mp3_320', label: 'MP3 320 kbps', desc: 'Legacy Hardware' },
                          { id: 'mp3_256', label: 'MP3 256 kbps', desc: 'Legacy Compat' },
                        ].map(fmt => (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => setOptions(prev => ({ ...prev, defaultAudioFormat: fmt.id }))}
                            className={`py-1.5 px-2 rounded-lg border text-left transition flex flex-col justify-center ${
                              (options.defaultAudioFormat || 'best') === fmt.id
                                ? 'bg-sky-500/20 text-sky-400 border-sky-500 font-medium'
                                : 'bg-[#181e2b] text-slate-300 border-slate-700 hover:bg-slate-800'
                            }`}
                          >
                            <span className="text-xs font-semibold">{fmt.label}</span>
                            <span className="text-[10px] text-slate-400">{fmt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Album Art & Tags */}
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
                            Crops horizontal YouTube thumbnails to square album covers for music players and car displays via FFmpeg
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
                            Embeds artist, title, release date, and video chapters directly into the output file
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

                {/* File Naming Template */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">
                      File Naming Template
                    </h4>
                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, namingTemplate: '%(title)s - %(artist,uploader)s.%(ext)s' }))}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset to Default</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={options.namingTemplate || '%(title)s - %(artist,uploader)s.%(ext)s'}
                    onChange={e => setOptions(prev => ({ ...prev, namingTemplate: e.target.value }))}
                    className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500 transition"
                  />

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '%(title)s', label: 'Title' },
                      { tag: '%(artist,uploader)s', label: 'Artist' },
                      { tag: '%(uploader)s', label: 'Uploader' },
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
                        className="text-[10px] font-mono bg-[#181f2f] hover:bg-[#20293d] border border-slate-700 text-slate-300 px-2 py-0.5 rounded transition"
                      >
                        +{item.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-2 rounded bg-[#0b0e14] border border-slate-800 text-[11px] font-mono text-slate-400 truncate">
                    <span className="text-slate-500">Preview: </span>
                    <span className="text-sky-300">{previewFilename(options.namingTemplate || '%(title)s - %(artist,uploader)s.%(ext)s')}</span>
                  </div>
                </div>

                {/* File Conflict Handling */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Existing File Conflict Handling</h4>
                      <p className="text-xs text-slate-400">
                        When the destination folder already contains a file with the same name
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Auto-Numbering Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, fileCollisionAction: 'number' }))}
                      className={`p-3 rounded-lg border text-left transition ${
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
                        Saves duplicate as <code className="text-sky-300 font-mono">Title (1).ext</code>, <code className="text-sky-300 font-mono">Title (2).ext</code>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, fileCollisionAction: 'overwrite' }))}
                      className={`p-3 rounded-lg border text-left transition ${
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
              </div>
            )}

            {/* TAB 3: SUBTITLES */}
            {isSubtitlesActive && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        Subtitle Downloads
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
                      <div className="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-600"></div>
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
                        className="text-xs text-sky-400 hover:text-sky-300 font-medium px-2.5 py-1 rounded bg-sky-950/50 border border-sky-800/50 transition shrink-0 ml-3"
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
                          className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                        />
                        <div className="flex gap-1.5 pt-1.5">
                          {['en.*', 'all', 'es', 'ja'].map(l => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => setOptions(prev => ({
                                ...prev,
                                subtitles: { ...prev.subtitles, langs: l }
                              }))}
                              className="text-[10px] font-mono bg-[#181f2f] hover:bg-[#20293d] border border-slate-700 text-slate-300 px-2 py-0.5 rounded transition"
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <label className="flex items-center justify-between cursor-pointer p-2 rounded bg-[#181e2b] border border-slate-800">
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
                            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                          />
                        </label>

                        <label className="flex items-center justify-between cursor-pointer p-2 rounded bg-[#181e2b] border border-slate-800">
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
                            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: SPONSORBLOCK SKIPPING */}
            {isSponsorBlockActive && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>SponsorBlock Skipping</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Automatically skip or mark sponsors, intro sequences, credits, and non-music portions using community timestamps
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
                        className="text-xs text-amber-400 hover:text-amber-300 font-medium px-2.5 py-1 rounded bg-amber-950/50 border border-amber-800/50 transition shrink-0 ml-3"
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
                              className="p-2 rounded-lg bg-[#181e2b] hover:bg-[#20293d] border border-slate-700 text-left transition"
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
                                    className={`text-[11px] px-2.5 py-1 rounded transition flex items-center gap-1 ${
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
                                    className={`text-[11px] px-2.5 py-1 rounded transition flex items-center gap-1 ${
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
                                    className={`text-[11px] px-2 py-1 rounded transition ${
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
                            className="flex-1 bg-[#0b0e14] border border-slate-700/80 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                          />
                          <button
                            type="button"
                            onClick={testApiConnection}
                            disabled={apiTestStatus === 'testing'}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded transition shrink-0"
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

                      {/* Live CLI Snippet */}
                      <div className="p-2.5 rounded bg-[#0b0e14] border border-slate-800 text-[11px] font-mono text-slate-400 truncate">
                        <span className="text-slate-500">Flags: </span>
                        <span className="text-amber-300">{getSponsorBlockCliSnippet()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: COOKIES & AUTHENTICATION */}
            {isCookiesActive && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Browser Cookie Extraction */}
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
                          className={`p-2 rounded-lg border text-center transition ${
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
                          className="text-[11px] text-slate-400 hover:text-white"
                        >
                          Disable
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Netscape cookies.txt Editor */}
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
                    rows={4}
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
                          className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 transition"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveCookies}
                        disabled={savingCookies || !cookiesContent.trim()}
                        className="text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg transition"
                      >
                        {savingCookies ? 'Saving...' : 'Save Cookies'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* BotGuard & PO Token Bypass */}
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
                      className="text-xs bg-[#1a2233] hover:bg-[#222c42] border border-[#2d3a54] text-slate-200 px-2.5 py-1 rounded-md transition"
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
                        className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5"
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

                {/* YouTube Player Client Persona Selection */}
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
                          Switches the client persona yt-dlp impersonates on YouTube. Highly effective for bypassing HTTP 429, bot checks, sign-in walls, and download speed throttling.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                      <span className="text-[11px] text-slate-400">Active Client:</span>
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
              </div>
            )}

            {/* TAB 6: ADVANCED & NETWORK */}
            {isAdvancedActive && (
              <div className="space-y-4 animate-in fade-in duration-150">

                {/* Concurrent Active Downloads Card */}
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

                {/* Download Speed Limiter & Bandwidth Throttling Card */}
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
                    Restricts the maximum socket download speed passed via <code className="text-sky-300">--limit-rate</code> to prevent yt-dlp from saturating your local internet connection during large media downloads.
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
                        <p className="text-[10px] text-slate-400">
                          Alternatively, place <code>aria2c.exe</code> directly into your application directory or <code>bin/</code> folder.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* System WakeLock & Power Automation Card (Native Windows Desktop Only) */}
                {isNativeWindowsDesktop() && (
                  <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">
                            Power & System Automation
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Manage system sleep prevention and post-download shutdown or suspend actions
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

                {/* Header Card */}
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
                          Browser identity string used for search requests, web scraping, and media downloads
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
                        <span>Reset to Default</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    This User-Agent string is sent with all web requests, including YouTube / YouTube Music InnerTube search, SoundCloud API search, and yt-dlp extractor executions. Leaving this as the default modern Chrome signature ensures compatibility and helps avoid bot detection.
                  </p>

                  <div className="space-y-2">
                    <textarea
                      rows={3}
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
                      <button
                        type="button"
                        onClick={() => setOptions(prev => ({
                          ...prev,
                          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15'
                        }))}
                        className="text-[11px] bg-[#181f2f] hover:bg-[#20293d] border border-slate-700 text-slate-300 px-2.5 py-1 rounded transition cursor-pointer"
                      >
                        Safari macOS
                      </button>
                    </div>
                  </div>
                </div>

                {/* Network Proxy Configuration Card */}
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
                          Route media downloads, stream metadata queries, and searches via HTTP, HTTPS, or SOCKS5 proxy
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

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Useful for bypassing regional geo-restrictions, unblocking school or workplace firewalls, or preventing IP rate-limiting. Supports HTTP, HTTPS, and SOCKS5 protocols (including authentication credentials).
                  </p>

                  <div className="space-y-3 pt-1 border-t border-slate-800/80">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-slate-300 font-medium">
                          Proxy Server Address:
                        </label>
                        <span className="text-[10px] font-mono text-slate-500">
                          [protocol]://[user:pass@]host:port
                        </span>
                      </div>
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
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500 mr-1">Quick Presets:</span>
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
                        Tor SOCKS5 (127.0.0.1:9050)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Additional Info Callout */}
                <div className="bg-[#121624] border border-[#202738] rounded-xl p-4 space-y-2 text-xs">
                  <h5 className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Privacy & Rate Limit Notice
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Custom User-Agents allow bypassing restrictive corporate proxies or mimicking specific client configurations. If search queries or video stream extractions encounter HTTP 403 or bot-detection errors, click <span className="text-sky-300 font-medium">Reset to Default</span> or configure cookies and player client personas under the{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('cookies')}
                      className="text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer"
                    >
                      Auth & Player Client
                    </button>{' '}
                    tab.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 7: ABOUT & SYSTEM INFO */}
            {isInfoActive && (
              <div className="space-y-4 animate-in fade-in duration-150 text-xs">
                {/* Hero Branding Card */}
                <div className="bg-gradient-to-br from-[#161c2b] via-[#121624] to-[#0e121c] border border-[#232c3f] rounded-xl p-5 relative overflow-hidden shadow-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-xl bg-[#141824] border border-[#252e42] flex items-center justify-center shadow-lg shadow-black/40 shrink-0 p-2">
                        <img src="/icon.png" alt="yt-dlp Client Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white tracking-wide">{APP_NAME}</h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            v{APP_VERSION}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 max-w-lg leading-relaxed">
                          Modern desktop GUI client for yt-dlp on Windows with batch downloading, SponsorBlock segment skipping, 1:1 album art cropping, media probing, and portable mode.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => api.openExternalUrl(`https://github.com/${APP_REPO}`)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-[#1a2233] hover:bg-[#232c42] border border-[#2d3a54] text-slate-200 hover:text-white transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer"
                      >
                        <span>GitHub</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => api.openExternalUrl(APP_RELEASES_URL)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 hover:text-sky-200 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer"
                      >
                        <span>Releases</span>
                        <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* System & Binary Environment Status */}
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                        <p className="text-xs font-mono font-bold text-white">
                          {systemStatus?.version || '2026.08.19'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Media extractor & stream parser</p>
                      </div>
                    </div>

                    {/* FFmpeg */}
                    <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400">FFmpeg Transcoder</span>
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
                        <p className="text-xs font-mono font-bold text-white">
                          {systemStatus?.ffmpegVersion || (systemStatus?.ffmpeg ? 'Active & Ready' : 'Optional Transcoder')}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Muxing, audio conversion & covers</p>
                      </div>
                    </div>

                    {/* FFprobe */}
                    <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400">FFprobe Inspector</span>
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
                        <p className="text-xs font-mono font-bold text-white">
                          {systemStatus?.ffprobeVersion || (systemStatus?.ffprobe ? 'Active & Ready' : 'Not installed')}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Stream codec & bitrate inspector</p>
                      </div>
                    </div>
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
                      <span className="text-[11px] text-slate-400">Download Directory:</span>
                      <p className="font-mono text-slate-200 text-[11px] break-all bg-[#0c0f16] p-2.5 rounded-lg border border-[#1e2535]">
                        {systemStatus?.downloadDir || '%USERPROFILE%\\Downloads'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Open Source & Credits */}
                <div className="bg-[#121624] border border-[#202738] rounded-xl p-4 space-y-2 text-xs">
                  <h5 className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Open Source Credits & Components
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Powered by the community-driven <span className="text-slate-300 font-medium">yt-dlp</span> extractor engine, <span className="text-slate-300 font-medium">FFmpeg</span> multimedia framework, <span className="text-slate-300 font-medium">Tauri v2</span>, React 19, and Tailwind CSS.
                  </p>
                  <div className="pt-2 border-t border-[#1f2738] flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                    <span>Licensed under the MIT License</span>
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
        <div className="h-12 bg-[#141824] border-t border-[#232b3e] px-4 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Settings saved automatically to config.json (Application Root)</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
