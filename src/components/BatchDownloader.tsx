import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  FolderDown,
  Copy,
  Eye,
  VolumeX,
  Film,
  Info,
  Scissors,
  Bookmark,
  X
} from 'lucide-react';
import { 
  MediaType, 
  ExtractedMedia, 
  ExtractedFormat,
  TaskOptions, 
  PlaylistEntry,
  SponsorBlockAction
} from '../types';
import { SPONSORBLOCK_CATEGORIES } from '../constants/sponsorblock';
import { SettingsTab } from './SettingsModal';
import { api } from '../lib/apiBridge';

interface BatchDownloaderProps {
  onQueueTasks: (items: any[], globalOptions: TaskOptions) => Promise<void>;
  onOpenAlbumArtModal: (url: string, title?: string, artist?: string) => void;
  onOpenSettings?: (tab?: SettingsTab) => void;
  options: TaskOptions;
  setOptions: React.Dispatch<React.SetStateAction<TaskOptions>>;
  downloadDir?: string;
}

// Extension ranking preferences: MP4 and M4A top compatibility first, then WebM/Opus, then others
const VIDEO_EXT_ORDER: Record<string, number> = {
  mp4: 1,
  m4v: 2,
  mkv: 3,
  webm: 4,
  mov: 5,
  avi: 6,
  flv: 7,
  '3gp': 8,
};

const AUDIO_EXT_ORDER: Record<string, number> = {
  m4a: 1,
  aac: 2,
  mp3: 3,
  opus: 4,
  webm: 5,
  ogg: 6,
  oga: 7,
  flac: 8,
  wav: 9,
};

function getVideoExtRank(ext?: string): number {
  if (!ext) return 99;
  const clean = ext.toLowerCase().trim();
  return VIDEO_EXT_ORDER[clean] ?? 50;
}

function getAudioExtRank(ext?: string): number {
  if (!ext) return 99;
  const clean = ext.toLowerCase().trim();
  return AUDIO_EXT_ORDER[clean] ?? 50;
}

function parseHeight(fmt: ExtractedFormat): number {
  if (typeof fmt.height === 'number' && fmt.height > 0) {
    return fmt.height;
  }
  if (fmt.resolution) {
    const pMatch = fmt.resolution.match(/(\d{3,4})p/i);
    if (pMatch) return parseInt(pMatch[1], 10);
    const dimMatch = fmt.resolution.match(/\d+x(\d{3,4})/i);
    if (dimMatch) return parseInt(dimMatch[1], 10);
  }
  if (fmt.format_note) {
    const fnMatch = fmt.format_note.match(/(\d{3,4})p/i);
    if (fnMatch) return parseInt(fnMatch[1], 10);
  }
  return 0;
}

function parseAudioBitrate(fmt: ExtractedFormat): number {
  if (typeof fmt.tbr === 'number' && fmt.tbr > 0) {
    return fmt.tbr;
  }
  if (fmt.format_note) {
    const kMatch = fmt.format_note.match(/(\d+)\s*k/i);
    if (kMatch) return parseInt(kMatch[1], 10);
  }
  return 0;
}

// Sort video formats: Group same file types together, higher resolution/filesize on top
function sortVideoFormats(formats: ExtractedFormat[]): ExtractedFormat[] {
  return [...formats].sort((a, b) => {
    // 1. Group by file type / container (e.g. MP4 together, WEBM together)
    const extA = (a.ext || '').toLowerCase().trim();
    const extB = (b.ext || '').toLowerCase().trim();
    const rankA = getVideoExtRank(extA);
    const rankB = getVideoExtRank(extB);

    if (rankA !== rankB) {
      return rankA - rankB;
    }
    if (extA !== extB) {
      return extA.localeCompare(extB);
    }

    // 2. Higher resolution / height on top
    const hA = parseHeight(a);
    const hB = parseHeight(b);
    if (hB !== hA) {
      return hB - hA;
    }

    // 3. Higher framerate (fps) on top (60fps > 30fps)
    const fpsA = a.fps || 0;
    const fpsB = b.fps || 0;
    if (fpsB !== fpsA) {
      return fpsB - fpsA;
    }

    // 4. Higher filesize on top
    const sizeA = a.filesize || 0;
    const sizeB = b.filesize || 0;
    if (sizeB !== sizeA) {
      return sizeB - sizeA;
    }

    // 5. Higher bitrate on top
    const tbrA = a.tbr || 0;
    const tbrB = b.tbr || 0;
    if (tbrB !== tbrA) {
      return tbrB - tbrA;
    }

    return 0;
  });
}

// Sort audio formats: Group same file types together, higher bitrate/filesize on top
function sortAudioFormats(formats: ExtractedFormat[]): ExtractedFormat[] {
  return [...formats].sort((a, b) => {
    // 1. Group by file type / container (e.g. M4A together, WEBM together)
    const extA = (a.ext || '').toLowerCase().trim();
    const extB = (b.ext || '').toLowerCase().trim();
    const rankA = getAudioExtRank(extA);
    const rankB = getAudioExtRank(extB);

    if (rankA !== rankB) {
      return rankA - rankB;
    }
    if (extA !== extB) {
      return extA.localeCompare(extB);
    }

    // 2. Higher bitrate (tbr / abr) on top
    const brA = parseAudioBitrate(a);
    const brB = parseAudioBitrate(b);
    if (brB !== brA) {
      return brB - brA;
    }

    // 3. Higher filesize on top
    const sizeA = a.filesize || 0;
    const sizeB = b.filesize || 0;
    if (sizeB !== sizeA) {
      return sizeB - sizeA;
    }

    return 0;
  });
}

