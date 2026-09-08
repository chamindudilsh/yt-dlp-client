import React, { useState } from 'react';
import { 
  Download, 
  Music, 
  Video, 
  Disc, 
  ListMusic, 
  User, 
  ExternalLink, 
  Check, 
  CheckSquare, 
  Square, 
  Sliders, 
  X
} from 'lucide-react';
import { SearchResultItem, SearchEngine } from '../types';

interface SearchResultsViewProps {
  results: SearchResultItem[];
  isLoading: boolean;
  hasSearched: boolean;
  searchQuery: string;
  engine: SearchEngine;
  activeFilter?: string;
  onFilterChange: (filter: string) => void;
  onSelectResult: (item: SearchResultItem) => void;
  onQuickDownload: (item: SearchResultItem) => void;
  onQueueBatch: (items: SearchResultItem[]) => void;
  onClearResults?: () => void;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  results,
  isLoading,
  hasSearched,
  searchQuery,
  engine,
  activeFilter = 'all',
  onFilterChange,
  onSelectResult,
  onQuickDownload,
  onQueueBatch,
  onClearResults,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(r => r.id)));
    }
  };

  const handleQueueSelected = () => {
    const selectedItems = results.filter(r => selectedIds.has(r.id));
    if (selectedItems.length > 0) {
      onQueueBatch(selectedItems);
      setSelectedIds(new Set());
    }
  };

  const handleClear = () => {
    setSelectedIds(new Set());
    if (onClearResults) {
      onClearResults();
    }
  };

  // Engine-specific filter definitions
  const youtubeFilters = [
    { id: 'all', label: 'All Results' },
    { id: 'video', label: 'Videos Only' },
    { id: 'playlist', label: 'Playlists' },
    { id: 'channel', label: 'Channels' },
  ];

  const ytmusicFilters = [
    { id: 'all', label: 'All' },
    { id: 'song', label: 'Songs' },
    { id: 'video', label: 'Videos' },
    { id: 'album', label: 'Albums' },
    { id: 'playlist', label: 'Playlists' },
    { id: 'artist', label: 'Artists' },
  ];

  const soundcloudFilters = [
    { id: 'all', label: 'All Results' },
    { id: 'track', label: 'Tracks' },
    { id: 'playlist', label: 'Playlists / Sets' },
    { id: 'user', label: 'Artists' },
  ];

  const currentFilters = engine === 'ytmusic'
    ? ytmusicFilters
    : engine === 'soundcloud'
    ? soundcloudFilters
    : youtubeFilters;

  const getTypeBadge = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'song':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 shrink-0">
            <Music className="w-2.5 h-2.5" /> Song
          </span>
        );
      case 'album':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
            <Disc className="w-2.5 h-2.5" /> Album
          </span>
        );
      case 'playlist':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 shrink-0">
            <ListMusic className="w-2.5 h-2.5" /> Playlist
          </span>
        );
      case 'artist':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
            <User className="w-2.5 h-2.5" /> Artist
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 shrink-0">
            <Video className="w-2.5 h-2.5" /> Video
          </span>
        );
    }
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* Category Filter Chips & Bulk Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar min-w-0">
          {currentFilters.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange(f.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 ${
                activeFilter === f.id
                  ? engine === 'ytmusic'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : engine === 'soundcloud'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-sky-600 text-white shadow-xs'
                  : 'bg-[#151a24] text-slate-400 hover:text-slate-200 hover:bg-[#1b2230] border border-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#131822] hover:bg-[#1a2130] border border-slate-800 transition cursor-pointer shrink-0"
            >
              {selectedIds.size === results.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 shrink-0" />
                  <span>Select All ({results.length})</span>
                </>
              )}
            </button>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleQueueSelected}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 px-3 py-1 rounded-lg transition shadow-md cursor-pointer animate-in zoom-in-95 shrink-0"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Queue Selected ({selectedIds.size})</span>
              </button>
            )}

            {onClearResults && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-slate-400 hover:text-rose-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#131822] hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800/60 transition cursor-pointer shrink-0"
                title="Clear all search results from grid"
              >
                <X className="w-3.5 h-3.5 text-slate-500 hover:text-rose-400 shrink-0" />
                <span>Clear Results</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="bg-[#111622] border border-slate-800/80 rounded-xl p-2.5 sm:p-3 flex gap-2.5 sm:gap-3 animate-pulse overflow-hidden">
              <div className="w-24 h-20 bg-slate-800 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 py-1 min-w-0">
                <div className="h-3.5 bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-800/60 rounded w-1/2" />
                <div className="h-3 bg-slate-800/40 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State - ONLY displayed when user has actually triggered a search and 0 results returned */}
      {!isLoading && hasSearched && results.length === 0 && (
        <div className="text-center py-10 px-4 bg-[#0e121a] rounded-xl border border-slate-800/80 space-y-3 animate-in fade-in">
          <Disc className="w-9 h-9 text-slate-600 mx-auto animate-pulse" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-300">
              No results found for &ldquo;{searchQuery}&rdquo;
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Check your spelling or try switching between YouTube and YouTube Music above.
            </p>
          </div>
          {onClearResults && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 rounded-lg bg-[#161c28] hover:bg-[#202738] text-slate-300 border border-slate-700/80 text-xs font-medium transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear Search</span>
            </button>
          )}
        </div>
      )}

      {/* Results Grid */}
      {!isLoading && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
          {results.map(item => {
            const isSelected = selectedIds.has(item.id);
            const isVideo = item.type === 'video';
            return (
              <div
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className={`group relative bg-[#121622] hover:bg-[#161c2b] border rounded-xl p-2.5 sm:p-3 flex gap-2.5 sm:gap-3 transition-all cursor-pointer select-none min-w-0 overflow-hidden ${
                  isSelected 
                    ? 'border-sky-500/60 ring-1 ring-sky-500/40 bg-[#131b29]' 
                    : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Thumbnail Column */}
                <div className={`relative ${isVideo ? 'w-24 sm:w-28 aspect-video' : 'w-20 h-20 sm:w-22 sm:h-22 aspect-square'} rounded-lg overflow-hidden bg-black/40 shrink-0 border border-slate-800/80 flex items-center justify-center self-start`}>
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Music className="w-6 h-6" />
                    </div>
                  )}

                  {/* Multi-select checkmark overlay */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.id);
                    }}
                    className={`absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center transition ${
                      isSelected 
                        ? 'bg-sky-600 text-white shadow' 
                        : 'bg-black/60 text-transparent hover:text-white/60 hover:bg-black/80'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </div>

                  {/* Duration Badge */}
                  {item.duration && (
                    <span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-xs text-white text-[9px] font-mono px-1 py-0.2 rounded">
                      {item.duration}
                    </span>
                  )}
                </div>

                {/* Details Column */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 overflow-hidden">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {getTypeBadge(item.type)}
                      {item.year && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.year}
                        </span>
                      )}
                    </div>

                    <h4 
                      className="text-xs font-semibold text-white truncate group-hover:text-sky-300 transition-colors"
                      title={item.title}
                    >
                      {item.title}
                    </h4>

                    <p className="text-[11px] text-slate-400 truncate" title={item.author}>
                      {item.author}
                    </p>

                    {item.album && (
                      <p className="text-[10px] text-slate-500 truncate flex items-center gap-1" title={item.album}>
                        <Disc className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{item.album}</span>
                      </p>
                    )}
                  </div>

                  {/* Action Buttons: perfectly bounded, zero overflow */}
                  <div className="flex items-center gap-1.5 pt-2 mt-auto w-full min-w-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onQuickDownload(item)}
                      className="flex-1 min-w-0 py-1.5 px-2 rounded-lg bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer overflow-hidden"
                      title="Direct download with current settings"
                    >
                      <Download className="w-3 h-3 shrink-0" />
                      <span className="truncate">Download</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectResult(item)}
                      className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer shrink-0"
                      title="Load formats and preview codecs in Single Link mode"
                    >
                      <Sliders className="w-3 h-3 shrink-0" />
                      <span>Formats</span>
                    </button>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition shrink-0 flex items-center justify-center"
                      title="Open on Web"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
