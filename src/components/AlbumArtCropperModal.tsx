import React, { useState, useEffect, useRef } from 'react';
import { X, Crop, Check, Image as ImageIcon, Music, Sparkles, Sliders, MoveHorizontal } from 'lucide-react';

interface AlbumArtCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  thumbnailUrl: string;
  songTitle?: string;
  artistName?: string;
  currentCropFocus: 'center' | 'left' | 'right' | 'custom';
  currentCropOffsetPercent?: number;
  onSaveCropFocus: (focus: 'center' | 'left' | 'right' | 'custom', offsetPercent: number) => void;
}

export const AlbumArtCropperModal: React.FC<AlbumArtCropperModalProps> = ({
  isOpen,
  onClose,
  thumbnailUrl,
  songTitle = 'Audio Track',
  artistName = 'Unknown Artist',
  currentCropFocus,
  currentCropOffsetPercent,
  onSaveCropFocus,
}) => {
  const initialPercent = typeof currentCropOffsetPercent === 'number'
    ? Math.max(0, Math.min(100, currentCropOffsetPercent))
    : currentCropFocus === 'left'
    ? 0
    : currentCropFocus === 'right'
    ? 100
    : 50;

  const [offsetPercent, setOffsetPercent] = useState<number>(initialPercent);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof currentCropOffsetPercent === 'number') {
      setOffsetPercent(Math.max(0, Math.min(100, currentCropOffsetPercent)));
    } else if (currentCropFocus === 'left') {
      setOffsetPercent(0);
    } else if (currentCropFocus === 'right') {
      setOffsetPercent(100);
    } else {
      setOffsetPercent(50);
    }
  }, [currentCropFocus, currentCropOffsetPercent]);

  const updatePositionFromClientX = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Square width is equal to container height in 16:9
    const squareWidth = rect.height;
    const maxOffset = rect.width - squareWidth;
    if (maxOffset <= 0) return;

    // Center the square on pointer's X
    const desiredLeft = clientX - rect.left - squareWidth / 2;
    const clamped = Math.max(0, Math.min(maxOffset, desiredLeft));
    const percent = Math.round((clamped / maxOffset) * 100);
    setOffsetPercent(percent);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePositionFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updatePositionFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const getFfmpegFilter = (pct: number) => {
    if (pct === 0) return "crop='min(iw\\,ih)':'min(iw\\,ih)':0:0";
    if (pct === 100) return "crop='min(iw\\,ih)':'min(iw\\,ih)':(in_w-out_w):0";
    if (pct === 50) return "crop='min(iw\\,ih)':'min(iw\\,ih)'";
    return `crop='min(iw\\,ih)':'min(iw\\,ih)':(in_w-out_w)*${(pct / 100).toFixed(3)}:0`;
  };

  const handleApply = () => {
    const focusType = offsetPercent === 0 
      ? 'left' 
      : offsetPercent === 100 
      ? 'right' 
      : offsetPercent === 50 
      ? 'center' 
      : 'custom';
    onSaveCropFocus(focusType, offsetPercent);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div 
        id="album-art-modal"
        className="bg-[#121620] border border-[#262e40] rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#171c2a] border-b border-[#262e40] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-md border border-rose-500/20">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">1:1 Square Album Art Cropper</h3>
              <p className="text-[11px] text-slate-400">
                Drag the square crop box horizontally to position cover art perfectly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original 16:9 Thumbnail with Draggable 1:1 Box */}
            <div className="bg-[#181d29] p-3 rounded-lg border border-[#262f42] flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Original 16:9 Thumbnail
                </span>
                <span className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  Drag to Reposition
                </span>
              </div>

              {/* Interactive Thumbnail Container */}
              <div 
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="relative aspect-video rounded-md overflow-hidden bg-black/60 border border-slate-700/40 select-none cursor-ew-resize group touch-none"
                title="Click and drag horizontally to reposition the 1:1 square crop area"
              >
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt="Original thumbnail"
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <span className="text-xs text-slate-500 w-full text-center">No thumbnail available</span>
                )}

                {/* Darkened area to the left */}
                <div
                  style={{ width: `${(offsetPercent / 100) * 43.75}%` }}
                  className="absolute top-0 bottom-0 left-0 bg-black/65 backdrop-blur-[1px] pointer-events-none"
                />

                {/* Darkened area to the right */}
                <div
                  style={{ left: `${(offsetPercent / 100) * 43.75 + 56.25}%`, right: 0 }}
                  className="absolute top-0 bottom-0 bg-black/65 backdrop-blur-[1px] pointer-events-none"
                />

                {/* Draggable 1:1 Square Box */}
                <div
                  style={{
                    left: `${(offsetPercent / 100) * 43.75}%`,
                    width: '56.25%',
                  }}
                  className={`absolute top-0 bottom-0 border-2 border-rose-500 bg-rose-500/10 flex flex-col items-center justify-between p-1.5 shadow-xl pointer-events-none transition-shadow ${
                    isDragging ? 'border-rose-400 ring-2 ring-rose-400/40 bg-rose-500/20' : ''
                  }`}
                >
                  {/* Top Badge */}
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[9px] font-bold text-white bg-black/80 px-1.5 py-0.5 rounded shadow-sm">
                      1:1 ID3 Area
                    </span>
                    <span className="text-[9px] font-mono font-bold text-rose-300 bg-rose-950/80 border border-rose-600/40 px-1 py-0.5 rounded shadow-sm">
                      {offsetPercent}%
                    </span>
                  </div>

                  {/* Center Drag Handle Badge */}
                  <div className="flex items-center gap-1.5 text-white/95 bg-black/80 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/20 shadow-md">
                    <MoveHorizontal className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-[10px] font-bold tracking-wide uppercase">Drag</span>
                  </div>

                  {/* Bottom Indicator */}
                  <span className="text-[9px] font-medium text-white/80 bg-black/75 px-1.5 py-0.5 rounded">
                    {offsetPercent === 0
                      ? 'Left Edge'
                      : offsetPercent === 50
                      ? 'Centered'
                      : offsetPercent === 100
                      ? 'Right Edge'
                      : 'Custom'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2">
                Click & drag the box horizontally across the thumbnail to isolate the artist or album art.
              </p>
            </div>

            {/* Cropped 1:1 Square Album Art */}
            <div className="bg-[#181d29] p-3 rounded-lg border border-[#262f42] flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-rose-400" />
                  Resulting 1:1 ID3 Album Art
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Live Preview
                </span>
              </div>

              <div className="flex items-center justify-center py-1">
                <div className="relative w-44 h-44 rounded-md overflow-hidden bg-slate-900 shadow-lg border-2 border-rose-500/50">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Resulting 1:1 Album Art"
                      style={{ objectPosition: `${offsetPercent}% center` }}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                      No thumbnail available
                    </div>
                  )}
                  {/* Vinyl / Cover gloss effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10 pointer-events-none" />
                </div>
              </div>

              <div className="mt-2 text-center">
                <p className="text-xs font-semibold text-white truncate">{songTitle}</p>
                <p className="text-[11px] text-slate-400 truncate">{artistName}</p>
              </div>
            </div>
          </div>

          {/* Crop Alignment Selector & Range Slider */}
          <div className="bg-[#161b26] p-3.5 rounded-lg border border-[#232938] space-y-3">
            {/* Slider Control */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  Horizontal Crop Position Slider:
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-rose-400">
                    {offsetPercent}%
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({offsetPercent === 0 ? 'Left' : offsetPercent === 50 ? 'Center' : offsetPercent === 100 ? 'Right' : 'Custom'})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] text-slate-500 font-mono">0% (L)</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={offsetPercent}
                  onChange={(e) => setOffsetPercent(Number(e.target.value))}
                  className="flex-1 accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 font-mono">100% (R)</span>
              </div>
            </div>

            {/* Quick Snap Preset Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOffsetPercent(0)}
                className={`py-2 px-3 rounded-md text-xs font-medium border transition text-center cursor-pointer ${
                  offsetPercent === 0
                    ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                    : 'bg-[#1f2535] text-slate-300 border-slate-700 hover:bg-[#283044]'
                }`}
              >
                Left Focus (0%)
              </button>
              <button
                type="button"
                onClick={() => setOffsetPercent(50)}
                className={`py-2 px-3 rounded-md text-xs font-medium border transition text-center cursor-pointer ${
                  offsetPercent === 50
                    ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                    : 'bg-[#1f2535] text-slate-300 border-slate-700 hover:bg-[#283044]'
                }`}
              >
                Center Focus (50% Default)
              </button>
              <button
                type="button"
                onClick={() => setOffsetPercent(100)}
                className={`py-2 px-3 rounded-md text-xs font-medium border transition text-center cursor-pointer ${
                  offsetPercent === 100
                    ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                    : 'bg-[#1f2535] text-slate-300 border-slate-700 hover:bg-[#283044]'
                }`}
              >
                Right Focus (100%)
              </button>
            </div>

            {/* Technical explanation pill */}
            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800 font-mono">
              <span className="text-slate-500">FFmpeg post-processor:</span>{' '}
              <span className="text-sky-300">
                --ppa "ThumbnailsConvertor+ffmpeg_o:-vf {getFfmpegFilter(offsetPercent)}"
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#171c2a] border-t border-[#262e40] flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Embedded into MP3/FLAC/M4A ID3 metadata with pixel-accurate alignment
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white transition flex items-center space-x-1.5 shadow cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply 1:1 Cover Art Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
