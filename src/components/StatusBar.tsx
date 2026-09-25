import React, { useState, useRef } from 'react';
import { 
  FolderOpen,
  CheckCircle2,
  Settings,
  ArrowDown,
  Activity,
  Gauge
} from 'lucide-react';
import { SystemStatus } from '../types';
import { api } from '../lib/apiBridge';
import { SpeedLimiterPopover } from './SpeedLimiterPopover';

interface StatusBarProps {
  systemStatus: SystemStatus | null;
  activeCount: number;
  queuedCount: number;
  pausedCount?: number;
  totalSpeed: string;
  limitRate?: string;
  onSetLimitRate?: (rate: string) => void;
  onOpenSettingsModal?: () => void;
  onOpenUpdateModal?: () => void;
  onSelectTab?: (tab: 'download' | 'queue' | 'library', filter?: 'all' | 'active' | 'queued' | 'paused' | 'finished' | 'errored') => void;
  onOpenPortableModal?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  systemStatus,
  activeCount,
  queuedCount,
  pausedCount = 0,
  totalSpeed,
  limitRate,
  onSetLimitRate,
  onOpenSettingsModal,
  onOpenUpdateModal,
  onSelectTab,
}) => {
  const [openingFolder, setOpeningFolder] = useState(false);
  const [isSpeedPopoverOpen, setIsSpeedPopoverOpen] = useState(false);
  const speedButtonRef = useRef<HTMLButtonElement>(null);

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
  const isCapped = Boolean(limitRate && limitRate.trim() && limitRate.toLowerCase() !== 'unlimited' && limitRate !== '0');

  return (
    <footer 
      id="app-status-bar"
      className="relative h-7 bg-[#10141d] border-t border-[#1e2535] flex items-center justify-between px-3.5 text-[11px] text-slate-400 select-none z-20"
    >
      {/* Left: Engine Status (Clickable to open Update Modal) */}
      <div className="flex items-center space-x-2.5">
        <button
          type="button"
          onClick={onOpenUpdateModal}
          className="flex items-center space-x-1.5 hover:bg-[#181d2a] px-1.5 py-0.5 rounded transition cursor-pointer group"
          title="Click to check for yt-dlp core & software updates"
        >
          <span 
            className={`w-2 h-2 rounded-full ${
              isDownloading 
                ? 'bg-sky-400 animate-pulse' 
                : isQueued 
                ? 'bg-amber-400' 
                : 'bg-emerald-500'
            }`} 
          />
          <span className="text-slate-200 font-medium group-hover:text-white">
            {isDownloading ? `Downloading (${activeCount})` : isQueued ? `Queue waiting (${queuedCount})` : 'Ready'}
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400 font-mono text-[10px] group-hover:text-sky-300 flex items-center gap-1">
            <span>yt-dlp Core</span>
            {systemStatus?.version && !systemStatus.version.includes('Not detected') && (
              <span className="text-slate-500">v{systemStatus.version.split(' ')[0]}</span>
            )}
          </span>
        </button>
      </div>

      {/* Right: Network Speed, Queue Counts, and Output Directory */}
      <div className="flex items-center space-x-3">
        {/* Speed indicator & Speed Limiter Popover */}
        <div className="relative flex items-center">
          {/* Live Speed + Speed Limiter Trigger */}
          <button
            ref={speedButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSpeedPopoverOpen(prev => !prev);
            }}
            className={`flex items-center space-x-1.5 font-mono text-[11px] px-2 py-0.5 rounded transition cursor-pointer group border ${
              isSpeedPopoverOpen
                ? 'bg-[#181d2a] text-white border-sky-500/40 shadow-sm'
                : isCapped
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                : 'text-slate-300 border-transparent hover:bg-[#181d2a] hover:text-white'
            }`}
            title={`Download Speed: ${totalSpeed}${isCapped ? ` (Capped at ${limitRate})` : ' (Unlimited)'} - Click to configure Speed Limiter`}
          >
            <ArrowDown className={`w-3 h-3 shrink-0 ${isDownloading ? 'text-sky-400 animate-pulse' : 'text-slate-500'}`} />
            <span className={isDownloading ? 'text-sky-300 font-medium' : isCapped ? 'text-amber-200 font-medium' : 'text-slate-300'}>
              {totalSpeed}
            </span>
            <Gauge className={`w-3 h-3 shrink-0 transition-colors ${
              isCapped
                ? 'text-amber-400'
                : 'text-slate-400 group-hover:text-sky-400'
            }`} />
            {isCapped && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/25 text-amber-300 font-semibold border border-amber-500/30 leading-tight">
                {limitRate}
              </span>
            )}
          </button>

          {/* Speed Limiter Popover */}
          {onSetLimitRate && (
            <SpeedLimiterPopover
              isOpen={isSpeedPopoverOpen}
              onClose={() => setIsSpeedPopoverOpen(false)}
              limitRate={limitRate}
              onSetLimitRate={(rate) => {
                onSetLimitRate(rate);
              }}
              triggerRef={speedButtonRef}
            />
          )}
        </div>

        <span className="text-slate-700">|</span>

        {/* Queue status (Clickable counters to filter) */}
        <div className="flex items-center space-x-1 text-slate-400">
          <Activity className="w-3 h-3 text-slate-500" />
          <span>Queue:</span>
          <button
            type="button"
            onClick={() => onSelectTab?.('queue', 'active')}
            className={`font-mono hover:underline cursor-pointer px-1 rounded hover:bg-[#181d2a] ${activeCount > 0 ? 'text-sky-400 font-medium' : 'text-slate-400'}`}
            title="Click to filter by active downloads"
          >
            {activeCount} active
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => onSelectTab?.('queue', 'queued')}
            className={`font-mono hover:underline cursor-pointer px-1 rounded hover:bg-[#181d2a] ${queuedCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}
            title="Click to filter by queued downloads"
          >
            {queuedCount} queued
          </button>
          {pausedCount > 0 && (
            <>
              <span>•</span>
              <button
                type="button"
                onClick={() => onSelectTab?.('queue', 'paused')}
                className="font-mono hover:underline cursor-pointer px-1 rounded hover:bg-[#181d2a] text-amber-300 font-medium"
                title="Click to filter by paused downloads"
              >
                {pausedCount} paused
              </button>
            </>
          )}
        </div>

        <span className="text-slate-700">|</span>

        {/* Output dir */}
        <div className="flex items-center space-x-1 group">
          <button
            onClick={handleOpenFolder}
            disabled={openingFolder}
            className="flex items-center space-x-1.5 text-slate-400 hover:text-slate-200 transition font-mono text-[10px] max-w-[240px] truncate px-1.5 py-0.5 rounded hover:bg-[#181d2a] cursor-pointer"
            title={`Download Folder: ${systemStatus?.downloadDir || 'Downloads'}\nClick to open in Explorer`}
          >
            {openingFolder ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <FolderOpen className="w-3 h-3 text-slate-400 group-hover:text-slate-200 shrink-0" />
            )}
            <span className="truncate">
              {openingFolder 
                ? 'Opening...' 
                : (systemStatus?.downloadDir ? systemStatus.downloadDir.replace(/%USERPROFILE%/gi, 'Downloads').replace(/[/\\]downloads$/i, '\\Downloads') : 'Downloads')}
            </span>
          </button>

          {onOpenSettingsModal && (
            <button
              onClick={onOpenSettingsModal}
              className="text-[10px] text-slate-500 hover:text-slate-300 p-0.5 rounded hover:bg-[#181d2a] transition cursor-pointer"
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
