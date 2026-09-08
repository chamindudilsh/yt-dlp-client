import React, { useState, useEffect, useMemo } from 'react';
import { 
  Folder, 
  FolderOpen,
  Music, 
  Video, 
  File,
  Play, 
  RefreshCw, 
  Search,
  CheckCircle2,
  Crop,
  FileSearch
} from 'lucide-react';
import { DownloadedFile } from '../types';
import { api } from '../lib/apiBridge';
import { MediaInspectorModal } from './MediaInspectorModal';

interface SavedFilesLibraryProps {
  downloadDir: string;
  onSwitchToDownloader?: () => void;
}

export const SavedFilesLibrary: React.FC<SavedFilesLibraryProps> = ({
  downloadDir,
  onSwitchToDownloader,
}) => {
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'audio' | 'other'>('all');
  const [inspectTarget, setInspectTarget] = useState<{
    filepath?: string;
    filename?: string;
    title?: string;
  } | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const handleInspect = (file: DownloadedFile) => {
    setInspectTarget({
      filepath: file.filepath || file.downloadUrl,
      filename: file.name,
      title: file.name,
    });
    setIsInspectorOpen(true);
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const data = await api.getDownloadedFiles();
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching downloaded files:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleOpenFolder = async () => {
    setOpeningFolder(true);
    try {
      await api.openDownloadFolder();
    } catch (e) {
      console.warn('Failed to open download folder:', e);
    } finally {
      setTimeout(() => setOpeningFolder(false), 900);
    }
  };

  const handleOpenFile = async (file: DownloadedFile) => {
    const target = file.filepath || file.downloadUrl || file.name;
    setOpeningFile(file.name);
    try {
      await api.openMediaFile(target);
    } catch (e) {
      console.warn('Could not open file with player:', e);
    } finally {
      setTimeout(() => setOpeningFile(null), 1000);
    }
  };

  const handleShowInFolder = async (file: DownloadedFile) => {
    const target = file.filepath || file.downloadUrl || file.name;
    try {
      await api.showItemInFolder(target);
    } catch (e) {
      console.warn('Could not show in folder:', e);
      api.openDownloadFolder();
    }
  };

  const isAudioFile = (f: DownloadedFile) => f.type === 'audio' || /\.(mp3|m4a|flac|opus|wav|ogg|aac|wma|aiff)$/i.test(f.name);
  const isVideoFile = (f: DownloadedFile) => f.type === 'video' || (f.type !== 'audio' && /\.(mp4|mkv|webm|avi|mov|flv|wmv|m4v|ts|3gp)$/i.test(f.name));
  const isOtherFile = (f: DownloadedFile) => !isAudioFile(f) && !isVideoFile(f);

  const videoCount = useMemo(() => files.filter(isVideoFile).length, [files]);
  const audioCount = useMemo(() => files.filter(isAudioFile).length, [files]);
  const otherCount = useMemo(() => files.filter(isOtherFile).length, [files]);

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      let matchesType = true;
      if (typeFilter === 'video') matchesType = isVideoFile(f);
      else if (typeFilter === 'audio') matchesType = isAudioFile(f);
      else if (typeFilter === 'other') matchesType = isOtherFile(f);
      return matchesSearch && matchesType;
    });
  }, [files, searchQuery, typeFilter]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">
      {/* Header Bar */}
      <div className="dark-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-[#181d28] border border-[#242c3d] flex items-center justify-center shrink-0">
            <Folder className="w-4.5 h-4.5 text-slate-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Downloaded Files Library</h3>
              <span className="text-[10px] bg-[#181d28] text-slate-300 border border-[#242c3d] px-2 py-0.5 rounded font-mono">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate max-w-md mt-0.5">
              {downloadDir || '%USERPROFILE%\\Downloads'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleOpenFolder}
            disabled={openingFolder}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#1a202c] hover:bg-[#242c3d] text-slate-200 border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
            title="Open download folder in Windows Explorer"
          >
            {openingFolder ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{openingFolder ? 'Opening Explorer...' : 'Open in Explorer'}</span>
          </button>

          <button
            onClick={fetchFiles}
            disabled={loading}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#1a202c] hover:bg-[#242c3d] text-slate-300 hover:text-white border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            title="Scan folder for new downloads"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls (If files exist) */}
      {files.length > 0 && (
        <div className="dark-card p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search downloaded files..."
              className="w-full bg-[#0c1017] border border-[#232b3d] focus:border-slate-500 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center bg-[#0c1017] p-0.5 rounded-lg border border-[#1e2536] self-end sm:self-auto shrink-0">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-[#222a3a] text-white font-medium shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({files.length})
            </button>
            <button
              onClick={() => setTypeFilter('video')}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                typeFilter === 'video'
                  ? 'bg-[#222a3a] text-sky-400 font-medium shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>Videos ({videoCount})</span>
            </button>
            <button
              onClick={() => setTypeFilter('audio')}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                typeFilter === 'audio'
                  ? 'bg-[#222a3a] text-rose-400 font-medium shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Music className="w-3 h-3" />
              <span>Music ({audioCount})</span>
            </button>
            {otherCount > 0 && (
              <button
                onClick={() => setTypeFilter('other')}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                  typeFilter === 'other'
                    ? 'bg-[#222a3a] text-slate-200 font-medium shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <File className="w-3 h-3" />
                <span>Other ({otherCount})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Files List View */}
      {loading && files.length === 0 ? (
        <div className="dark-card p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
          <span>Scanning destination folder for downloads...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="dark-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#181d28] border border-[#242c3d] flex items-center justify-center mx-auto text-slate-400">
            <Folder className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">No Downloaded Files Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Files downloaded via the batch downloader will appear here automatically.
            </p>
          </div>
          {onSwitchToDownloader && (
            <button
              onClick={onSwitchToDownloader}
              className="btn-primary text-xs px-4 py-2 mt-2 cursor-pointer"
            >
              Start New Download
            </button>
          )}
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="dark-card p-8 text-center space-y-2">
          <p className="text-xs text-slate-400">No downloaded files matched &quot;{searchQuery}&quot;</p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-sky-400 hover:underline cursor-pointer"
          >
            Clear search filter
          </button>
        </div>
      ) : (
        <div className="dark-card overflow-hidden shadow-xs">
          <div className="divide-y divide-[#1e2536]">
            {filteredFiles.map((file, idx) => {
              const isAudio = isAudioFile(file);
              const isVideo = isVideoFile(file);
              const isOpening = openingFile === file.name;
              return (
                <div
                  key={idx}
                  onDoubleClick={() => handleOpenFile(file)}
                  className="p-3.5 flex items-center justify-between hover:bg-[#161c27] transition-colors group select-none"
                >
                  <div className="flex items-center space-x-3 truncate min-w-0 mr-3">
                    {isAudio ? (
                      <div className="p-2 rounded-lg bg-rose-950/40 text-rose-400 border border-rose-800/30 shrink-0">
                        <Music className="w-4 h-4" />
                      </div>
                    ) : isVideo ? (
                      <div className="p-2 rounded-lg bg-sky-950/40 text-sky-400 border border-sky-800/30 shrink-0">
                        <Video className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-slate-800/60 text-slate-400 border border-slate-700/50 shrink-0">
                        <File className="w-4 h-4" />
                      </div>
                    )}

                    <div className="truncate space-y-0.5 min-w-0">
                      <p 
                        onClick={() => handleOpenFile(file)}
                        className="text-xs font-semibold text-white truncate max-w-md hover:text-sky-300 cursor-pointer transition"
                        title="Click to open with default player"
                      >
                        {file.name}
                      </p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                        <span className="text-slate-300">{file.size}</span>
                        <span>•</span>
                        <span>{new Date(Number(file.mtime) || file.mtime).toLocaleDateString()}</span>
                        {isAudio && (
                          <>
                            <span>•</span>
                            <span className="text-rose-400">1:1 ID3 Tagged</span>
                          </>
                        )}
                        {!isAudio && !isVideo && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">File</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleOpenFile(file)}
                      disabled={isOpening}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 hover:text-sky-200 border border-sky-500/40 transition flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      title="Open file with default installed media player"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isOpening ? 'Opening...' : 'Open'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShowInFolder(file)}
                      className="p-1.5 rounded-lg bg-[#1a202c] hover:bg-[#242c3d] text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                      title="Show in Windows File Explorer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInspect(file)}
                      className="p-1.5 rounded-lg bg-[#1a202c] hover:bg-indigo-950/40 text-slate-300 hover:text-indigo-400 border border-slate-700 transition cursor-pointer"
                      title="Inspect Streams, Codecs & Integrity (ffprobe)"
                    >
                      <FileSearch className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ffprobe Media Stream Inspector Modal */}
      <MediaInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => {
          setIsInspectorOpen(false);
          setInspectTarget(null);
        }}
        target={inspectTarget}
      />
    </div>
  );
};
