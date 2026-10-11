import { useCallback, useSyncExternalStore } from "react";
import { translate } from "./strings.js";

// English by default, 简体中文 by the toggle. Same contract as the LibreZoo
// sites: localStorage "lz-lang" ("en" | "zh") and <html lang> follow it.
export const LANG_KEY = "lz-lang";

function detect() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    // storage blocked: fall through to the browser language
  }
  return /^zh/i.test(globalThis.navigator?.language ?? "") ? "zh" : "en";
}

let current = detect();
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

function applyToDocument() {
  if (typeof document !== "undefined") document.documentElement.lang = current;
}
applyToDocument();

export const getLang = () => current;

export function setLang(next) {
  if (next !== "en" && next !== "zh") return;
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // the choice still holds for this page
  }
  applyToDocument();
  emit();
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

if (typeof window !== "undefined") {
  // another tab of the same site changed the language
  window.addEventListener("storage", (event) => {
    if (event.key === LANG_KEY && (event.newValue === "en" || event.newValue === "zh") && event.newValue !== current) {
      current = event.newValue;
      applyToDocument();
      emit();
    }
  });
}

export function useLang() {
  return useSyncExternalStore(subscribe, getLang, () => "en");
}

// t(key, ...params) in the current language; re-renders on a language change.
export function useT() {
  const lang = useLang();
  const t = useCallback((key, ...params) => translate(lang, key, ...params), [lang]);
  return { t, lang };
}

// A {en, zh} pair from the manifest or the registry.
export const pick = (pair, lang) => (pair ? pair[lang] ?? pair.en : "");
