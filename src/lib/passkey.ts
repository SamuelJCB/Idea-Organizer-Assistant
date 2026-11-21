import { useSyncExternalStore } from "react";

/** How many devices can be saved for Touch ID / Face ID login. */
export const MAX_DEVICES = 3;

const SAVED_KEY = "nova-device-saved";
const noSubscribe = () => () => {};

/** Whether this device was saved. Storage can be unavailable, e.g. in a private window. */
export function isDeviceSaved() {
  try {
    return localStorage.getItem(SAVED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDeviceSaved() {
  try {
    localStorage.setItem(SAVED_KEY, "1");
  } catch {
    // Touch ID still works; this device just won't prompt automatically.
  }
}

/** False during server rendering, then whether this browser supports passkeys. */
export function usePasskeySupport() {
  return useSyncExternalStore(
    noSubscribe,
    () => typeof window.PublicKeyCredential === "function",
    () => false,
  );
}

/** True during server rendering (so nothing flashes), then whether this device is saved. */
export function useDeviceSaved() {
  return useSyncExternalStore(noSubscribe, isDeviceSaved, () => true);
}
