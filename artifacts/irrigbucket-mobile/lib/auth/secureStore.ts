import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Tiny key/value wrapper for persisting the server session id (sid).
 *
 * On native we use the OS keychain/keystore via expo-secure-store. On web (the
 * Expo preview / react-native-web) SecureStore is unavailable, so we fall back
 * to AsyncStorage (localStorage). The only value stored is the opaque server
 * session id — a short hex string, well within SecureStore's size limits.
 */
const useSecure = Platform.OS !== 'web';

export async function getSecureItem(key: string): Promise<string | null> {
  if (!useSecure) return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (!useSecure) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (!useSecure) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
