import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Trash2, 
  Terminal, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Clock, 
  ArrowDown, 
  Music, 
  Video, 
  Crop, 
  ShieldAlert, 
  FileText,
  ChevronDown,
  ChevronUp,
  XCircle,
  Download,
  Copy,
  Check,
  X,
  Cookie,
  FolderOpen
} from 'lucide-react';
import { DownloadTask } from '../types';
import { api } from '../lib/apiBridge';

interface DownloadQueueManagerProps {
  tasks: DownloadTask[];
  onCancelTask: (id: string) => Promise<void>;
  onRetryTask: (id: string) => Promise<void>;
  onClearCompleted: () => Promise<void>;
  onSwitchToLibrary: () => void;
  onOpenSettings?: (tab?: string) => void;
}

export const DownloadQueueManager: React.FC<DownloadQueueManagerProps> = ({
  tasks,
  onCancelTask,
  onRetryTask,
  onClearCompleted,
  onSwitchToLibrary,
  onOpenSettings,
}) => {
  const [expandedLogTaskId, setExpandedLogTaskId] = useState<string | null>(null);
  const [selectedErrorTask, setSelectedErrorTask] = useState<DownloadTask | null>(null);
  const [copiedError, setCopiedError] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);

  const handleOpenFolder = async () => {
    setOpeningFolder(true);
    try {
      await api.openDownloadFolder();
    } catch (e) {
      console.warn('Failed to open folder:', e);
    } finally {
      setTimeout(() => setOpeningFolder(false), 900);
    }
  };

  const activeTasks = tasks.filter(t => t.status === 'downloading' || t.status === 'fetching' || t.status === 'converting');
  const queuedTasks = tasks.filter(t => t.status === 'queued');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'error' || t.status === 'cancelled');

  const toggleLog = (id: string) => {
    setExpandedLogTaskId(expandedLogTaskId === id ? null : id);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">
      {/* Batch Overview & Global Controls */}
      <div className="bg-[#121620] border border-[#232a3b] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Metrics Counters */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <span className="text-slate-400">Total in Queue:</span>
            <span className="ml-1.5 font-bold text-white text-sm">{tasks.length}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span className="text-slate-400">Downloading:</span>
            <span className="font-bold text-sky-400 font-mono">{activeTasks.length}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span className="text-slate-400">Queued:</span>
            <span className="ml-1 font-mono text-slate-300">{queuedTasks.length}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span className="text-slate-400">Finished:</span>
            <span className="ml-1 font-mono text-emerald-400">{completedTasks.length}</span>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenFolder}
            disabled={openingFolder}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a202c] hover:bg-[#242c3d] text-slate-300 hover:text-white border border-slate-700 transition flex items-center space-x-1.5"
            title="Open download folder in Windows Explorer"
          >
            {openingFolder ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{openingFolder ? 'Opening...' : 'Open Folder'}</span>
          </button>

          {completedTasks.length > 0 && (
            <button
              onClick={onSwitchToLibrary}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40 transition flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>View Saved Media ({completedTasks.length})</span>
            </button>
          )}

          <button
            onClick={onClearCompleted}
            disabled={completedTasks.length === 0 && failedTasks.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e2433] hover:bg-[#283145] text-slate-300 border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Clear Finished</span>
          </button>
        </div>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="bg-[#121620] border border-[#232a3b] rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
            <Clock className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-300">Download Queue is Empty</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Use the Batch Downloader tab to paste individual video URLs, multi-line batches, or extract full playlists.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const isLogOpen = expandedLogTaskId === task.id;

            return (
              <div
                key={task.id}
                className={`bg-[#121620] border rounded-xl overflow-hidden transition ${
                  task.status === 'downloading' || task.status === 'converting'
                    ? 'border-sky-500/50 shadow-md'
                    : task.status === 'completed'
                    ? 'border-emerald-500/30'
                    : task.status === 'error'
                    ? 'border-rose-500/40'
                    : 'border-[#232a3b]'
                }`}
              >
                {/* Main Task Row */}
                <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Thumbnail & Title Info */}
                  <div className="flex items-center space-x-3 truncate">
                    {/* Thumbnail */}
                    <div className="relative w-16 h-12 rounded overflow-hidden bg-black/80 shrink-0 border border-slate-800">
                      {task.thumbnail ? (
                        <img
                          src={task.thumbnail}
                          alt={task.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          {task.type === 'audio' ? <Music className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                        </div>
                      )}

                      {/* 1:1 Aspect Ratio Cropped Square Badge */}
                      {task.type === 'audio' && task.options.audioCropThumbnailSquare && (
                        <div 
                          className="absolute bottom-0 right-0 bg-rose-600/90 text-white p-0.5 rounded-tl text-[8px] font-bold"
                          title="1:1 Aspect Ratio Square Album Art Cropping"
                        >
                          <Crop className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>

                    {/* Title & Metadata Badges */}
                    <div className="space-y-1 truncate">
                      <h4 className="text-xs font-semibold text-white truncate max-w-md">
                        {task.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="text-slate-300">{task.uploader || 'Unknown'}</span>
                        <span>•</span>
                        <span className="font-mono uppercase bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700/50">
                          {task.type} • {task.format}
                        </span>

                        {task.options.sponsorblock.enabled && (
                          <span className="text-amber-400 font-mono bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/40 flex items-center gap-0.5">
                            <ShieldAlert className="w-2.5 h-2.5" /> SponsorBlock
                          </span>
                        )}

                        {task.options.audioCropThumbnailSquare && task.type === 'audio' && (
                          <span className="text-rose-400 font-mono bg-rose-950/40 px-1.5 py-0.2 rounded border border-rose-800/40 flex items-center gap-0.5">
                            <Crop className="w-2.5 h-2.5" /> 1:1 Square Cover
                          </span>
                        )}
                      </div>

                      {/* Clickable exact error preview strip */}
                      {task.status === 'error' && (
                        <div 
                          onClick={() => setSelectedErrorTask(task)}
                          className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/50 rounded-md px-2.5 py-1 cursor-pointer transition max-w-xl group shadow-sm"
                          title="Click to view exact yt-dlp error breakdown and full log"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="font-mono text-rose-200 truncate">{task.error || "Execution failed with error. Click for details."}</span>
                          <span className="text-[10px] text-rose-300/80 underline ml-auto shrink-0 group-hover:text-rose-100 font-sans">
                            View Error
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center/Right: Status & Actions */}
                  <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0">
                    {/* Status Pill */}
                    <div>
                      {task.status === 'queued' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Queued
                        </span>
                      )}
                      {task.status === 'downloading' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                          <ArrowDown className="w-3 h-3" /> Downloading
                        </span>
                      )}
                      {task.status === 'converting' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          FFmpeg Post-processing
                        </span>
                      )}
                      {task.status === 'completed' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      )}
                      {task.status === 'error' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedErrorTask(task)}
                            className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 hover:border-rose-400 flex items-center gap-1.5 cursor-pointer transition shadow-sm group"
                            title="Click to view exact yt-dlp error message and traceback"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                            <span>Error</span>
                            <span className="text-[9px] bg-rose-950/80 px-1 py-0.2 rounded text-rose-200 border border-rose-800/60 ml-0.5">
                              Inspect
                            </span>
                          </button>
                          {(task.error?.toLowerCase().includes('bot') || 
                            task.error?.toLowerCase().includes('sign in') || 
                            task.error?.toLowerCase().includes('429')) && onOpenSettings && (
                            <button
                              type="button"
                              onClick={() => onOpenSettings('cookies')}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/70 border border-amber-600/50 text-amber-300 hover:bg-amber-900/80 transition flex items-center gap-1 shadow-sm"
                              title="YouTube bot detection detected: Configure Cookies or PO Token"
                            >
                              <Cookie className="w-3 h-3 text-amber-400" />
                              <span>Fix Sign-in</span>
                            </button>
                          )}
                        </div>
                      )}
                      {task.status === 'cancelled' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Cancelled
                        </span>
                      )}
                    </div>

                    {/* Metric info */}
                    {(task.status === 'downloading' || task.status === 'converting') && (
                      <div className="text-right font-mono text-[11px] min-w-[100px]">
                        <div className="text-sky-400 font-bold">{task.speed}</div>
                        <div className="text-slate-400 text-[10px]">ETA: {task.eta}</div>
                      </div>
                    )}

                    {/* Individual Control Buttons */}
                    <div className="flex items-center space-x-1">
                      {/* Terminal log toggle */}
                      <button
                        onClick={() => toggleLog(task.id)}
                        className={`p-1.5 rounded transition ${
                          isLogOpen ? 'bg-sky-900/40 text-sky-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                        title="Toggle yt-dlp Process Output Logs"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                      </button>

                      {/* Cancel if downloading / queued */}
                      {(task.status === 'downloading' || task.status === 'queued') && (
                        <button
                          onClick={() => onCancelTask(task.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition"
                          title="Cancel Download"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Retry if error or cancelled */}
                      {(task.status === 'error' || task.status === 'cancelled') && (
                        <button
                          onClick={() => onRetryTask(task.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-sky-300 hover:bg-sky-950/40 transition"
                          title="Retry Download"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Download link if completed */}
                      {task.status === 'completed' && task.filename && (
                        <a
                          href={`/api/files/${encodeURIComponent(task.filename)}`}
                          download={task.filename}
                          className="p-1.5 rounded text-emerald-400 hover:bg-emerald-950/40 transition flex items-center"
                          title="Save / Download File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="px-3.5 pb-2.5">
                  <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        task.status === 'completed'
                          ? 'bg-emerald-500'
                          : task.status === 'error'
                          ? 'bg-rose-500'
                          : 'bg-gradient-to-r from-sky-500 to-blue-500'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>{task.progress.toFixed(1)}%</span>
                    <span>{task.totalSize || '-- MB'}</span>
                  </div>
                </div>

                {/* Real-Time Terminal Log Drawer */}
                {isLogOpen && (
                  <div className="border-t border-slate-800 bg-[#0a0d14] p-3 text-[11px] font-mono text-slate-300 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pb-1 border-b border-slate-800/60">
                      <span>yt-dlp Execution Standard Output (stdout):</span>
                      <span>Task ID: {task.id}</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-0.5 pt-1 text-slate-300 leading-tight">
                      {task.logs.map((log, idx) => (
                        <div
                          key={idx}
                          className={
                            log.includes('[Error]')
                              ? 'text-rose-400'
                              : log.includes('[SponsorBlock]')
                              ? 'text-amber-400'
                              : log.includes('[Audio Processor]')
                              ? 'text-rose-300'
                              : log.includes('[Completed]')
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* EXACT ERROR INSPECTOR MODAL */}
      {selectedErrorTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-[#0f131c] border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Title Bar */}
            <div className="h-14 bg-[#151a26] border-b border-[#232b3c] px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-400 shadow-sm">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>Task Execution Error Inspector</span>
                    <span className="text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-800/60 px-2 py-0.5 rounded-full">
                      Exit Error
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-md">
                    {selectedErrorTask.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedErrorTask(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Media URL & Target Info */}
              <div className="p-3 bg-[#141926] rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Target Link:</span>
                <a
                  href={selectedErrorTask.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1 font-mono truncate max-w-xs"
                >
                  {selectedErrorTask.url}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>

              {/* Exact Error Callout */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    Exact yt-dlp Error Message:
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedErrorTask.error || 'Unknown Error');
                      setCopiedError(true);
                      setTimeout(() => setCopiedError(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[10px] text-rose-300 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/60 px-2 py-1 rounded transition"
                  >
                    {copiedError ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedError ? 'Copied!' : 'Copy Exact Error'}</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-[#181119] border border-rose-500/40 text-rose-200 font-mono text-[12px] leading-relaxed break-words selection:bg-rose-500/30">
                  {selectedErrorTask.error || 'yt-dlp process terminated with non-zero exit code'}
                </div>
              </div>

              {/* Automated Diagnostic Tip */}
              <div className="p-3 bg-[#131924] rounded-xl border border-slate-800/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    Diagnostic Explanation & Suggestions
                  </span>
                  {(selectedErrorTask.error?.toLowerCase().includes('bot') || 
                    selectedErrorTask.error?.toLowerCase().includes('sign in') || 
                    selectedErrorTask.error?.toLowerCase().includes('429')) && onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedErrorTask(null);
                        onOpenSettings('cookies');
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-medium bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg transition shadow-sm"
                    >
                      <Cookie className="w-3.5 h-3.5" />
                      <span>Open Cookies & Bot Fix</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {selectedErrorTask.error?.toLowerCase().includes('bot') || selectedErrorTask.error?.toLowerCase().includes('sign in')
                    ? 'YouTube is requesting bot verification ("Sign in to confirm you’re not a bot"). You can bypass this by importing browser cookies, generating a Web Client PO Token, or selecting the iOS Player Client in Settings.'
                    : selectedErrorTask.error?.toLowerCase().includes('unavailable') || selectedErrorTask.error?.toLowerCase().includes('private')
                    ? 'The media stream appears to be private, unlisted, geo-restricted, or member-only. If this video requires login, configure cookies in Settings.'
                    : selectedErrorTask.error?.toLowerCase().includes('ffmpeg') || selectedErrorTask.error?.toLowerCase().includes('postprocessing')
                    ? 'FFmpeg encountered an issue muxing or converting the streams. Try setting container format to MKV or audio format to MP3.'
                    : 'The external yt-dlp binary encountered an issue during extraction or network transfer. Check that the URL is valid and click Retry.'}
                </p>
              </div>

              {/* Stderr and Traceback Terminal */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-400" />
                    Process Stderr / Output Tail ({selectedErrorTask.logs.length} entries)
                  </span>
                </div>

                <div className="bg-[#090c12] border border-slate-800 rounded-xl p-3 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1">
                  {selectedErrorTask.logs.length === 0 ? (
                    <div className="text-slate-500 italic">No output logs recorded for this task.</div>
                  ) : (
                    selectedErrorTask.logs.map((line, idx) => (
                      <div
                        key={idx}
                        className={
                          line.includes('ERROR:') || line.includes('[stderr]') || line.includes('[Error]')
                            ? 'text-rose-400 font-semibold bg-rose-950/30 px-1 rounded'
                            : line.includes('[SponsorBlock]')
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }
                      >
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="h-14 bg-[#141824] border-t border-[#232b3e] px-5 flex items-center justify-between shrink-0">
              <button
                onClick={() => {
                  const fullReport = `Task Error Report:\nTitle: ${selectedErrorTask.title}\nURL: ${selectedErrorTask.url}\nError: ${selectedErrorTask.error}\n\nLogs:\n${selectedErrorTask.logs.join('\n')}`;
                  navigator.clipboard.writeText(fullReport);
                  setCopiedError(true);
                  setTimeout(() => setCopiedError(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Full Report</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedErrorTask(null)}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const id = selectedErrorTask.id;
                    setSelectedErrorTask(null);
                    onRetryTask(id);
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
