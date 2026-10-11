import { useEffect, useSyncExternalStore } from "react";

const supported = typeof matchMedia === "function";

function useMedia(query, fallback = false) {
  return useSyncExternalStore(
    (listener) => {
      if (!supported) return () => {};
      const list = matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    () => (supported ? matchMedia(query).matches : fallback),
    () => fallback,
  );
}

export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");
export const useCoarsePointer = () => useMedia("(pointer: coarse)");

// desktop: floating panels over a full-bleed stage; mobile: stage on top with
// a bottom sheet; landscape: a phone on its side, stage and sheet side by side.
export function useLayoutMode() {
  const wide = useMedia("(min-width: 900px)", true);
  const short = useMedia("(max-height: 520px) and (orientation: landscape)");
  if (wide) return "desktop";
  return short ? "landscape" : "mobile";
}

// Calls handler when a pointer goes down outside the element, or Escape is pressed.
export function useDismiss(ref, active, onDismiss) {
  useEffect(() => {
    if (!active) return undefined;
    const down = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onDismiss();
    };
    const key = (event) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [ref, active, onDismiss]);
}
