import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileSearch, 
  Film, 
  Music, 
  ShieldCheck, 
  AlertTriangle, 
  HardDrive, 
  Clock, 
  Activity, 
  Layers, 
  Tag, 
  Image as ImageIcon, 
  Copy, 
  Check, 
  Code,
  Sparkles,
  Volume2,
  Tv,
  CheckCircle2
} from 'lucide-react';
import { MediaProbeInfo } from '../types';
import { api } from '../lib/apiBridge';

interface MediaInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  target?: {
    filepath?: string;
    taskId?: string;
    filename?: string;
    title?: string;
  } | null;
}

export const MediaInspectorModal: React.FC<MediaInspectorModalProps> = ({
  isOpen,
  onClose,
  target,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaInfo, setMediaInfo] = useState<MediaProbeInfo | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'metadata' | 'raw'>('overview');

  useEffect(() => {
    if (!isOpen || !target) {
      setMediaInfo(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    api.inspectMedia({
      filepath: target.filepath,
      taskId: target.taskId,
      filename: target.filename,
    })
      .then((info) => {
        if (!isMounted) return;
        if (info.error && !info.isValid) {
          setError(info.error);
        } else {
          setMediaInfo(info);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.message || 'Failed to inspect media file');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, target]);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    if (!mediaInfo) return;
    navigator.clipboard.writeText(JSON.stringify(mediaInfo, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const title = target?.title || target?.filename || mediaInfo?.filename || 'Media Inspector';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <FileSearch className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white truncate">Media Stream Inspector</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  ffprobe engine
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md" title={title}>
                {title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            title="Close Inspector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 px-6 bg-slate-950/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Streams & Codecs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('metadata')}
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === 'metadata'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Metadata & Tags</span>
            {mediaInfo && Object.keys(mediaInfo.tags || {}).length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                {Object.keys(mediaInfo.tags).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === 'raw'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Raw JSON</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-mono">Running ffprobe stream analysis...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Stream Inspection Failed</span>
              </div>
              <p className="text-xs text-rose-200/80 font-mono break-all">{error}</p>
              <p className="text-xs text-slate-400">
                Ensure FFmpeg / ffprobe is installed on your system or in your PATH, and that the media file is fully downloaded.
              </p>
            </div>
          )}

          {mediaInfo && !loading && (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Integrity & Container Banner */}
                  <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${mediaInfo.isValid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {mediaInfo.isValid ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100 text-sm">
                            {mediaInfo.formatLongName || mediaInfo.formatName}
                          </span>
                          {mediaInfo.isValid && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Integrity Verified
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          Format: {mediaInfo.formatName}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold text-sky-400 font-mono">
                        {mediaInfo.sizeFormatted}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {mediaInfo.durationFormatted} ({mediaInfo.durationSeconds}s)
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-sky-400" /> Size
                      </span>
                      <span className="text-slate-200 font-mono font-medium block mt-1">
                        {mediaInfo.sizeFormatted}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" /> Duration
                      </span>
                      <span className="text-slate-200 font-mono font-medium block mt-1">
                        {mediaInfo.durationFormatted}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                        <Activity className="w-3 h-3 text-emerald-400" /> Bitrate
                      </span>
                      <span className="text-slate-200 font-mono font-medium block mt-1">
                        {mediaInfo.bitRateKbps > 0 ? `${mediaInfo.bitRateKbps} kbps` : 'Variable'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-amber-400" /> Cover Art
                      </span>
                      <span className={`font-mono font-medium block mt-1 ${mediaInfo.hasCoverArt ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {mediaInfo.hasCoverArt ? 'Embedded' : 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Video Stream Card (if present) */}
                  {mediaInfo.video && (
                    <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/90 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
                        <div className="flex items-center space-x-2 text-sky-400">
                          <Film className="w-4 h-4" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                            Video Stream
                          </h4>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                          {mediaInfo.video.codec.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                        <div>
                          <span className="text-slate-500 text-[10px] block">Resolution</span>
                          <span className="text-slate-200 font-medium">
                            {mediaInfo.video.resolution} ({mediaInfo.video.aspectRatio})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">Framerate</span>
                          <span className="text-slate-200 font-medium">
                            {mediaInfo.video.fps > 0 ? `${mediaInfo.video.fps} fps` : 'Variable'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">Color Profile</span>
                          <span className="text-slate-200 font-medium">
                            {mediaInfo.video.pixelFormat || 'Standard'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">Codec Details</span>
                          <span className="text-slate-300 text-[11px] truncate block" title={mediaInfo.video.codecLong}>
                            {mediaInfo.video.codecLong || mediaInfo.video.codec}
                          </span>
                        </div>
                        {mediaInfo.video.bitRateKbps && (
                          <div>
                            <span className="text-slate-500 text-[10px] block">Video Bitrate</span>
                            <span className="text-slate-200 font-medium">
                              {mediaInfo.video.bitRateKbps} kbps
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Audio Stream Card (if present) */}
                  {mediaInfo.audio && (
                    <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/90 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
                        <div className="flex items-center space-x-2 text-emerald-400">
                          <Music className="w-4 h-4" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                            Audio Stream
                          </h4>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          {mediaInfo.audio.codec.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                        <div>
                          <span className="text-slate-500 text-[10px] block">Sample Rate</span>
                          <span className="text-slate-200 font-medium">
                            {mediaInfo.audio.sampleRate.toLocaleString()} Hz ({(mediaInfo.audio.sampleRate / 1000).toFixed(1)} kHz)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">Channels</span>
                          <span className="text-slate-200 font-medium">
                            {mediaInfo.audio.channelLayout} ({mediaInfo.audio.channels} ch)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">Audio Bitrate</span>
                          <span className="text-slate-200 font-medium">
                            {mediaInfo.audio.bitRateKbps ? `${mediaInfo.audio.bitRateKbps} kbps` : 'Auto / VBR'}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 text-[10px] block">Codec Spec</span>
                          <span className="text-slate-300 text-[11px] truncate block" title={mediaInfo.audio.codecLong}>
                            {mediaInfo.audio.codecLong || mediaInfo.audio.codec}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Chapters Info */}
                  {mediaInfo.chapterCount > 0 && (
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <span>Embedded Chapter Markers</span>
                      </div>
                      <span className="font-mono text-purple-300 font-medium">
                        {mediaInfo.chapterCount} chapters
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: METADATA & TAGS */}
              {activeTab === 'metadata' && (
                <div className="space-y-4">
                  {Object.keys(mediaInfo.tags || {}).length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      No embedded ID3/Vorbis comment metadata tags found in this file.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Embedded Media Tags
                      </h4>
                      <div className="bg-slate-950/60 rounded-xl border border-slate-800 divide-y divide-slate-850 overflow-hidden font-mono text-xs">
                        {Object.entries(mediaInfo.tags).map(([key, value]) => (
                          <div key={key} className="flex items-start px-3.5 py-2.5 hover:bg-slate-900/50 transition">
                            <span className="w-1/3 text-slate-400 font-medium truncate uppercase text-[11px]" title={key}>
                              {key}
                            </span>
                            <span className="w-2/3 text-slate-200 break-words text-[11px]">
                              {String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Album Cover Art Status */}
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-slate-300">
                      <ImageIcon className="w-4 h-4 text-amber-400" />
                      <span>Square Album Artwork:</span>
                    </div>
                    <span className={`font-mono font-medium ${mediaInfo.hasCoverArt ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {mediaInfo.hasCoverArt ? 'Embedded (Attached Picture)' : 'None Embedded'}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 3: RAW JSON */}
              {activeTab === 'raw' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">
                      Raw ffprobe inspection output
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-80 leading-relaxed">
                    {JSON.stringify(mediaInfo, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono truncate max-w-sm" title={mediaInfo?.filepath || ''}>
            {mediaInfo?.filepath || ''}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
