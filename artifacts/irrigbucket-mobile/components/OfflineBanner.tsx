import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getStatus, subscribeStatus } from '@/lib/sync/syncEngine';

const BANNER_HEIGHT = 38;

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const [pending, setPending] = useState(() => getStatus().pending);

  useEffect(() => {
    setPending(getStatus().pending);
    return subscribeStatus((status) => setPending(status.pending));
  }, []);

  // Offline takes priority; otherwise surface unsynced work saved locally.
  const visible = !isOnline || pending > 0;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: visible ? BANNER_HEIGHT : 0,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [visible]);

  const topOffset = Platform.OS === 'web' ? 0 : insets.top;

  const background = !isOnline ? colors.accent : colors.primary;
  const foreground = !isOnline ? colors.accentForeground : colors.primaryForeground;
  const icon = !isOnline ? 'wifi-off' : 'upload-cloud';
  const message = !isOnline
    ? `No connection — working offline${pending > 0 ? ` · ${pending} pending` : ''}`
    : `${pending} ${pending === 1 ? 'report' : 'reports'} saved locally`;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          top: topOffset,
          backgroundColor: background,
          height: heightAnim,
          opacity: opacityAnim,
          pointerEvents: 'none',
        },
      ]}
    >
      <View style={styles.inner}>
        <Feather name={icon} size={13} color={foreground} />
        <Text style={[styles.text, { color: foreground }]}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    overflow: 'hidden',
  },
  inner: {
    height: BANNER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.1,
  },
});
