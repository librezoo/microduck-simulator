// Public-room ingress limits. These are intentionally independent from the
// renderer so malformed or overactive peers are rejected before allocating a
// rig, material, or interpolation buffer.
export const MAX_GHOSTS = 3;
export const MAX_INBOUND_STATES_PER_SECOND = 30;

const XY_LIMIT = 32; // covers the largest shipped room with margin
const Z_MIN = -2;
const Z_MAX = 12;
const JOINT_LIMIT = Math.PI + 0.35;

const finiteArray = (value, length) =>
  Array.isArray(value) && value.length === length && value.every(Number.isFinite);

const within = (value, min, max) => value >= min && value <= max;

export function isValidGhostPeerId(peerId) {
  return typeof peerId === "string" &&
    peerId.length > 0 &&
    peerId.length <= 160 &&
    /^[A-Za-z0-9_-]+$/.test(peerId);
}

// Reserve a slot before Trystero promotes a WebRTC connection from pending to
// active. This bounds the active/action layer rather than merely limiting how
// many received states become rendered ghosts. ICE and the data channel already
// exist when Trystero invokes its handshake callback, so pre-handshake transport
// work remains outside this boundary. Reservations expire just after Trystero's
// own timeout so a peer disconnecting before onPeerJoin cannot leak a slot.
export function createPeerAdmission({
  maxPeers = MAX_GHOSTS,
  reservationMs = 11_000,
  schedule = setTimeout,
  cancel = clearTimeout,
} = {}) {
  if (!Number.isInteger(maxPeers) || maxPeers < 1) {
    throw new TypeError("maxPeers must be a positive integer");
  }
  if (!Number.isFinite(reservationMs) || reservationMs <= 0) {
    throw new TypeError("reservationMs must be positive");
  }

  const pending = new Map();
  const active = new Set();

  const clearReservation = (peerId) => {
    const timer = pending.get(peerId);
    if (timer === undefined) return false;
    pending.delete(peerId);
    if (timer !== null) cancel(timer);
    return true;
  };

  const release = (peerId) => {
    const wasPending = clearReservation(peerId);
    const wasActive = active.delete(peerId);
    return wasPending || wasActive;
  };

  return {
    reserve(peerId) {
      if (!isValidGhostPeerId(peerId)) return false;
      if (pending.has(peerId) || active.has(peerId)) return true;
      if (pending.size + active.size >= maxPeers) return false;
      pending.set(peerId, null);
      const timer = schedule(() => clearReservation(peerId), reservationMs);
      // A test scheduler may run synchronously. Do not resurrect an already
      // expired reservation in that case.
      if (pending.has(peerId)) pending.set(peerId, timer);
      return true;
    },
    activate(peerId) {
      if (active.has(peerId)) return true;
      if (!clearReservation(peerId)) return false;
      active.add(peerId);
      return true;
    },
    release,
    isActive: (peerId) => active.has(peerId),
    activePeerIds: () => [...active],
    pendingCount: () => pending.size,
    activeCount: () => active.size,
    size: () => pending.size + active.size,
    clear() {
      for (const peerId of [...pending.keys()]) clearReservation(peerId);
      active.clear();
    },
  };
}

export function hasOpenRelay(sockets, allowedUrls, openState = 1) {
  if (!sockets || typeof sockets !== "object") return false;
  const allowed = new Set(Array.isArray(allowedUrls) ? allowedUrls : []);
  if (!allowed.size) return false;
  return Object.entries(sockets).some(
    ([url, socket]) => allowed.has(url) && socket?.readyState === openState,
  );
}

export function selectActivePeerTargets(activePeerIds, peers) {
  if (!Array.isArray(activePeerIds) || !peers || typeof peers !== "object") return [];
  return activePeerIds.filter(
    (peerId) => isValidGhostPeerId(peerId) &&
      Object.prototype.hasOwnProperty.call(peers, peerId),
  );
}

export function findStalePeerIds(peerIds, lastSeenByPeer, now, staleMs) {
  if (!Array.isArray(peerIds) || !(lastSeenByPeer instanceof Map) ||
      !Number.isFinite(now) || !Number.isFinite(staleMs) || staleMs < 0) return [];
  return peerIds.filter((peerId) => {
    const lastSeen = lastSeenByPeer.get(peerId);
    return !Number.isFinite(lastSeen) || now - lastSeen > staleMs;
  });
}

export function isValidGhostState(state, jointCount) {
  if (typeof state !== "object" || state === null) return false;
  if (!finiteArray(state.p, 7) || !finiteArray(state.j, jointCount)) return false;
  if (typeof state.v !== "string" || state.v.length === 0 || state.v.length > 64) return false;
  if (state.w != null && (!Number.isFinite(state.w) || !within(state.w, 0, 1))) return false;
  if (state.l != null && state.l !== 0 && state.l !== 1 &&
      state.l !== false && state.l !== true) return false;

  const [x, y, z, qw, qx, qy, qz] = state.p;
  if (!within(x, -XY_LIMIT, XY_LIMIT) || !within(y, -XY_LIMIT, XY_LIMIT) ||
      !within(z, Z_MIN, Z_MAX)) return false;
  if (![qw, qx, qy, qz].every((value) => within(value, -1.001, 1.001))) return false;
  const quatNormSq = qw * qw + qx * qx + qy * qy + qz * qz;
  if (!within(quatNormSq, 0.9, 1.1)) return false;
  return state.j.every((value) => within(value, -JOINT_LIMIT, JOINT_LIMIT));
}

export function createPeerRateLimiter({
  maxEvents = MAX_INBOUND_STATES_PER_SECOND,
  windowMs = 1000,
  maxPeers = MAX_GHOSTS,
  idleMs = 5000,
  now = () => performance.now(),
} = {}) {
  const windows = new Map();

  return {
    allow(peerId) {
      const stamp = now();
      if (!isValidGhostPeerId(peerId) || !Number.isFinite(stamp)) return false;
      let entry = windows.get(peerId);
      if (!entry) {
        for (const [id, candidate] of windows) {
          if (stamp - candidate.lastAt >= idleMs) windows.delete(id);
        }
        if (windows.size >= maxPeers) return false;
        entry = { startedAt: stamp, lastAt: stamp, count: 0 };
        windows.set(peerId, entry);
      } else if (stamp < entry.startedAt || stamp - entry.startedAt >= windowMs) {
        entry.startedAt = stamp;
        entry.count = 0;
      }
      if (entry.count >= maxEvents) return false;
      entry.count++;
      entry.lastAt = stamp;
      return true;
    },
    delete(peerId) {
      windows.delete(peerId);
    },
    clear() {
      windows.clear();
    },
    size() {
      return windows.size;
    },
  };
}
