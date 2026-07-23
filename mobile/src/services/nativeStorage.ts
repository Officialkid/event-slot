const memoryStore = new Map<string, unknown>();

export type NativeStorageDriver = "memory" | "secure-native";

export const activeNativeStorageDriver: NativeStorageDriver = "memory";

export async function loadNativeStorageValue<TValue>(key: string): Promise<TValue | null> {
  if (!memoryStore.has(key)) {
    return null;
  }

  return cloneValue(memoryStore.get(key) as TValue);
}

export async function saveNativeStorageValue<TValue>(key: string, value: TValue): Promise<void> {
  memoryStore.set(key, cloneValue(value));
}

export async function removeNativeStorageValue(key: string): Promise<void> {
  memoryStore.delete(key);
}

export function getNativeStorageReadinessMessage(): string {
  return "Native storage uses one shared adapter now, but the active driver is memory-only until SecureStore or AsyncStorage is installed and reviewed.";
}

function cloneValue<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue;
}
