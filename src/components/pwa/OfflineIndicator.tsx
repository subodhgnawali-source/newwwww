import React from 'react';
import { useOnlineStatus } from '../../hooks/usePWAInstall';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/80 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-amber-200 shadow-xl">
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      <span>Offline Mode — All changes stay safe in IndexedDB</span>
    </div>
  );
};
