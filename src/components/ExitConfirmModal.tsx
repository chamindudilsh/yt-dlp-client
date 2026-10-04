import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X, Minimize2, LogOut, Download, Film, Music, ArrowRight } from 'lucide-react';
import { DownloadTask } from '../types';

interface ExitConfirmModalProps {
  isOpen: boolean;
  activeTasks: DownloadTask[];
  canMinimizeToTray: boolean;
  onKeepDownloading: () => void;
  onMinimizeToTray: () => void;
  onExit: () => void;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  activeTasks,
  canMinimizeToTray,
  onKeepDownloading,
  onMinimizeToTray,
  onExit,
}) => {
  const chimePlayedRef = useRef(false);

  // Play subtle warning notification chime when modal appears
  const playAlertChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      if (!chimePlayedRef.current) {
        playAlertChime();
        chimePlayedRef.current = true;
      }
    } else {
      chimePlayedRef.current = false;
    }
  }, [isOpen]);

  // Handle ESC key to dismiss modal safely
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onKeepDownloading();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onKeepDownloading]);

  if (!isOpen) return null;

  const count = activeTasks.length;
  const displayTasks = activeTasks.slice(0, 3);
  const remainingCount = count - displayTasks.length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onKeepDownloading();
      }}
    >
      <div 
        className="relative w-full max-w-lg bg-[#10141d] border border-[#252e42] rounded-xl shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-confirm-title"
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 opacity-80" />

        {/* Modal Header */}
        <div className="p-4 border-b border-[#1e2535] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-xs shadow-amber-500/10">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 id="exit-confirm-title" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Active Downloads in Progress
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {count} {count === 1 ? 'task' : 'tasks'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Closing the application will interrupt running processes and cancel downloads.
              </p>
            </div>
          </div>
          <button
            onClick={onKeepDownloading}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-[#1a2130] transition cursor-pointer"
            title="Dismiss (Keep downloading)"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content: Active Tasks Preview */}
        <div className="p-4 space-y-3">
          <div className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Currently downloading:</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {displayTasks.map((task) => (
              <div
                key={task.id}
                className="bg-[#0c1017] border border-[#1e2536] rounded-lg p-2.5 flex items-center gap-3"
              >
                {/* Thumbnail / Media Icon */}
                <div className="w-10 h-10 rounded bg-[#161c28] border border-[#232b3d] shrink-0 overflow-hidden flex items-center justify-center">
                  {task.thumbnail ? (
                    <img
                      src={task.thumbnail}
                      alt={task.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : task.type === 'audio' ? (
                    <Music className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Film className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate" title={task.title}>
                    {task.title || 'Untitled download'}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                    <span className="capitalize text-sky-400 font-sans font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      {task.status}
                    </span>
                    <span>{task.speed || '0 KB/s'}</span>
                    <span className="text-slate-300 font-semibold">{Math.round(task.progress || 0)}%</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-1 bg-[#1a2130] rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${Math.max(3, Math.min(100, task.progress || 0))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {remainingCount > 0 && (
              <div className="text-center py-1 text-[11px] text-slate-400 font-medium">
                + {remainingCount} more active {remainingCount === 1 ? 'item' : 'items'} in queue
              </div>
            )}
          </div>

          {canMinimizeToTray && (
            <div className="bg-[#141a26] border border-[#20293d] rounded-lg p-2.5 flex items-start gap-2.5 text-xs text-slate-300">
              <Minimize2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-slate-300">
                <span className="font-semibold text-slate-200">Prefer background downloading?</span> You can send the application to the system tray so downloads safely continue without keeping this window open.
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-[#0d111a] border-t border-[#1e2535] flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Safe Action: Keep Downloading */}
          <button
            onClick={onKeepDownloading}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#1a2130] hover:bg-[#222a3d] border border-[#2a3449] text-xs font-medium text-slate-200 hover:text-white transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Keep Downloading</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {/* Alternative: Minimize to Tray */}
            {canMinimizeToTray && (
              <button
                onClick={onMinimizeToTray}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-xs font-medium text-sky-300 hover:text-sky-200 transition cursor-pointer flex items-center justify-center gap-1.5"
                title="Send window to system tray and let downloads finish in the background"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>To Tray</span>
              </button>
            )}

            {/* Destructive Action: Exit & Cancel */}
            <button
              onClick={onExit}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-medium transition cursor-pointer shadow-xs shadow-rose-900/50 flex items-center justify-center gap-1.5"
              title="Cancel all active downloads and close the application"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cancel & Exit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
