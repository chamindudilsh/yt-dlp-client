import React, { useState } from 'react';
import { 
  Folder, 
  Activity, 
  ArrowDown,
  FolderOpen,
  CheckCircle2,
  Settings
} from 'lucide-react';
import { SystemStatus } from '../types';
import { api } from '../lib/apiBridge';

interface StatusBarProps {
  systemStatus: SystemStatus | null;
  activeCount: number;
  queuedCount: number;
  totalSpeed: string;
  onOpenSettingsModal?: () => void;
  onSelectTab?: (tab: 'download' | 'queue' | 'library') => void;
  onOpenPortableModal?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  systemStatus,
  activeCount,
  queuedCount,
  totalSpeed,
  onOpenSettingsModal,
  onSelectTab,
}) => {
  const [openingFolder, setOpeningFolder] = useState(false);

  const handleOpenFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpeningFolder(true);
    try {
      await api.openDownloadFolder();
    } catch (err) {
      console.warn('Failed to open downloads folder', err);
    } finally {
      setTimeout(() => setOpeningFolder(false), 900);
    }
  };

  const isDownloading = activeCount > 0;
  const isQueued = queuedCount > 0 && !isDownloading;

  return (
    <footer 
      id="app-status-bar"
      className="h-7 bg-[#0a0d14] border-t border-[#181e2b] flex items-center justify-between px-3 text-[11px] text-slate-400 select-none z-20"
    >
      {/* Left: Core Engine Status */}
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center space-x-1.5">
          <span 
            className={`w-2 h-2 rounded-full transition-colors ${
              isDownloading 
                ? 'bg-sky-400' 
                : isQueued 
                ? 'bg-amber-400' 
                : 'bg-emerald-500'
            }`} 
          />
          <span className="text-slate-200 font-medium tracking-wide">
            {isDownloading ? `Downloading (${activeCount})` : isQueued ? `Queue waiting (${queuedCount})` : 'Ready'}
          </span>
        </div>

        <span className="text-slate-700">|</span>

        <span className="text-slate-400 font-mono text-[10px]">
          yt-dlp Core
        </span>
      </div>

      {/* Right: Network Speed, Queue Counts, and Output Directory */}
      <div className="flex items-center space-x-3">
        {/* Speed indicator */}
        <div 
          className="flex items-center space-x-1 text-slate-300 font-mono"
          title="Current aggregate download speed"
        >
          <ArrowDown className={`w-3 h-3 ${isDownloading ? 'text-sky-400' : 'text-slate-600'}`} />
          <span className={isDownloading ? 'text-sky-300 font-medium' : 'text-slate-400'}>
            {totalSpeed}
          </span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Queue status (clickable to switch to queue view) */}
        <button
          onClick={() => onSelectTab?.('queue')}
          className="flex items-center space-x-1 text-slate-400 hover:text-sky-300 transition"
          title="Click to view Active Queue"
        >
          <Activity className={`w-3 h-3 ${isDownloading ? 'text-sky-400' : 'text-slate-500'}`} />
          <span>Queue:</span>
          <span className={`font-medium ${activeCount > 0 ? 'text-sky-400' : 'text-slate-400'}`}>
            {activeCount} active
          </span>
          <span>•</span>
          <span className={queuedCount > 0 ? 'text-amber-400' : 'text-slate-500'}>
            {queuedCount} queued
          </span>
        </button>

        <span className="text-slate-700">|</span>

        {/* Output dir (clickable to open in Windows File Explorer or change in settings) */}
        <div className="flex items-center space-x-1 group">
          <button
            onClick={handleOpenFolder}
            disabled={openingFolder}
            className="flex items-center space-x-1 text-slate-400 hover:text-sky-300 transition font-mono text-[10px] max-w-[240px] truncate px-1.5 py-0.5 rounded hover:bg-slate-800/80"
            title={`Download Folder: ${systemStatus?.downloadDir || '%USERPROFILE%\\Downloads'}\nClick to open in Windows Explorer`}
          >
            {openingFolder ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <FolderOpen className="w-3 h-3 text-amber-400/90 group-hover:text-amber-300 shrink-0" />
            )}
            <span className="truncate">
              {openingFolder 
                ? 'Opening in Explorer...' 
                : (systemStatus?.downloadDir || '%USERPROFILE%\\Downloads')}
            </span>
          </button>

          {onOpenSettingsModal && (
            <button
              onClick={onOpenSettingsModal}
              className="text-[10px] text-slate-500 hover:text-slate-300 p-0.5 rounded hover:bg-slate-800 transition"
              title="Configure Download Location"
            >
              <Settings className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
