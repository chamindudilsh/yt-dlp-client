import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileSearch,
  Video,
  Music,
  FileText,
  Copy,
  Check,
  RefreshCw,
  FolderOpen,
  Play,
  CheckCircle2,
  AlertTriangle,
  Code,
  Layers,
  Sparkles,
  Info,
  Clock,
  HardDrive,
  Activity,
  Image as ImageIcon,
  ExternalLink,
  Search
} from 'lucide-react';
import { MediaProbeInfo } from '../types';
import { api, isNativeWindowsDesktop } from '../lib/apiBridge';

export interface MediaInspectorTarget {
  filepath?: string;
  taskId?: string;
  filename?: string;
  title?: string;
}

export interface MediaInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: MediaInspectorTarget | null;
}

type InspectorTab = 'overview' | 'video' | 'audio' | 'metadata' | 'raw';

export const MediaInspectorModal: React.FC<MediaInspectorModalProps> = ({
  isOpen,
  onClose,
  target,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('overview');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<MediaProbeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState('');

  const fetchProbeData = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const probeResult = await api.inspectMedia({
        filepath: target.filepath,
        taskId: target.taskId,
        filename: target.filename,
      });

      if (probeResult && (probeResult.isValid || probeResult.formatName !== 'unknown' || probeResult.video || probeResult.audio)) {
        setInfo(probeResult);
        if (probeResult.error && !probeResult.video && !probeResult.audio) {
          setError(probeResult.error);
        }
      } else if (probeResult?.error) {
        setError(probeResult.error);
        setInfo(probeResult);
      } else {
        setError('No media stream information detected in file.');
      }
    } catch (err: any) {
      console.error('Failed to probe media:', err);
      setError(err?.message || 'Failed to inspect media file with ffprobe.');
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    if (isOpen && target) {
      setActiveTab('overview');
      setTagSearch('');
      fetchProbeData();
    } else {
      setInfo(null);
      setError(null);
    }
  }, [isOpen, target, fetchProbeData]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !target) return null;

  const handleCopy = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyRawJson = () => {
    if (!info) return;
    const jsonStr = JSON.stringify(info, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const handleOpenMedia = async () => {
    try {
      await api.openMediaFile({
        filepath: target.filepath || info?.filepath,
        taskId: target.taskId,
        filename: target.filename || info?.filename,
      });
    } catch (e) {
      console.warn('Failed to open media file:', e);
    }
  };

  const handleShowInFolder = async () => {
    try {
      await api.showItemInFolder({
        filepath: target.filepath || info?.filepath,
        taskId: target.taskId,
        filename: target.filename || info?.filename,
      });
    } catch (e) {
      console.warn('Failed to show file in folder:', e);
    }
  };

  const displayName = target.title || target.filename || info?.filename || 'Media File';
  const displayFilepath = target.filepath || info?.filepath || target.filename || '';

  const tagsList = info?.tags ? Object.entries(info.tags) : [];
  const filteredTags = tagsList.filter(([key, val]) => {
    if (!tagSearch.trim()) return true;
    const q = tagSearch.toLowerCase();
    return key.toLowerCase().includes(q) || String(val).toLowerCase().includes(q);
  });

  return (
    <div
      id="media-inspector-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="media-inspector-modal-container"
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0f1422] border border-[#222c42] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden text-slate-200"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#141b2e] border-b border-[#222c42] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-xl shadow-inner shrink-0">
              <FileSearch className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight truncate">
                  Media Stream Inspector
                </h3>
                {info && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      info.isValid
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {info.isValid ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Streams Verified</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>Analysis Warning</span>
                      </>
                    )}
                  </span>
                )}
                {info?.formatName && info.formatName !== 'unknown' && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-mono tracking-wider font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {info.formatName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate max-w-xl font-mono mt-0.5" title={displayFilepath}>
                {displayName}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchProbeData}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Re-run ffprobe stream inspection"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-5 py-2.5 bg-[#111728] border-b border-[#1f283d] flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center space-x-2">
            {isNativeWindowsDesktop() && (
              <button
                type="button"
                onClick={handleOpenMedia}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Open in Player</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleShowInFolder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Show in Explorer</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyRawJson}
              disabled={!info}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#182035] hover:bg-[#202b46] text-slate-300 hover:text-white font-mono border border-slate-700/80 transition cursor-pointer disabled:opacity-40"
            >
              {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRaw ? 'Copied JSON' : 'Copy JSON'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 bg-[#0d121f] border-b border-[#1c2438] flex items-center space-x-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'border-indigo-400 text-white bg-[#141b2e]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'video'
                ? 'border-indigo-400 text-white bg-[#141b2e]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Stream</span>
            {info?.video && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'audio'
                ? 'border-indigo-400 text-white bg-[#141b2e]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Audio Stream</span>
            {info?.audio && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('metadata')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'metadata'
                ? 'border-indigo-400 text-white bg-[#141b2e]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Metadata & Tags</span>
            {tagsList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {tagsList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'raw'
                ? 'border-indigo-400 text-white bg-[#141b2e]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Raw ffprobe Output</span>
          </button>
        </div>

        {/* Body Content Area */}
        <div className="p-5 overflow-y-auto flex-1 min-h-[300px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm font-medium text-slate-300">Running ffprobe inspection...</p>
              <p className="text-xs text-slate-500">Extracting container format, audio/video streams, and embedded tags</p>
            </div>
          ) : error && !info?.video && !info?.audio ? (
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <h4 className="font-semibold text-sm text-rose-200">Failed to analyze media file</h4>
                <p className="text-xs text-rose-300/90 font-mono break-all">{error}</p>
                <p className="text-xs text-slate-400 pt-1">
                  Ensure ffprobe or ffmpeg is installed and the target media file exists in your downloads folder.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={fetchProbeData}
                    className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 border border-rose-700/60 rounded-md text-xs text-white font-medium transition cursor-pointer"
                  >
                    Retry Inspection
                  </button>
                </div>
              </div>
            </div>
          ) : info ? (
            <>
              {/* Tab: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* Metric Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#141b2d] border border-[#222c42]">
                      <div className="flex items-center space-x-2 text-slate-400 text-xs">
                        <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                        <span>File Size</span>
                      </div>
                      <div className="mt-1 text-base font-bold text-white font-mono">
                        {info.sizeFormatted || `${((info.sizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB`}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {info.sizeBytes?.toLocaleString() || 0} bytes
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#141b2d] border border-[#222c42]">
                      <div className="flex items-center space-x-2 text-slate-400 text-xs">
                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                        <span>Duration</span>
                      </div>
                      <div className="mt-1 text-base font-bold text-white font-mono">
                        {info.durationFormatted || '00:00'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {info.durationSeconds} seconds
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#141b2d] border border-[#222c42]">
                      <div className="flex items-center space-x-2 text-slate-400 text-xs">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Total Bitrate</span>
                      </div>
                      <div className="mt-1 text-base font-bold text-white font-mono">
                        {info.bitRateKbps > 0 ? `${info.bitRateKbps} kbps` : '--'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {info.bitRateKbps > 0 ? `${(info.bitRateKbps / 1000).toFixed(2)} Mbps` : 'Variable / Unknown'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#141b2d] border border-[#222c42]">
                      <div className="flex items-center space-x-2 text-slate-400 text-xs">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        <span>Container</span>
                      </div>
                      <div className="mt-1 text-base font-bold text-white uppercase font-mono truncate" title={info.formatLongName}>
                        {info.formatName}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate" title={info.formatLongName}>
                        {info.formatLongName}
                      </div>
                    </div>
                  </div>

                  {/* Primary Streams Snapshot */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Video Stream Card */}
                    <div className="p-4 rounded-xl bg-[#131929] border border-[#202a3f]">
                      <div className="flex items-center justify-between pb-3 border-b border-[#1e273a]">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                            <Video className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white">Video Stream</h4>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {info.video ? info.video.codec.toUpperCase() : 'No Video Track'}
                            </span>
                          </div>
                        </div>

                        {info.video && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            {info.video.resolution}
                          </span>
                        )}
                      </div>

                      {info.video ? (
                        <div className="mt-3 space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Codec Details</span>
                            <span className="font-mono text-slate-200">{info.video.codecLong || info.video.codec}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Resolution & Aspect</span>
                            <span className="font-mono text-slate-200">{info.video.resolution} ({info.video.aspectRatio})</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Frame Rate</span>
                            <span className="font-mono text-slate-200">{info.video.fps} FPS</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-400">Pixel Format</span>
                            <span className="font-mono text-slate-200">{info.video.pixelFormat || 'yuv420p'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 py-4 text-center text-xs text-slate-500">
                          Audio-only media file (no active video stream)
                        </div>
                      )}
                    </div>

                    {/* Audio Stream Card */}
                    <div className="p-4 rounded-xl bg-[#131929] border border-[#202a3f]">
                      <div className="flex items-center justify-between pb-3 border-b border-[#1e273a]">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <Music className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white">Audio Stream</h4>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {info.audio ? info.audio.codec.toUpperCase() : 'No Audio Track'}
                            </span>
                          </div>
                        </div>

                        {info.audio && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            {info.audio.sampleRate ? `${(info.audio.sampleRate / 1000).toFixed(1)} kHz` : 'Audio'}
                          </span>
                        )}
                      </div>

                      {info.audio ? (
                        <div className="mt-3 space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Audio Codec</span>
                            <span className="font-mono text-slate-200">{info.audio.codecLong || info.audio.codec}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Sampling Rate</span>
                            <span className="font-mono text-slate-200">{info.audio.sampleRate.toLocaleString()} Hz</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Channels</span>
                            <span className="font-mono text-slate-200">{info.audio.channelLayout} ({info.audio.channels} ch)</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-400">Audio Bitrate</span>
                            <span className="font-mono text-slate-200">{info.audio.bitRateKbps ? `${info.audio.bitRateKbps} kbps` : 'Variable'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 py-4 text-center text-xs text-slate-500">
                          Silent video (no audio stream detected)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Highlights / Badges */}
                  <div className="p-3.5 rounded-xl bg-[#141b2d] border border-[#222c42] flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center space-x-2">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-400">Cover Art:</span>
                      <span className={`font-semibold ${info.hasCoverArt ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {info.hasCoverArt ? 'Embedded Picture Attached' : 'None'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-400">Chapters:</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {info.chapterCount > 0 ? `${info.chapterCount} Chapters` : 'None'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-400">Metadata Tags:</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {tagsList.length} fields
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Video Stream */}
              {activeTab === 'video' && (
                <div className="space-y-4">
                  {info.video ? (
                    <div className="p-4 rounded-xl bg-[#141b2d] border border-[#222c42] space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-[#20293d]">
                        <div>
                          <h4 className="font-semibold text-white text-sm">Video Stream Details</h4>
                          <p className="text-xs text-slate-400">High-fidelity ffprobe stream specifications</p>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-700/60 text-xs font-mono font-semibold">
                          {info.video.resolution} @ {info.video.fps} fps
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800">
                          <span className="text-slate-500 block">Codec</span>
                          <span className="text-slate-200 font-mono font-medium">{info.video.codec}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800">
                          <span className="text-slate-500 block">Codec Description</span>
                          <span className="text-slate-200 font-mono font-medium">{info.video.codecLong}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800">
                          <span className="text-slate-500 block">Dimensions</span>
                          <span className="text-slate-200 font-mono font-medium">{info.video.width} x {info.video.height} px</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800">
                          <span className="text-slate-500 block">Aspect Ratio</span>
                          <span className="text-slate-200 font-mono font-medium">{info.video.aspectRatio}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800">
                          <span className="text-slate-500 block">Frame Rate</span>
                          <span className="text-slate-200 font-mono font-medium">{info.video.fps} FPS</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800">
                          <span className="text-slate-500 block">Pixel Format</span>
                          <span className="text-slate-200 font-mono font-medium">{info.video.pixelFormat || 'N/A'}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800 sm:col-span-2">
                          <span className="text-slate-500 block">Stream Bitrate</span>
                          <span className="text-slate-200 font-mono font-medium">
                            {info.video.bitRateKbps ? `${info.video.bitRateKbps} kbps (${(info.video.bitRateKbps / 1000).toFixed(2)} Mbps)` : 'Variable / Container shared'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-xl bg-[#141b2d] border border-[#222c42] space-y-2">
                      <Video className="w-10 h-10 text-slate-600 mx-auto" />
                      <h4 className="text-sm font-semibold text-slate-300">No Video Stream</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        This file does not contain a video track. It is likely an audio download (MP3, M4A, Opus, FLAC).
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Audio Stream */}
              {activeTab === 'audio' && (
                <div className="space-y-4">
                  {info.audio ? (
                    <div className="p-4 rounded-xl bg-[#141b2d] border border-[#222c42] space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-[#20293d]">
                        <div>
                          <h4 className="font-semibold text-white text-sm">Audio Stream Details</h4>
                          <p className="text-xs text-slate-400">Acoustic fidelity & channel specifications</p>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/60 text-xs font-mono font-semibold">
                          {info.audio.codec.toUpperCase()} {info.audio.bitRateKbps ? `@ ${info.audio.bitRateKbps}k` : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800">
                          <span className="text-slate-500 block">Audio Codec</span>
                          <span className="text-slate-200 font-mono font-medium">{info.audio.codec}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800">
                          <span className="text-slate-500 block">Full Description</span>
                          <span className="text-slate-200 font-mono font-medium">{info.audio.codecLong}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800">
                          <span className="text-slate-500 block">Sample Rate</span>
                          <span className="text-slate-200 font-mono font-medium">{info.audio.sampleRate.toLocaleString()} Hz</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800">
                          <span className="text-slate-500 block">Channels & Layout</span>
                          <span className="text-slate-200 font-mono font-medium">{info.audio.channelLayout} ({info.audio.channels} channels)</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0e1320] border border-slate-800 sm:col-span-2">
                          <span className="text-slate-500 block">Audio Bitrate</span>
                          <span className="text-slate-200 font-mono font-medium">
                            {info.audio.bitRateKbps ? `${info.audio.bitRateKbps} kbps` : 'Variable Bitrate (VBR)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-xl bg-[#141b2d] border border-[#222c42] space-y-2">
                      <Music className="w-10 h-10 text-slate-600 mx-auto" />
                      <h4 className="text-sm font-semibold text-slate-300">No Audio Stream</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        This file has no audio stream detected.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Metadata & Tags */}
              {activeTab === 'metadata' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Search metadata tags..."
                        className="w-full bg-[#141b2d] border border-[#222c42] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      Showing {filteredTags.length} of {tagsList.length} tags
                    </span>
                  </div>

                  {filteredTags.length > 0 ? (
                    <div className="rounded-xl border border-[#222c42] overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#141b2d] text-slate-400 uppercase font-mono border-b border-[#222c42]">
                          <tr>
                            <th className="py-2.5 px-4 font-semibold w-1/3">Tag Key</th>
                            <th className="py-2.5 px-4 font-semibold">Value</th>
                            <th className="py-2.5 px-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e273b] bg-[#0e1320]">
                          {filteredTags.map(([key, val]) => (
                            <tr key={key} className="hover:bg-slate-800/40 transition">
                              <td className="py-2.5 px-4 font-mono font-medium text-indigo-300 align-top">
                                {key}
                              </td>
                              <td className="py-2.5 px-4 text-slate-200 font-mono break-all select-text align-top">
                                {String(val)}
                              </td>
                              <td className="py-2.5 px-2 text-right align-top">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(String(val), key)}
                                  className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                                  title={`Copy ${key}`}
                                >
                                  {copiedField === key ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-xl bg-[#141b2d] border border-[#222c42]">
                      <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 font-medium">No metadata tags found</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {tagSearch ? 'No tags match your search filter.' : 'The media container does not contain embedded ID3 or Vorbis tags.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Raw Output */}
              {activeTab === 'raw' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">
                      Parsed ffprobe JSON data payload
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRawJson}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition cursor-pointer border border-slate-700"
                    >
                      {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRaw ? 'Copied Raw JSON' : 'Copy All'}</span>
                    </button>
                  </div>
                  <div className="rounded-xl bg-[#080b12] border border-[#1e273a] p-4 max-h-[380px] overflow-auto">
                    <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(info, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#141b2e] border-t border-[#222c42] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="truncate max-w-sm font-mono text-[11px] text-slate-500" title={displayFilepath}>
            {displayFilepath}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium transition cursor-pointer border border-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaInspectorModal;
