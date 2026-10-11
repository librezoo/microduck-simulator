import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHex, contrast, luminance, readableOn } from "../src/customizer/color-utils.js";
import {
  colorsChanged, HISTORY_LIMIT, initialStudioState, randomColors, savedDesignColors, studioReducer,
} from "../src/customizer/studio-state.js";
import { duckLegacy, duckStudio } from "./helpers/duck-studio.js";

const studio = duckStudio();
const step = (state, action) => studioReducer(state, action, studio);

test("hex input: 3 and 6 digits, with or without #, any case", () => {
  assert.equal(normalizeHex("#ff7a2f"), "#FF7A2F");
  assert.equal(normalizeHex("ff7a2f"), "#FF7A2F");
  assert.equal(normalizeHex(" f72 "), "#FF7722");
  assert.equal(normalizeHex("#12345"), null);
  assert.equal(normalizeHex("zzzzzz"), null);
  assert.equal(normalizeHex(null), null);
});

test("readable text colour follows the fill", () => {
  assert.equal(readableOn("#FFFFFF"), "#0B0B10");
  assert.equal(readableOn("#0B0B10"), "#F6F2E8");
  assert.equal(readableOn("#FF7A2F"), "#0B0B10");
  assert.ok(contrast("#FFFFFF", "#000000") > 20.9);
  assert.ok(luminance("#000000") < luminance("#FFFFFF"));
});

test("a fresh state starts on the first part in the default colours", () => {
  const state = initialStudioState(studio);
  assert.equal(state.selectedId, "head");
  assert.deepEqual(state.colors, studio.defaultColors);
  assert.deepEqual(state.past, []);
  assert.equal(colorsChanged(studio, state.colors), false);
});

test("a saved design is restored, completed and cleaned", () => {
  const state = initialStudioState(studio, { head: "#abcdef", eye: "not-a-colour", ghost: "#000000" });
  assert.equal(state.colors.head, "#ABCDEF");
  assert.equal(state.colors.eye, studio.defaultColors.eye);
  assert.equal("ghost" in state.colors, false);
  assert.equal(Object.keys(state.colors).length, 32);
});

test("selecting changes only the selection, and only to a real part", () => {
  let state = initialStudioState(studio);
  state = step(state, { type: "select", id: "leftFoot" });
  assert.equal(state.selectedId, "leftFoot");
  assert.deepEqual(state.past, []);
  assert.equal(step(state, { type: "select", id: "nope" }), state);
});

test("colour edits apply to the selected part and normalise", () => {
  let state = initialStudioState(studio);
  state = step(state, { type: "select", id: "eye" });
  state = step(state, { type: "color", color: "#12ab34" });
  assert.equal(state.colors.eye, "#12AB34");
  assert.equal(state.colors.head, studio.defaultColors.head);
  // the same colour again is not an edit
  assert.equal(step(state, { type: "color", color: "#12AB34" }), state);
  // a malformed colour falls back to the part default, which is a change back
  const back = step(state, { type: "color", color: "red" });
  assert.equal(back.colors.eye, studio.defaultColors.eye);
});

test("dragging a picker over one part is one undo step; switching part starts a new one", () => {
  let state = initialStudioState(studio);
  for (const color of ["#111111", "#222222", "#333333"]) state = step(state, { type: "color", id: "head", color });
  assert.equal(state.past.length, 1);
  state = step(state, { type: "color", id: "eye", color: "#444444" });
  assert.equal(state.past.length, 2);
  state = step(state, { type: "undo" });
  assert.equal(state.colors.eye, studio.defaultColors.eye);
  assert.equal(state.colors.head, "#333333");
  state = step(state, { type: "undo" });
  assert.equal(state.colors.head, studio.defaultColors.head);
  assert.equal(step(state, { type: "undo" }), state, "nothing left to undo");
});

test("a colourway applies every part and can be undone", () => {
  const way = studio.colorways.find((w) => w.id === "graphite");
  let state = initialStudioState(studio);
  state = step(state, { type: "apply", colors: way.colors });
  assert.deepEqual(state.colors, way.colors);
  assert.equal(state.past.length, 1);
  assert.equal(step(state, { type: "apply", colors: way.colors }), state, "same colourway again is a no-op");
  state = step(state, { type: "undo" });
  assert.deepEqual(state.colors, studio.defaultColors);
});

test("reset part and reset all", () => {
  let state = initialStudioState(studio);
  state = step(state, { type: "color", id: "head", color: "#010203" });
  state = step(state, { type: "color", id: "eye", color: "#040506" });
  state = step(state, { type: "select", id: "head" });
  const fresh = initialStudioState(studio);
  assert.equal(step(fresh, { type: "resetPart" }), fresh, "nothing to reset on an untouched part");
  assert.equal(step(fresh, { type: "resetAll" }), fresh);
  const partReset = step(state, { type: "resetPart" });
  assert.equal(partReset.colors.head, studio.defaultColors.head);
  assert.equal(partReset.colors.eye, "#040506");
  const allReset = step(state, { type: "resetAll" });
  assert.deepEqual(allReset.colors, studio.defaultColors);
  assert.equal(colorsChanged(studio, allReset.colors), false);
  assert.deepEqual(step(allReset, { type: "undo" }).colors, state.colors);
});

test("history is bounded", () => {
  let state = initialStudioState(studio);
  for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
    state = step(state, { type: "select", id: i % 2 ? "head" : "eye" });
    state = step(state, { type: "color", color: `#${(i + 1).toString(16).padStart(6, "0")}` });
  }
  assert.equal(state.past.length, HISTORY_LIMIT);
});

test("a random colourway paints every part from the palette", () => {
  const palette = ["#111111", "#222222", "#333333"];
  let seed = 0;
  const colors = randomColors(studio, palette, () => ((seed += 0.37) % 1));
  assert.equal(Object.keys(colors).length, 32);
  assert.ok(Object.values(colors).every((color) => palette.includes(color)));
});

test("a design saved without part colours is rebuilt from its mesh colours", () => {
  const meshColors = studio.colorOverridesForParts({ ...studio.defaultColors, head: "#ABCDEF", leftSole: "#123456" });
  const rebuilt = savedDesignColors(studio, { meshColors });
  assert.equal(rebuilt.head, "#ABCDEF");
  assert.equal(rebuilt.leftSole, "#123456");
  assert.equal(savedDesignColors(studio, null), null);
  assert.deepEqual(savedDesignColors(studio, { colors: { head: "#000000" }, meshColors }), { head: "#000000" });
});

test("the legacy colourway key stays out of the design", () => {
  const legacy = duckLegacy();
  const jaw = legacy.colorways.find((way) => "jaw" in way.colors);
  assert.ok(jaw, "the fixture still carries the old key");
  const state = step(initialStudioState(studio), { type: "apply", colors: jaw.colors });
  assert.equal("jaw" in state.colors, false);
});