interface FormatExtGroup {
  ext: string;
  formats: ExtractedFormat[];
}

// Group already-sorted formats into contiguous blocks by extension
function groupFormatsByExt(formats: ExtractedFormat[]): FormatExtGroup[] {
  const groups: FormatExtGroup[] = [];
  const map = new Map<string, ExtractedFormat[]>();
  for (const fmt of formats) {
    const ext = (fmt.ext || 'other').toUpperCase().trim();
    if (!map.has(ext)) {
      const arr: ExtractedFormat[] = [];
      map.set(ext, arr);
      groups.push({ ext, formats: arr });
    }
    map.get(ext)!.push(fmt);
  }
  return groups;
}

const NAMING_PRESETS = [
  { label: 'Default: Title - Artist', value: '%(title)s - %(artist,uploader)s.%(ext)s' },
  { label: 'Music: Artist - Title', value: '%(artist,uploader)s - %(title)s.%(ext)s' },
  { label: 'Clean: Title only', value: '%(title)s.%(ext)s' },
  { label: 'Standard: Title [ID]', value: '%(title)s [%(id)s].%(ext)s' },
  { label: 'Album Index: Track - Title', value: '%(playlist_index)02d - %(title)s.%(ext)s' },
  { label: 'Uploader / Date - Title', value: '%(uploader)s/%(upload_date)s - %(title)s.%(ext)s' },
];

