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
  Sparkles, 
  Scissors, 
  Bookmark, 
  PowerOff, 
  ExternalLink,
  Info,
  Server,
  Terminal,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sliders,
  Layers,
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
  FileCode,
  Globe,
  Folder,
  FolderDown,
  FolderOpen
} from 'lucide-react';
import { 
  TaskOptions, 
  SponsorBlockAction, 
  SystemStatus,
  MediaType,
  DownloadDirInfo
} from '../types';
import { 
  SPONSORBLOCK_CATEGORIES, 
  SPONSORBLOCK_PRESETS 
} from '../constants/sponsorblock';
import { api } from '../lib/apiBridge';

export type SettingsTab = 'download' | 'selection' | 'sponsorblock' | 'audio' | 'naming' | 'subtitles' | 'cookies' | 'general';

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
  initialTab = 'download',
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
    }
  }, [isOpen]);

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
        setDirFeedback({ type: 'success', message: 'Download location updated successfully' });
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

  const handleBrowseFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        if (dirHandle && dirHandle.name) {
          const chosenName = dirHandle.name;
          const newPath = `%USERPROFILE%\\Downloads\\${chosenName}`;
          setInputDir(newPath);
          handleSaveDownloadDir(newPath);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Directory picker error:', err);
        }
      }
    } else {
      const manual = window.prompt('Enter or paste folder path for downloads:', inputDir || '%USERPROFILE%\\Downloads');
      if (manual && manual.trim()) {
        setInputDir(manual.trim());
        handleSaveDownloadDir(manual.trim());
      }
    }
  };

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
  const [showManualGuide, setShowManualGuide] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Check for saved cookies on server
      fetch('/api/auth/get-cookies')
        .then(r => r.json())
        .then(data => {
          setCookiesServerStatus(data);
          if (data.content && !cookiesContent) {
            setCookiesContent(data.content);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Handle PO Token Generation
  const handleGeneratePoToken = async () => {
    setGeneratingPoToken(true);
    setPoTokenFeedback(null);
    try {
      const res = await fetch('/api/auth/generate-potoken', { method: 'POST' });
      const data = await res.json();
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
          msg: `MINTED Web Client PO Token & Live Visitor Data (${data.visitorData.slice(0, 18)}...)`
        });
      } else {
        setPoTokenFeedback({ ok: false, msg: data.error || 'Failed to generate Web Client PO token.' });
      }
    } catch (e: any) {
      setPoTokenFeedback({ ok: false, msg: e.message || 'Network error minting PO token.' });
    } finally {
      setGeneratingPoToken(false);
    }
  };

  // Handle Cookies Save
  const handleSaveCookies = async () => {
    if (!cookiesContent.trim()) return;
    setSavingCookies(true);
    try {
      const res = await fetch('/api/auth/save-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cookiesContent })
      });
      const data = await res.json();
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

  // Handle Clear Cookies
  const handleClearCookies = async () => {
    try {
      await fetch('/api/auth/clear-cookies', { method: 'POST' });
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

  // Handle Cookies file upload
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

  // Test YouTube Bot Bypass
  const handleTestBypass = async () => {
    setTestingBypass(true);
    setBypassResult(null);
    try {
      const res = await fetch('/api/auth/test-bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth: options.auth })
      });
      const data = await res.json();
      if (data.ok) {
        setBypassResult({
          ok: true,
          message: 'Bypass Verified! YouTube accepted stream metadata without requesting bot authentication.'
        });
      } else {
        setBypassResult({
          ok: false,
          message: data.error || 'YouTube returned a blocking response.',
          isBotGuard: data.isBotGuard
        });
      }
    } catch (e: any) {
      setBypassResult({ ok: false, message: e.message || 'Connection failed during simulation.' });
    } finally {
      setTestingBypass(false);
    }
  };

  // Segment category action handlers
  const handleCategoryActionChange = (categoryId: string, action: SponsorBlockAction) => {
    const updatedActions = {
      ...options.sponsorblock.categoryActions,
      [categoryId]: action,
    };

    // Keep categories array in sync with remove actions for backward compatibility
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

  const setAllCategoriesTo = (action: SponsorBlockAction) => {
    const newActions: Record<string, SponsorBlockAction> = {};
    SPONSORBLOCK_CATEGORIES.forEach(cat => {
      newActions[cat.id] = action;
    });

    const removeCats = action === 'remove' ? SPONSORBLOCK_CATEGORIES.map(c => c.id) : [];

    setOptions(prev => ({
      ...prev,
      sponsorblock: {
        ...prev.sponsorblock,
        categoryActions: newActions,
        categories: removeCats,
      },
    }));
  };

  const testApiConnection = async () => {
    setApiTestStatus('testing');
    try {
      const res = await fetch('/api/sponsorblock/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: customApiUrl }),
      });
      const data = await res.json();
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

  // Compute active remove and mark categories for summary & live command
  const currentActions = options.sponsorblock.categoryActions || {};
  const removeList = Object.entries(currentActions).filter(([_, a]) => a === 'remove').map(([k]) => k);
  const markList = Object.entries(currentActions).filter(([_, a]) => a === 'mark').map(([k]) => k);

  const getSponsorBlockCliSnippet = () => {
    if (!options.sponsorblock.enabled) return '# SponsorBlock is currently disabled';
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
    return parts.length > 0 ? parts.join(' ') : '# No segment categories selected';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#10141d] border border-[#232b3e] rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Window Header */}
        <div className="h-12 bg-[#141824] border-b border-[#232b3e] px-4 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-sky-500/20 text-sky-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                Application Settings
                <span className="text-[10px] text-sky-400 font-mono bg-sky-950/60 border border-sky-800/50 px-1.5 py-0.5 rounded">
                  Windows 11 GUI
                </span>
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

        {/* Modal Body: Two-Column Windows 11 Settings Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Sidebar Navigation */}
          <aside className="w-full md:w-56 bg-[#0c0f16] border-b md:border-b-0 md:border-r border-[#1e2535] p-2 space-y-1 shrink-0 overflow-y-auto">
            <button
              onClick={() => setActiveTab('download')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'download'
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderDown className="w-3.5 h-3.5 text-sky-400" />
                <span>Download Location</span>
              </span>
              <span className="text-[9px] font-mono bg-sky-950/60 text-sky-300 px-1 py-0.2 rounded border border-sky-800/40">
                Storage
              </span>
            </button>

            <button
              onClick={() => setActiveTab('selection')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'selection'
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>File Selection</span>
              </span>
              <span className="text-[9px] font-mono bg-sky-950/60 text-sky-300 px-1 py-0.2 rounded border border-sky-800/40">
                Layout
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sponsorblock')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'sponsorblock'
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>SponsorBlock</span>
              </span>
              <span className="text-[9px] font-mono bg-amber-950/60 text-amber-300 px-1 py-0.2 rounded border border-amber-800/40">
                Segments
              </span>
            </button>

            <button
              onClick={() => setActiveTab('audio')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'audio'
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <Crop className="w-3.5 h-3.5 text-rose-400" />
                <span>Audio & Album Art</span>
              </span>
              <span className="text-[9px] font-mono bg-rose-950/60 text-rose-300 px-1 py-0.2 rounded border border-rose-800/40">
                1:1 Crop
              </span>
            </button>

            <button
              onClick={() => setActiveTab('naming')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'naming'
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>File Naming</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('subtitles')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'subtitles'
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <Subtitles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Subtitles</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('cookies')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'cookies'
                  ? 'bg-[#1b2333] text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <Cookie className="w-3.5 h-3.5 text-amber-400" />
                <span>Cookies & Bot Fix</span>
              </span>
              <span className="text-[9px] font-mono bg-amber-950/60 text-amber-300 px-1 py-0.2 rounded border border-amber-800/40">
                PO Token
              </span>
            </button>

            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'general'
                  ? 'bg-[#1b2333] text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-[#131722] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Storage & Engine</span>
              </span>
            </button>
          </aside>

          {/* Right Main Content Area */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto bg-[#10141d] space-y-5">
            {/* TAB: Download Location */}
            {activeTab === 'download' && (
              <div className="space-y-4">
                {/* Header Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FolderDown className="w-4 h-4 text-sky-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Download Destination Directory
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800/50 px-2 py-0.5 rounded">
                      Windows 11 Target
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Choose where yt-dlp saves all downloaded videos, audio tracks, and playlists. By default on Windows, files are saved directly to your personal <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">%USERPROFILE%\Downloads</code> folder. When run in a browser or server environment, it automatically falls back to the <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">/downloads</code> project directory.
                  </p>
                </div>

                {/* Active Path & Status Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                      Current Active Location
                    </span>
                    <div className="flex items-center gap-2">
                      {downloadDirInfo?.isCustom ? (
                        <span className="text-[10px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/50 px-2 py-0.5 rounded">
                          Custom Path Configured
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" /> Default Path Active
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleOpenDownloadFolder}
                        disabled={openingFolder}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1.5 transition"
                        title="Open this folder in Windows Explorer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                        <span>{openingFolder ? 'Opening...' : 'Open Folder'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0d1017] rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] text-slate-400 block mb-0.5">Physical Filesystem Path:</span>
                      <p className="font-mono text-xs text-sky-300 truncate select-all">
                        {downloadDirInfo?.current || systemStatus?.downloadDir || '%USERPROFILE%\\Downloads'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const val = downloadDirInfo?.current || systemStatus?.downloadDir || '';
                        if (val) navigator.clipboard.writeText(val);
                      }}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition shrink-0"
                      title="Copy path to clipboard"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Configure Path Form */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-slate-200">
                      Set Custom Download Directory
                    </h5>
                    <button
                      type="button"
                      onClick={handleResetDownloadDir}
                      disabled={savingDir}
                      className="text-xs text-slate-400 hover:text-sky-300 flex items-center gap-1 transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset to Default</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-400 block">
                      Enter Directory Path (Supports Windows drive letters and %USERPROFILE% environment variable):
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Folder className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={inputDir}
                          onChange={(e) => setInputDir(e.target.value)}
                          placeholder="%USERPROFILE%\Downloads"
                          className="w-full bg-[#0d1017] border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none transition"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleBrowseFolder}
                          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
                          title="Select folder via directory browser or prompt"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-slate-300" />
                          <span>Browse...</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveDownloadDir()}
                          disabled={savingDir || !inputDir.trim()}
                          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition shadow"
                        >
                          {savingDir ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Apply</span>
                        </button>
                      </div>
                    </div>

                    {dirFeedback && (
                      <div
                        className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                          dirFeedback.type === 'success'
                            ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                            : 'bg-rose-950/60 border border-rose-800 text-rose-300'
                        }`}
                      >
                        {dirFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        )}
                        <span>{dirFeedback.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="space-y-2 pt-2 border-t border-[#1e2535]">
                    <span className="text-[11px] text-slate-400 block">Quick Destination Presets:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setInputDir('%USERPROFILE%\\Downloads');
                          handleSaveDownloadDir('%USERPROFILE%\\Downloads');
                        }}
                        className="p-2.5 rounded-lg bg-[#0d1017] hover:bg-[#151a24] border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                            <Folder className="w-3.5 h-3.5 text-sky-400" />
                            <span>Default Windows Downloads</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            %USERPROFILE%\Downloads
                          </span>
                        </div>
                        <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                          Standard
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const p = downloadDirInfo?.fallbackDir || './downloads';
                          setInputDir(p);
                          handleSaveDownloadDir(p);
                        }}
                        className="p-2.5 rounded-lg bg-[#0d1017] hover:bg-[#151a24] border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                            <Folder className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Project Location Folder</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            /downloads (Local fallback)
                          </span>
                        </div>
                        <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                          Portable
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInputDir('%USERPROFILE%\\Music');
                          handleSaveDownloadDir('%USERPROFILE%\\Music');
                        }}
                        className="p-2.5 rounded-lg bg-[#0d1017] hover:bg-[#151a24] border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                            <Music className="w-3.5 h-3.5 text-rose-400" />
                            <span>Windows Music Library</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            %USERPROFILE%\Music
                          </span>
                        </div>
                        <span className="text-[9px] bg-rose-950/40 text-rose-300 px-1.5 py-0.5 rounded border border-rose-800/40">
                          Audio
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInputDir('%USERPROFILE%\\Videos');
                          handleSaveDownloadDir('%USERPROFILE%\\Videos');
                        }}
                        className="p-2.5 rounded-lg bg-[#0d1017] hover:bg-[#151a24] border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                            <Film className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Windows Videos Library</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            %USERPROFILE%\Videos
                          </span>
                        </div>
                        <span className="text-[9px] bg-indigo-950/40 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800/40">
                          Video
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Informational Guidance */}
                <div className="bg-[#141926]/60 border border-[#232c3f]/80 rounded-xl p-3.5 text-xs text-slate-400 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                    <Info className="w-3.5 h-3.5 text-sky-400" />
                    <span>How yt-dlp uses this location</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    The download directory is passed directly to the yt-dlp execution engine via the <code className="text-slate-200 bg-slate-900 px-1 py-0.5 rounded">-P &quot;&lt;path&gt;&quot;</code> parameter. Any nested subdirectories defined by your file naming template (e.g. <code className="text-slate-200 bg-slate-900 px-1 py-0.5 rounded">%(uploader)s/%(title)s</code>) will be created relative to this base location.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: File Selection & Layout Defaults */}
            {activeTab === 'selection' && (
              <div className="space-y-4">
                {/* Header Banner */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-sky-400" />
                      <h4 className="text-sm font-semibold text-white">
                        File Selection & Interface Settings
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800/50 px-2 py-0.5 rounded">
                      YTDLnis Selection Parity
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Configure your primary download defaults and control interface simplicity. When simplified selection is enabled, complex template chips and codec matrixes are moved here, keeping the main downloader clean and fast.
                  </p>
                </div>

                {/* Simplified Mode Toggle Card */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Simplified File Selection Mode
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Hides heavy template builders, raw flag editors, and tag matrices from the main downloader screen
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
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                    </label>
                  </div>
                </div>

                {/* Default Media Type */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-white block">
                    Default Media Type
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, defaultMediaType: 'video' }))}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition ${
                        (options.defaultMediaType || 'video') === 'video'
                          ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                          : 'bg-[#181e2b] text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <Film className="w-4 h-4 text-sky-300" />
                      <span>Video (MP4 / MKV)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptions(prev => ({ ...prev, defaultMediaType: 'audio' }))}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition ${
                        options.defaultMediaType === 'audio'
                          ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                          : 'bg-[#181e2b] text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <Music className="w-4 h-4 text-rose-300" />
                      <span>Audio (MP3 / FLAC / Opus)</span>
                    </button>
                  </div>
                </div>

                {/* Default Video Quality Selection */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-white block">
                    Default Video Resolution & Codec Quality
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'best', label: 'Best Available', sub: 'Max res + highest audio' },
                      { id: '4k', label: '4K UHD (2160p)', sub: 'AV1 / VP9 60fps' },
                      { id: '1440p', label: '2K QHD (1440p)', sub: 'VP9 60fps' },
                      { id: '1080p', label: '1080p Full HD', sub: 'H.264 Universal' },
                      { id: '720p', label: '720p HD', sub: 'Standard Bandwidth' },
                      { id: '480p', label: '480p SD', sub: 'Lightweight File' },
                    ].map(q => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setOptions(prev => ({ ...prev, defaultVideoQuality: q.id }))}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          (options.defaultVideoQuality || 'best') === q.id
                            ? 'bg-sky-600/30 border-sky-500 text-white'
                            : 'bg-[#181e2b] border-slate-700/80 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-xs font-semibold block">{q.label}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{q.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Default Audio Format Selection */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-white block">
                    Default Audio Codec & Bitrate
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'mp3_320', label: 'MP3 320 kbps', sub: 'Studio CBR Quality' },
                      { id: 'flac', label: 'FLAC Lossless', sub: 'Bit-perfect FFmpeg' },
                      { id: 'm4a', label: 'M4A / AAC', sub: 'Apple Native 128k' },
                      { id: 'opus', label: 'Opus 160 kbps', sub: 'Highest Stream Fidelity' },
                      { id: 'wav', label: 'WAV 16-bit', sub: 'Uncompressed PCM' },
                    ].map(fmt => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setOptions(prev => ({ ...prev, defaultAudioFormat: fmt.id }))}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          (options.defaultAudioFormat || 'mp3_320') === fmt.id
                            ? 'bg-rose-600/30 border-rose-500 text-white'
                            : 'bg-[#181e2b] border-slate-700/80 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-xs font-semibold block">{fmt.label}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{fmt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* File Naming Template & Tag Chips */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white block">
                      Custom File Naming Template
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">yt-dlp -o format</span>
                  </div>

                  <input
                    type="text"
                    value={options.namingTemplate}
                    onChange={e => setOptions(prev => ({ ...prev, namingTemplate: e.target.value }))}
                    className="w-full bg-[#181d29] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />

                  {/* Template Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-400 block">Quick Presets:</span>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {[
                        '%(title)s [%(id)s].%(ext)s',
                        '%(uploader)s - %(title)s.%(ext)s',
                        '%(playlist_index)02d - %(title)s.%(ext)s',
                        '%(title)s (%(resolution)s).%(ext)s'
                      ].map((tpl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setOptions(prev => ({ ...prev, namingTemplate: tpl }))}
                          className="px-2.5 py-1 rounded bg-[#181e2b] hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono text-[10px]"
                        >
                          {tpl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clickable Variable Tag Chips */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 block">Click chip to insert into template:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        '%(title)s',
                        '%(artist)s',
                        '%(uploader)s',
                        '%(id)s',
                        '%(playlist_index)02d',
                        '%(resolution)s',
                        '%(upload_date)s',
                        '%(ext)s'
                      ].map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setOptions(prev => ({
                            ...prev,
                            namingTemplate: (prev.namingTemplate || '') + chip
                          }))}
                          className="px-2 py-0.5 rounded bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/50 text-sky-300 text-[10px] font-mono transition"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Additional Selection Defaults */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-white block">
                    Post-Processing Defaults
                  </span>

                  <label className="flex items-center space-x-3 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={options.audioCropThumbnailSquare}
                      onChange={e => setOptions(prev => ({ ...prev, audioCropThumbnailSquare: e.target.checked }))}
                      className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0 w-4 h-4"
                    />
                    <span>Crop thumbnail to 1:1 square album art for all audio downloads</span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={options.embedMetadata}
                      onChange={e => setOptions(prev => ({ ...prev, embedMetadata: e.target.checked }))}
                      className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-4 h-4"
                    />
                    <span>Embed ID3 / MP4 container metadata tags (title, artist, album)</span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={options.subtitles.embed}
                      onChange={e => setOptions(prev => ({
                        ...prev,
                        subtitles: { ...prev.subtitles, embed: e.target.checked }
                      }))}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-4 h-4"
                    />
                    <span>Embed soft subtitles directly into video container (--embed-subs)</span>
                  </label>
                </div>
              </div>
            )}

            {/* TAB: SponsorBlock (Requested Feature with YTDLnis parity) */}
            {activeTab === 'sponsorblock' && (
              <div className="space-y-4">
                {/* Header Banner with YTDLnis Reference Note */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs sm:text-sm font-semibold text-white">
                        SponsorBlock Segment Management
                      </h4>
                      <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800/50 px-1.5 py-0.2 rounded">
                        YTDLnis-Style Segment Matrix
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Choose precisely which video segments to <strong>Skip (Cut)</strong>, <strong>Mark as Chapters</strong>, or <strong>Ignore</strong> using SponsorBlock crowd-sourced timestamps.
                    </p>
                  </div>

                  {/* Master Toggle */}
                  <label className="flex items-center space-x-2 cursor-pointer shrink-0 bg-[#1c2233] px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 transition">
                    <input
                      type="checkbox"
                      checked={options.sponsorblock.enabled}
                      onChange={e => setOptions(prev => ({
                        ...prev,
                        sponsorblock: {
                          ...prev.sponsorblock,
                          enabled: e.target.checked,
                        }
                      }))}
                      className="rounded bg-slate-800 border-slate-600 text-sky-500 focus:ring-0 w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-white">
                      {options.sponsorblock.enabled ? 'SponsorBlock ON' : 'SponsorBlock OFF'}
                    </span>
                  </label>
                </div>

                {/* Quick Presets Bar (Modeled like YTDLnis presets) */}
                <div className="space-y-2 bg-[#121622] p-3 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Quick Segment Presets
                    </span>
                    <div className="flex items-center space-x-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setAllCategoriesTo('remove')}
                        className="text-amber-400 hover:text-amber-300 underline"
                      >
                        Skip All
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => setAllCategoriesTo('mark')}
                        className="text-sky-400 hover:text-sky-300 underline"
                      >
                        Mark All
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => setAllCategoriesTo('off')}
                        className="text-slate-400 hover:text-slate-300 underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {SPONSORBLOCK_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset.actions)}
                        className="p-2.5 rounded-lg bg-[#181e2c] hover:bg-[#20273a] border border-slate-700/60 hover:border-sky-500/50 text-left transition group space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-100 group-hover:text-sky-300">
                            {preset.name}
                          </span>
                          {preset.badge && (
                            <span className="text-[9px] font-mono bg-sky-950 text-sky-400 border border-sky-800/40 px-1 rounded">
                              {preset.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Individual Segment Categories (YTDLnis 3-choice selector) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-semibold text-slate-200">
                      Segment Categories & Actions ({SPONSORBLOCK_CATEGORIES.length})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      <span className="text-amber-400 font-bold">{removeList.length}</span> to skip •{' '}
                      <span className="text-sky-400 font-bold">{markList.length}</span> to mark
                    </span>
                  </div>

                  <div className="space-y-2">
                    {SPONSORBLOCK_CATEGORIES.map(category => {
                      const currentAction = currentActions[category.id] || 'off';

                      return (
                        <div
                          key={category.id}
                          className={`p-3 rounded-lg border transition ${
                            currentAction === 'remove'
                              ? 'bg-[#181922] border-amber-500/30'
                              : currentAction === 'mark'
                              ? 'bg-[#131b26] border-sky-500/30'
                              : 'bg-[#121620] border-slate-800'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            {/* Category Info */}
                            <div className="flex items-start space-x-2.5">
                              {/* Color dot badge */}
                              <span
                                className="w-3 h-3 rounded-full mt-1 shrink-0 shadow-sm"
                                style={{ backgroundColor: category.color }}
                                title={`Official SponsorBlock Color (${category.color})`}
                              />

                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-semibold text-white">
                                    {category.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1 rounded">
                                    {category.id}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-tight max-w-lg">
                                  {category.description}
                                </p>
                              </div>
                            </div>

                            {/* 3-State YTDLnis Action Toggle */}
                            <div className="flex items-center bg-[#0d1017] p-1 rounded-lg border border-slate-700/80 shrink-0 self-end sm:self-center">
                              {/* Skip / Remove */}
                              <button
                                type="button"
                                onClick={() => handleCategoryActionChange(category.id, 'remove')}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center space-x-1 ${
                                  currentAction === 'remove'
                                    ? 'bg-amber-600 text-white shadow-sm font-semibold'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title="Remove / Cut out this segment from final video file"
                              >
                                <Scissors className="w-3 h-3" />
                                <span>Skip</span>
                              </button>

                              {/* Mark Chapter */}
                              <button
                                type="button"
                                onClick={() => handleCategoryActionChange(category.id, 'mark')}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center space-x-1 ${
                                  currentAction === 'mark'
                                    ? 'bg-sky-600 text-white shadow-sm font-semibold'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title="Keep video intact but add SponsorBlock chapter marker"
                              >
                                <Bookmark className="w-3 h-3" />
                                <span>Mark</span>
                              </button>

                              {/* Off / Ignore */}
                              <button
                                type="button"
                                onClick={() => handleCategoryActionChange(category.id, 'off')}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center space-x-1 ${
                                  currentAction === 'off'
                                    ? 'bg-slate-700 text-slate-200 font-semibold'
                                    : 'text-slate-500 hover:text-slate-400'
                                }`}
                                title="Do nothing with this category"
                              >
                                <PowerOff className="w-3 h-3" />
                                <span>Off</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SponsorBlock API Server Configuration */}
                <div className="bg-[#121620] border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-sky-400" />
                      SponsorBlock API Endpoint URL
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">--sponsorblock-api</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="url"
                      value={customApiUrl}
                      onChange={e => setCustomApiUrl(e.target.value)}
                      placeholder="https://sponsor.ajay.app"
                      className="flex-1 bg-[#181d29] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                    />

                    <button
                      type="button"
                      onClick={testApiConnection}
                      disabled={apiTestStatus === 'testing'}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e2536] hover:bg-[#283248] text-slate-200 border border-slate-700 transition flex items-center space-x-1 disabled:opacity-50"
                    >
                      {apiTestStatus === 'testing' ? (
                        <span>Checking...</span>
                      ) : apiTestStatus === 'success' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Connected</span>
                        </>
                      ) : apiTestStatus === 'error' ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-rose-300">Failed</span>
                        </>
                      ) : (
                        <span>Test Ping</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCustomApiUrl('https://sponsor.ajay.app');
                        setOptions(prev => ({
                          ...prev,
                          sponsorblock: { ...prev.sponsorblock, apiUrl: 'https://sponsor.ajay.app' },
                        }));
                      }}
                      className="p-1.5 rounded text-slate-400 hover:text-white"
                      title="Reset to official SponsorBlock server"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Default is the public official SponsorBlock server (https://sponsor.ajay.app). You can specify private or self-hosted mirrors if desired.
                  </p>
                </div>

                {/* Live yt-dlp CLI Argument Preview */}
                <div className="bg-[#0b0e14] border border-slate-800/80 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Terminal className="w-3.5 h-3.5 text-sky-400" />
                      Dynamic yt-dlp Flag Output
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400">Auto-generated</span>
                  </div>
                  <pre className="text-[11px] font-mono text-amber-300/90 bg-[#10141d] p-2 rounded border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                    {getSponsorBlockCliSnippet()}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB: Audio & 1:1 Album Art */}
            {activeTab === 'audio' && (
              <div className="space-y-4">
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Crop className="w-4 h-4 text-rose-400" />
                    <h4 className="text-sm font-semibold text-white">
                      1:1 Aspect Ratio Square Album Art Cropping
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Most YouTube thumbnails are widescreen (16:9). For digital music players, this creates awkward black pillar-bars. Enabling 1:1 square cropping automatically extracts and crops the center square using FFmpeg, embedding a pixel-perfect album art into the audio ID3 tags.
                  </p>

                  <label className="flex items-center space-x-3 p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.audioCropThumbnailSquare}
                      onChange={e => setOptions({ ...options, audioCropThumbnailSquare: e.target.checked })}
                      className="rounded bg-slate-800 border-rose-500 text-rose-500 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Crop thumbnail into 1:1 aspect ratio square for audio files
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        --convert-thumbnails jpg --ppa "ThumbnailsConvertor+ffmpeg_o:-vf crop=min(iw,ih):min(iw,ih)"
                      </span>
                    </div>
                  </label>

                  <div className="p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 space-y-2">
                    <span className="text-xs font-semibold text-white block">Default Crop Alignment</span>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {(['left', 'center', 'right'] as const).map(focus => (
                        <button
                          key={focus}
                          type="button"
                          onClick={() => setOptions({ ...options, cropFocus: focus })}
                          className={`py-1.5 rounded border text-center capitalize transition ${
                            options.cropFocus === focus
                              ? 'bg-rose-600 text-white border-rose-500 font-semibold'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {focus}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center space-x-3 p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.embedMetadata}
                      onChange={e => setOptions({ ...options, embedMetadata: e.target.checked })}
                      className="rounded bg-slate-800 border-sky-500 text-sky-500 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Embed Complete Audio ID3 Tags & Metadata
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Automatically writes title, artist, album, genre, release year, and track number.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB: File Naming & Templates */}
            {activeTab === 'naming' && (
              <div className="space-y-4">
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <h4 className="text-sm font-semibold text-white">
                      File Naming Template
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Set the output template string passed to yt-dlp <code className="font-mono text-sky-300">-o</code> parameter.
                  </p>

                  <input
                    type="text"
                    value={options.namingTemplate}
                    onChange={e => setOptions({ ...options, namingTemplate: e.target.value })}
                    className="w-full bg-[#181d29] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />

                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {[
                      '%(title)s [%(id)s].%(ext)s',
                      '%(uploader)s - %(title)s.%(ext)s',
                      '%(playlist_index)02d - %(title)s.%(ext)s',
                      '%(title)s (%(resolution)s).%(ext)s'
                    ].map((tpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setOptions({ ...options, namingTemplate: tpl })}
                        className="px-2.5 py-1 rounded bg-[#181e2b] hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono"
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Subtitles */}
            {activeTab === 'subtitles' && (
              <div className="space-y-4">
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Subtitles className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Subtitle & Caption Downloading
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded">
                      Soft Subtitle Remuxing
                    </span>
                  </div>

                  <label className="flex items-center space-x-3 p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.subtitles.enabled}
                      onChange={e => setOptions(prev => ({
                        ...prev,
                        subtitles: { ...prev.subtitles, enabled: e.target.checked }
                      }))}
                      className="rounded bg-slate-800 border-indigo-500 text-indigo-500 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Enable Subtitle Downloading
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Automatically queries and downloads subtitle tracks alongside video content
                      </span>
                    </div>
                  </label>

                  {options.subtitles.enabled && (
                    <div className="space-y-4 pt-2">
                      {/* Subtitle Embedding Card */}
                      <div className="p-3.5 bg-[#121622] rounded-xl border border-indigo-500/30 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-indigo-400" />
                              Embed Subtitles into Video Container (--embed-subs)
                            </span>
                            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                              Merges the subtitle streams directly into the MP4 or MKV video file as <strong>soft tracks</strong>. Viewers can turn subtitles on or off in VLC, Windows Media Player, Plex, or Smart TVs. No video re-encoding is required.
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                            <input
                              type="checkbox"
                              checked={options.subtitles.embed}
                              onChange={e => setOptions(prev => ({
                                ...prev,
                                subtitles: { ...prev.subtitles, embed: e.target.checked }
                              }))}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        {/* Auto-generated captions */}
                        <label className="flex items-center space-x-2.5 pt-2 border-t border-slate-800 cursor-pointer text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={options.subtitles.autoSubs}
                            onChange={e => setOptions(prev => ({
                              ...prev,
                              subtitles: { ...prev.subtitles, autoSubs: e.target.checked }
                            }))}
                            className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
                          />
                          <span>Include YouTube speech-to-text automatic captions (--write-auto-subs)</span>
                        </label>

                        {/* Keep subtitle files after embedding toggle */}
                        {options.subtitles.embed && (
                          <label className="flex items-center space-x-2.5 pt-2 border-t border-slate-800 cursor-pointer text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={options.subtitles.keepSubs ?? false}
                              onChange={e => setOptions(prev => ({
                                ...prev,
                                subtitles: { ...prev.subtitles, keepSubs: e.target.checked }
                              }))}
                              className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
                            />
                            <div>
                              <span className="font-medium text-white block">Keep subtitle files after embedding</span>
                              <span className="text-[11px] text-slate-400">
                                Retain separate .srt / .vtt caption files in your downloads folder alongside the embedded video file
                              </span>
                            </div>
                          </label>
                        )}
                      </div>

                      {/* Preferred Subtitle Conversion Format */}
                      <div className="p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 space-y-2">
                        <span className="text-xs font-semibold text-white block">
                          Subtitle Format Conversion (--convert-subs)
                        </span>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          {[
                            { id: 'best', label: 'Best (Source)' },
                            { id: 'srt', label: 'SRT (SubRip)' },
                            { id: 'vtt', label: 'VTT (WebVTT)' },
                            { id: 'ass', label: 'ASS (Advanced)' },
                          ].map(fmt => (
                            <button
                              key={fmt.id}
                              type="button"
                              onClick={() => setOptions(prev => ({
                                ...prev,
                                subtitles: { ...prev.subtitles, format: fmt.id as any }
                              }))}
                              className={`py-1.5 rounded border text-center transition ${
                                (options.subtitles.format || 'best') === fmt.id
                                  ? 'bg-indigo-600 text-white border-indigo-500 font-semibold'
                                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                              }`}
                            >
                              {fmt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Language Selection */}
                      <div className="p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-white">
                            Subtitle Languages (--sub-langs)
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">Regex or comma-separated</span>
                        </div>
                        <input
                          type="text"
                          value={options.subtitles.langs}
                          onChange={e => setOptions(prev => ({
                            ...prev,
                            subtitles: { ...prev.subtitles, langs: e.target.value }
                          }))}
                          placeholder="en.*,all"
                          className="w-full bg-[#121622] border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                        />

                        {/* Quick language tags */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[
                            { label: 'English Regex', code: 'en.*' },
                            { label: 'All Available', code: 'all' },
                            { label: 'English + Spanish', code: 'en.*,es' },
                            { label: 'Spanish', code: 'es' },
                            { label: 'Japanese', code: 'ja' },
                            { label: 'German', code: 'de' },
                            { label: 'French', code: 'fr' },
                            { label: 'Chinese', code: 'zh.*' },
                          ].map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setOptions(prev => ({
                                ...prev,
                                subtitles: { ...prev.subtitles, langs: item.code }
                              }))}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-mono transition"
                            >
                              {item.label} ({item.code})
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Subtitle CLI Preview */}
                      <div className="bg-[#0b0e14] border border-slate-800 rounded-xl p-3 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                            Generated Subtitle CLI Flags
                          </span>
                        </div>
                        <pre className="text-[11px] font-mono text-indigo-300 bg-[#10141d] p-2 rounded border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                          {`--write-subs ${options.subtitles.autoSubs ? '--write-auto-subs ' : ''}--sub-langs "${options.subtitles.langs || 'en.*'}" ${options.subtitles.embed ? '--embed-subs ' : ''}${options.subtitles.embed && !options.subtitles.keepSubs ? '--compat-options no-keep-subs ' : ''}${options.subtitles.format && options.subtitles.format !== 'best' ? `--convert-subs ${options.subtitles.format}` : ''}`}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: Cookies, Bot Bypass & PO Token */}
            {activeTab === 'cookies' && (
              <div className="space-y-4">
                {/* Header Banner */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Cookie className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Cookies & YouTube Bot Bypass (PO Token)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800/50 px-2 py-0.5 rounded">
                      Anti-Bot Defense Parity
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    YouTube frequently blocks automated downloads with <em>"Sign in to confirm you’re not a bot"</em> or <em>HTTP Error 429</em>. Passing authenticated browser cookies, Proof of Origin (PO) tokens, or switching client personas solves these errors completely.
                  </p>
                </div>

                {/* Section 1: Web Client PO Token Generator */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Web Client Proof of Origin (PO Token) Generator
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Generates valid YouTube web visitor data and cryptographic session tokens
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGeneratePoToken}
                        disabled={generatingPoToken}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${generatingPoToken ? 'animate-spin' : ''}`} />
                        <span>{generatingPoToken ? 'Minting PO Token...' : 'Generate Web Client PO Token'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Feedback Banner */}
                  {poTokenFeedback && (
                    <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                      poTokenFeedback.ok 
                        ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300' 
                        : 'bg-rose-950/50 border-rose-800/60 text-rose-300'
                    }`}>
                      {poTokenFeedback.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
                      <span className="font-mono text-[11px]">{poTokenFeedback.msg}</span>
                    </div>
                  )}

                  {/* Enable PO Token Toggle */}
                  <label className="flex items-center space-x-3 p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.auth?.enablePoToken ?? false}
                      onChange={e => setOptions(prev => ({
                        ...prev,
                        auth: {
                          ...prev.auth,
                          cookieSource: prev.auth?.cookieSource || 'none',
                          enablePoToken: e.target.checked
                        }
                      }))}
                      className="rounded bg-slate-800 border-amber-500 text-amber-500 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Inject PO Token & Visitor Data Into yt-dlp Extractor
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Appends <code>--extractor-args "youtube:player_client=web,default;po_token=...;visitor_data=..."</code>
                      </span>
                    </div>
                  </label>

                  {/* PO Token and Visitor Data Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* PO Token Input */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-300 flex items-center gap-1">
                          <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
                          Web Client PO Token:
                        </span>
                        {options.auth?.poToken && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(options.auth?.poToken || '');
                              setCopiedPoToken(true);
                              setTimeout(() => setCopiedPoToken(false), 1500);
                            }}
                            className="text-[10px] text-amber-300 hover:underline flex items-center gap-1"
                          >
                            {copiedPoToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedPoToken ? 'Copied' : 'Copy'}</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={options.auth?.poToken || ''}
                        onChange={e => setOptions(prev => ({
                          ...prev,
                          auth: {
                            ...prev.auth,
                            cookieSource: prev.auth?.cookieSource || 'none',
                            poToken: e.target.value,
                            enablePoToken: true
                          }
                        }))}
                        placeholder="e.g. web+MnQzNjg0... or paste real token"
                        className="w-full bg-[#121622] border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-600"
                      />
                    </div>

                    {/* Visitor Data Input */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-300 flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-sky-400" />
                          Visitor Data:
                        </span>
                        {options.auth?.visitorData && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(options.auth?.visitorData || '');
                              setCopiedVisitorData(true);
                              setTimeout(() => setCopiedVisitorData(false), 1500);
                            }}
                            className="text-[10px] text-sky-300 hover:underline flex items-center gap-1"
                          >
                            {copiedVisitorData ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedVisitorData ? 'Copied' : 'Copy'}</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={options.auth?.visitorData || ''}
                        onChange={e => setOptions(prev => ({
                          ...prev,
                          auth: {
                            ...prev.auth,
                            cookieSource: prev.auth?.cookieSource || 'none',
                            visitorData: e.target.value,
                            enablePoToken: true
                          }
                        }))}
                        placeholder="e.g. Cgt2YzhXQUhF... (Live visitor session context)"
                        className="w-full bg-[#121622] border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* Test Bypass Action */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleTestBypass}
                      disabled={testingBypass}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e2738] hover:bg-[#28354c] text-sky-300 border border-sky-600/40 transition disabled:opacity-50"
                    >
                      <ShieldAlert className={`w-3.5 h-3.5 ${testingBypass ? 'animate-pulse' : ''}`} />
                      <span>{testingBypass ? 'Testing YouTube Connection...' : 'Simulate YouTube Player & Test Bypass'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowManualGuide(!showManualGuide)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <Info className="w-3.5 h-3.5 text-amber-400" />
                      <span>{showManualGuide ? 'Hide Browser Extraction Guide' : 'Manual Browser PO Token Guide'}</span>
                    </button>
                  </div>

                  {/* Bypass Result Callout */}
                  {bypassResult && (
                    <div className={`p-3 rounded-lg text-xs border space-y-1 ${
                      bypassResult.ok
                        ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                    }`}>
                      <div className="flex items-center gap-2 font-semibold">
                        {bypassResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                        <span>{bypassResult.ok ? 'Authentication & Bypass Check Passed' : 'Verification Alert'}</span>
                      </div>
                      <p className="text-[11px] font-mono leading-relaxed pl-6">
                        {bypassResult.message}
                      </p>
                    </div>
                  )}

                  {/* Manual Browser Token Guide */}
                  {showManualGuide && (
                    <div className="p-3.5 bg-[#0f131d] rounded-xl border border-amber-800/40 space-y-2 text-xs text-slate-300 leading-relaxed">
                      <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-amber-400" />
                        How to retrieve your browser's exact PO Token (Permanent Immunity):
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
                        <li>Open <a href="https://www.youtube.com" target="_blank" rel="noreferrer" className="text-sky-400 underline">YouTube.com</a> in your everyday browser while signed in.</li>
                        <li>Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-white font-mono">F12</kbd> (or right click -&gt; Inspect) and switch to the <strong>Network</strong> tab.</li>
                        <li>In the filter box, type <code className="text-amber-300 font-mono">/v1/player</code>.</li>
                        <li>Play any video. Click the network item named <code className="text-sky-300 font-mono">player</code>.</li>
                        <li>Look under the <strong>Payload</strong> tab: locate <code className="text-amber-300 font-mono">serviceIntegrityDimensions.poToken</code>.</li>
                        <li>Copy the token string and paste it into the Web Client PO Token field above.</li>
                      </ol>
                    </div>
                  )}
                </div>

                {/* Section 2: Cookie Source & Storage */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Cookie className="w-4 h-4 text-amber-400" />
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Cookie Authentication Source
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Pass authenticated cookies to download private, age-restricted, or member-only videos
                        </span>
                      </div>
                    </div>
                    {cookiesServerStatus?.exists && (
                      <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>cookies.txt Saved ({cookiesServerStatus.count} lines)</span>
                      </span>
                    )}
                  </div>

                  {/* Cookie Source Selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'none', label: 'Disabled', desc: 'No cookies' },
                      { id: 'browser', label: 'From Browser', desc: '--cookies-from-browser' },
                      { id: 'text', label: 'cookies.txt File', desc: '--cookies file/raw text' }
                    ].map(src => (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => setOptions(prev => ({
                          ...prev,
                          auth: {
                            ...prev.auth,
                            cookieSource: src.id as any
                          }
                        }))}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          (options.auth?.cookieSource || 'none') === src.id
                            ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                            : 'bg-[#181e2b] border-slate-700/80 text-slate-300 hover:bg-slate-850'
                        }`}
                      >
                        <span className="text-xs font-semibold block">{src.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{src.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Browser Options */}
                  {options.auth?.cookieSource === 'browser' && (
                    <div className="p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-slate-300 block mb-1">
                            Select Installed Browser
                          </label>
                          <select
                            value={options.auth?.browser || 'chrome'}
                            onChange={e => setOptions(prev => ({
                              ...prev,
                              auth: { ...prev.auth!, browser: e.target.value as any }
                            }))}
                            className="w-full bg-[#121622] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="chrome">Google Chrome</option>
                            <option value="firefox">Mozilla Firefox</option>
                            <option value="edge">Microsoft Edge</option>
                            <option value="brave">Brave Browser</option>
                            <option value="chromium">Chromium</option>
                            <option value="opera">Opera</option>
                            <option value="vivaldi">Vivaldi</option>
                            <option value="safari">Apple Safari</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-slate-300 block mb-1">
                            Browser Profile (Optional)
                          </label>
                          <input
                            type="text"
                            value={options.auth?.browserProfile || 'Default'}
                            onChange={e => setOptions(prev => ({
                              ...prev,
                              auth: { ...prev.auth!, browserProfile: e.target.value }
                            }))}
                            placeholder="e.g. Default or Profile 1"
                            className="w-full bg-[#121622] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-amber-300/80 leading-relaxed bg-amber-950/20 p-2 rounded border border-amber-900/30">
                        <strong>Important:</strong> Please ensure your chosen browser is closed or running in a separate profile during downloads so yt-dlp can access the cookie database without SQLite file-lock conflicts.
                      </p>
                    </div>
                  )}

                  {/* cookies.txt Content / Upload */}
                  {(options.auth?.cookieSource === 'text' || options.auth?.cookieSource === 'file') && (
                    <div className="p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-300">
                          Netscape Format Cookies (exported with "Get cookies.txt LOCALLY" extension):
                        </span>

                        <label className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 transition">
                          <Upload className="w-3 h-3" />
                          <span>Upload cookies.txt</span>
                          <input
                            type="file"
                            accept=".txt"
                            onChange={handleFileUploadCookies}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <textarea
                        rows={5}
                        value={cookiesContent}
                        onChange={e => setCookiesContent(e.target.value)}
                        placeholder={`# Netscape HTTP Cookie File\n# https://curl.haxx.se/rfc/cookie_spec.html\n.youtube.com\tTRUE\t/\tTRUE\t1759238400\tLOGIN_INFO\tAFmmF2cw...\n.youtube.com\tTRUE\t/\tTRUE\t1759238400\tSID\thQfcO2W_...`}
                        className="w-full bg-[#121622] border border-slate-700 rounded p-2.5 text-xs text-white font-mono leading-tight resize-y placeholder:text-slate-600"
                      />

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={handleSaveCookies}
                          disabled={savingCookies || !cookiesContent.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{savingCookies ? 'Saving to Disk...' : 'Save to portable_data/cookies.txt'}</span>
                        </button>

                        {cookiesServerStatus?.exists && (
                          <button
                            type="button"
                            onClick={handleClearCookies}
                            className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 hover:underline"
                          >
                            <PowerOff className="w-3 h-3" />
                            <span>Remove Saved Cookies</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3: Alternative Player Client Persona */}
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Player Client Persona Override
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Force YouTube to respond through mobile, TV, or creator endpoints that bypass bot gates
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'default', label: 'Default / Web', desc: 'Standard browser client' },
                      { id: 'ios', label: 'iOS Client', desc: 'High bot-immunity, no PO Token needed' },
                      { id: 'android', label: 'Android Client', desc: 'Mobile Innertube API' },
                      { id: 'mweb', label: 'Mobile Web', desc: 'Lightweight m.youtube.com' },
                      { id: 'web_creator', label: 'Creator Studio', desc: 'YouTube Studio API' },
                      { id: 'tv', label: 'Smart TV / Living Room', desc: 'Living room streaming client' },
                    ].map(client => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => setOptions(prev => ({
                          ...prev,
                          auth: {
                            ...prev.auth,
                            cookieSource: prev.auth?.cookieSource || 'none',
                            playerClient: client.id as any
                          }
                        }))}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          (options.auth?.playerClient || 'default') === client.id
                            ? 'bg-sky-950/40 border-sky-500 text-sky-200'
                            : 'bg-[#181e2b] border-slate-700/80 text-slate-300 hover:bg-slate-850'
                        }`}
                      >
                        <span className="text-xs font-semibold block">{client.label}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{client.desc}</span>
                      </button>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#121622] border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                    <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Tip:</strong> Selecting <strong>iOS Client</strong> causes yt-dlp to impersonate the YouTube iOS application. Because mobile apps do not execute JavaScript challenges, this bypasses the <em>"Sign in to confirm you’re not a bot"</em> prompt on almost all cloud and datacenter IP networks!
                    </span>
                  </div>
                </div>

                {/* Section 4: Live CLI Flags Preview */}
                <div className="bg-[#0b0e14] border border-slate-800 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Terminal className="w-3.5 h-3.5 text-amber-400" />
                      yt-dlp Authentication CLI Flags Generated:
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-amber-300 bg-[#10141d] p-2 rounded border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                    {(() => {
                      const flags: string[] = [];
                      if (options.auth?.cookieSource === 'browser' && options.auth?.browser) {
                        flags.push(`--cookies-from-browser ${options.auth.browser}${options.auth.browserProfile ? `:${options.auth.browserProfile}` : ''}`);
                      } else if (options.auth?.cookieSource === 'text' || options.auth?.cookieSource === 'file') {
                        flags.push('--cookies portable_data/cookies.txt');
                      }

                      const client = options.auth?.playerClient && options.auth.playerClient !== 'default' 
                        ? options.auth.playerClient 
                        : (options.auth?.enablePoToken ? 'web,default' : '');
                      
                      const ext: string[] = [];
                      if (client) ext.push(`player_client=${client}`);
                      if (options.auth?.enablePoToken && options.auth?.poToken) {
                        const clean = options.auth.poToken.startsWith('web+') ? options.auth.poToken : `web+${options.auth.poToken}`;
                        ext.push(`po_token=${clean}`);
                      }
                      if (options.auth?.enablePoToken && options.auth?.visitorData) {
                        ext.push(`visitor_data=${options.auth.visitorData}`);
                      }
                      if (ext.length > 0) {
                        flags.push(`--extractor-args "youtube:${ext.join(';')}"`);
                      }

                      return flags.length > 0 ? flags.join(' ') : '(No authentication or extractor overrides active)';
                    })()}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB: Storage & Engine */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div className="bg-[#141926] border border-[#232c3f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">
                      Portable Storage & Engine Health
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Download Directory</span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('download')}
                          className="text-[11px] text-sky-400 hover:text-sky-300 font-medium"
                        >
                          Change...
                        </button>
                      </div>
                      <span className="text-white font-mono truncate block text-[11px]">
                        {downloadDirInfo?.current || systemStatus?.downloadDir || '%USERPROFILE%\\Downloads'}
                      </span>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={handleOpenDownloadFolder}
                          disabled={openingFolder}
                          className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 transition"
                        >
                          <FolderOpen className="w-3 h-3 text-sky-400" />
                          <span>{openingFolder ? 'Opening...' : 'Open in Explorer'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-[#181e2b] rounded-lg border border-slate-700/80 space-y-2">
                      <span className="text-slate-400 block">yt-dlp Core Engine</span>
                      <span className="text-emerald-400 font-mono block text-sm font-semibold">
                        Ready
                      </span>
                      <span className="text-[11px] text-slate-400 block pt-1 border-t border-slate-800">
                        Windows & Linux Engine Bridge
                      </span>
                    </div>
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
            <span>Settings saved automatically to current session</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
