import React, { useState } from 'react';
import { X, Terminal, Copy, Check, Download, Sparkles } from 'lucide-react';
import { TaskOptions, MediaType } from '../types';

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

  if (!isOpen) return null;

  // Build the exact Windows CMD / PowerShell CLI string
  const generateCommand = () => {
    const parts: string[] = ['yt-dlp.exe'];

    if (type === 'audio') {
      parts.push('-x');
      const audioFormat = format.startsWith('mp3') ? 'mp3' : format;
      parts.push(`--audio-format ${audioFormat}`);
      if (format === 'mp3_320') parts.push('--audio-quality 320k');
      else if (format === 'mp3_256') parts.push('--audio-quality 256k');
      else if (format === 'flac') parts.push('--audio-quality 0');

      if (options.embedMetadata) {
        parts.push('--embed-metadata');
        parts.push('--add-metadata');
      }

      if (options.audioCropThumbnailSquare) {
        parts.push('--embed-thumbnail');
        parts.push('--convert-thumbnails jpg');
        parts.push('--ppa "ThumbnailsConvertor+ffmpeg_o:-vf crop=min(iw\\,ih):min(iw\\,ih)"');
      }
    } else {
      if (format === '4k' || format === '2160p') {
        parts.push('-f "bestvideo[height<=2160]+bestaudio/best[height<=2160]/best"');
      } else if (format === '1440p') {
        parts.push('-f "bestvideo[height<=1440]+bestaudio/best[height<=1440]/best"');
      } else if (format === '1080p') {
        parts.push('-f "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"');
      } else if (format === '720p') {
        parts.push('-f "bestvideo[height<=720]+bestaudio/best[height<=720]/best"');
      } else {
        parts.push('-f "bestvideo+bestaudio/best"');
      }
      parts.push('--merge-output-format mp4');
      if (options.embedMetadata) {
        parts.push('--embed-metadata');
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
      parts.push('--write-subs --write-auto-subs');
      parts.push(`--sub-langs "${options.subtitles.langs || 'en.*'}"`);
      if (options.subtitles.embed && type === 'video') {
        parts.push('--embed-subs');
      }
    }

    const tmpl = options.namingTemplate || '%(title)s [%(id)s].%(ext)s';
    parts.push(`-o "${tmpl}"`);

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

  const handleExportBat = () => {
    const batContent = `@echo off\r\ntitle yt-dlp Windows Client Script\r\necho Running yt-dlp with configured parameters...\r\n${command}\r\npause\r\n`;
    const blob = new Blob([batContent], { type: 'text/plain' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'download-task.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div 
        id="cli-command-modal"
        className="bg-[#121620] border border-[#262e40] rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#171c2a] border-b border-[#262e40] flex items-center justify-between">
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
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="relative">
            <div className="bg-[#0b0e14] p-4 rounded-lg border border-slate-800 font-mono text-xs text-sky-300 leading-relaxed break-all select-all">
              {command}
            </div>

            <button
              onClick={handleCopy}
              className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1.5 shadow transition"
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
              <div className="bg-[#181d29] p-2 rounded border border-slate-800/80">
                <span className="text-slate-400">Mode:</span>{' '}
                <span className="text-white font-medium capitalize">{type}</span> ({format})
              </div>
              <div className="bg-[#181d29] p-2 rounded border border-slate-800/80">
                <span className="text-slate-400">SponsorBlock:</span>{' '}
                <span className={options.sponsorblock.enabled ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                  {options.sponsorblock.enabled ? 'Remove segments active' : 'Disabled'}
                </span>
              </div>
              <div className="bg-[#181d29] p-2 rounded border border-slate-800/80">
                <span className="text-slate-400">1:1 Square Album Art:</span>{' '}
                <span className={type === 'audio' && options.audioCropThumbnailSquare ? 'text-rose-400 font-medium' : 'text-slate-500'}>
                  {type === 'audio' && options.audioCropThumbnailSquare ? 'crop=min(iw,ih):min(iw,ih)' : 'Standard'}
                </span>
              </div>
              <div className="bg-[#181d29] p-2 rounded border border-slate-800/80">
                <span className="text-slate-400">Subtitles:</span>{' '}
                <span className={options.subtitles.enabled ? 'text-sky-400 font-medium' : 'text-slate-500'}>
                  {options.subtitles.enabled ? `${options.subtitles.langs} (${options.subtitles.embed ? 'embed' : 'external'})` : 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#171c2a] border-t border-[#262e40] flex items-center justify-between">
          <button
            onClick={handleExportBat}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[#1e2433] hover:bg-[#283145] text-slate-200 border border-slate-700 transition flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Export as Windows .bat Script</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
