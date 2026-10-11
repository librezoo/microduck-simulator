// Small colour helpers for the Studio UI. Pure, so they are tested in node.

const HEX6 = /^#[0-9a-f]{6}$/i;

// "#ff7a2f", "ff7a2f", "#f72", "F72" -> "#FF7A2F"; anything else -> null.
export function normalizeHex(input) {
  const raw = String(input ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${[...raw].map((c) => c + c).join("").toUpperCase()}`;
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}

export const isHex = (value) => typeof value === "string" && HEX6.test(value);

export function rgbOf(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// WCAG relative luminance of an sRGB hex colour.
export function luminance(hex) {
  const [r, g, b] = rgbOf(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Ink or cream, whichever reads better on the given fill.
export const readableOn = (hex) => (contrast(hex, "#0B0B10") >= contrast(hex, "#F6F2E8") ? "#0B0B10" : "#F6F2E8");
