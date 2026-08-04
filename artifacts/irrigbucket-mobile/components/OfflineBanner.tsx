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
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const [pending, setPending] = useState(() => getStatus().pending);
  const [syncErrored, setSyncErrored] = useState(() => getStatus().state === 'error');

  useEffect(() => {
    setPending(getStatus().pending);
    setSyncErrored(getStatus().state === 'error');
    return subscribeStatus((status) => {
      setPending(status.pending);
      setSyncErrored(status.state === 'error');
    });
  }, []);

  // Offline takes priority; otherwise surface unsynced work saved locally.
  const visible = !isOnline || pending > 0;
  const showSyncError = isOnline && syncErrored && pending > 0;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: visible ? BANNER_HEIGHT + bottomInset : 0,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [visible, bottomInset]);

  const background = !isOnline || showSyncError ? colors.accent : colors.primary;
  const foreground =
    !isOnline || showSyncError ? colors.accentForeground : colors.primaryForeground;
  const icon = !isOnline ? 'wifi-off' : showSyncError ? 'cloud-off' : 'upload-cloud';
  const message = !isOnline
    ? `No connection — working offline${pending > 0 ? ` · ${pending} pending` : ''}`
    : showSyncError
      ? 'Sync unavailable — data saved locally'
      : `${pending} ${pending === 1 ? 'report' : 'reports'} saved locally`;

  // Rendered in normal flow at the very bottom of the app shell so it never
  // covers the branded header (logo / account / reports); it grows/shrinks the
  // available content area instead of overlaying it.
  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          backgroundColor: background,
          height: heightAnim,
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.inner, { paddingBottom: bottomInset }]}>
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
    width: '100%',
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
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
