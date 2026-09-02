import assert from "node:assert/strict";
import test from "node:test";

import {
  MULTIPLAYER_STORAGE_KEY,
  readMultiplayerPreference,
  writeMultiplayerPreference,
} from "../src/game/multiplayer-preference.js";
import {
  MAX_GHOSTS,
  MAX_INBOUND_STATES_PER_SECOND,
  createPeerAdmission,
  createPeerRateLimiter,
  findStalePeerIds,
  hasOpenRelay,
  isValidGhostPeerId,
  isValidGhostState,
  selectActivePeerTargets,
} from "../src/game/ghost-security.js";

function memoryStorage(initial) {
  const values = new Map(initial ? [[MULTIPLAYER_STORAGE_KEY, initial]] : []);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function validState() {
  return {
    p: [0, 0, 0.24, 1, 0, 0, 0],
    j: Array(14).fill(0),
    w: 0.5,
    v: "classic",
    l: 0,
  };
}

test("public multiplayer defaults off and persists an explicit local choice", () => {
  const storage = memoryStorage();
  assert.equal(readMultiplayerPreference(storage), false);
  assert.equal(writeMultiplayerPreference(true, storage), true);
  assert.equal(readMultiplayerPreference(storage), true);
  assert.equal(writeMultiplayerPreference(false, storage), true);
  assert.equal(readMultiplayerPreference(storage), false);
});

test("storage denial fails closed instead of enabling a network room", () => {
  const denied = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
  };
  assert.equal(readMultiplayerPreference(denied), false);
  assert.equal(writeMultiplayerPreference(true, denied), false);
});

test("denial while resolving the platform storage object also fails closed", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() { throw new Error("blocked by policy"); },
  });
  try {
    assert.equal(readMultiplayerPreference(), false);
    assert.equal(writeMultiplayerPreference(true), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
});

test("ghost payload validation keeps exact shape and enforces numeric bounds", () => {
  assert.equal(isValidGhostState(validState(), 14), true);

  const invalid = [
    { ...validState(), p: [0, 0, 0.24, 0, 0, 0, 0] },
    { ...validState(), p: [33, 0, 0.24, 1, 0, 0, 0] },
    { ...validState(), p: [0, 0, 20, 1, 0, 0, 0] },
    { ...validState(), j: Array(13).fill(0) },
    { ...validState(), j: [...Array(13).fill(0), 4] },
    { ...validState(), w: 1.01 },
    { ...validState(), l: "rollers" },
    { ...validState(), v: "" },
    { ...validState(), v: "x".repeat(65) },
    { ...validState(), p: [0, 0, 0.24, 1, 0, 0, Number.NaN] },
  ];
  for (const state of invalid) assert.equal(isValidGhostState(state, 14), false);
});

test("peer identifiers and inbound rate buckets are bounded", () => {
  assert.equal(isValidGhostPeerId("peer-a"), true);
  assert.equal(isValidGhostPeerId(""), false);
  assert.equal(isValidGhostPeerId("peer.with.punctuation"), false);
  assert.equal(isValidGhostPeerId("x".repeat(161)), false);

  let clock = 0;
  const limiter = createPeerRateLimiter({ now: () => clock });
  for (let i = 0; i < MAX_INBOUND_STATES_PER_SECOND; i++) {
    assert.equal(limiter.allow("peer-a"), true);
  }
  assert.equal(limiter.allow("peer-a"), false);
  clock = 1000;
  assert.equal(limiter.allow("peer-a"), true);

  for (let i = 1; i < MAX_GHOSTS; i++) {
    assert.equal(limiter.allow(`peer-${i}`), true);
  }
  assert.equal(limiter.size(), MAX_GHOSTS);
  assert.equal(limiter.allow("one-peer-too-many"), false);
  limiter.delete("peer-a");
  assert.equal(limiter.allow("replacement-peer"), true);
});

test("inactive candidate peers release their admission slot", () => {
  let clock = 0;
  const limiter = createPeerRateLimiter({ maxPeers: 1, idleMs: 5000, now: () => clock });
  assert.equal(limiter.allow("silent-peer"), true);
  assert.equal(limiter.allow("waiting-peer"), false);
  clock = 5000;
  assert.equal(limiter.allow("waiting-peer"), true);
});

test("handshake admission hard-limits pending plus active peers", () => {
  const timers = new Map();
  let nextTimer = 0;
  const admission = createPeerAdmission({
    schedule: (fn) => {
      const id = ++nextTimer;
      timers.set(id, fn);
      return id;
    },
    cancel: (id) => timers.delete(id),
  });

  assert.equal(admission.reserve("pending-a"), true);
  assert.equal(admission.reserve("pending-b"), true);
  assert.equal(admission.activate("pending-a"), true);
  assert.equal(admission.reserve("pending-c"), true);
  assert.equal(admission.size(), MAX_GHOSTS);
  assert.equal(admission.activeCount(), 1);
  assert.equal(admission.pendingCount(), 2);
  assert.equal(admission.reserve("peer-over-capacity"), false);
  assert.equal(admission.reserve("not valid!"), false);

  assert.equal(admission.release("pending-b"), true);
  assert.equal(admission.reserve("replacement"), true);
  assert.deepEqual(admission.activePeerIds(), ["pending-a"]);
  admission.clear();
  assert.equal(admission.size(), 0);
  assert.equal(timers.size, 0);
});

test("failed handshakes expire their pending admission slot", () => {
  let expire;
  const admission = createPeerAdmission({
    maxPeers: 1,
    schedule: (fn) => {
      expire = fn;
      return 1;
    },
    cancel() {},
  });

  assert.equal(admission.reserve("failed-peer"), true);
  assert.equal(admission.reserve("waiting-peer"), false);
  expire();
  assert.equal(admission.reserve("waiting-peer"), true);
});

test("relay readiness requires an allowed WebSocket in OPEN state", () => {
  const allowed = ["wss://relay-a.example", "wss://relay-b.example"];
  const sockets = {
    "wss://relay-a.example": { readyState: 0 },
    "wss://relay-b.example": { readyState: 3 },
    "wss://unrelated.example": { readyState: 1 },
  };

  assert.equal(hasOpenRelay(sockets, allowed), false);
  sockets["wss://relay-b.example"].readyState = 1;
  assert.equal(hasOpenRelay(sockets, allowed), true);
  assert.equal(hasOpenRelay(null, allowed), false);
  assert.equal(hasOpenRelay(sockets, []), false);
});

test("outbound state targets only admitted peers that remain active", () => {
  const activeConnections = {
    "approved-a": {},
    "approved-b": {},
    "extra-transport-peer": {},
  };
  assert.deepEqual(
    selectActivePeerTargets(
      ["approved-a", "already-left", "approved-b", "invalid peer"],
      activeConnections,
    ),
    ["approved-a", "approved-b"],
  );
  assert.deepEqual(selectActivePeerTargets([], activeConnections), []);
});

test("silent and expired active peers are selected for disconnect", () => {
  const lastSeen = new Map([
    ["fresh-peer", 5500],
    ["expired-peer", 999],
  ]);
  assert.deepEqual(
    findStalePeerIds(
      ["fresh-peer", "expired-peer", "never-sent-peer"],
      lastSeen,
      6000,
      5000,
    ),
    ["expired-peer", "never-sent-peer"],
  );
});
