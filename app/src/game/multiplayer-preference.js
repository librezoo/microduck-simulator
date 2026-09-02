// Public multiplayer is optional and disabled on a fresh install. Keep the
// decision local to this browser / WKWebView data store: it is consent state,
// not an account setting, and must never require a network round trip.
export const MULTIPLAYER_STORAGE_KEY = "microduck.public-multiplayer";

export function readMultiplayerPreference(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    return target?.getItem(MULTIPLAYER_STORAGE_KEY) === "on";
  } catch {
    // Private browsing policies and hardened WebViews may deny storage.
    // Privacy-preserving failure mode: stay offline.
    return false;
  }
}

export function writeMultiplayerPreference(enabled, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    target?.setItem(MULTIPLAYER_STORAGE_KEY, enabled ? "on" : "off");
    return true;
  } catch {
    return false;
  }
}
