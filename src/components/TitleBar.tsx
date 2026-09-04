import React from 'react';
import { 
  RefreshCw, 
  Terminal, 
  Settings
} from 'lucide-react';
import { SystemStatus } from '../types';

interface TitleBarProps {
  systemStatus: SystemStatus | null;
  onOpenUpdateModal: () => void;
  onOpenPortableModal?: () => void;
  onOpenCliModal: () => void;
  onOpenSettingsModal: () => void;
  activeTab: 'download' | 'queue' | 'library';
  setActiveTab: (tab: 'download' | 'queue' | 'library') => void;
  queuedCount: number;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  systemStatus,
  onOpenUpdateModal,
  onOpenPortableModal,
  onOpenCliModal,
  onOpenSettingsModal,
  activeTab,
  setActiveTab,
  queuedCount,
}) => {
  return (
    <header className="h-11 bg-[#0e1117] border-b border-[#1e2330] flex items-center justify-between px-3.5 select-none text-xs text-slate-300 relative z-30">
      {/* Left: App Icon & Brand Title */}
      <div className="flex items-center space-x-2.5">
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          <img src="/icon.ico" alt="App Icon" className="w-5 h-5 object-contain" />
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="font-semibold text-slate-100 tracking-wide text-[13px]">yt-dlp Client</span>
        </div>
      </div>

      {/* Center: Main View Navigation */}
      <nav className="flex items-center bg-[#161a23] p-0.5 rounded-lg border border-[#232938]">
        <button
          onClick={() => setActiveTab('download')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'download'
              ? 'bg-[#252c3d] text-sky-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Batch Downloader
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all relative flex items-center space-x-1.5 ${
            activeTab === 'queue'
              ? 'bg-[#252c3d] text-sky-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Active Queue</span>
          {queuedCount > 0 && (
            <span className="bg-sky-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {queuedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'library'
              ? 'bg-[#252c3d] text-sky-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Saved Files
        </button>
      </nav>

      {/* Right: Action Tools (Settings, CLI, Updates) */}
      <div className="flex items-center space-x-2">
        {/* Settings button */}
        <button
          onClick={onOpenSettingsModal}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/80 transition border border-slate-700/60"
          title="Open Settings (SponsorBlock, 1:1 Album Art, Subtitles, Cookies)"
        >
          <Settings className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-medium">Settings</span>
        </button>

        {/* CLI Command Preview button */}
        <button
          onClick={onOpenCliModal}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition border border-slate-700/60"
          title="Preview Windows PowerShell / CMD yt-dlp.exe command"
        >
          <Terminal className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px]">CLI Script</span>
        </button>

        {/* Update Checker Button */}
        <button
          onClick={onOpenUpdateModal}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition border border-slate-700/60"
          title="Check for yt-dlp engine updates"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px]">Check Updates</span>
        </button>
      </div>
    </header>
  );
};
