import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SyncStatus } from '@workspace/sync';

import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { getStatus, subscribeStatus } from '@/lib/sync/syncEngine';

function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => getStatus());
  useEffect(() => subscribeStatus(setStatus), []);
  return status;
}

function syncSummary(status: SyncStatus): { icon: keyof typeof Feather.glyphMap; text: string } {
  if (status.state === 'offline') {
    return {
      icon: 'wifi-off',
      text:
        status.pending > 0
          ? `Offline — ${status.pending} waiting to sync`
          : 'Offline — changes sync when reconnected',
    };
  }
  if (status.state === 'error') {
    return { icon: 'alert-triangle', text: 'Sync error — will retry automatically' };
  }
  if (status.state === 'syncing') {
    return { icon: 'refresh-cw', text: `Syncing${status.pending > 0 ? ` — ${status.pending} left` : '…'}` };
  }
  if (status.pending > 0) {
    return { icon: 'upload-cloud', text: `${status.pending} waiting to sync` };
  }
  return { icon: 'check-circle', text: 'All reports backed up' };
}

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { status, user, busy, error, signIn, signOut, deleteAccount, clearError } =
    useAuth();
  const sync = useSyncStatus();

  const topPad = Platform.OS === 'web' ? 24 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteAccount();
      router.back();
    } catch {
      // Error is surfaced via the auth context's `error`; keep the panel open.
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password || busy) return;
    try {
      await signIn(email, password);
      setPassword('');
    } catch {
      // Error is surfaced via the auth context's `error`.
    }
  };

  const summary = syncSummary(sync);
  const canSubmit = !!email.trim() && !!password && !busy;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.muted }]}
          activeOpacity={0.7}
          testID="account-back"
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Account</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {status === 'loading' ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : status === 'signedIn' ? (
            <View>
              <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '18' }]}>
                  <Feather name="user" size={26} color={colors.primary} />
                </View>
                {!!(user?.firstName || user?.lastName) && (
                  <Text style={[styles.name, { color: colors.foreground }]}>
                    {[user?.firstName, user?.lastName].filter(Boolean).join(' ')}
                  </Text>
                )}
                <Text style={[styles.email, { color: colors.mutedForeground }]}>
                  {user?.email ?? 'Signed in'}
                </Text>
              </View>

              <View style={[styles.syncRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name={summary.icon} size={16} color={colors.mutedForeground} />
                <Text style={[styles.syncText, { color: colors.foreground }]}>{summary.text}</Text>
              </View>

              <TouchableOpacity
                onPress={() => void signOut()}
                disabled={busy}
                activeOpacity={0.8}
                testID="sign-out-button"
                style={[
                  styles.signOutBtn,
                  { borderColor: colors.destructive, opacity: busy ? 0.6 : 1 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.destructive} />
                ) : (
                  <>
                    <Feather name="log-out" size={18} color={colors.destructive} />
                    <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
                  </>
                )}
              </TouchableOpacity>

              {confirmingDelete ? (
                <View
                  style={[
                    styles.deleteConfirm,
                    { borderColor: colors.destructive, backgroundColor: colors.destructive + '0d' },
                  ]}
                >
                  <Text style={[styles.deleteTitle, { color: colors.foreground }]}>
                    Delete your account?
                  </Text>
                  <Text style={[styles.deleteBody, { color: colors.mutedForeground }]}>
                    This permanently deletes your account and all your saved reports from our servers
                    and this device. This can{'\u2019'}t be undone.
                  </Text>
                  {!!error && (
                    <View
                      style={[
                        styles.errorBox,
                        { backgroundColor: colors.destructive + '12', marginTop: 12, marginBottom: 0 },
                      ]}
                    >
                      <Feather name="alert-circle" size={15} color={colors.destructive} />
                      <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => void handleDelete()}
                    disabled={busy}
                    activeOpacity={0.8}
                    testID="confirm-delete-account"
                    style={[
                      styles.deleteConfirmBtn,
                      { backgroundColor: colors.destructive, opacity: busy ? 0.6 : 1 },
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.destructiveForeground} />
                    ) : (
                      <Text style={[styles.deleteConfirmText, { color: colors.destructiveForeground }]}>
                        Permanently delete
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setConfirmingDelete(false);
                      if (error) clearError();
                    }}
                    disabled={busy}
                    activeOpacity={0.7}
                    testID="cancel-delete-account"
                    style={styles.deleteCancelBtn}
                  >
                    <Text style={[styles.deleteCancelText, { color: colors.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setConfirmingDelete(true)}
                  disabled={busy}
                  activeOpacity={0.7}
                  testID="delete-account-button"
                  style={styles.deleteLink}
                >
                  <Text style={[styles.deleteLinkText, { color: colors.mutedForeground }]}>
                    Delete account
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View>
              <View style={styles.introBlock}>
                <View style={[styles.introIcon, { backgroundColor: colors.primary + '18' }]}>
                  <Feather name="cloud" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.introTitle, { color: colors.foreground }]}>Sign in to sync</Text>
                <Text style={[styles.introSub, { color: colors.mutedForeground }]}>
                  Back up your reports and access them on any device. You can keep using the app
                  offline without an account.
                </Text>
              </View>

              <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) clearError();
                }}
                placeholder="you@farm.co.nz"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!busy}
                testID="email-input"
                style={[
                  styles.input,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                ]}
              />

              <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) clearError();
                }}
                placeholder="Your password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!busy}
                testID="password-input"
                onSubmitEditing={() => void handleSignIn()}
                style={[
                  styles.input,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                ]}
              />

              {!!error && (
                <View style={[styles.errorBox, { backgroundColor: colors.destructive + '12' }]}>
                  <Feather name="alert-circle" size={15} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => void handleSignIn()}
                disabled={!canSubmit}
                activeOpacity={0.8}
                testID="submit-sign-in"
                style={[
                  styles.submitBtn,
                  { backgroundColor: canSubmit ? colors.primary : colors.muted, opacity: canSubmit ? 1 : 0.7 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.submitText,
                      { color: canSubmit ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    Sign in
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', letterSpacing: -0.3 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 24 },
  loading: { paddingTop: 80, alignItems: 'center' },

  profileCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  name: { fontSize: 18, fontFamily: 'Outfit_700Bold', marginBottom: 2, letterSpacing: -0.2 },
  email: { fontSize: 14, fontFamily: 'Inter_400Regular' },

  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  syncText: { fontSize: 14, fontFamily: 'Inter_500Medium', flexShrink: 1 },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  signOutText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.2 },

  deleteLink: { alignItems: 'center', justifyContent: 'center', height: 44, marginTop: 12 },
  deleteLinkText: { fontSize: 14, fontFamily: 'Inter_500Medium', letterSpacing: -0.1 },
  deleteConfirm: { marginTop: 16, borderWidth: 1.5, borderRadius: 16, padding: 18 },
  deleteTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', marginBottom: 6, letterSpacing: -0.2 },
  deleteBody: { fontSize: 13.5, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  deleteConfirmBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  deleteConfirmText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.2 },
  deleteCancelBtn: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  deleteCancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.2 },

  introBlock: { alignItems: 'center', marginBottom: 28 },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: { fontSize: 22, fontFamily: 'Outfit_700Bold', marginBottom: 8, letterSpacing: -0.3 },
  introSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },

  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8, marginTop: 4 },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', flexShrink: 1 },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.2 },
});
