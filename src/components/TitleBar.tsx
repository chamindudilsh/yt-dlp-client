import React from 'react';
import { 
  RefreshCw, 
  Terminal, 
  Settings,
  Download,
  ListOrdered,
  FolderHeart
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
    <header className="h-11 bg-[#10141d] border-b border-[#1e2535] flex items-center justify-between px-3.5 select-none text-xs text-slate-300 relative z-30">
      {/* Left: App Icon & Brand Title */}
      <div className="flex items-center space-x-2.5">
        <div className="w-6 h-6 rounded-md bg-[#161c28] border border-[#252e42] flex items-center justify-center shrink-0">
          <img src="/icon.png" alt="App Icon" className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-100 tracking-tight text-[13px]">
            yt-dlp <span className="text-slate-300 font-normal">Client</span>
          </span>
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-[#161c28] border border-[#232b3d]">
            {systemStatus?.version || '2026.08'}
          </span>
        </div>
      </div>

      {/* Center: Main View Tabs */}
      <nav className="flex items-center bg-[#0c1017] p-0.5 rounded-lg border border-[#1e2536]">
        <button
          onClick={() => setActiveTab('download')}
          className={`px-3 py-1 rounded-md text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'download'
              ? 'bg-[#222a3a] text-white font-medium shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
          }`}
        >
          <Download className="w-3.5 h-3.5 text-slate-300" />
          <span>Downloader</span>
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-3 py-1 rounded-md text-xs transition-colors relative flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-[#222a3a] text-white font-medium shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5 text-slate-300" />
          <span>Active Queue</span>
          {queuedCount > 0 && (
            <span className="bg-sky-600 text-white text-[10px] font-semibold px-1.5 py-0.2 rounded-full font-mono">
              {queuedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`px-3 py-1 rounded-md text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'library'
              ? 'bg-[#222a3a] text-white font-medium shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
          }`}
        >
          <FolderHeart className="w-3.5 h-3.5 text-slate-300" />
          <span>Saved Files</span>
        </button>
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center space-x-1.5">
        <button
          onClick={onOpenSettingsModal}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-slate-300 hover:text-white bg-[#141824] hover:bg-[#1c2232] border border-[#232b3d] transition cursor-pointer text-[11px]"
          title="Open Settings"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline font-medium">Settings</span>
        </button>

        <button
          onClick={onOpenCliModal}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-slate-300 hover:text-white bg-[#141824] hover:bg-[#1c2232] border border-[#232b3d] transition cursor-pointer text-[11px]"
          title="Preview yt-dlp CLI Command"
        >
          <Terminal className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline font-medium">CLI</span>
        </button>

        <button
          onClick={onOpenUpdateModal}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-slate-300 hover:text-white bg-[#141824] hover:bg-[#1c2232] border border-[#232b3d] transition cursor-pointer text-[11px]"
          title="Check for yt-dlp engine updates"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline font-medium">Updates</span>
        </button>
      </div>
    </header>
  );
};
