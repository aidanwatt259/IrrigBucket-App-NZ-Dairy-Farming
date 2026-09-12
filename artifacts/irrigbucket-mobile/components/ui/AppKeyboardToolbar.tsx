import React from 'react';
import { KeyboardToolbar } from 'react-native-keyboard-controller';

import colors from '@/constants/colors';

// A single brand-matching theme for the iOS keyboard accessory bar (the row of
// prev/next arrows + "Done" shown above the keyboard). The app renders
// light-only, so we intentionally use the same palette for both light and dark
// device appearances so the bar always matches the rest of the UI.
const toolbarTheme = {
  primary: colors.light.primary,
  disabled: colors.light.border,
  background: colors.light.card,
  ripple: colors.light.muted,
};

/**
 * Themed wrapper around `KeyboardToolbar`. Renders a clean white bar with
 * brand-green prev/next arrows and a "Done" action, replacing the library's
 * default grey styling. No-op on web (only relevant to on-screen keyboards).
 */
export function AppKeyboardToolbar() {
  return (
    <KeyboardToolbar
      theme={{ light: toolbarTheme, dark: toolbarTheme }}
      opacity="ff"
    />
  );
}
