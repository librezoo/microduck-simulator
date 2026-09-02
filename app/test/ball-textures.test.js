import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { BALL_TEXTURE_SIZE, drawBallPattern } from "../src/game/ball-visual.js";

test("paints a deterministic procedural ball pattern", () => {
  const calls = { fillRect: 0, fill: 0, stroke: 0, lineTo: 0 };
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() { calls.lineTo++; },
    fillRect() { calls.fillRect++; },
    fill() { calls.fill++; },
    stroke() { calls.stroke++; },
  };

  drawBallPattern(ctx, BALL_TEXTURE_SIZE.width, BALL_TEXTURE_SIZE.height);

  assert.deepEqual(BALL_TEXTURE_SIZE, { width: 512, height: 256 });
  assert.ok(calls.fillRect >= 2, "base and rotation accent must be painted");
  assert.ok(calls.fill >= 12, "football panels must be painted");
  assert.ok(calls.stroke >= 12, "panel seams must be painted");
  assert.ok(calls.lineTo >= 40, "pattern must contain an actual seam lattice");
});

test("ball visual has no file-backed texture dependency", async () => {
  const source = await readFile(
    new URL("../src/game/ball-visual.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /assets\/ball\//);
  assert.doesNotMatch(source, /TextureLoader/);
  assert.match(source, /CanvasTexture/);
});
