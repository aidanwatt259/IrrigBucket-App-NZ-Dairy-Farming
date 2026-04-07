import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsOnline(state.isConnected ?? true);
    });

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  return { isOnline };
}
