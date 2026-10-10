import React, { useState } from 'react';
import { X, Terminal, Copy, Check, Download, Sparkles, FolderOpen } from 'lucide-react';
import { TaskOptions, MediaType } from '../types';
import { api } from '../lib/apiBridge';

interface CliCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  type: MediaType;
  format: string;
  options: TaskOptions;
}

export const CliCommandModal: React.FC<CliCommandModalProps> = ({
  isOpen,
  onClose,
  url,
  type,
  format,
  options,
}) => {
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Build the exact Windows CMD / PowerShell CLI string
  const generateCommand = () => {
    const parts: string[] = ['yt-dlp.exe'];

    if (type === 'audio') {
      parts.push('-x');
      const isFormatDirect = format && !format.startsWith('mp3') && !['m4a', 'opus', 'flac', 'wav', 'best', 'audio', 'mp3_auto'].includes(format);
      if (isFormatDirect) {
        parts.push(`-f "${format}"`);
        parts.push('--audio-format best');
      } else if (format === 'best' || format === 'audio' || !format) {
        parts.push('-f "bestaudio/best"');
        parts.push('--audio-format best');
      } else if (format === 'm4a') {
        parts.push('-f "bestaudio[ext=m4a]/bestaudio/best"');
        parts.push('--audio-format m4a');
      } else if (format === 'opus') {
        parts.push('-f "bestaudio[ext=opus]/bestaudio[ext=webm]/bestaudio/best"');
        parts.push('--audio-format opus');
      } else if (format === 'flac') {
        parts.push('-f "bestaudio/best"');
        parts.push('--audio-format flac');
      } else if (format === 'wav') {
        parts.push('-f "bestaudio/best"');
        parts.push('--audio-format wav');
      } else if (format.startsWith('mp3')) {
        parts.push('-f "bestaudio/best"');
        parts.push('--audio-format mp3');
        if (format === 'mp3_320') parts.push('--audio-quality 320k');
        else if (format === 'mp3_256') parts.push('--audio-quality 256k');
        else if (format === 'mp3_192') parts.push('--audio-quality 192k');
        else parts.push('--audio-quality 0');
      } else {
        parts.push('-f "bestaudio/best"');
        parts.push('--audio-format best');
      }

      if (options.embedMetadata) {
        parts.push('--embed-metadata');
        parts.push('--embed-chapters');
        parts.push('--parse-metadata "%(artist,uploader)s:%(meta_artist)s"');
        parts.push('--parse-metadata "%(release_date,upload_date)s:(?s)^(?P<meta_date>\\d{4})"');
      }

      parts.push('--embed-thumbnail');
      parts.push('--convert-thumbnails jpg');
      if (options.audioCropThumbnailSquare) {
        let percent = 50;
        if (typeof options.cropOffsetPercent === 'number') {
          percent = Math.max(0, Math.min(100, options.cropOffsetPercent));
        } else if (options.cropFocus === 'left') {
          percent = 0;
        } else if (options.cropFocus === 'right') {
          percent = 100;
        }

        let cropFilter = "crop='min(iw\\,ih)':'min(iw\\,ih)'";
        if (percent === 0) {
          cropFilter = "crop='min(iw\\,ih)':'min(iw\\,ih)':0:0";
        } else if (percent === 100) {
          cropFilter = "crop='min(iw\\,ih)':'min(iw\\,ih)':(in_w-out_w):0";
        } else if (percent !== 50) {
          const factor = (percent / 100).toFixed(3);
          cropFilter = `crop='min(iw\\,ih)':'min(iw\\,ih)':(in_w-out_w)*${factor}:0`;
        }
        parts.push(`--ppa "ThumbnailsConvertor+ffmpeg_o:-vf ${cropFilter}"`);
      }
    } else {
      // Prioritize MP4 video and M4A audio (YTDLnis standard format sorting)
      parts.push('-S "res,ext:mp4:m4a"');
      if (format === '4k' || format === '2160p') {
        parts.push('-f "bestvideo[height<=2160]+bestaudio/best[height<=2160]/best"');
      } else if (format === '1440p') {
        parts.push('-f "bestvideo[height<=1440]+bestaudio/best[height<=1440]/best"');
      } else if (format === '1080p') {
        parts.push('-f "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"');
      } else if (format === '720p') {
        parts.push('-f "bestvideo[height<=720]+bestaudio/best[height<=720]/best"');
      } else if (format !== 'best' && format) {
        parts.push(`-f "${format}"`);
      } else {
        parts.push('-f "bestvideo+bestaudio/best"');
      }
      parts.push('--merge-output-format mp4');
      if (options.upscaleHeight && options.upscaleHeight > 0) {
        parts.push(`--ppa "Merger+ffmpeg_o:-vf scale=-2:${options.upscaleHeight}"`);
      }
      if (options.embedMetadata) {
        parts.push('--embed-metadata');
        parts.push('--embed-chapters');
        parts.push('--parse-metadata "%(artist,uploader)s:%(meta_artist)s"');
        parts.push('--parse-metadata "%(release_date,upload_date)s:(?s)^(?P<meta_date>\\d{4})"');
      }
    }

    if (options.sponsorblock?.enabled) {
      const sb = options.sponsorblock;
      let removeCats: string[] = [];
      let markCats: string[] = [];

      if (sb.categoryActions && Object.keys(sb.categoryActions).length > 0) {
        removeCats = Object.entries(sb.categoryActions)
          .filter(([_, action]) => action === 'remove')
          .map(([cat]) => cat);
        markCats = Object.entries(sb.categoryActions)
          .filter(([_, action]) => action === 'mark')
          .map(([cat]) => cat);
      } else if (sb.categories && sb.categories.length > 0) {
        if (sb.action === 'mark') {
          markCats = sb.categories;
        } else {
          removeCats = sb.categories;
        }
      } else {
        removeCats = ['sponsor', 'intro', 'outro', 'selfpromo', 'interaction'];
      }

      if (removeCats.length > 0) {
        parts.push(`--sponsorblock-remove "${removeCats.join(',')}"`);
      }
      if (markCats.length > 0) {
        parts.push(`--sponsorblock-mark "${markCats.join(',')}"`);
      }
      if (sb.apiUrl && sb.apiUrl !== 'https://sponsor.ajay.app') {
        parts.push(`--sponsorblock-api "${sb.apiUrl}"`);
      }
    }

    if (options.subtitles.enabled) {
      const isEmbed = Boolean(options.subtitles.embed && type === 'video');
      if (isEmbed) {
        parts.push('--embed-subs');
        if (options.subtitles.keepSubs) {
          parts.push('--write-subs');
        } else {
          parts.push('--compat-options no-keep-subs');
        }
      } else {
        parts.push('--write-subs');
      }
      if (options.subtitles.writeAutoSubs !== false && options.subtitles.autoSubs !== false) {
        parts.push('--write-auto-subs');
      }
      parts.push(`--sub-langs "${options.subtitles.langs || 'en.*'}"`);
      if (options.subtitles.format && options.subtitles.format !== 'best') {
        parts.push(`--convert-subs ${options.subtitles.format}`);
      }
    }

    const tmpl = options.namingTemplate || '%(title)s - %(artist,uploader)s.%(ext)s';
    parts.push(`-o "${tmpl}"`);

    const playerClient = options.playerClient || options.auth?.playerClient;
    if (playerClient && playerClient !== 'default') {
      parts.push(`--extractor-args "youtube:player_client=${playerClient}"`);
    }

    if (options.limitRate && options.limitRate !== 'unlimited' && options.limitRate !== '0') {
      parts.push(`--limit-rate ${options.limitRate}`);
    }

    if (options.useAria2) {
      const conn = Math.max(1, Math.min(16, options.aria2Connections || 16));
      parts.push('--downloader aria2c');
      parts.push('--downloader "dash,m3u8:native"');
      let ariaArgs = `aria2c:-c -j ${conn} -x ${conn} -s ${conn} -k 1M --file-allocation=none --summary-interval=1`;
      if (options.limitRate && options.limitRate !== 'unlimited' && options.limitRate !== '0') {
        ariaArgs += ` --max-download-limit=${options.limitRate}`;
      }
      parts.push(`--downloader-args "${ariaArgs}"`);
    }

    if (options.proxy && options.proxy.trim()) {
      parts.push(`--proxy "${options.proxy.trim()}"`);
    }

    if (options.downloadSections && options.downloadSections.trim()) {
      const secTrimmed = options.downloadSections.trim();
      const secFormatted = secTrimmed.startsWith('*') ? secTrimmed : `*${secTrimmed}`;
      parts.push(`--download-sections "${secFormatted}" --force-keyframes-at-cuts`);
    }

    if (options.splitChapters) {
      parts.push('--split-chapters -o "chapter:%(title)s - %(section_number)02d %(section_title)s.%(ext)s"');
    }

    if (options.enableDownloadArchive) {
      const archPath = options.downloadArchivePath && options.downloadArchivePath.trim()
        ? options.downloadArchivePath.trim()
        : 'archive.txt';
      parts.push(`--download-archive "${archPath}"`);
    }

    const targetUrl = url.trim() || 'https://www.youtube.com/watch?v=...';
    parts.push(`"${targetUrl}"`);

    return parts.join(' ');
  };

  const command = generateCommand();

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportBat = async () => {
    const batContent = `@echo off\r\ntitle yt-dlp Task Runner\r\necho ========================================================\r\necho  yt-dlp Windows CLI Task Execution\r\necho ========================================================\r\necho.\r\nif exist "%~dp0yt-dlp.exe" (\r\n    cd /d "%~dp0"\r\n)\r\n${command}\r\necho.\r\necho ========================================================\r\necho Execution finished.\r\npause\r\n`;

    try {
      setExportError(null);
      const res = await api.exportTextFile({
        defaultName: 'download-task.bat',
        content: batContent,
        filterName: 'Windows Batch Script (*.bat)',
        filterExt: 'bat',
      });
      if (res.success && !res.cancelled) {
        setExported(true);
        if (res.path) {
          setExportedPath(res.path);
        }
        setTimeout(() => setExported(false), 4000);
      }
    } catch (err: any) {
      console.error('Failed to export batch script:', err);
      setExportError('Export failed');
      setTimeout(() => setExportError(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div 
        id="cli-command-modal"
        className="bg-[#141926] border border-[#232c3f] rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#141926] border-b border-[#232c3f] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-md border border-sky-500/20">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Windows CLI Command Inspector</h3>
              <p className="text-[11px] text-slate-400">
                Direct equivalent yt-dlp.exe command line string for Windows Terminal or CMD
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#181f2f] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="relative">
            <div className="bg-[#0b0e14] p-4 rounded-lg border border-[#232c3f] font-mono text-xs text-sky-300 leading-relaxed break-all select-all">
              {command}
            </div>

            <button
              onClick={handleCopy}
              className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded bg-[#181f2f] hover:bg-[#222c42] text-slate-200 border border-[#232c3f] text-xs font-medium flex items-center space-x-1.5 shadow transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Copy Command</span>
                </>
              )}
            </button>
          </div>

          {/* Breakdown flags */}
          <div className="space-y-1.5">
            <span className="text-slate-400 font-medium text-[11px]">Command Flags Applied:</span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#181f2f] p-2 rounded border border-[#232c3f]">
                <span className="text-slate-400">Mode:</span>{' '}
                <span className="text-white font-medium capitalize">{type}</span> ({format})
              </div>
              <div className="bg-[#181f2f] p-2 rounded border border-[#232c3f]">
                <span className="text-slate-400">SponsorBlock:</span>{' '}
                <span className={options.sponsorblock.enabled ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                  {options.sponsorblock.enabled ? 'Remove segments active' : 'Disabled'}
                </span>
              </div>
              <div className="bg-[#181f2f] p-2 rounded border border-[#232c3f]">
                <span className="text-slate-400">1:1 Square Album Art:</span>{' '}
                <span className={type === 'audio' && options.audioCropThumbnailSquare ? 'text-rose-400 font-medium' : 'text-slate-500'}>
                  {type === 'audio' && options.audioCropThumbnailSquare
                    ? (typeof options.cropOffsetPercent === 'number' && options.cropOffsetPercent !== 50
                        ? `Custom (${options.cropOffsetPercent}%)`
                        : (options.cropFocus === 'left' ? 'Left Edge' : options.cropFocus === 'right' ? 'Right Edge' : 'Centered 1:1'))
                    : 'Standard'}
                </span>
              </div>
              <div className="bg-[#181f2f] p-2 rounded border border-[#232c3f]">
                <span className="text-slate-400">Subtitles:</span>{' '}
                <span className={options.subtitles.enabled ? 'text-sky-400 font-medium' : 'text-slate-500'}>
                  {options.subtitles.enabled
                    ? `${options.subtitles.langs} (${options.subtitles.embed ? (options.subtitles.keepSubs ? 'embed + keep' : 'embed') : 'external'})`
                    : 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#141926] border-t border-[#232c3f] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportBat}
              disabled={exported}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium border transition flex items-center space-x-1.5 ${
                exported 
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40' 
                  : exportError
                  ? 'bg-rose-950/40 text-rose-300 border-rose-500/40'
                  : 'bg-[#181f2f] hover:bg-[#222c42] text-slate-200 border-[#232c3f]'
              }`}
            >
              {exported ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Saved download-task.bat</span>
                </>
              ) : exportError ? (
                <>
                  <X className="w-3.5 h-3.5 text-rose-400" />
                  <span>{exportError}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Export as Windows .bat Script</span>
                </>
              )}
            </button>

            {exportedPath && (
              <button
                type="button"
                onClick={() => api.showItemInFolder(exportedPath)}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#181f2f] hover:bg-[#222c42] text-sky-300 hover:text-sky-200 border border-[#232c3f] transition flex items-center space-x-1 animate-in fade-in duration-200"
                title="Show exported script in Windows File Explorer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                <span>Reveal in Explorer</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-[#181f2f] hover:bg-[#222c42] text-white border border-[#232c3f] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
