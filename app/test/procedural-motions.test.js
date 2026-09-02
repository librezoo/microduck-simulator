import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_POSE, NUM_JOINTS } from "../src/game/constants.js";
import {
  DEFAULT_PROCEDURAL_MOTION_ID,
  PROCEDURAL_MOTION_FPS,
  PROCEDURAL_MOTIONS,
  getProceduralMotion,
  sampleProceduralMotionFrame,
} from "../src/game/procedural-motions.js";

const expectedIds = [
  "wbc_happy",
  "wbc_curious",
  "wbc_happy_bob",
  "wbc_wiggle",
];

test("publishes four deterministic 50 Hz motions with stable clip IDs", () => {
  assert.equal(PROCEDURAL_MOTION_FPS, 50);
  assert.equal(DEFAULT_PROCEDURAL_MOTION_ID, "wbc_happy");
  assert.deepEqual(PROCEDURAL_MOTIONS.map(({ id }) => id), expectedIds);
  for (const motion of PROCEDURAL_MOTIONS) {
    assert.equal(motion.fps, PROCEDURAL_MOTION_FPS);
    assert.equal(motion.durationSec, motion.frames / motion.fps);
    assert.equal(getProceduralMotion(motion.id), motion);
  }
});

test("every generated target is finite, continuous and stays near HOME", () => {
  const previous = new Float32Array(NUM_JOINTS);
  const current = new Float32Array(NUM_JOINTS);

  for (const motion of PROCEDURAL_MOTIONS) {
    sampleProceduralMotionFrame(motion.id, 0, previous);
    assert.deepEqual([...previous], [...DEFAULT_POSE], `${motion.id} first frame`);

    let maximumStep = 0;
    let maximumOffset = 0;
    for (let frame = 1; frame < motion.frames; frame++) {
      sampleProceduralMotionFrame(motion.id, frame, current);
      assert.equal(current.length, NUM_JOINTS);
      for (let joint = 0; joint < NUM_JOINTS; joint++) {
        assert.ok(Number.isFinite(current[joint]), `${motion.id} frame ${frame} joint ${joint}`);
        maximumStep = Math.max(maximumStep, Math.abs(current[joint] - previous[joint]));
        maximumOffset = Math.max(maximumOffset, Math.abs(current[joint] - DEFAULT_POSE[joint]));
      }
      previous.set(current);
    }

    assert.deepEqual([...current], [...DEFAULT_POSE], `${motion.id} final frame`);
    assert.ok(maximumStep < 0.03, `${motion.id} max frame step ${maximumStep}`);
    assert.ok(maximumOffset <= 0.25, `${motion.id} max HOME offset ${maximumOffset}`);
  }
});

test("the four motion characters produce distinct joint trajectories", () => {
  const signatures = PROCEDURAL_MOTIONS.map((motion) => {
    const samples = [0.25, 0.5, 0.75].flatMap((position) => {
      const frame = Math.round((motion.frames - 1) * position);
      return [...sampleProceduralMotionFrame(motion.id, frame)]
        .map((value, joint) => Math.round((value - DEFAULT_POSE[joint]) * 10_000));
    });
    return samples.join(",");
  });
  assert.equal(new Set(signatures).size, PROCEDURAL_MOTIONS.length);
});

test("rejects unknown motions, out-of-range frames and malformed outputs", () => {
  assert.throws(() => sampleProceduralMotionFrame("missing", 0), /Unknown pose motion/);
  assert.throws(() => sampleProceduralMotionFrame("wbc_happy", -1), /outside/);
  assert.throws(
    () => sampleProceduralMotionFrame("wbc_happy", 0, new Float32Array(2)),
    /exactly 14 joint targets/,
  );
});
