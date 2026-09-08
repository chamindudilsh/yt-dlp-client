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
  ShieldCheck
} from 'lucide-react';
import { 
  TaskOptions, 
  SponsorBlockAction, 
  SystemStatus,
  DownloadDirInfo
} from '../types';
import { 
  SPONSORBLOCK_CATEGORIES, 
  SPONSORBLOCK_PRESETS 
} from '../constants/sponsorblock';
import { api } from '../lib/apiBridge';
import { 
  APP_NAME, 
  APP_VERSION, 
  APP_REPO, 
  APP_RELEASES_URL 
} from '../constants/app';

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

  const handleCopyDiagnostics = () => {
    const diag = {
      app: {
        name: APP_NAME,
        version: APP_VERSION,
        repo: APP_REPO,
      },
      system: {
        os: systemStatus?.os || navigator.platform,
        portableMode: Boolean(systemStatus?.portableMode),
        downloadDir: systemStatus?.downloadDir || '',
      },
      binaries: {
        ytdlpVersion: systemStatus?.version || 'Not detected',
        ytdlpInstalled: Boolean(systemStatus?.ytdlp_installed ?? (systemStatus?.version && systemStatus?.version !== 'Not detected')),
        ffmpegInstalled: Boolean(systemStatus?.ffmpeg ?? systemStatus?.ffmpeg_installed),
        ffprobeInstalled: Boolean(systemStatus?.ffprobe),
        ffprobeVersion: systemStatus?.ffprobeVersion || 'Not detected',
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
  const isInfoActive = activeTab === 'info';

  const previewFilename = (template: string) => {
    const audioExt = options.defaultAudioFormat === 'opus' ? 'opus' : 
      options.defaultAudioFormat === 'flac' ? 'flac' : 
      options.defaultAudioFormat === 'wav' ? 'wav' : 
      options.defaultAudioFormat?.startsWith('mp3') ? 'mp3' : 'm4a';
    return template
      .replace(/%\(title\)s/g, 'Never Gonna Give You Up')
      .replace(/%\(artist,uploader\)s/g, 'Rick Astley')
      .replace(/%\(artist\)s/g, 'Rick Astley')
      .replace(/%\(uploader\)s/g, 'Rick Astley')
      .replace(/%\(id\)s/g, 'dQw4w9WgXcQ')
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
              <span>Cookies & Auth</span>
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

                {/* Engine Health & System Status */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">
                      System & Engine Health
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 bg-[#181e2b] rounded-lg border border-slate-800 space-y-1">
                      <span className="text-slate-400 text-[11px] block">yt-dlp Engine</span>
                      <span className={`font-mono font-medium block ${systemStatus?.version && !systemStatus?.version.includes('Not detected') ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {systemStatus?.version || 'Ready'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-[#181e2b] rounded-lg border border-slate-800 space-y-1">
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

                    <div className="p-2.5 bg-[#181e2b] rounded-lg border border-slate-800 space-y-1">
                      <span className="text-slate-400 text-[11px] block">App Environment</span>
                      <span className="text-sky-300 font-mono font-medium block">
                        {systemStatus?.os?.includes('Windows') ? 'Windows Client' : 'Portable Desktop'}
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
                          M4A uses native AAC (No transcode loss)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'm4a', label: 'M4A (AAC Native — Best)', desc: 'Fast, Zero Loss' },
                          { id: 'opus', label: 'OPUS (High Efficiency)', desc: 'Native Stream' },
                          { id: 'flac', label: 'FLAC Lossless', desc: 'Master Audio' },
                          { id: 'wav', label: 'WAV Uncompressed', desc: 'PCM Master' },
                          { id: 'mp3_320', label: 'MP3 320 kbps', desc: 'Legacy Compat' },
                          { id: 'mp3_256', label: 'MP3 256 kbps', desc: 'Legacy Compat' },
                          { id: 'mp3_192', label: 'MP3 192 kbps', desc: 'Legacy Compat' },
                        ].map(fmt => (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => setOptions(prev => ({ ...prev, defaultAudioFormat: fmt.id }))}
                            className={`py-1.5 px-2 rounded-lg border text-left transition flex flex-col justify-center ${
                              (options.defaultAudioFormat || 'm4a') === fmt.id
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
              </div>
            )}

            {/* TAB 6: ABOUT & SYSTEM INFO */}
            {isInfoActive && (
              <div className="space-y-4 animate-in fade-in duration-150 text-xs">
                {/* Hero Branding Card */}
                <div className="bg-gradient-to-br from-[#161c2b] via-[#121624] to-[#0e121c] border border-[#232c3f] rounded-xl p-5 relative overflow-hidden shadow-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500/25 via-indigo-500/20 to-emerald-500/20 border border-sky-500/40 flex items-center justify-center shadow-lg shadow-sky-950/50 shrink-0">
                        <Sparkles className="w-6 h-6 text-sky-400" />
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
                          {systemStatus?.ffmpeg ? 'Active & Ready' : 'Optional Transcoder'}
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
                      <span className="text-[11px] text-slate-400">Platform OS:</span>
                      <p className="font-mono text-white font-medium capitalize">
                        {systemStatus?.os || 'Windows'} (x64)
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400">Storage Mode:</span>
                      <p className="font-mono text-sky-300 font-medium">
                        {systemStatus?.portableMode ? 'Portable Mode (config.json in app directory)' : 'Standard Application Mode'}
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
