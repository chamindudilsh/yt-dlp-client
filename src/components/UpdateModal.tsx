import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Sparkles, 
  ExternalLink,
  ShieldCheck,
  Package,
  Terminal,
  Laptop,
  Calendar,
  Layers,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { AppUpdateInfo, EngineUpdateInfo } from '../types';
import { api } from '../lib/apiBridge';
import { APP_VERSION, APP_RELEASES_URL, YTDLP_RELEASES_URL } from '../constants/app';
import { formatReleaseDate } from '../lib/versionUtils';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion?: string;
  appVersion?: string;
}

type TabType = 'app' | 'engine';

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  currentVersion = '2026.08.19',
  appVersion = APP_VERSION,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('app');
  const [loading, setLoading] = useState(false);
  const [updatingEngine, setUpdatingEngine] = useState(false);
  const [engineSuccess, setEngineSuccess] = useState(false);
  const [appUpdate, setAppUpdate] = useState<AppUpdateInfo | null>(null);
  const [engineUpdate, setEngineUpdate] = useState<EngineUpdateInfo | null>(null);
  const [autoCheck, setAutoCheck] = useState(() => {
    try {
      const val = localStorage.getItem('ytdlp_autocheck_updates');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const handleCheckUpdates = useCallback(async () => {
    setLoading(true);
    setEngineSuccess(false);
    try {
      const [appData, engineData] = await Promise.allSettled([
        api.checkAppUpdate(),
        api.checkEngineUpdate(),
      ]);

      if (appData.status === 'fulfilled') {
        setAppUpdate(appData.value);
        if (appData.value.hasUpdate) {
          setActiveTab('app');
        }
      }
      if (engineData.status === 'fulfilled') {
        setEngineUpdate(engineData.value);
      }
      setLastChecked(new Date());
    } catch (e) {
      console.error('Error checking updates:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Automatically check updates once when the modal is opened if not checked yet
  useEffect(() => {
    if (isOpen && !appUpdate && !engineUpdate && !loading) {
      handleCheckUpdates();
    }
  }, [isOpen, appUpdate, engineUpdate, loading, handleCheckUpdates]);

  const handleAutoCheckChange = (checked: boolean) => {
    setAutoCheck(checked);
    try {
      localStorage.setItem('ytdlp_autocheck_updates', String(checked));
    } catch (e) {
      console.warn('Could not save auto-check preference:', e);
    }
  };

  const handleRunEngineUpdate = async () => {
    setUpdatingEngine(true);
    setEngineSuccess(false);
    try {
      const data = await api.updateEngine();
      if (data.success) {
        setEngineSuccess(true);
        if (engineUpdate) {
          setEngineUpdate({
            ...engineUpdate,
            currentVersion: data.version || engineUpdate.latestVersion,
            hasUpdate: false,
          });
        }
      }
    } catch (e) {
      console.error('Failed to update engine:', e);
    } finally {
      setUpdatingEngine(false);
    }
  };

  const handleOpenUrl = (url: string) => {
    api.openExternalUrl(url);
  };

  if (!isOpen) return null;

  const currentAppVer = appVersion || APP_VERSION;
  const currentEngineVer = engineUpdate?.currentVersion || currentVersion;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="update-modal"
        className="bg-[#10141f] border border-[#222b3d] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#141a29] border-b border-[#222b3d] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-sky-500/20 to-emerald-500/20 text-sky-400 rounded-xl border border-sky-500/30 shadow-inner">
              <Sparkles className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">Update Center</h3>
                {lastChecked && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60 font-mono">
                    Checked {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Manage updates for yt-dlp Client software and the core extraction engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Component Selector Tabs */}
        <div className="p-4 pb-0 bg-[#0d101a] border-b border-[#1f2738]">
          <div className="grid grid-cols-2 gap-3">
            {/* Tab: yt-dlp Client Software */}
            <button
              onClick={() => setActiveTab('app')}
              className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer text-left ${
                activeTab === 'app'
                  ? 'bg-[#182033] border-sky-500/50 shadow-md shadow-sky-950/40 text-white'
                  : 'bg-[#121624] border-[#202738] text-slate-400 hover:bg-[#151b2c] hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`p-2 rounded-lg border ${
                  activeTab === 'app' 
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' 
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                }`}>
                  <Laptop className="w-4 h-4 shrink-0" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs truncate">yt-dlp Client</span>
                    <span className="text-[10px] text-slate-500 font-mono">v{currentAppVer}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">Desktop Software</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0 ml-2">
                {loading ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    Checking
                  </span>
                ) : appUpdate?.hasUpdate ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <AlertCircle className="w-2.5 h-2.5" />
                    v{appUpdate.latestVersion} Available
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Up to date
                  </span>
                )}
              </div>
            </button>

            {/* Tab: yt-dlp Engine */}
            <button
              onClick={() => setActiveTab('engine')}
              className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer text-left ${
                activeTab === 'engine'
                  ? 'bg-[#182033] border-emerald-500/50 shadow-md shadow-emerald-950/40 text-white'
                  : 'bg-[#121624] border-[#202738] text-slate-400 hover:bg-[#151b2c] hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`p-2 rounded-lg border ${
                  activeTab === 'engine' 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                }`}>
                  <Terminal className="w-4 h-4 shrink-0" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs truncate">Core Engine</span>
                    <span className="text-[10px] text-slate-500 font-mono">{currentEngineVer}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">yt-dlp CLI Binary</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0 ml-2">
                {loading ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    Checking
                  </span>
                ) : engineUpdate?.hasUpdate ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Update Available
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Up to date
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 space-y-4 max-h-[58vh] overflow-y-auto custom-scrollbar text-xs">
          {/* TAB 1: YT-DLP CLIENT SOFTWARE */}
          {activeTab === 'app' && (
            <div className="space-y-4">
              {/* App Status Banner */}
              {appUpdate?.hasUpdate ? (
                <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-xl p-4 flex items-start space-x-3.5">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-amber-200">New Release Available!</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40">
                        {appUpdate.releaseTag || `v${appUpdate.latestVersion}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      A newer version of yt-dlp Client is available on GitHub with updated features, UI improvements, and fixes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/25 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-emerald-200">You're on the latest release</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          v{currentAppVer}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Your software is fully up to date with official GitHub releases.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenUrl(appUpdate?.releaseUrl || APP_RELEASES_URL)}
                    className="px-3 py-1.5 rounded-lg bg-[#192133] hover:bg-[#222c44] border border-[#2b3752] text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0"
                  >
                    <span>Releases</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              )}

              {/* Version Comparison Info Card */}
              <div className="bg-[#141926] p-4 rounded-xl border border-[#222b3d] grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-slate-400">Current Installed:</span>
                  <p className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                    v{currentAppVer}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[11px] text-slate-400">Latest GitHub Release:</span>
                  <p className="text-sm font-bold text-sky-400 font-mono flex items-center gap-1.5">
                    {appUpdate ? (appUpdate.releaseTag || `v${appUpdate.latestVersion}`) : `v${currentAppVer}`}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[11px] text-slate-400">Release Published:</span>
                  <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {formatReleaseDate(appUpdate?.publishedAt) || 'Latest Build'}
                  </p>
                </div>
              </div>

              {/* Download Packages Section */}
              {appUpdate && appUpdate.assets && appUpdate.assets.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-sky-400" />
                      Available Packages & Installers
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {appUpdate.assets.length} artifacts available
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {appUpdate.assets.map((asset, idx) => {
                      const isInstaller = asset.name.includes('setup') || asset.name.includes('installer');
                      const isPortable = asset.name.includes('portable');
                      const isStandalone = asset.name.includes('standalone') || asset.name === 'yt-dlp-client.exe';
                      const isSha = asset.name.includes('SHA256');

                      let badgeText = 'Binary';
                      let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                      if (isInstaller) {
                        badgeText = 'Windows Setup';
                        badgeColor = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
                      } else if (isPortable) {
                        badgeText = 'Portable Zip';
                        badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                      } else if (isStandalone) {
                        badgeText = 'Standalone .exe';
                        badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
                      } else if (isSha) {
                        badgeText = 'Checksums';
                        badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';
                      }

                      return (
                        <div
                          key={idx}
                          className="p-2.5 bg-[#141926] hover:bg-[#181f30] border border-[#222b3d] rounded-xl flex items-center justify-between space-x-2 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${badgeColor}`}>
                                {badgeText}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">{asset.sizeFormatted}</span>
                            </div>
                            <p 
                              className="text-xs font-mono font-medium text-slate-200 truncate mt-1" 
                              title={asset.name}
                            >
                              {asset.name}
                            </p>
                          </div>

                          <button
                            onClick={() => handleOpenUrl(asset.downloadUrl)}
                            className="p-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 hover:text-sky-200 border border-sky-500/30 transition cursor-pointer shrink-0"
                            title={`Download ${asset.name}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Release Notes / Changelog */}
              {appUpdate?.releaseNotes && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      Changelog & Release Notes
                    </span>
                    <button
                      onClick={() => handleOpenUrl(appUpdate.releaseUrl)}
                      className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Open in Browser</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="bg-[#0b0e16] p-3.5 rounded-xl border border-[#1f2738] text-[11px] text-slate-300 font-mono max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap select-text custom-scrollbar">
                    {appUpdate.releaseNotes}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: YT-DLP CORE ENGINE */}
          {activeTab === 'engine' && (
            <div className="space-y-4">
              {/* Engine Status Box */}
              <div className="bg-[#141926] p-4 rounded-xl border border-[#222b3d] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-xs">Installed yt-dlp Core Engine:</span>
                    <p className="text-base font-bold text-white font-mono mt-0.5">
                      yt-dlp {currentEngineVer}
                    </p>
                  </div>

                  {engineUpdate?.hasUpdate ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      New Version Available
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Up to Date
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-700/50 flex items-center justify-between text-slate-300 text-xs">
                  <span>Upstream GitHub Release:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {engineUpdate?.latestVersion || currentEngineVer}
                  </span>
                </div>
              </div>

              {/* Explanatory Info Card */}
              <div className="bg-[#121624] border border-[#202738] rounded-xl p-3.5 flex items-start space-x-3 text-slate-300">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-slate-200">Why update the engine?</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    yt-dlp is continuously maintained to adapt to streaming platform code changes, signature deciphering updates, and rate-limit bypasses. Running updates ensures smooth downloads across all supported platforms.
                  </p>
                </div>
              </div>

              {/* Success Message */}
              {engineSuccess && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3.5 text-emerald-300 flex items-start space-x-2.5 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-xs">Engine updated successfully!</p>
                    <p className="text-[11px] text-emerald-400/80 mt-0.5">
                      Core yt-dlp binary updated to {currentEngineVer} with the latest extractors.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Box */}
              <div className="bg-[#141926] p-4 rounded-xl border border-[#222b3d] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-200">In-Place Binary Upgrade</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Executes <code className="px-1 py-0.5 bg-slate-800 rounded font-mono text-sky-300">yt-dlp -U</code> to download and replace the core executable automatically.
                  </p>
                </div>

                <button
                  onClick={handleRunEngineUpdate}
                  disabled={updatingEngine || loading}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/50 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Download className={`w-3.5 h-3.5 ${updatingEngine ? 'animate-bounce' : ''}`} />
                  <span>{updatingEngine ? 'Updating yt-dlp...' : 'Update yt-dlp Engine'}</span>
                </button>
              </div>

              {/* Link to upstream releases */}
              <div className="flex justify-end">
                <button
                  onClick={() => handleOpenUrl(YTDLP_RELEASES_URL)}
                  className="text-[11px] text-slate-400 hover:text-sky-400 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>View upstream yt-dlp changelogs on GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-3.5 bg-[#141a29] border-t border-[#222b3d] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoCheck}
                onChange={e => handleAutoCheckChange(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="text-slate-300 text-xs">Auto-check on startup</span>
            </label>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleCheckUpdates}
              disabled={loading || updatingEngine}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1a2133] hover:bg-[#232c42] text-slate-200 border border-[#2a3650] transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              title="Check GitHub for newer versions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
              <span>{loading ? 'Checking Releases...' : 'Check All Updates'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
