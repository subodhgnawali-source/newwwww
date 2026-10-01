import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Share2, X } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#7CC8FF] to-[#3B82F6] font-medium text-slate-950 shadow-sm hover:brightness-110 active:scale-95 transition-all ${
          compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'
        }`}
        title="Install FrostArc as a standalone App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-lg border border-[rgba(160,210,255,0.2)] bg-white/5 font-medium text-[#7CC8FF] hover:bg-white/10 active:scale-95 transition-all ${
            compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
          }`}
          title="Install on iPhone / iPad"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-[#0E1626] border border-[#7CC8FF]/30 p-6 shadow-2xl text-[#EAF4FF]">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-base font-semibold">Install FrostArc on iOS</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[#8FA3BF]">
                <p className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#7CC8FF]/20 text-[#7CC8FF] text-xs font-bold flex items-center justify-center">1</span>
                  <span>Tap the <strong className="text-white">Share</strong> button in Safari's bottom toolbar.</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#7CC8FF]/20 text-[#7CC8FF] text-xs font-bold flex items-center justify-center">2</span>
                  <span>Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#7CC8FF]/20 text-[#7CC8FF] text-xs font-bold flex items-center justify-center">3</span>
                  <span>Open FrostArc from your home screen for full standalone experience.</span>
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-white/10 py-2.5 text-xs font-semibold text-white hover:bg-white/15 active:scale-98 transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
