import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);

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

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          key="offline"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-2 px-4 shadow-md"
        >
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>No internet — your data is saved on this device</span>
        </motion.div>
      )}
      {showOnlineBanner && (
        <motion.div
          key="online"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium py-2 px-4 shadow-md"
        >
          <Wifi className="w-4 h-4 flex-shrink-0" />
          <span>Back online</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
