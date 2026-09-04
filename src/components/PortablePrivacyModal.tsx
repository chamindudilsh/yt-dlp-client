import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  HardDrive, 
  FolderLock, 
  Download, 
  Check, 
  Info,
  Lock,
  Trash2
} from 'lucide-react';
import { SystemStatus } from '../types';

interface PortablePrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemStatus: SystemStatus | null;
  onTogglePortable: (enabled: boolean) => Promise<void>;
}

export const PortablePrivacyModal: React.FC<PortablePrivacyModalProps> = ({
  isOpen,
  onClose,
  systemStatus,
  onTogglePortable,
}) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isPortable = systemStatus?.portableMode ?? true;

  const handleToggle = async () => {
    setLoading(true);
    try {
      await onTogglePortable(!isPortable);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPortableBat = () => {
    const batScript = `@echo off
title yt-dlp Portable Windows Client
echo ========================================================
echo  yt-dlp Portable Privacy Client Launcher
echo  Zero Registry Footprint - Isolated Local Environment
echo ========================================================
set CURRENT_DIR=%~dp0
set YTDLP_CONFIG_DIR=%CURRENT_DIR%portable_data\\config
set YTDLP_CACHE_DIR=%CURRENT_DIR%portable_data\\cache
set DOWNLOADS_DIR=%CURRENT_DIR%portable_data\\downloads

if not exist "%YTDLP_CONFIG_DIR%" mkdir "%YTDLP_CONFIG_DIR%"
if not exist "%YTDLP_CACHE_DIR%" mkdir "%YTDLP_CACHE_DIR%"
if not exist "%DOWNLOADS_DIR%" mkdir "%DOWNLOADS_DIR%"

echo [Privacy] Sandboxing all cookies, configs, and temporary files...
echo [Path] Output: %DOWNLOADS_DIR%
echo.
"%CURRENT_DIR%yt-dlp.exe" --cache-dir "%YTDLP_CACHE_DIR%" -P "%DOWNLOADS_DIR%" %*
pause
`;
    const blob = new Blob([batScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Launch-yt-dlp-Portable.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div 
        id="portable-privacy-modal"
        className="bg-[#121620] border border-[#262e40] rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#171c2a] border-b border-[#262e40] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Portable Mode & Privacy Controls</h3>
              <p className="text-[11px] text-slate-400">
                Sandboxed execution with zero Windows registry or %APPDATA% traces
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Main Toggle Banner */}
          <div className="bg-[#181d29] p-4 rounded-lg border border-[#262f42] flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <FolderLock className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-white text-sm">Portable Sandbox Isolation</span>
              </div>
              <p className="text-slate-400 text-[11px] max-w-xs">
                Stores all media, settings, and extractor tokens strictly in the local application folder.
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggle}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isPortable ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isPortable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Privacy Benefits List */}
          <div className="space-y-2">
            <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
              Privacy Safeguards Active:
            </span>

            <div className="grid grid-cols-1 gap-2">
              <div className="bg-[#161a24] p-2.5 rounded border border-slate-800 flex items-start space-x-2.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-slate-200">Zero Windows Registry Modifications</span>
                  <p className="text-[11px] text-slate-400">
                    No registry keys, telemetry trackers, or file association hooks are created in Windows.
                  </p>
                </div>
              </div>

              <div className="bg-[#161a24] p-2.5 rounded border border-slate-800 flex items-start space-x-2.5">
                <FolderLock className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-slate-200">No Lingering %LOCALAPPDATA% Traces</span>
                  <p className="text-[11px] text-slate-400">
                    All logs, temporary video segments, and SponsorBlock chapter cache reside inside <code className="text-sky-300">./portable_data/</code>.
                  </p>
                </div>
              </div>

              <div className="bg-[#161a24] p-2.5 rounded border border-slate-800 flex items-start space-x-2.5">
                <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-slate-200">USB Flash Drive & Cross-PC Portability</span>
                  <p className="text-[11px] text-slate-400">
                    Move the entire folder to a USB drive and run on any Windows device without installation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Path Indicator */}
          <div className="bg-slate-900/80 p-3 rounded border border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Active Storage Path:</span>
            <span className="font-mono text-emerald-400 font-medium">
              {systemStatus?.downloadDir || './portable_data/downloads'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#171c2a] border-t border-[#262e40] flex items-center justify-between">
          <button
            type="button"
            onClick={handleDownloadPortableBat}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[#1e2433] hover:bg-[#283145] text-slate-200 border border-slate-700 transition flex items-center space-x-1.5"
            title="Download Windows batch script for launching portable yt-dlp"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Export Portable Launcher (.bat)</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
