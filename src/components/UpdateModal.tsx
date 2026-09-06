import React, { useState } from 'react';
import { 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Sparkles, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { UpdateInfo } from '../types';
import { api } from '../lib/apiBridge';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  currentVersion,
}) => {
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [autoCheck, setAutoCheck] = useState(true);

  if (!isOpen) return null;

  const handleCheckUpdate = async () => {
    setLoading(true);
    setUpdateSuccess(false);
    try {
      const data = await api.checkUpdate();
      setUpdateInfo(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunUpdate = async () => {
    setUpdating(true);
    try {
      const data = await api.updateEngine();
      if (data.success) {
        setUpdateSuccess(true);
        if (updateInfo) {
          setUpdateInfo({
            ...updateInfo,
            currentVersion: data.version || updateInfo.latestVersion,
            hasUpdate: false,
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div 
        id="update-modal"
        className="bg-[#121620] border border-[#262e40] rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#171c2a] border-b border-[#262e40] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">yt-dlp Engine Update Manager</h3>
              <p className="text-[11px] text-slate-400">
                Keep extractors updated to maintain compatibility with site changes
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
          {/* Version Status Box */}
          <div className="bg-[#181d29] p-4 rounded-lg border border-[#262f42] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-400">Current Core Engine:</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  yt-dlp {updateInfo?.currentVersion || currentVersion}
                </p>
              </div>

              {updateInfo?.hasUpdate ? (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  New Version Available
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Up to Date
                </span>
              )}
            </div>

            {updateInfo && (
              <div className="pt-3 border-t border-slate-700/50 flex items-center justify-between text-slate-300">
                <span>Latest GitHub Release:</span>
                <span className="font-mono text-sky-400 font-semibold">{updateInfo.latestVersion}</span>
              </div>
            )}
          </div>

          {/* Success Message */}
          {updateSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 text-emerald-300 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Engine updated successfully!</p>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  Core binary updated to the latest build with all recent YouTube signature and extractor fixes.
                </p>
              </div>
            </div>
          )}

          {/* Release Notes Preview */}
          {updateInfo?.releaseNotes && (
            <div className="space-y-1.5">
              <span className="text-slate-400 font-medium">Changelog & Highlights:</span>
              <div className="bg-[#10131c] p-3 rounded border border-slate-800 text-[11px] text-slate-300 font-mono max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {updateInfo.releaseNotes.slice(0, 500)}
                {updateInfo.releaseNotes.length > 500 && '...'}
              </div>
            </div>
          )}

          {/* Auto-check toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCheck}
                onChange={e => setAutoCheck(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="text-slate-300">Auto-check for updates on application launch</span>
            </label>
            <span className="text-[10px] text-slate-500">Daily check recommended</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-[#171c2a] border-t border-[#262e40] flex items-center justify-between">
          <button
            onClick={handleCheckUpdate}
            disabled={loading || updating}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[#1e2433] hover:bg-[#283145] text-slate-200 border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            <span>{loading ? 'Checking...' : 'Check GitHub Releases'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Close
            </button>
            <button
              onClick={handleRunUpdate}
              disabled={updating || loading}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center space-x-1.5 shadow disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${updating ? 'animate-bounce' : ''}`} />
              <span>{updating ? 'Updating yt-dlp...' : 'Update yt-dlp Engine'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
