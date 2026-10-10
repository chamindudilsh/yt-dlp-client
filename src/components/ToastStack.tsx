import React, { useEffect, useState, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Play, 
  Folder, 
  RotateCcw, 
  X,
  FileCheck2
} from 'lucide-react';
import { ToastItem } from '../types';

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onOpenFile?: (filePath: string) => void;
  onOpenFolder?: (folderPath?: string, filePath?: string) => void;
  onRetry?: (taskId: string) => void;
}

interface SingleToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  onOpenFile?: (filePath: string) => void;
  onOpenFolder?: (folderPath?: string, filePath?: string) => void;
  onRetry?: (taskId: string) => void;
}

const SingleToast: React.FC<SingleToastProps> = ({
  toast,
  onDismiss,
  onOpenFile,
  onOpenFolder,
  onRetry,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const duration = toast.durationMs ?? (toast.type === 'error' ? 7000 : 5000);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  useEffect(() => {
    if (isHovered) return;

    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const timeLeft = Math.max(0, remainingTimeRef.current - elapsed);
      setProgress((timeLeft / duration) * 100);

      if (timeLeft <= 0) {
        clearInterval(interval);
        onDismiss(toast.id);
      }
    }, 50);

    return () => {
      clearInterval(interval);
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - (Date.now() - startTimeRef.current));
    };
  }, [isHovered, duration, onDismiss, toast.id]);

  const borderColors = {
    success: 'border-emerald-500/40 shadow-emerald-950/30',
    error: 'border-rose-500/40 shadow-rose-950/30',
    info: 'border-sky-500/40 shadow-sky-950/30',
  };

  const accentPills = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    error: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  };

  const progressColors = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    info: 'bg-sky-500',
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-84 sm:w-96 bg-[#141926]/95 backdrop-blur-md border ${borderColors[toast.type]} rounded-xl shadow-xl overflow-hidden transition-all duration-200 transform translate-y-0 opacity-100 hover:scale-[1.01]`}
      role="alert"
    >
      <div className="p-3.5 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
            <span className="text-xs font-semibold text-slate-100 truncate">
              {toast.title}
            </span>
            {toast.count && toast.count > 1 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${accentPills[toast.type]}`}>
                {toast.count} items
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors shrink-0"
            title="Dismiss notification"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Message / Details */}
        {toast.message && (
          <p className="text-xs text-slate-300 leading-relaxed break-words line-clamp-2 select-text">
            {toast.message}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {toast.filePath && onOpenFile && (
            <button
              type="button"
              onClick={() => {
                onOpenFile(toast.filePath!);
                onDismiss(toast.id);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-md shadow-sm transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Open Media</span>
            </button>
          )}

          {(toast.filePath || toast.folderPath) && onOpenFolder && (
            <button
              type="button"
              onClick={() => {
                onOpenFolder(toast.folderPath, toast.filePath);
                onDismiss(toast.id);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-md transition-colors"
            >
              <Folder className="w-3 h-3 text-sky-400" />
              <span>Show in Folder</span>
            </button>
          )}

          {toast.taskId && onRetry && (
            <button
              type="button"
              onClick={() => {
                onRetry(toast.taskId!);
                onDismiss(toast.id);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-rose-600/90 hover:bg-rose-500 text-white rounded-md shadow-sm transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress countdown bar */}
      <div className="h-0.5 w-full bg-slate-800/80">
        <div
          className={`h-full transition-all duration-75 ${progressColors[toast.type]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const ToastStack: React.FC<ToastStackProps> = ({
  toasts,
  onDismiss,
  onOpenFile,
  onOpenFolder,
  onRetry,
}) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside 
      aria-label="Notifications"
      className="fixed bottom-10 right-4 z-50 flex flex-col-reverse gap-2.5 max-w-full pointer-events-auto"
    >
      {toasts.map(toast => (
        <SingleToast
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
          onRetry={onRetry}
        />
      ))}
    </aside>
  );
};
