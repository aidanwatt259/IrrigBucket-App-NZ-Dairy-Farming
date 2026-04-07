import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isConnected: true,
  });

  const applyState = (state: NetInfoState) => {
    const connected = state.isConnected ?? true;
    const reachable = state.isInternetReachable ?? connected;
    setStatus({ isConnected: connected, isOnline: connected && reachable });
  };

  useEffect(() => {
    NetInfo.fetch().then(applyState);
    const unsubscribe = NetInfo.addEventListener(applyState);
    return unsubscribe;
  }, []);

  return status;
}
