import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  ListMusic, 
  Video, 
  Music, 
  Sparkles, 
  Layers, 
  ShieldAlert, 
  FileText, 
  Settings2, 
  Subtitles, 
  Check, 
  Crop, 
  Tag, 
  AlertCircle,
  Clock,
  Play,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sliders,
  ExternalLink,
  Clipboard,
  FolderDown
} from 'lucide-react';
import { 
  MediaType, 
  ExtractedMedia, 
  TaskOptions, 
  PlaylistEntry,
  SponsorBlockAction
} from '../types';
import { SPONSORBLOCK_CATEGORIES } from '../constants/sponsorblock';
import { SettingsTab } from './SettingsModal';

interface BatchDownloaderProps {
  onQueueTasks: (items: any[], globalOptions: TaskOptions) => Promise<void>;
  onOpenAlbumArtModal: (url: string, title?: string, artist?: string) => void;
  onOpenSettings?: (tab?: SettingsTab) => void;
  options: TaskOptions;
  setOptions: React.Dispatch<React.SetStateAction<TaskOptions>>;
  downloadDir?: string;
}

const NAMING_PRESETS = [
  { label: 'Standard: Title [ID]', value: '%(title)s [%(id)s].%(ext)s' },
  { label: 'Music: Artist - Title', value: '%(artist,uploader)s - %(title)s.%(ext)s' },
  { label: 'Clean: Title only', value: '%(title)s.%(ext)s' },
  { label: 'Album Index: Track. Title', value: '%(playlist_index)02d - %(title)s.%(ext)s' },
  { label: 'Uploader / Date - Title', value: '%(uploader)s/%(upload_date)s - %(title)s.%(ext)s' },
];

const TEMPLATE_CHIPS = [
  '%(title)s',
  '%(artist)s',
  '%(uploader)s',
  '%(id)s',
  '%(playlist_index)02d',
  '%(resolution)s',
  '%(upload_date)s',
  '%(ext)s'
];

const formatUploadDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  // YYYYMMDD -> YYYY/MM/DD
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}/${trimmed.slice(4, 6)}/${trimmed.slice(6, 8)}`;
  }
  // YYYY-MM-DD -> YYYY/MM/DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed.replace(/-/g, '/');
  }
  return trimmed;
};

export const BatchDownloader: React.FC<BatchDownloaderProps> = ({
  onQueueTasks,
  onOpenAlbumArtModal,
  onOpenSettings,
  options,
  setOptions,
  downloadDir,
}) => {
  // Input mode: Single or Multi-line Batch
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [singleUrl, setSingleUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');

  // Clipboard paste handler
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const trimmed = text.trim();
        setSingleUrl(trimmed);
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          handleExtract(trimmed);
        }
      }
    } catch {
      // If clipboard read is disallowed or focus needed
      const el = document.getElementById('single-url-input');
      el?.focus();
    }
  };

  // Selected Media Type & Format
  const [mediaType, setMediaType] = useState<MediaType>(options.defaultMediaType || 'video');
  const [videoQuality, setVideoQuality] = useState(options.defaultVideoQuality || 'best');
  const [audioFormat, setAudioFormat] = useState(options.defaultAudioFormat || 'mp3_320');

  // Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedMedia, setExtractedMedia] = useState<ExtractedMedia | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const lastExtractedUrlRef = useRef<string>('');

  // Metadata editor toggle
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [customMetadata, setCustomMetadata] = useState({
    title: '',
    artist: '',
    album: '',
    year: '',
    genre: 'Soundtrack',
    track: '01'
  });

  // Advanced options accordion
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-fetch qualities, codecs from URL by default
  const handleExtract = async (urlToTest?: string) => {
    const target = urlToTest || singleUrl.trim();
    if (!target) return;
    if (lastExtractedUrlRef.current === target && extractedMedia) return;

    setIsExtracting(true);
    setExtractError(null);

    try {
      const res = await fetch('/api/extract-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target })
      });
      const data = await res.json();

      if (data.error) {
        setExtractError(data.error);
      } else {
        setExtractedMedia(data);
        lastExtractedUrlRef.current = target;
        // Pre-fill metadata
        setCustomMetadata({
          title: data.title || '',
          artist: data.uploader || 'Unknown Artist',
          album: data.isPlaylist ? data.title : 'Single Release',
          year: data.upload_date ? data.upload_date.slice(0, 4) : new Date().getFullYear().toString(),
          genre: 'Digital Media',
          track: '01'
        });
      }
    } catch (err: any) {
      setExtractError('Network or extraction issue. Check target link.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Automatically fetch qualities/codecs when user pastes or types a valid URL
  useEffect(() => {
    const trimmed = singleUrl.trim();
    if (!trimmed || isBatchMode || isExtracting) return;
    if ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && trimmed.length >= 15) {
      if (trimmed !== lastExtractedUrlRef.current) {
        const timer = setTimeout(() => {
          handleExtract(trimmed);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [singleUrl, isBatchMode]);

  // Immediate fetch on paste
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (pasted.startsWith('http://') || pasted.startsWith('https://')) {
      setSingleUrl(pasted);
      handleExtract(pasted);
    }
  };

  // Quick Demo Links for user testing
  const loadDemo = (type: 'video' | 'music' | 'playlist') => {
    if (type === 'video') {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      setSingleUrl(url);
      setMediaType('video');
      handleExtract(url);
    } else if (type === 'music') {
      const url = 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ';
      setSingleUrl(url);
      setMediaType('audio');
      setOptions(prev => ({ ...prev, audioCropThumbnailSquare: true, embedMetadata: true }));
      handleExtract(url);
    } else if (type === 'playlist') {
      const url = 'https://www.youtube.com/playlist?list=PLrEnWoR732-DES01qB5B_y07m_y96pE2j';
      setSingleUrl(url);
      setMediaType('video');
      handleExtract(url);
    }
  };

  // Toggle playlist entry selection
  const togglePlaylistEntry = (index: number) => {
    if (!extractedMedia || !extractedMedia.entries) return;
    const updated = [...extractedMedia.entries];
    updated[index].selected = !updated[index].selected;
    setExtractedMedia({ ...extractedMedia, entries: updated });
  };

  const selectAllPlaylistEntries = (select: boolean) => {
    if (!extractedMedia || !extractedMedia.entries) return;
    const updated = extractedMedia.entries.map(e => ({ ...e, selected: select }));
    setExtractedMedia({ ...extractedMedia, entries: updated });
  };

  // Add tag to template
  const insertTemplateTag = (tag: string) => {
    setOptions(prev => ({
      ...prev,
      namingTemplate: (prev.namingTemplate || '') + tag
    }));
  };

  // Start Download Action
  const handleStartDownload = async () => {
    const itemsToQueue: any[] = [];

    // If multi-line batch
    if (isBatchMode) {
      const lines = batchUrls
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('http://') || l.startsWith('https://'));

      if (lines.length === 0) return;

      for (const link of lines) {
        itemsToQueue.push({
          url: link,
          title: link,
          type: mediaType,
          format: mediaType === 'video' ? videoQuality : audioFormat,
          namingTemplate: options.namingTemplate,
          subtitles: options.subtitles,
          sponsorblock: options.sponsorblock,
          audioCropThumbnailSquare: options.audioCropThumbnailSquare,
          embedMetadata: options.embedMetadata,
        });
      }
    } 
    // If playlist extracted and items selected
    else if (extractedMedia?.isPlaylist && extractedMedia.entries) {
      const selectedEntries = extractedMedia.entries.filter(e => e.selected);
      for (const entry of selectedEntries) {
        itemsToQueue.push({
          url: entry.url,
          title: entry.title,
          uploader: entry.uploader,
          thumbnail: entry.thumbnail,
          duration: entry.duration_string,
          type: mediaType,
          format: mediaType === 'video' ? videoQuality : audioFormat,
          namingTemplate: options.namingTemplate,
          subtitles: options.subtitles,
          sponsorblock: options.sponsorblock,
          audioCropThumbnailSquare: options.audioCropThumbnailSquare,
          embedMetadata: options.embedMetadata,
          customMetadata: showMetadataEditor ? customMetadata : undefined
        });
      }
    } 
    // Single item
    else {
      const targetUrl = singleUrl.trim();
      if (!targetUrl) return;

      itemsToQueue.push({
        url: targetUrl,
        title: extractedMedia?.title || targetUrl,
        uploader: extractedMedia?.uploader || 'Unknown',
        thumbnail: extractedMedia?.thumbnail || '',
        duration: extractedMedia?.duration_string || '',
        type: mediaType,
        format: mediaType === 'video' ? videoQuality : audioFormat,
        namingTemplate: options.namingTemplate,
        subtitles: options.subtitles,
        sponsorblock: options.sponsorblock,
        audioCropThumbnailSquare: options.audioCropThumbnailSquare,
        embedMetadata: options.embedMetadata,
        customMetadata: showMetadataEditor ? customMetadata : undefined
      });
    }

    if (itemsToQueue.length > 0) {
      await onQueueTasks(itemsToQueue, options);
      // Reset input if successful
      if (!isBatchMode) {
        setSingleUrl('');
        setExtractedMedia(null);
      } else {
        setBatchUrls('');
      }
    }
  };

  // Compute live filename preview
  const getComputedFilenamePreview = () => {
    const tmpl = options.namingTemplate || '%(title)s [%(id)s].%(ext)s';
    const ext = mediaType === 'video' ? 'mp4' : (audioFormat.startsWith('mp3') ? 'mp3' : audioFormat);
    const title = extractedMedia?.title || customMetadata.title || 'Rick Astley - Never Gonna Give You Up';
    const artist = extractedMedia?.uploader || customMetadata.artist || 'Rick Astley';
    const id = extractedMedia?.id || 'dQw4w9WgXcQ';
    const track = customMetadata.track || '01';

    return tmpl
      .replace(/%\(title\)s/g, title.replace(/[\\/:*?"<>|]/g, ''))
      .replace(/%\(artist,uploader\)s/g, artist)
      .replace(/%\(artist\)s/g, artist)
      .replace(/%\(uploader\)s/g, artist)
      .replace(/%\(id\)s/g, id)
      .replace(/%\(playlist_index\)02d/g, track)
      .replace(/%\(upload_date\)s/g, '20260819')
      .replace(/%\(resolution\)s/g, videoQuality === 'best' ? '1080p' : videoQuality)
      .replace(/%\(ext\)s/g, ext);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">
      {/* Top Banner / Mode Picker */}
      <div className="bg-[#121620] border border-[#232a3b] rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Input Mode:
            </span>
            <div className="flex bg-[#181d29] p-0.5 rounded-lg border border-slate-700/60">
              <button
                type="button"
                onClick={() => setIsBatchMode(false)}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  !isBatchMode ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Single Link / Playlist Extractor
              </button>
              <button
                type="button"
                onClick={() => setIsBatchMode(true)}
                className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                  isBatchMode ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Batch Multi-URL Queue</span>
              </button>
            </div>
          </div>

          {/* Quick Demo Pre-fill links */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-500 text-[11px]">Quick Samples:</span>
            <button
              onClick={() => loadDemo('video')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] transition"
            >
              Demo Video
            </button>
            <button
              onClick={() => loadDemo('music')}
              className="px-2 py-0.5 rounded bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 text-[11px] transition flex items-center gap-1"
            >
              <Crop className="w-2.5 h-2.5" /> Demo Music (1:1 Art)
            </button>
            <button
              onClick={() => loadDemo('playlist')}
              className="px-2 py-0.5 rounded bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/50 text-[11px] transition"
            >
              Demo Playlist
            </button>
          </div>
        </div>

        {/* Input Field Section */}
        {!isBatchMode ? (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  id="single-url-input"
                  type="text"
                  value={singleUrl}
                  onChange={e => setSingleUrl(e.target.value)}
                  onPaste={handleUrlPaste}
                  onKeyDown={e => e.key === 'Enter' && handleExtract()}
                  placeholder="Paste video or playlist link (e.g. YouTube, Twitch, Vimeo, SoundCloud)..."
                  className="w-full bg-[#181d29] border border-slate-700/80 rounded-lg pl-3.5 pr-16 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono transition"
                />
                
                <div className="absolute right-2 top-2 flex items-center space-x-1">
                  {singleUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSingleUrl('');
                        setExtractedMedia(null);
                      }}
                      className="text-slate-500 hover:text-slate-300 px-1.5 py-0.5 text-xs rounded hover:bg-slate-800"
                      title="Clear input"
                    >
                      ✕
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-sans flex items-center gap-1 transition"
                      title="Paste from clipboard"
                    >
                      <Clipboard className="w-3 h-3 text-sky-400" />
                      <span>Paste</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleExtract()}
                disabled={isExtracting || !singleUrl.trim()}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#252c3d] hover:bg-[#30394e] text-sky-400 border border-sky-500/30 transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
                <span>{isExtracting ? 'Extracting...' : 'Analyze Link'}</span>
              </button>
            </div>

            {/* Destination directory indicator */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                <FolderDown className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-slate-500 font-sans">Save to:</span>
                <span className="text-slate-300 truncate max-w-[280px]">
                  {downloadDir || '%USERPROFILE%\\Downloads'}
                </span>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => onOpenSettings('download')}
                    className="text-sky-400 hover:text-sky-300 font-sans underline cursor-pointer ml-0.5"
                  >
                    Change
                  </button>
                )}
              </div>
              <span className="text-slate-500 text-[10px]">
                Supported: YouTube, SoundCloud, Twitch, Vimeo & 1000+ sites
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <textarea
              rows={4}
              value={batchUrls}
              onChange={e => setBatchUrls(e.target.value)}
              placeholder="Enter multiple links (one URL per line)...&#10;https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/playlist?list=..."
              className="w-full bg-[#181d29] border border-slate-700/80 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono resize-y"
            />
            <div className="flex justify-between text-[11px] text-slate-400 px-1">
              <span>
                {batchUrls.split('\n').filter(l => l.trim().startsWith('http')).length} URLs ready to queue
              </span>
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                <FolderDown className="w-3 h-3 text-sky-400" />
                <span className="truncate max-w-[200px]">{downloadDir || '%USERPROFILE%\\Downloads'}</span>
              </div>
            </div>
          </div>
        )}

        {extractError && (
          <div className="mt-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-800/40 p-2 rounded flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{extractError}</span>
          </div>
        )}
      </div>

      {/* Extracted Media Preview Box (If Single URL Analyzed) */}
      {extractedMedia && !isBatchMode && (
        <div className="bg-[#121620] border border-[#232a3b] rounded-xl p-4 shadow-sm animate-in fade-in duration-150 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3.5">
              {/* Thumbnail Container */}
              <div className="relative w-36 h-20 rounded-md overflow-hidden bg-black/80 shrink-0 border border-slate-700/50">
                {extractedMedia.thumbnail ? (
                  <img
                    src={extractedMedia.thumbnail}
                    alt={extractedMedia.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Video className="w-6 h-6" />
                  </div>
                )}

                {extractedMedia.duration_string && (
                  <span className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-200">
                    {extractedMedia.duration_string}
                  </span>
                )}

                {extractedMedia.isPlaylist && (
                  <span className="absolute top-1 left-1 bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase">
                    Playlist
                  </span>
                )}
              </div>

              {/* Title & Info */}
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white line-clamp-2">
                  {extractedMedia.title}
                </h4>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="text-slate-300 font-medium">{extractedMedia.uploader}</span>
                  {extractedMedia.upload_date && (
                    <>
                      <span>•</span>
                      <span>Uploaded {formatUploadDate(extractedMedia.upload_date)}</span>
                    </>
                  )}
                  {extractedMedia.isPlaylist && (
                    <>
                      <span>•</span>
                      <span className="text-amber-400 font-semibold">
                        {extractedMedia.entriesCount || extractedMedia.entries?.length || 0} Tracks Total
                      </span>
                    </>
                  )}
                </div>

                {/* Subtitle & Tag badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {extractedMedia.subtitles && extractedMedia.subtitles.length > 0 && (
                    <span className="text-[10px] bg-sky-950/60 text-sky-400 border border-sky-800/50 px-2 py-0.5 rounded flex items-center gap-1">
                      <Subtitles className="w-2.5 h-2.5" />
                      {extractedMedia.subtitles.length} Subtitles Available
                    </span>
                  )}
                  {extractedMedia.tags && extractedMedia.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="text-[10px] bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions (e.g. 1:1 Album Art Preview modal button) */}
            <div className="flex flex-col items-end space-y-1.5 shrink-0">
              {mediaType === 'audio' && (
                <button
                  type="button"
                  onClick={() => onOpenAlbumArtModal(
                    extractedMedia.thumbnail || '', 
                    extractedMedia.title, 
                    extractedMedia.uploader
                  )}
                  className="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50 transition flex items-center space-x-1"
                  title="Inspect 1:1 square cropped album art preview"
                >
                  <Crop className="w-3.5 h-3.5 text-rose-400" />
                  <span>Inspect 1:1 Album Art</span>
                </button>
              )}

              {/* Toggle Audio Metadata Tag Editor */}
              <button
                type="button"
                onClick={() => setShowMetadataEditor(!showMetadataEditor)}
                className="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[#1e2433] hover:bg-[#283145] text-slate-300 border border-slate-700 transition flex items-center space-x-1"
              >
                <Tag className="w-3.5 h-3.5 text-sky-400" />
                <span>{showMetadataEditor ? 'Hide Tags' : 'Edit Audio Tags'}</span>
              </button>
            </div>
          </div>

          {/* Audio Metadata Tags Editor Drawer */}
          {showMetadataEditor && (
            <div className="p-3 bg-[#171d2b] rounded-lg border border-[#273248] space-y-2.5 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Audio File Metadata Mapping (ID3v2 Tags)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">--embed-metadata active</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 mb-0.5 block">Title</label>
                  <input
                    type="text"
                    value={customMetadata.title}
                    onChange={e => setCustomMetadata({ ...customMetadata, title: e.target.value })}
                    className="w-full bg-[#10141d] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 mb-0.5 block">Artist / Uploader</label>
                  <input
                    type="text"
                    value={customMetadata.artist}
                    onChange={e => setCustomMetadata({ ...customMetadata, artist: e.target.value })}
                    className="w-full bg-[#10141d] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 mb-0.5 block">Album</label>
                  <input
                    type="text"
                    value={customMetadata.album}
                    onChange={e => setCustomMetadata({ ...customMetadata, album: e.target.value })}
                    className="w-full bg-[#10141d] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 mb-0.5 block">Release Year</label>
                  <input
                    type="text"
                    value={customMetadata.year}
                    onChange={e => setCustomMetadata({ ...customMetadata, year: e.target.value })}
                    className="w-full bg-[#10141d] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 mb-0.5 block">Genre</label>
                  <input
                    type="text"
                    value={customMetadata.genre}
                    onChange={e => setCustomMetadata({ ...customMetadata, genre: e.target.value })}
                    className="w-full bg-[#10141d] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 mb-0.5 block">Track #</label>
                  <input
                    type="text"
                    value={customMetadata.track}
                    onChange={e => setCustomMetadata({ ...customMetadata, track: e.target.value })}
                    className="w-full bg-[#10141d] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Playlist Extraction Table (if playlist) */}
          {extractedMedia.isPlaylist && extractedMedia.entries && (
            <div className="mt-3 border-t border-slate-800 pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ListMusic className="w-3.5 h-3.5 text-amber-400" />
                  Playlist Tracks Selection ({extractedMedia.entries.filter(e => e.selected).length} of {extractedMedia.entries.length} selected)
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => selectAllPlaylistEntries(true)}
                    className="text-sky-400 hover:text-sky-300 text-[11px]"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => selectAllPlaylistEntries(false)}
                    className="text-slate-400 hover:text-slate-300 text-[11px]"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Scrollable track list */}
              <div className="max-h-56 overflow-y-auto space-y-1 bg-[#10141e] p-2 rounded-lg border border-slate-800 text-xs">
                {extractedMedia.entries.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    onClick={() => togglePlaylistEntry(idx)}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition ${
                      entry.selected ? 'bg-[#1b2230] text-white' : 'hover:bg-slate-800/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="text-slate-400">
                        {entry.selected ? (
                          <CheckSquare className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <span className="font-mono text-slate-500 w-5 text-right">{idx + 1}</span>
                      <span className="truncate font-medium">{entry.title}</span>
                    </div>

                    <div className="flex items-center space-x-3 text-[11px] text-slate-500 shrink-0 font-mono ml-2">
                      <span>{entry.uploader}</span>
                      <span>{entry.duration_string}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Primary Configuration Panel: Formats, Template, SponsorBlock, Subtitles */}
      <div className="bg-[#121620] border border-[#232a3b] rounded-xl p-5 shadow-sm space-y-5">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center justify-between">
          <span>Download & Extraction Settings</span>
          <span className="text-[11px] text-slate-500 font-normal">Fully custom Windows CLI parameters</span>
        </h3>

        {/* Media Type & Quality Picker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode Switcher */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Media Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-center space-x-2 ${
                  mediaType === 'video'
                    ? 'bg-sky-600/20 border-sky-500 text-sky-300 shadow-sm'
                    : 'bg-[#181d29] border-slate-700/70 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video (MP4 / MKV)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMediaType('audio');
                  setOptions(prev => ({ ...prev, audioCropThumbnailSquare: true, embedMetadata: true }));
                }}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-center space-x-2 ${
                  mediaType === 'audio'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-sm'
                    : 'bg-[#181d29] border-slate-700/70 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>Audio (MP3 / FLAC)</span>
              </button>
            </div>
          </div>

          {/* Quality / Codec Format */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                {mediaType === 'video' ? 'Resolution Quality & Codec' : 'Audio Codec & Bitrate'}
              </label>
              {isExtracting ? (
                <span className="text-[10px] text-sky-400 flex items-center gap-1 font-mono">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Fetching stream codecs...
                </span>
              ) : extractedMedia?.formats && extractedMedia.formats.length > 0 ? (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <Check className="w-2.5 h-2.5" /> Codecs fetched from URL
                </span>
              ) : null}
            </div>

            {mediaType === 'video' ? (
              <select
                value={videoQuality}
                onChange={e => setVideoQuality(e.target.value)}
                className="w-full bg-[#181d29] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <optgroup label="Standard Quality Presets">
                  <option value="best">Best Available (Auto Resolution + Highest Audio)</option>
                  <option value="4k">4K Ultra HD (2160p)</option>
                  <option value="1440p">2K QHD (1440p)</option>
                  <option value="1080p">Full HD (1080p 60fps)</option>
                  <option value="720p">HD (720p)</option>
                  <option value="480p">SD (480p - Low Data)</option>
                </optgroup>
                {extractedMedia?.formats && extractedMedia.formats.filter(f => f.vcodec && f.vcodec !== 'none').length > 0 && (
                  <optgroup label={`⚡ Streams Fetched from URL (${extractedMedia.formats.filter(f => f.vcodec && f.vcodec !== 'none').length} Available)`}>
                    {extractedMedia.formats.filter(f => f.vcodec && f.vcodec !== 'none').map(fmt => {
                      const sizeStr = fmt.filesize ? ` • ~${(fmt.filesize / 1024 / 1024).toFixed(1)} MB` : '';
                      const fpsStr = fmt.fps ? ` @ ${fmt.fps}fps` : '';
                      const codecStr = fmt.vcodec ? ` • Codec: ${fmt.vcodec}` : '';
                      return (
                        <option key={fmt.format_id} value={fmt.format_id}>
                          {fmt.resolution || 'Video'} ({fmt.ext?.toUpperCase() || 'MP4'}{fpsStr}{codecStr}{sizeStr}) [ID: {fmt.format_id}]
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            ) : (
              <select
                value={audioFormat}
                onChange={e => setAudioFormat(e.target.value)}
                className="w-full bg-[#181d29] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <optgroup label="High Fidelity Audio Presets">
                  <option value="mp3_320">MP3 — 320 kbps CBR (Studio Quality)</option>
                  <option value="mp3_256">MP3 — 256 kbps High Quality</option>
                  <option value="mp3_192">MP3 — 192 kbps Standard Quality</option>
                  <option value="flac">FLAC — Lossless Audio (Highest Fidelity)</option>
                  <option value="m4a">M4A (AAC — Apple Native)</option>
                  <option value="opus">OPUS (Modern High Efficiency)</option>
                  <option value="wav">WAV (Uncompressed PCM)</option>
                </optgroup>
                {extractedMedia?.formats && extractedMedia.formats.filter(f => f.acodec && f.acodec !== 'none').length > 0 && (
                  <optgroup label={`⚡ Direct Audio Streams from URL (${extractedMedia.formats.filter(f => f.acodec && f.acodec !== 'none').length} Available)`}>
                    {extractedMedia.formats.filter(f => f.acodec && f.acodec !== 'none').map(fmt => {
                      const sizeStr = fmt.filesize ? ` • ~${(fmt.filesize / 1024 / 1024).toFixed(1)} MB` : '';
                      const bitrateStr = fmt.tbr ? ` @ ${Math.round(fmt.tbr)}kbps` : '';
                      const codecStr = fmt.acodec ? ` • Codec: ${fmt.acodec}` : '';
                      return (
                        <option key={fmt.format_id} value={fmt.format_id}>
                          Audio ({fmt.ext?.toUpperCase() || 'M4A'}{bitrateStr}{codecStr}{sizeStr}) [ID: {fmt.format_id}]
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            )}
          </div>
        </div>

        {/* Music Album Art Cropping Feature (Highlighted as requested) */}
        {mediaType === 'audio' && (
          <div className="p-3.5 bg-[#171520] border border-rose-500/30 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.audioCropThumbnailSquare}
                  onChange={e => setOptions({ ...options, audioCropThumbnailSquare: e.target.checked })}
                  className="rounded bg-slate-800 border-rose-500 text-rose-500 focus:ring-0 w-4 h-4"
                />
                <span className="text-xs font-semibold text-rose-200 flex items-center gap-1.5">
                  <Crop className="w-3.5 h-3.5 text-rose-400" />
                  Auto-Crop Thumbnail to 1:1 Aspect Ratio Square
                </span>
              </label>

              {extractedMedia?.thumbnail && (
                <button
                  type="button"
                  onClick={() => onOpenAlbumArtModal(
                    extractedMedia.thumbnail || '', 
                    extractedMedia.title, 
                    extractedMedia.uploader
                  )}
                  className="text-[11px] text-rose-300 underline hover:text-white"
                >
                  Preview 1:1 Crop
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed pl-6">
              When downloading music without official album art, automatically crops the widescreen 16:9 thumbnail
              centered to a 1:1 square aspect ratio via FFmpeg post-processing filter. Ensures clean, professional cover art in Windows Media Player, iTunes, and Android.
            </p>
          </div>
        )}

        {/* Simplified File Selection Mode vs Advanced Template Builder */}
        {(options.simplifyFileSelection ?? true) ? (
          <div className="pt-2 border-t border-slate-800">
            <div className="p-3 bg-[#151923] border border-slate-800/80 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-200">
                      File Selection Mode
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950/80 border border-sky-600/30 text-sky-300">
                      Simplified
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 truncate block">
                    Template: {getComputedFilenamePreview()}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0 ml-2">
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => onOpenSettings('selection')}
                    className="text-[11px] text-sky-300 hover:text-sky-200 font-medium px-2.5 py-1 rounded bg-[#202738] hover:bg-[#283248] border border-sky-500/30 transition flex items-center space-x-1"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>File Selection Settings</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                Custom File Naming Template
              </label>

              {/* Presets dropdown */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-400">Presets:</span>
                <select
                  onChange={e => setOptions({ ...options, namingTemplate: e.target.value })}
                  className="bg-[#181d29] border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
                  defaultValue=""
                >
                  <option value="" disabled>Select a preset...</option>
                  {NAMING_PRESETS.map((p, idx) => (
                    <option key={idx} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <input
              type="text"
              value={options.namingTemplate}
              onChange={e => setOptions({ ...options, namingTemplate: e.target.value })}
              placeholder="%(title)s [%(id)s].%(ext)s"
              className="w-full bg-[#181d29] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            />

            {/* Clickable Template Tag Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-slate-500 mr-1">Insert Tag:</span>
              {TEMPLATE_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => insertTemplateTag(chip)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-mono border border-slate-700 transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Live Preview Box */}
            <div className="bg-[#0f121a] p-2.5 rounded border border-slate-800 flex items-center space-x-2 text-[11px]">
              <span className="text-slate-500 font-medium">Output Preview:</span>
              <span className="text-emerald-400 font-mono truncate">{getComputedFilenamePreview()}</span>
            </div>
          </div>
        )}

        {/* SponsorBlock & Subtitles Quick Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          {/* SponsorBlock with YTDLnis Segment Controls */}
          <div className="p-3 bg-[#151923] rounded-lg border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.sponsorblock.enabled}
                  onChange={e => setOptions({
                    ...options,
                    sponsorblock: { ...options.sponsorblock, enabled: e.target.checked }
                  })}
                  className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  SponsorBlock Skipping
                </span>
              </label>

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => onOpenSettings('sponsorblock')}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/40 px-2 py-0.5 rounded transition"
                  title="Configure segment actions (skip, mark chapters, or ignore)"
                >
                  <Settings2 className="w-3 h-3" />
                  <span>Select Segments</span>
                </button>
              )}
            </div>

            {/* Active Segments Summary & Quick Chips */}
            {options.sponsorblock.enabled && (
              <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Selected Segments:</span>
                  <span className="font-mono text-slate-400">
                    {Object.values(options.sponsorblock.categoryActions || {}).filter(a => a === 'remove').length} skip •{' '}
                    {Object.values(options.sponsorblock.categoryActions || {}).filter(a => a === 'mark').length} mark
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {SPONSORBLOCK_CATEGORIES.map(cat => {
                    const action = (options.sponsorblock.categoryActions || {})[cat.id] || 'off';
                    if (action === 'off') return null;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          // Quick cycle: remove -> mark -> off
                          const nextAction: SponsorBlockAction = 
                            action === 'remove' ? 'mark' : action === 'mark' ? 'off' : 'remove';
                          const updated = {
                            ...options.sponsorblock.categoryActions,
                            [cat.id]: nextAction,
                          };
                          setOptions(prev => ({
                            ...prev,
                            sponsorblock: {
                              ...prev.sponsorblock,
                              categoryActions: updated,
                              categories: Object.entries(updated).filter(([_, a]) => a === 'remove').map(([k]) => k),
                            }
                          }));
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border transition ${
                          action === 'remove'
                            ? 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/60'
                            : 'bg-sky-950/60 border-sky-500/40 text-sky-300 hover:bg-sky-900/60'
                        }`}
                        title={`Category: ${cat.name} (${action.toUpperCase()}) - Click to toggle action`}
                      >
                        <span 
                          className="w-1.5 h-1.5 rounded-full" 
                          style={{ backgroundColor: cat.color }} 
                        />
                        <span className="font-medium">{cat.name.split('/')[0].trim()}</span>
                        <span className="opacity-70 text-[9px] uppercase font-mono">
                          {action === 'remove' ? 'Cut' : 'Mark'}
                        </span>
                      </button>
                    );
                  })}

                  {/* If all are off */}
                  {Object.values(options.sponsorblock.categoryActions || {}).every(a => a === 'off') && (
                    <span className="text-[10px] text-slate-500 italic">
                      No segments active. Click "Select Segments" to configure.
                    </span>
                  )}
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Cuts annoying sponsorship pitches, self-promos, and intros directly from media using crowd-sourced timestamps.
            </p>
          </div>

          {/* Subtitles */}
          <div className="p-3 bg-[#151923] rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.subtitles.enabled}
                  onChange={e => setOptions({
                    ...options,
                    subtitles: { ...options.subtitles, enabled: e.target.checked }
                  })}
                  className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                  <Subtitles className="w-3.5 h-3.5 text-sky-400" />
                  Subtitle Downloading
                </span>
              </label>

              <div className="flex items-center space-x-2">
                {options.subtitles.enabled && options.subtitles.embed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 font-mono">
                    Embed ({options.subtitles.format?.toUpperCase() || 'SRT'})
                  </span>
                )}

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => onOpenSettings('subtitles')}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/40 px-2 py-0.5 rounded transition"
                    title="Configure subtitle embedding, formats, and auto-captions in Settings"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>Subtitles & Embedding</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-[11px] text-slate-400">Languages:</span>
              <input
                type="text"
                value={options.subtitles.langs}
                onChange={e => setOptions({
                  ...options,
                  subtitles: { ...options.subtitles, langs: e.target.value }
                })}
                placeholder="en.*,es,ja"
                className="bg-[#10131c] border border-slate-700 rounded px-2 py-0.5 text-xs text-white font-mono flex-1"
              />
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Settings */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-slate-200 transition py-1"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              SponsorBlock Categories & Metadata
            </span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3 bg-[#10141d] rounded-lg border border-slate-800 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium text-[11px] block mb-1.5">
                  SponsorBlock Categories to Remove:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'sponsor', label: 'Sponsor Segments' },
                    { id: 'intro', label: 'Intro / Intermission' },
                    { id: 'outro', label: 'Outro / Credits' },
                    { id: 'selfpromo', label: 'Self-promotion / Merch' },
                    { id: 'interaction', label: 'Subscribe Reminders' },
                    { id: 'music_offtopic', label: 'Music Off-topic' },
                  ].map(cat => {
                    const isChecked = options.sponsorblock.categories.includes(cat.id);
                    return (
                      <label key={cat.id} className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const newCats = e.target.checked
                              ? [...options.sponsorblock.categories, cat.id]
                              : options.sponsorblock.categories.filter(c => c !== cat.id);
                            setOptions({
                              ...options,
                              sponsorblock: { ...options.sponsorblock, categories: newCats }
                            });
                          }}
                          className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span className="text-[11px]">{cat.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center space-x-4 pt-2 border-t border-slate-800 text-[11px]">
                <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={options.embedMetadata}
                    onChange={e => setOptions({ ...options, embedMetadata: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Always embed metadata tags (--embed-metadata)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Master Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleStartDownload}
            disabled={!singleUrl.trim() && !batchUrls.trim() && !extractedMedia}
            className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>
              {isBatchMode
                ? `Start Batch Download Queue (${batchUrls.split('\n').filter(l => l.trim().startsWith('http')).length || 0} items)`
                : extractedMedia?.isPlaylist
                ? `Queue Playlist Tracks (${extractedMedia.entries?.filter(e => e.selected).length || 0} selected)`
                : `Download ${mediaType === 'audio' ? 'Audio Track' : 'Video'} Now`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