const TEMPLATE_CHIPS = [
  '%(title)s',
  '%(artist,uploader)s',
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

// URL sanitizer to prevent duplicated URLs from double-paste or concatenated links
export function sanitizeUrl(input: string): string {
  if (!input) return '';
  let str = input.trim();
  // Strip enclosing quotes or brackets
  str = str.replace(/^["'<\(]+|["'>\)]+$/g, '');

  // Detect if URL was pasted twice or multiple links present
  const matches = str.match(/https?:\/\/[^\s"'<>]+/gi);
  if (matches && matches.length > 0) {
    let first = matches[0];
    // In case two URLs were glued together without space: e.g. https://xyz.com/watch?v=123https://xyz.com/watch?v=123
    const secondHttp = first.slice(4).search(/https?:\/\//i);
    if (secondHttp !== -1) {
      first = first.substring(0, secondHttp + 4);
    }
    return first.trim();
  }
  return str;
}

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
        if (isBatchMode) {
          setBatchUrls(prev => (prev ? `${prev.trim()}\n${text.trim()}` : text.trim()));
        } else {
          const cleaned = sanitizeUrl(text);
          setSingleUrl(cleaned);
          if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
            handleExtract(cleaned);
          }
        }
      }
    } catch {
      // If clipboard read is disallowed or focus needed
      const el = document.getElementById(isBatchMode ? 'batch-urls-input' : 'single-url-input');
      el?.focus();
    }
  };

  // Selected Media Type & Format
  const [mediaType, setMediaType] = useState<MediaType>(options.defaultMediaType || 'video');
  const [videoQuality, setVideoQuality] = useState(options.defaultVideoQuality || 'best');
  const [audioFormat, setAudioFormat] = useState(options.defaultAudioFormat || 'm4a');
  const [videoStreamFilter, setVideoStreamFilter] = useState<'all' | 'normal' | 'video_only'>('all');
  const [mergeAudioForVideoOnly, setMergeAudioForVideoOnly] = useState<boolean>(true);

  // Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedMedia, setExtractedMedia] = useState<ExtractedMedia | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractFullError, setExtractFullError] = useState<string | null>(null);
  const [showExtractErrorModal, setShowExtractErrorModal] = useState(false);
  const [copiedExtractError, setCopiedExtractError] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const lastExtractedUrlRef = useRef<string>('');
  const extractAbortRef = useRef<AbortController | null>(null);

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
    const rawTarget = urlToTest !== undefined ? urlToTest : singleUrl;
    const target = sanitizeUrl(rawTarget);
    if (!target) return;
    if (lastExtractedUrlRef.current === target && extractedMedia) return;

    // Abort previous extraction request if still pending
    if (extractAbortRef.current) {
      extractAbortRef.current.abort();
    }
    const controller = new AbortController();
    extractAbortRef.current = controller;

    setIsExtracting(true);
    setExtractError(null);
    setExtractFullError(null);

    try {
      const data = await api.extractInfo(target, options.auth, controller.signal);

      if (data.error) {
        setExtractError(data.error);
        setExtractFullError(data.fullError || data.error);
      } else {
        setExtractError(null);
        setExtractFullError(null);
        setExtractedMedia(data);
        lastExtractedUrlRef.current = target;
        // Pre-fill metadata
        const rawDate = data.release_date || data.upload_date;
        setCustomMetadata({
          title: data.title || '',
          artist: data.uploader || 'Unknown Artist',
          album: data.isPlaylist ? data.title : 'Single Release',
          year: rawDate ? rawDate.slice(0, 4) : new Date().getFullYear().toString(),
          genre: 'Digital Media',
          track: '01'
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      let fullMsg = err?.message ? `Extraction error: ${err.message}` : 'Network or extraction issue. Check target link.';
      if (fullMsg.includes('Unexpected token') || fullMsg.includes('<!doctype') || fullMsg.includes('not valid JSON')) {
        fullMsg = 'Extraction service is warming up. Please wait a few seconds and click Analyze Link again.';
      }
      setExtractError(fullMsg.split('\n')[0] || fullMsg);
      setExtractFullError(err?.stack || fullMsg);
    } finally {
      setIsExtracting(false);
    }
  };

  // Automatically fetch qualities/codecs when user pastes or types a valid URL
  useEffect(() => {
    const trimmed = singleUrl.trim();
    if (!trimmed || isBatchMode || isExtracting) return;
    const clean = sanitizeUrl(trimmed);
    if ((clean.startsWith('http://') || clean.startsWith('https://')) && clean.length >= 15) {
      if (clean !== lastExtractedUrlRef.current) {
        const timer = setTimeout(() => {
          handleExtract(clean);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [singleUrl, isBatchMode]);

  // Immediate fetch on paste: prevent duplicate insertion from native paste + state update
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const rawPasted = e.clipboardData.getData('text');
    if (!rawPasted) return;

    const cleaned = sanitizeUrl(rawPasted);
    setSingleUrl(cleaned);
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      handleExtract(cleaned);
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
      const url = 'https://music.youtube.com/watch?v=XMWIJCaYx1M&si=E-mrMd_eJhDTj7if';
      setSingleUrl(url);
      setMediaType('audio');
      setOptions(prev => ({ ...prev, audioCropThumbnailSquare: true, embedMetadata: true }));
      handleExtract(url);
    } else if (type === 'playlist') {
      const url = 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI';
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

    // Determine effective format (auto-merge best audio if video-only format is selected and merge is enabled)
    const selectedFormatObj = extractedMedia?.formats?.find(f => f.format_id === videoQuality);
    const isSelectedVideoOnly = selectedFormatObj ? (
      Boolean(selectedFormatObj.vcodec &&
      selectedFormatObj.vcodec !== 'none' &&
      (!selectedFormatObj.acodec || selectedFormatObj.acodec === 'none') &&
      !selectedFormatObj.isAudioOnly)
    ) : false;

    const effectiveVideoFormat = (isSelectedVideoOnly && mergeAudioForVideoOnly)
      ? `${videoQuality}+bestaudio/best`
      : videoQuality;

    const taskFormat = mediaType === 'video' ? effectiveVideoFormat : audioFormat;

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
          format: taskFormat,
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
          format: taskFormat,
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
        format: taskFormat,
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
    const tmpl = options.namingTemplate || '%(title)s - %(artist,uploader)s.%(ext)s';
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

  // Separate video formats into normal video (audio included) and video-only (no audio),
  // sorted so same file types (MP4, WEBM) are together with higher quality & file size on top
  const rawVideoFormats = useMemo(() => (extractedMedia?.formats || []).filter(
    f => f.vcodec && f.vcodec !== 'none' && !f.isAudioOnly
  ), [extractedMedia?.formats]);

  const allVideoFormats = useMemo(
    () => sortVideoFormats(rawVideoFormats),
    [rawVideoFormats]
  );

  const normalVideoFormats = useMemo(
    () => sortVideoFormats(rawVideoFormats.filter(f => f.acodec && f.acodec !== 'none')),
    [rawVideoFormats]
  );

  const videoOnlyFormats = useMemo(
    () => sortVideoFormats(rawVideoFormats.filter(f => !f.acodec || f.acodec === 'none')),
    [rawVideoFormats]
  );

  // Audio-only formats sorted with same file types (M4A, WEBM, MP3) together and higher quality/bitrate on top
  const audioOnlyFormats = useMemo(
    () => sortAudioFormats((extractedMedia?.formats || []).filter(
      f => f.acodec && f.acodec !== 'none' && (f.vcodec === 'none' || !f.vcodec || f.isAudioOnly)
    )),
    [extractedMedia?.formats]
  );

  // Check currently selected video format characteristics
  const currentSelectedFormatObj = extractedMedia?.formats?.find(f => f.format_id === videoQuality);
  const isCurrentFormatVideoOnly = currentSelectedFormatObj ? (
    Boolean(currentSelectedFormatObj.vcodec &&
    currentSelectedFormatObj.vcodec !== 'none' &&
    (!currentSelectedFormatObj.acodec || currentSelectedFormatObj.acodec === 'none') &&
    !currentSelectedFormatObj.isAudioOnly)
  ) : false;

  const isCurrentFormatNormalVideo = currentSelectedFormatObj ? (
    Boolean(currentSelectedFormatObj.vcodec &&
    currentSelectedFormatObj.vcodec !== 'none' &&
    currentSelectedFormatObj.acodec &&
    currentSelectedFormatObj.acodec !== 'none' &&
    !currentSelectedFormatObj.isAudioOnly)
  ) : false;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">
      {/* Top Banner / Mode Picker */}
      <div className="dark-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Input Mode
            </span>
            <div className="flex bg-[#0c1017] p-0.5 rounded-lg border border-[#1e2536]">
              <button
                type="button"
                onClick={() => setIsBatchMode(false)}
                className={`px-3 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                  !isBatchMode 
                    ? 'bg-[#222a3a] text-white font-medium shadow-xs' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Single Link / Playlist
              </button>
              <button
                type="button"
                onClick={() => setIsBatchMode(true)}
                className={`px-3 py-1 rounded-md text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isBatchMode 
                    ? 'bg-[#222a3a] text-white font-medium shadow-xs' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Batch Multi-URL Queue</span>
              </button>
            </div>
          </div>

          {/* Quick Demo Pre-fill links */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-500 text-[11px]">Samples:</span>
            <button
              onClick={() => loadDemo('video')}
              className="px-2.5 py-1 rounded bg-[#161c27] hover:bg-[#1f2636] text-slate-300 border border-[#242c3d] text-[11px] transition cursor-pointer"
            >
              Demo Video
            </button>
            <button
              onClick={() => loadDemo('music')}
              className="px-2.5 py-1 rounded bg-[#161c27] hover:bg-[#1f2636] text-slate-300 border border-[#242c3d] text-[11px] transition flex items-center gap-1 cursor-pointer"
            >
              <Crop className="w-2.5 h-2.5 text-slate-400" /> Demo Music (1:1 Art)
            </button>
            <button
              onClick={() => loadDemo('playlist')}
              className="px-2.5 py-1 rounded bg-[#161c27] hover:bg-[#1f2636] text-slate-300 border border-[#242c3d] text-[11px] transition cursor-pointer"
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
                  className="w-full bg-[#0c1017] border border-[#232b3d] focus:border-slate-500 rounded-lg pl-3 pr-16 py-2 text-xs text-white placeholder-slate-500 focus:outline-none font-mono transition-colors"
                />
                
                <div className="absolute right-2 top-1.5 flex items-center space-x-1">
                  {singleUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSingleUrl('');
                        setExtractedMedia(null);
                      }}
                      className="text-slate-400 hover:text-slate-200 px-1.5 py-0.5 text-xs rounded hover:bg-[#1b2230] cursor-pointer"
                      title="Clear input"
                    >
                      ✕
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="px-2 py-0.5 rounded bg-[#181d28] hover:bg-[#202736] text-slate-300 border border-[#242c3d] text-[11px] font-sans flex items-center gap-1 transition cursor-pointer"
                      title="Paste from clipboard"
                    >
                      <Clipboard className="w-3 h-3 text-slate-400" />
                      <span>Paste</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleExtract()}
                disabled={isExtracting || !singleUrl.trim()}
                className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#1e2536] hover:bg-[#273147] text-slate-200 border border-[#2b364d] transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shrink-0"
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
          <div className="mt-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/50 p-2.5 rounded-lg flex items-center justify-between gap-2 animate-in fade-in">
            <div 
              onClick={() => setShowExtractErrorModal(true)}
              className="flex items-center gap-2 overflow-hidden cursor-pointer hover:text-rose-200 group flex-1"
              title="Click to inspect full error message and diagnostic details"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 group-hover:scale-110 transition-transform" />
              <span className="truncate font-mono text-rose-200">{extractError}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowExtractErrorModal(true)}
                className="px-2 py-1 rounded bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 border border-rose-800/60 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                title="View full error message and details"
              >
                <Eye className="w-3 h-3 text-rose-300" />
                <span>Error Details</span>
              </button>
              <button
                type="button"
                onClick={() => handleExtract()}
                disabled={isExtracting}
                className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800/80 text-rose-100 border border-rose-700/60 text-[11px] font-medium transition disabled:opacity-50 cursor-pointer"
              >
                {isExtracting ? 'Retrying...' : 'Retry'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExtractError(null);
                  setExtractFullError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-200 text-xs rounded hover:bg-slate-800/60 cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Extracted Media Preview Box (If Single URL Analyzed) */}
      {extractedMedia && !isBatchMode && (
        <div className="dark-card p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3.5">
              {/* Thumbnail Container */}
              <div className="relative w-36 h-20 rounded-lg overflow-hidden bg-black/90 shrink-0 border border-[#232b3d]">
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
                  <span className="absolute top-1 left-1 bg-amber-600 text-white px-1.5 py-0.2 rounded text-[9px] font-bold uppercase">
                    Playlist
                  </span>
                )}
              </div>

              {/* Title & Info */}
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white line-clamp-2 leading-snug">
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
                      <span className="text-amber-400 font-medium">
                        {extractedMedia.entriesCount || extractedMedia.entries?.length || 0} Tracks Total
                      </span>
                    </>
                  )}
                </div>

                {/* Subtitle & Tag badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {extractedMedia.subtitles && extractedMedia.subtitles.length > 0 && (
                    <span className="text-[10px] bg-[#141b29] text-sky-300 border border-sky-800/40 px-2 py-0.5 rounded flex items-center gap-1">
                      <Subtitles className="w-2.5 h-2.5 text-sky-400" />
                      {extractedMedia.subtitles.length} Subtitles Available
                    </span>
                  )}
                  {extractedMedia.tags && extractedMedia.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="text-[10px] bg-[#161c28] text-slate-400 border border-[#232b3d] px-2 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col items-end space-y-1.5 shrink-0">
              {mediaType === 'audio' && (
                <button
                  type="button"
                  onClick={() => onOpenAlbumArtModal(
                    extractedMedia.thumbnail || '', 
                    extractedMedia.title, 
                    extractedMedia.uploader
                  )}
                  className="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[#161c28] hover:bg-[#1f2636] text-slate-300 border border-[#242c3d] transition flex items-center space-x-1.5 cursor-pointer"
                  title="Inspect 1:1 square cropped album art preview"
                >
                  <Crop className="w-3.5 h-3.5 text-slate-400" />
                  <span>1:1 Album Art</span>
                </button>
              )}

              {/* Toggle Audio Metadata Tag Editor */}
              <button
                type="button"
                onClick={() => setShowMetadataEditor(!showMetadataEditor)}
                className="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[#161c28] hover:bg-[#1f2636] text-slate-300 border border-[#242c3d] transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>{showMetadataEditor ? 'Hide Tags' : 'Edit Tags'}</span>
              </button>
            </div>
          </div>

          {/* YouTube Bot / Sign-In Notice Banner */}
          {extractedMedia.isBotGuard && (
            <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded-lg text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-300">YouTube Cloud Host Bot Verification Notice</div>
                  <div className="text-[11px] text-amber-300/80">
                    YouTube flagged this cloud container IP. Authentic video metadata was verified and retrieved. You can import browser cookies in Settings or copy the CLI command to download locally without restrictions.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => onOpenSettings('cookies')}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-[11px] transition cursor-pointer"
                  >
                    Anti-Bot Settings
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const targetUrl = singleUrl.trim() || (extractedMedia.id ? `https://www.youtube.com/watch?v=${extractedMedia.id}` : '');
                    const cmd = `yt-dlp --cookies-from-browser chrome "${targetUrl}"`;
                    navigator.clipboard.writeText(cmd);
                    setCopiedCli(true);
                    setTimeout(() => setCopiedCli(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-medium text-[11px] transition cursor-pointer flex items-center gap-1"
                >
                  {copiedCli ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{copiedCli ? 'Copied CLI Cmd!' : 'Copy Local CLI Cmd'}</span>
                </button>
              </div>
            </div>
          )}

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
      <div className="dark-card p-5 space-y-4">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>Download & Extraction Settings</span>
          </span>
          <span className="text-[11px] text-slate-500 font-normal">Windows yt-dlp parameters</span>
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
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-center space-x-2 cursor-pointer ${
                  mediaType === 'video'
                    ? 'bg-[#222a3a] border-slate-600 text-white shadow-xs'
                    : 'bg-[#131722] border-[#202737] text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-slate-300" />
                <span>Video (MP4 / MKV)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMediaType('audio');
                  setOptions(prev => ({ ...prev, audioCropThumbnailSquare: true, embedMetadata: true }));
                }}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-center space-x-2 cursor-pointer ${
                  mediaType === 'audio'
                    ? 'bg-[#222a3a] border-slate-600 text-white shadow-xs'
                    : 'bg-[#131722] border-[#202737] text-slate-400 hover:text-slate-200'
                }`}
              >
                <Music className="w-3.5 h-3.5 text-slate-300" />
                <span>Audio (MP3 / FLAC)</span>
              </button>
            </div>
          </div>

          {/* Quality / Codec Format */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-300">
                  {mediaType === 'video' ? 'Resolution Quality & Codec' : 'Audio Codec & Bitrate'}
                </label>
                {mediaType === 'video' && allVideoFormats.length > 0 && (
                  <div className="flex items-center bg-[#141824] p-0.5 rounded-md border border-slate-700/60 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setVideoStreamFilter('all')}
                      className={`px-2 py-0.5 rounded transition font-medium ${
                        videoStreamFilter === 'all'
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All ({allVideoFormats.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoStreamFilter('normal')}
                      className={`px-2 py-0.5 rounded transition font-medium flex items-center gap-1 ${
                        videoStreamFilter === 'normal'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-emerald-300'
                      }`}
                      title="Streams containing both video and audio tracks in a single container"
                    >
                      <Film className="w-2.5 h-2.5" />
                      Normal ({normalVideoFormats.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoStreamFilter('video_only')}
                      className={`px-2 py-0.5 rounded transition font-medium flex items-center gap-1 ${
                        videoStreamFilter === 'video_only'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-amber-300'
                      }`}
                      title="DASH video-only streams with no audio track"
                    >
                      <VolumeX className="w-2.5 h-2.5" />
                      Video Only ({videoOnlyFormats.length})
                    </button>
                  </div>
                )}
              </div>

              {isExtracting ? (
                <span className="text-[10px] text-sky-400 flex items-center gap-1 font-mono">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Fetching stream codecs...
                </span>
              ) : extractedMedia?.formats && extractedMedia.formats.length > 0 ? (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <Check className="w-2.5 h-2.5" /> {normalVideoFormats.length} Normal • {videoOnlyFormats.length} Video-Only
                </span>
              ) : null}
            </div>

            {mediaType === 'video' ? (
              <>
                <select
                  value={videoQuality}
                  onChange={e => setVideoQuality(e.target.value)}
                  className="w-full bg-[#181d29] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {videoStreamFilter !== 'video_only' && (
                    <optgroup label="Standard Quality Presets">
                      <option value="best">Best Available (Auto Resolution + Highest Audio)</option>
                      <option value="4k">4K Ultra HD (2160p)</option>
                      <option value="1440p">2K QHD (1440p)</option>
                      <option value="1080p">Full HD (1080p 60fps)</option>
                      <option value="720p">HD (720p)</option>
                      <option value="480p">SD (480p - Low Data)</option>
                    </optgroup>
                  )}

                  {videoStreamFilter !== 'video_only' && normalVideoFormats.length > 0 && (
                    groupFormatsByExt(normalVideoFormats).map(group => (
                      <optgroup
                        key={`normal-${group.ext}`}
                        label={`🎬 Normal Videos • ${group.ext} (${group.formats.length} Available — Sound Included)`}
                      >
                        {group.formats.map(fmt => {
                          const resDisplay = fmt.resolution?.toLowerCase().includes('p')
                            ? fmt.resolution
                            : (fmt.height ? `${fmt.height}p (${fmt.resolution || `${fmt.height}p`})` : (fmt.resolution || 'Video'));
                          const sizeStr = fmt.filesize ? ` • ~${(fmt.filesize / 1024 / 1024).toFixed(1)} MB` : '';
                          const fpsStr = fmt.fps ? ` @ ${fmt.fps}fps` : '';
                          const vcodecStr = fmt.vcodec ? ` • ${fmt.vcodec}` : '';
                          const acodecStr = fmt.acodec && fmt.acodec !== 'none' ? ` + ${fmt.acodec}` : ' + Audio';
                          return (
                            <option key={fmt.format_id} value={fmt.format_id}>
                              {resDisplay} ({group.ext}{fpsStr}{vcodecStr}{acodecStr}{sizeStr}) [ID: {fmt.format_id}]
                            </option>
                          );
                        })}
                      </optgroup>
                    ))
                  )}

                  {videoStreamFilter !== 'normal' && videoOnlyFormats.length > 0 && (
                    groupFormatsByExt(videoOnlyFormats).map(group => (
                      <optgroup
                        key={`videoonly-${group.ext}`}
                        label={`🔇 Video Only • ${group.ext} (${group.formats.length} Available — No Audio)`}
                      >
                        {group.formats.map(fmt => {
                          const resDisplay = fmt.resolution?.toLowerCase().includes('p')
                            ? fmt.resolution
                            : (fmt.height ? `${fmt.height}p (${fmt.resolution || `${fmt.height}p`})` : (fmt.resolution || 'Video'));
                          const sizeStr = fmt.filesize ? ` • ~${(fmt.filesize / 1024 / 1024).toFixed(1)} MB` : '';
                          const fpsStr = fmt.fps ? ` @ ${fmt.fps}fps` : '';
                          const vcodecStr = fmt.vcodec ? ` • ${fmt.vcodec}` : '';
                          return (
                            <option key={fmt.format_id} value={fmt.format_id}>
                              {resDisplay} ({group.ext}{fpsStr}{vcodecStr} • No Audio{sizeStr}) [ID: {fmt.format_id}]
                            </option>
                          );
                        })}
                      </optgroup>
                    ))
                  )}
                </select>

                {isCurrentFormatVideoOnly && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-amber-200">
                    <div className="flex items-center gap-2">
                      <VolumeX className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-semibold text-amber-300">Video-Only Stream (No Audio) Selected</span>
                        <p className="text-[11px] text-amber-300/80">
                          Stream ID {videoQuality} has no audio stream. Check "Auto-merge best audio" to combine with the best audio track.
                        </p>
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1.5 rounded border border-amber-500/40 text-xs text-amber-100 font-medium transition shrink-0">
                      <input
                        type="checkbox"
                        checked={mergeAudioForVideoOnly}
                        onChange={e => setMergeAudioForVideoOnly(e.target.checked)}
                        className="rounded bg-slate-900 border-amber-500 text-amber-500 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Auto-merge best audio (+bestaudio)</span>
                    </label>
                  </div>
                )}

                {isCurrentFormatNormalVideo && (
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Normal Video stream with built-in audio ({currentSelectedFormatObj?.acodec || 'Sound Included'}) — Ready to download directly.</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <select
                  value={audioFormat}
                  onChange={e => setAudioFormat(e.target.value)}
                  className="w-full bg-[#181d29] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <optgroup label="🌟 Native Direct Audio (Fast, No Re-encoding Loss)">
                    <option value="m4a">M4A (AAC — Native YouTube Audio, Best Quality & Fast) [Default]</option>
                    <option value="opus">OPUS (Native YouTube High-Efficiency Stream)</option>
                    <option value="flac">FLAC (Lossless Audio Container)</option>
                    <option value="wav">WAV (Uncompressed PCM)</option>
                  </optgroup>
                  <optgroup label="🔄 Legacy Compatibility (Transcoded to MP3)">
                    <option value="mp3_320">MP3 — 320 kbps CBR (Legacy Hardware & Car Stereos)</option>
                    <option value="mp3_256">MP3 — 256 kbps (Compatibility)</option>
                    <option value="mp3_192">MP3 — 192 kbps (Compatibility)</option>
                  </optgroup>
                  {audioOnlyFormats.length > 0 && (
                    groupFormatsByExt(audioOnlyFormats).map(group => (
                      <optgroup
                        key={`audio-${group.ext}`}
                        label={`⚡ Direct Audio Streams • ${group.ext} (${group.formats.length} Available)`}
                      >
                        {group.formats.map(fmt => {
                          const sizeStr = fmt.filesize ? ` • ~${(fmt.filesize / 1024 / 1024).toFixed(1)} MB` : '';
                          const bitrateStr = fmt.tbr ? ` @ ${Math.round(fmt.tbr)}kbps` : '';
                          const codecStr = fmt.acodec ? ` • Codec: ${fmt.acodec}` : '';
                          return (
                            <option key={fmt.format_id} value={fmt.format_id}>
                              Audio ({group.ext}{bitrateStr}{codecStr}{sizeStr}) [ID: {fmt.format_id}]
                            </option>
                          );
                        })}
                      </optgroup>
                    ))
                  )}
                </select>

                {audioFormat === 'm4a' && (
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Native M4A (AAC):</strong> Directly downloads YouTube's native AAC audio stream with zero transcoding degradation and instant processing. Perfect for Apple, Android, Windows & modern players.
                    </span>
                  </div>
                )}

                {audioFormat.startsWith('mp3') && (
                  <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-xs text-sky-300 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>
                      <strong>MP3 Compatibility Mode:</strong> Will transcode YouTube's stream to MP3 for legacy playback devices. Note: YouTube does not host native MP3s, so transcoding takes slight CPU time.
                    </span>
                  </div>
                )}
              </>
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
              placeholder="%(title)s - %(artist,uploader)s.%(ext)s"
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

              {/* Segment Toggles - Always kept visible as toggles even when off */}
              <div className={`space-y-1.5 pt-1.5 border-t border-slate-800/60 ${!options.sponsorblock.enabled ? 'opacity-70' : ''}`}>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span>Segment Toggles:</span>
                    {!options.sponsorblock.enabled && (
                      <span className="text-[10px] text-amber-400/90 font-medium">(Skipping paused)</span>
                    )}
                  </span>
                  <span className="font-mono text-slate-400">
                    {Object.values(options.sponsorblock.categoryActions || {}).filter(a => a === 'remove').length} cut •{' '}
                    {Object.values(options.sponsorblock.categoryActions || {}).filter(a => a === 'mark').length} mark •{' '}
                    {Object.values(options.sponsorblock.categoryActions || {}).filter(a => a === 'off').length} off
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {SPONSORBLOCK_CATEGORIES.map(cat => {
                    const action = (options.sponsorblock.categoryActions || {})[cat.id] || 'off';

                    const handleToggle = () => {
                      // Cycle: off -> remove (Cut) -> mark (Mark) -> off
                      const nextAction: SponsorBlockAction = 
                        action === 'off' ? 'remove' : action === 'remove' ? 'mark' : 'off';
                      const updatedActions = {
                        ...(options.sponsorblock.categoryActions || {}),
                        [cat.id]: nextAction,
                      };
                      const updatedCategories = Object.entries(updatedActions)
                        .filter(([_, a]) => a === 'remove')
                        .map(([k]) => k);

                      setOptions(prev => ({
                        ...prev,
                        sponsorblock: {
                          ...prev.sponsorblock,
                          enabled: true, // Auto-activate SponsorBlock when any segment toggle is clicked
                          categoryActions: updatedActions,
                          categories: updatedCategories,
                        }
                      }));
                    };

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={handleToggle}
                        className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1.5 border transition cursor-pointer font-medium ${
                          action === 'remove'
                            ? 'bg-rose-950/50 border-rose-500/50 text-rose-300 hover:bg-rose-900/60'
                            : action === 'mark'
                            ? 'bg-sky-950/50 border-sky-500/50 text-sky-300 hover:bg-sky-900/60'
                            : 'bg-[#10141d] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800/40'
                        }`}
                        title={`${cat.name} (${action.toUpperCase()}) - Click to toggle between Cut, Mark, and Off`}
                      >
                        <span 
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${action === 'off' ? 'opacity-40' : ''}`} 
                          style={{ backgroundColor: cat.color }} 
                        />
                        <span className="font-medium">{cat.name.split('/')[0].trim()}</span>
                        <span className={`text-[9px] uppercase font-mono px-1 py-0.2 rounded ${
                          action === 'remove'
                            ? 'bg-rose-500/20 text-rose-300'
                            : action === 'mark'
                            ? 'bg-sky-500/20 text-sky-300'
                            : 'bg-slate-800/80 text-slate-400'
                        }`}>
                          {action === 'remove' ? 'Cut' : action === 'mark' ? 'Mark' : 'Off'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Click any segment toggle to cycle between <span className="text-rose-300">Cut</span>, <span className="text-sky-300">Mark</span>, or <span className="text-slate-400">Off</span>.
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
                  {SPONSORBLOCK_CATEGORIES.map(cat => {
                    const isChecked = (options.sponsorblock.categoryActions || {})[cat.id] === 'remove';
                    return (
                      <label key={cat.id} className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const updatedActions = {
                              ...(options.sponsorblock.categoryActions || {}),
                              [cat.id]: e.target.checked ? ('remove' as const) : ('off' as const),
                            };
                            const updatedCats = Object.entries(updatedActions)
                              .filter(([_, a]) => a === 'remove')
                              .map(([k]) => k);
                            setOptions(prev => ({
                              ...prev,
                              sponsorblock: {
                                ...prev.sponsorblock,
                                categoryActions: updatedActions,
                                categories: updatedCats,
                              }
                            }));
                          }}
                          className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span className="text-[11px] truncate">{cat.name}</span>
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
            className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-4 h-4 text-white" />
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

      {/* Extraction Error Details Modal */}
      {showExtractErrorModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263045] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="h-14 px-5 border-b border-[#232b3e] flex items-center justify-between bg-[#151a28] shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Media Extraction Error Details
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Detailed yt-dlp diagnostic breakdown and full error message
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExtractErrorModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Target Link Box */}
              <div className="bg-[#0e121b] border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1">
                  Target Link / URL
                </div>
                <div className="font-mono text-xs text-sky-300 break-all select-all flex items-center justify-between gap-2">
                  <span>{singleUrl || lastExtractedUrlRef.current || 'No URL specified'}</span>
                  {singleUrl && (
                    <a
                      href={singleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-sky-400 shrink-0"
                      title="Open URL in browser"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Exact Error Message */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    Full yt-dlp Error Message:
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(extractFullError || extractError || 'Unknown Extraction Error');
                      setCopiedExtractError(true);
                      setTimeout(() => setCopiedExtractError(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[10px] text-rose-300 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/60 px-2 py-1 rounded transition cursor-pointer"
                  >
                    {copiedExtractError ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedExtractError ? 'Copied!' : 'Copy Full Error'}</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-[#181119] border border-rose-500/40 text-rose-200 font-mono text-[12px] leading-relaxed break-words max-h-56 overflow-y-auto whitespace-pre-wrap select-text selection:bg-rose-500/30">
                  {extractFullError || extractError || 'Extraction process failed with unspecified error'}
                </div>
              </div>

              {/* Diagnostic Suggestions */}
              <div className="p-3 bg-[#131924] rounded-xl border border-slate-800/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    Diagnostic Analysis & Recommendations
                  </span>
                  {((extractFullError || extractError)?.toLowerCase().includes('bot') || 
                   (extractFullError || extractError)?.toLowerCase().includes('sign in') || 
                   (extractFullError || extractError)?.toLowerCase().includes('429')) && onOpenSettings ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowExtractErrorModal(false);
                        onOpenSettings('cookies');
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-medium bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg transition shadow-sm cursor-pointer"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>Open Cookies & Bot Fix</span>
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {(extractFullError || extractError)?.toLowerCase().includes('bot') || (extractFullError || extractError)?.toLowerCase().includes('sign in')
                    ? 'YouTube is enforcing bot verification ("Sign in to confirm you’re not a bot"). You can bypass this by importing browser cookies, generating a Web Client PO Token, or selecting an alternate Player Client in Settings.'
                    : (extractFullError || extractError)?.toLowerCase().includes('private') || (extractFullError || extractError)?.toLowerCase().includes('unavailable')
                    ? 'The media stream appears to be private, member-only, geo-restricted, or removed. If this video requires authentication, configure cookies in Settings.'
                    : (extractFullError || extractError)?.toLowerCase().includes('429')
                    ? 'HTTP 429 Too Many Requests: The server is rate-limiting requests. Wait a short period or use a proxy/cookies.'
                    : 'The extraction engine could not read format metadata from this target URL. Verify that the URL is public and supported by yt-dlp.'}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="h-14 bg-[#141824] border-t border-[#232b3e] px-5 flex items-center justify-between shrink-0">
              <button
                onClick={() => {
                  const fullReport = `Extraction Error Report:\nTarget URL: ${singleUrl || lastExtractedUrlRef.current}\nError: ${extractError}\n\nFull Details / Traceback:\n${extractFullError || extractError}`;
                  navigator.clipboard.writeText(fullReport);
                  setCopiedExtractError(true);
                  setTimeout(() => setCopiedExtractError(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedExtractError ? 'Copied Report!' : 'Copy Full Diagnostic Report'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowExtractErrorModal(false)}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowExtractErrorModal(false);
                    handleExtract();
                  }}
                  disabled={isExtracting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
                  <span>Retry Extraction</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
