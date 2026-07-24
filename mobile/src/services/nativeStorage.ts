import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const memoryStore = new Map<string, string>();

export type NativeStorageDriver = "memory-fallback" | "async-storage" | "secure-store";

export type NativeStorageOptions = {
  sensitive?: boolean;
};

export const activeNativeStorageDriver: NativeStorageDriver = "secure-store";

let secureStoreAvailability: Promise<boolean> | null = null;

export async function loadNativeStorageValue<TValue>(key: string, options: NativeStorageOptions = {}): Promise<TValue | null> {
  const rawValue = await loadRawValue(key, options);
  if (!rawValue) return null;
  return parseValue<TValue>(rawValue);
}

export async function saveNativeStorageValue<TValue>(key: string, value: TValue, options: NativeStorageOptions = {}): Promise<void> {
  const rawValue = JSON.stringify(value);

  if (options.sensitive && await canUseSecureStore()) {
    await SecureStore.setItemAsync(key, rawValue);
    return;
  }

  if (!options.sensitive) {
    await AsyncStorage.setItem(key, rawValue);
    return;
  }

  memoryStore.set(key, rawValue);
}

export async function removeNativeStorageValue(key: string, options: NativeStorageOptions = {}): Promise<void> {
  memoryStore.delete(key);

  if (options.sensitive && await canUseSecureStore()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  if (!options.sensitive) {
    await AsyncStorage.removeItem(key);
  }
}

export function getNativeStorageReadinessMessage(): string {
  return "Native storage now uses SecureStore for session tokens and AsyncStorage for preferences/drafts, with memory fallback only when a native storage module is unavailable during preview.";
}

async function loadRawValue(key: string, options: NativeStorageOptions): Promise<string | null> {
  if (options.sensitive && await canUseSecureStore()) {
    const value = await SecureStore.getItemAsync(key);
    return value ?? memoryStore.get(key) ?? null;
  }

  if (!options.sensitive) {
    const value = await AsyncStorage.getItem(key);
    return value ?? memoryStore.get(key) ?? null;
  }

  return memoryStore.get(key) ?? null;
}

async function canUseSecureStore(): Promise<boolean> {
  secureStoreAvailability ??= SecureStore.isAvailableAsync().catch(() => false);
  return secureStoreAvailability;
}

function parseValue<TValue>(rawValue: string): TValue | null {
  try {
    return JSON.parse(rawValue) as TValue;
  } catch {
    return null;
  }
}
