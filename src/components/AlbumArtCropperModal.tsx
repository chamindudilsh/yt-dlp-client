import React, { useState, useEffect, useRef } from 'react';
import { X, Crop, Check, Image as ImageIcon, Music, Sparkles, Sliders } from 'lucide-react';

interface AlbumArtCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  thumbnailUrl: string;
  songTitle?: string;
  artistName?: string;
  currentCropFocus: 'center' | 'left' | 'right';
  onSaveCropFocus: (focus: 'center' | 'left' | 'right') => void;
}

export const AlbumArtCropperModal: React.FC<AlbumArtCropperModalProps> = ({
  isOpen,
  onClose,
  thumbnailUrl,
  songTitle = 'Audio Track',
  artistName = 'Unknown Artist',
  currentCropFocus,
  onSaveCropFocus,
}) => {
  const [focus, setFocus] = useState<'center' | 'left' | 'right'>(currentCropFocus);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setFocus(currentCropFocus);
  }, [currentCropFocus]);

  // Render 1:1 preview onto canvas
  useEffect(() => {
    if (!isOpen || !thumbnailUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = thumbnailUrl;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = 320;
      canvas.width = size;
      canvas.height = size;

      // Crop calculation
      const minDim = Math.min(img.width, img.height);
      let sx = 0;
      let sy = 0;

      if (img.width > img.height) {
        if (focus === 'center') {
          sx = (img.width - minDim) / 2;
        } else if (focus === 'left') {
          sx = 0;
        } else if (focus === 'right') {
          sx = img.width - minDim;
        }
        sy = 0;
      } else {
        sx = 0;
        sy = (img.height - minDim) / 2;
      }

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
    };
  }, [isOpen, thumbnailUrl, focus]);

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
                Transforms 16:9 widescreen thumbnails into professional 1:1 square cover art
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
        <div className="p-5 space-y-5">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original 16:9 Thumbnail */}
            <div className="bg-[#181d29] p-3 rounded-lg border border-[#262f42] flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Original 16:9 Thumbnail
                </span>
                <span className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  Widescreen Video
                </span>
              </div>
              <div className="relative aspect-video rounded-md overflow-hidden bg-black/60 border border-slate-700/40 flex items-center justify-center">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt="Original thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-slate-500">No thumbnail available</span>
                )}
                {/* Crop overlay box to visualize */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[56.25%] h-full border-2 border-dashed border-rose-500/80 bg-rose-500/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded">
                      1:1 Square Area
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Standard video thumbnails contain wide margins that produce ugly black borders in music players.
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
                  <Sparkles className="w-2.5 h-2.5" /> Ready for Tags
                </span>
              </div>

              <div className="flex items-center justify-center py-1">
                <div className="relative w-44 h-44 rounded-md overflow-hidden bg-black shadow-lg border-2 border-rose-500/50">
                  <canvas ref={canvasRef} className="w-full h-full object-cover" />
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

          {/* Crop Alignment Selector */}
          <div className="bg-[#161b26] p-3.5 rounded-lg border border-[#232938] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                Square Cropping Focal Alignment
              </label>
              <span className="text-[11px] text-slate-400">Centered (Standard) recommended</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFocus('left')}
                className={`py-2 px-3 rounded-md text-xs font-medium border transition text-center ${
                  focus === 'left'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                    : 'bg-[#1f2535] text-slate-300 border-slate-700 hover:bg-[#283044]'
                }`}
              >
                Left Focus
              </button>
              <button
                type="button"
                onClick={() => setFocus('center')}
                className={`py-2 px-3 rounded-md text-xs font-medium border transition text-center ${
                  focus === 'center'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                    : 'bg-[#1f2535] text-slate-300 border-slate-700 hover:bg-[#283044]'
                }`}
              >
                Center Focus (Default)
              </button>
              <button
                type="button"
                onClick={() => setFocus('right')}
                className={`py-2 px-3 rounded-md text-xs font-medium border transition text-center ${
                  focus === 'right'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                    : 'bg-[#1f2535] text-slate-300 border-slate-700 hover:bg-[#283044]'
                }`}
              >
                Right Focus
              </button>
            </div>

            {/* Technical explanation pill */}
            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800 font-mono">
              <span className="text-slate-500">FFmpeg post-processor:</span>{' '}
              <span className="text-sky-300">
                {focus === 'left'
                  ? '--ppa "ThumbnailsConvertor+ffmpeg_o:-vf crop=\\"\'min(iw,ih)\':\'min(iw,ih)\':0:0\\""'
                  : focus === 'right'
                  ? '--ppa "ThumbnailsConvertor+ffmpeg_o:-vf crop=\\"\'min(iw,ih)\':\'min(iw,ih)\':(in_w-out_w):0\\""'
                  : '--ppa "ThumbnailsConvertor+ffmpeg_o:-vf crop=\\"\'min(iw,ih)\':\'min(iw,ih)\'\\""'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#171c2a] border-t border-[#262e40] flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Automatically embedded into MP3/FLAC/M4A ID3 metadata
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSaveCropFocus(focus);
                onClose();
              }}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white transition flex items-center space-x-1.5 shadow"
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
