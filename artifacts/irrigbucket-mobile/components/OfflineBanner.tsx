import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

const BANNER_HEIGHT = 38;

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: isOnline ? 0 : BANNER_HEIGHT,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: isOnline ? 0 : 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isOnline]);

  const topOffset = Platform.OS === 'web' ? 0 : insets.top;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          top: topOffset,
          backgroundColor: colors.accent,
          height: heightAnim,
          opacity: opacityAnim,
          pointerEvents: 'none',
        },
      ]}
    >
      <View style={styles.inner}>
        <Feather name="wifi-off" size={13} color={colors.accentForeground} />
        <Text style={[styles.text, { color: colors.accentForeground }]}>
          No connection — working offline
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
