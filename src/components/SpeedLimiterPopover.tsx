import React, { useState, useEffect, useRef } from 'react';
import { Gauge, X, Zap, ArrowDown, Check } from 'lucide-react';

interface SpeedLimiterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  limitRate?: string;
  onSetLimitRate: (rate: string) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

interface SpeedPreset {
  label: string;
  value: string; // yt-dlp format e.g. '500K', '1M', '2M', ''
}

const PRESETS: SpeedPreset[] = [
  { label: 'Unlimited', value: '' },
  { label: '500 KB/s', value: '500K' },
  { label: '1 MB/s', value: '1M' },
  { label: '2 MB/s', value: '2M' },
  { label: '5 MB/s', value: '5M' },
  { label: '10 MB/s', value: '10M' },
  { label: '25 MB/s', value: '25M' },
];

export const SpeedLimiterPopover: React.FC<SpeedLimiterPopoverProps> = ({
  isOpen,
  onClose,
  limitRate = '',
  onSetLimitRate,
  triggerRef,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Normalize current limit rate
  const activeRate = (limitRate || '').trim();
  const isLimited = Boolean(activeRate && activeRate.toLowerCase() !== 'unlimited' && activeRate !== '0');

  // Custom rate input state
  const [customValue, setCustomValue] = useState<string>(() => {
    if (!isLimited) return '5';
    const num = activeRate.replace(/[^0-9.]/g, '');
    return num || '5';
  });

  const [customUnit, setCustomUnit] = useState<'M' | 'K'>(() => {
    if (activeRate.toUpperCase().endsWith('K')) return 'K';
    return 'M';
  });

  // Sync state if external limitRate changes
  useEffect(() => {
    if (isLimited) {
      const num = activeRate.replace(/[^0-9.]/g, '');
      if (num) setCustomValue(num);
      setCustomUnit(activeRate.toUpperCase().endsWith('K') ? 'K' : 'M');
    }
  }, [activeRate, isLimited]);

  // Click outside listener to dismiss
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        (!triggerRef?.current || !triggerRef.current.contains(target))
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(customValue);
    if (!val || val <= 0) {
      onSetLimitRate('');
    } else {
      onSetLimitRate(`${val}${customUnit}`);
    }
  };

  const formatActiveLabel = () => {
    if (!isLimited) return 'Uncapped (Full Speed)';
    const match = PRESETS.find(p => p.value.toUpperCase() === activeRate.toUpperCase());
    if (match) return match.label;
    return `${activeRate}B/s`;
  };

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 w-72 bg-[#131824]/95 backdrop-blur-md border border-[#263044] rounded-xl shadow-2xl p-3.5 text-xs text-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-150 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/25">
            <Gauge className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white leading-none">
              Download Speed Limiter
            </h4>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
              {formatActiveLabel()}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
          title="Close (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Presets Grid */}
      <div className="space-y-1.5 mb-3">
        <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block px-0.5">
          Speed Presets
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {PRESETS.map((preset) => {
            const isSelected = (!isLimited && preset.value === '') ||
              (isLimited && activeRate.toUpperCase() === preset.value.toUpperCase());

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onSetLimitRate(preset.value)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer border ${
                  isSelected
                    ? preset.value === ''
                      ? 'bg-emerald-600/90 text-white border-emerald-400 shadow-sm'
                      : 'bg-sky-600/90 text-white border-sky-400 shadow-sm'
                    : 'bg-[#181f2f] hover:bg-[#20293d] text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {preset.value === '' ? (
                  <Zap className="w-3 h-3 text-emerald-300 shrink-0" />
                ) : null}
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Speed Form */}
      <form onSubmit={handleApplyCustom} className="space-y-1.5 pt-2 border-t border-slate-800/80">
        <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block px-0.5">
          Custom Cap
        </span>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="number"
              step="any"
              min="0.1"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="e.g. 5"
              className="w-full bg-[#0b0e14] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          <select
            value={customUnit}
            onChange={(e) => setCustomUnit(e.target.value as 'M' | 'K')}
            className="bg-[#0b0e14] border border-slate-700/80 text-xs text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-sky-500 font-medium cursor-pointer"
          >
            <option value="M">MB/s</option>
            <option value="K">KB/s</option>
          </select>

          <button
            type="submit"
            className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer"
          >
            Apply
          </button>
        </div>
      </form>

      {/* Helper Note */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-start gap-1.5 text-[10px] text-slate-400">
        <ArrowDown className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
        <span>
          Throttles yt-dlp native socket rate per download task to prevent network saturation.
        </span>
      </div>
    </div>
  );
};
