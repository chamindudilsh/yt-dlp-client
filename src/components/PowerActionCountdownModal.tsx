import React, { useEffect, useState, useRef } from 'react';
import { Moon, Power, LogOut, Disc, AlertTriangle, X, Clock, Play } from 'lucide-react';
import { PostDownloadAction } from '../types';

interface PowerActionCountdownModalProps {
  isOpen: boolean;
  action: PostDownloadAction;
  graceSeconds?: number;
  onExecute: () => void;
  onCancel: () => void;
}

export const PowerActionCountdownModal: React.FC<PowerActionCountdownModalProps> = ({
  isOpen,
  action,
  graceSeconds = 60,
  onExecute,
  onCancel,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(graceSeconds);
  const initialSecondsRef = useRef(graceSeconds);
  const chimePlayedRef = useRef(false);

  // Play subtle warning notification chime
  const playAlertChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      setSecondsRemaining(graceSeconds);
      initialSecondsRef.current = graceSeconds;
      if (!chimePlayedRef.current) {
        playAlertChime();
        chimePlayedRef.current = true;
      }
    } else {
      chimePlayedRef.current = false;
    }
  }, [isOpen, graceSeconds]);

  useEffect(() => {
    if (!isOpen || action === 'none') return;

    if (secondsRemaining <= 0) {
      onExecute();
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onExecute();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, action, secondsRemaining, onExecute]);

  if (!isOpen || action === 'none') return null;

  const total = initialSecondsRef.current || 60;
  const progressPct = Math.max(0, Math.min(100, ((total - secondsRemaining) / total) * 100));

  const getActionDetails = () => {
    switch (action) {
      case 'sleep':
        return {
          title: 'Putting PC to Sleep',
          badge: 'Sleep Mode',
          badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
          icon: <Moon className="w-8 h-8 text-indigo-400 animate-pulse" />,
          accentBg: 'bg-indigo-500',
          accentText: 'text-indigo-400',
          btnExecute: 'Sleep Now',
          description: 'All downloads have completed. Your system will enter sleep mode to conserve energy.',
        };
      case 'hibernate':
        return {
          title: 'Hibernating System',
          badge: 'Hibernate',
          badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          icon: <Disc className="w-8 h-8 text-amber-400 animate-pulse" />,
          accentBg: 'bg-amber-500',
          accentText: 'text-amber-400',
          btnExecute: 'Hibernate Now',
          description: 'All downloads have completed. Open applications and memory will be saved before power down.',
        };
      case 'shutdown':
        return {
          title: 'Shutting Down PC',
          badge: 'Power Off',
          badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          icon: <Power className="w-8 h-8 text-rose-400 animate-pulse" />,
          accentBg: 'bg-rose-500',
          accentText: 'text-rose-400',
          btnExecute: 'Shut Down Now',
          description: 'All downloads have completed. Windows will power off completely.',
        };
      case 'close_app':
        return {
          title: 'Closing Application',
          badge: 'Exit Client',
          badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          icon: <LogOut className="w-8 h-8 text-sky-400 animate-pulse" />,
          accentBg: 'bg-sky-500',
          accentText: 'text-sky-400',
          btnExecute: 'Exit Now',
          description: 'All downloads have completed. yt-dlp client will gracefully terminate.',
        };
      default:
        return {
          title: 'Automated Power Action',
          badge: 'Automated',
          badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          icon: <AlertTriangle className="w-8 h-8 text-slate-400" />,
          accentBg: 'bg-slate-500',
          accentText: 'text-slate-400',
          btnExecute: 'Execute Now',
          description: 'All queue tasks finished.',
        };
    }
  };

  const details = getActionDetails();

  const handleAddMinute = () => {
    setSecondsRemaining(prev => {
      const next = prev + 60;
      initialSecondsRef.current = Math.max(initialSecondsRef.current, next);
      return next;
    });
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f141f] border border-slate-700/80 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
        {/* Top Progress bar showing countdown progress */}
        <div className="w-full bg-slate-800 h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${details.accentBg}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="p-6 text-center">
          {/* Action Icon Header */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-4 shadow-inner">
            {details.icon}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-2 uppercase tracking-wide">
            <span className={details.badgeColor}>{details.badge}</span>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            {details.title}
          </h2>

          <p className="text-xs text-slate-300 mb-6 leading-relaxed px-2">
            {details.description}
          </p>

          {/* Large Countdown Display */}
          <div className="bg-[#0b0e14] border border-slate-800 rounded-xl py-4 px-6 mb-6 inline-flex flex-col items-center min-w-[200px]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
              Time Remaining
            </span>
            <span className="text-4xl font-extrabold font-mono text-white tracking-widest">
              {formatTimer(secondsRemaining)}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              Click Cancel to stay on your PC
            </span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-sm transition-all shadow-lg hover:shadow-slate-800/50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Cancel & Keep Working</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleAddMinute}
                className="py-2 px-3 rounded-lg bg-[#141925] hover:bg-[#1a2131] border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>+1 Minute</span>
              </button>

              <button
                type="button"
                onClick={onExecute}
                className={`py-2 px-3 rounded-lg border border-transparent text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  action === 'shutdown'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-sky-600 hover:bg-sky-500'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{details.btnExecute}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
