import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, CloudOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeSyncStatus } from '@/lib/syncEngine';

const BANNER_VAR = '--offline-banner-h';

function setBannerOffset(px: number) {
  document.documentElement.style.setProperty(BANNER_VAR, `${Math.max(0, px)}px`);
}

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);
  const [syncErrored, setSyncErrored] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  const showOffline = !isOnline;
  const showSyncError = isOnline && syncErrored;
  const showBackOnline = isOnline && showOnlineBanner && !syncErrored;
  const visible = showOffline || showSyncError || showBackOnline;

  useEffect(() => {
    return subscribeSyncStatus((status) => {
      setSyncErrored(status.state === 'error' && status.pending > 0);
    });
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineBanner(true);
      setTimeout(() => setShowOnlineBanner(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineBanner(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useLayoutEffect(() => {
    const el = bannerRef.current;
    if (!visible || !el) {
      setBannerOffset(0);
      return;
    }
    const apply = () => setBannerOffset(el.getBoundingClientRect().height);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setBannerOffset(0);
    };
  }, [visible, showOffline, showSyncError, showBackOnline]);

  let icon = <CloudOff className="w-4 h-4 flex-shrink-0" />;
  let message = 'Sync unavailable — data saved locally. We\'ll retry automatically.';
  let tone = 'bg-amber-500 text-white';
  if (showOffline) {
    icon = <WifiOff className="w-4 h-4 flex-shrink-0" />;
    message = 'No internet — your data is saved on this device';
  } else if (showBackOnline) {
    icon = <Wifi className="w-4 h-4 flex-shrink-0" />;
    message = 'Back online';
    tone = 'bg-primary text-white';
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="sync-banner"
          ref={bannerRef}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 ${tone} text-sm font-medium py-2 px-4 shadow-md pointer-events-none`}
        >
          {icon}
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
