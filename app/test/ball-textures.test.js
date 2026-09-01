import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";

test("ships the pre-baked soccer ball textures", async () => {
  for (const name of ["soccer-color.png", "soccer-bump.png"]) {
    const info = await stat(new URL(`../public/assets/ball/${name}`, import.meta.url));
    assert.ok(info.size > 10_000, `${name} must contain an actual texture`);
  }
});
