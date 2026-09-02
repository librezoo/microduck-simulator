import { DEFAULT_POSE, NUM_JOINTS } from "./constants.js";

export const PROCEDURAL_MOTION_FPS = 50;
export const DEFAULT_PROCEDURAL_MOTION_ID = "wbc_happy";

// Clip IDs and timings intentionally match the former reference bundle so
// saved selections and the native diagnostics bridge remain compatible. The
// motion itself is original: every joint target is generated below from the
// simulator's neutral pose, without loading a policy, recording or CSV file.
export const PROCEDURAL_MOTIONS = Object.freeze([
  Object.freeze({
    id: "wbc_happy",
    name: "Happy",
    frames: 989,
    durationSec: 19.78,
    fps: PROCEDURAL_MOTION_FPS,
  }),
  Object.freeze({
    id: "wbc_curious",
    name: "Curious",
    frames: 399,
    durationSec: 7.98,
    fps: PROCEDURAL_MOTION_FPS,
  }),
  Object.freeze({
    id: "wbc_happy_bob",
    name: "Happy Bob",
    frames: 399,
    durationSec: 7.98,
    fps: PROCEDURAL_MOTION_FPS,
  }),
  Object.freeze({
    id: "wbc_wiggle",
    name: "Playful Wiggle",
    frames: 449,
    durationSec: 8.98,
    fps: PROCEDURAL_MOTION_FPS,
  }),
]);

const motionById = new Map(PROCEDURAL_MOTIONS.map((motion) => [motion.id, motion]));
const TAU = 2 * Math.PI;

export function getProceduralMotion(id) {
  return motionById.get(id) ?? null;
}

function addHappy(target, t, envelope) {
  const bounce = envelope * (0.026 + 0.022 * Math.sin(TAU * 6 * t));
  const sway = envelope * Math.sin(TAU * 3 * t);
  const nod = envelope * Math.sin(TAU * 4 * t + Math.PI / 5);

  target[1] += 0.025 * sway;
  target[10] += 0.025 * sway;
  target[2] -= bounce;
  target[11] += bounce;
  target[3] -= 0.65 * bounce;
  target[12] += 0.65 * bounce;
  target[4] += 0.42 * bounce;
  target[13] -= 0.42 * bounce;
  target[5] += 0.035 * nod;
  target[6] += 0.055 * nod;
  target[7] += 0.105 * sway;
  target[8] -= 0.04 * sway;
}

function addCurious(target, t, envelope) {
  const glance = envelope * Math.sin(TAU * 0.75 * t);
  const tilt = envelope * Math.sin(TAU * 0.5 * t + Math.PI / 4);
  const listen = envelope * Math.sin(TAU * 1.5 * t + Math.PI / 7);

  target[5] -= 0.045 * envelope + 0.025 * listen;
  target[6] += 0.075 * listen;
  target[7] += 0.24 * glance;
  target[8] += 0.115 * tilt;
  target[1] += 0.018 * tilt;
  target[10] += 0.018 * tilt;
}

function addHappyBob(target, t, envelope) {
  const pulse = 0.5 + 0.5 * Math.sin(TAU * 5 * t - Math.PI / 2);
  const bend = 0.065 * envelope * pulse;
  const nod = envelope * Math.sin(TAU * 5 * t);

  target[2] -= bend;
  target[11] += bend;
  target[3] -= 0.8 * bend;
  target[12] += 0.8 * bend;
  target[4] += 0.55 * bend;
  target[13] -= 0.55 * bend;
  target[5] += 0.07 * nod;
  target[6] += 0.1 * nod;
  target[7] += 0.035 * envelope * Math.sin(TAU * 2.5 * t);
}

function addPlayfulWiggle(target, t, envelope) {
  const wiggle = envelope * Math.sin(TAU * 7 * t);
  const counter = envelope * Math.sin(TAU * 7 * t + Math.PI / 2);

  target[0] += 0.085 * wiggle;
  target[9] -= 0.085 * wiggle;
  target[1] += 0.07 * counter;
  target[10] += 0.07 * counter;
  target[2] -= 0.025 * counter;
  target[11] += 0.025 * counter;
  target[4] += 0.02 * wiggle;
  target[13] -= 0.02 * wiggle;
  target[7] -= 0.18 * wiggle;
  target[8] -= 0.09 * counter;
}

const generators = Object.freeze({
  wbc_happy: addHappy,
  wbc_curious: addCurious,
  wbc_happy_bob: addHappyBob,
  wbc_wiggle: addPlayfulWiggle,
});

export function sampleProceduralMotionFrame(id, frame, out = new Float32Array(NUM_JOINTS)) {
  const motion = getProceduralMotion(id);
  if (!motion) throw new Error(`Unknown pose motion: ${id}`);
  if (!Number.isInteger(frame) || frame < 0 || frame >= motion.frames) {
    throw new RangeError(`Pose motion ${id} frame ${frame} is outside 0..${motion.frames - 1}`);
  }
  if (!out || out.length !== NUM_JOINTS || typeof out.set !== "function") {
    throw new TypeError(`Pose motion output must hold exactly ${NUM_JOINTS} joint targets`);
  }

  out.set(DEFAULT_POSE);
  if (frame === 0 || frame === motion.frames - 1) return out;

  const t = frame / (motion.frames - 1);
  // sin² has zero value and zero slope at both ends. That gives every clip
  // a gentle departure from and return to HOME even when its inner waveform
  // is midway through a cycle.
  const envelope = Math.sin(Math.PI * t) ** 2;
  generators[id](out, t, envelope);
  return out;
}
