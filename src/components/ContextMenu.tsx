import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  id?: string;
  label?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Position adjustments to prevent overflowing window bounds
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pad = 8;
    let adjustedX = x;
    let adjustedY = y;

    if (adjustedX + rect.width > window.innerWidth - pad) {
      adjustedX = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (adjustedY + rect.height > window.innerHeight - pad) {
      adjustedY = Math.max(pad, window.innerHeight - rect.height - pad);
    }

    el.style.left = `${adjustedX}px`;
    el.style.top = `${adjustedY}px`;
  }, [x, y]);

  // Dismiss on outside click, scroll, blur, or Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => onClose();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{ left: `${x}px`, top: `${y}px` }}
      className="fixed z-50 min-w-[180px] bg-[#121622]/95 backdrop-blur-md border border-[#2b354b] rounded-xl shadow-2xl p-1 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return <div key={`sep-${idx}`} className="h-px bg-slate-800/80 my-1 mx-1.5" />;
        }

        return (
          <button
            key={item.id || idx}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              onClose();
              const callback = item.action || item.onClick;
              callback?.();
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              item.danger
                ? 'text-rose-400 hover:bg-rose-950/50 hover:text-rose-200'
                : 'text-slate-200 hover:bg-[#20293d] hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2 truncate">
              {item.icon && <span className="w-3.5 h-3.5 shrink-0 opacity-80">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </div>

            {item.shortcut && (
              <span className="text-[10px] font-mono text-slate-500 ml-3 shrink-0">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
