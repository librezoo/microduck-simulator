// Opt-in multiplayer ghosts: while the visitor has explicitly enabled the
// feature, this module broadcasts duck state over WebRTC and renders other
// visitors as translucent ducks. There is no backend - this is a static Space
// - so peer discovery uses Trystero's serverless signaling over public Nostr
// relays. Payloads are tiny (22 floats + a variant name at SEND_HZ), and at
// most MAX_GHOSTS ghosts are instantiated regardless of room population.
//
// This module deliberately imports nothing from duck.js / variants.js:
// on the private Space those need the ?__sign JWT that only rl.js knows
// how to append, so all rig helpers arrive through init parameters.
import {
  MAX_GHOSTS,
  createPeerAdmission,
  createPeerRateLimiter,
  findStalePeerIds,
  hasOpenRelay,
  isValidGhostPeerId,
  isValidGhostState,
  selectActivePeerTargets,
} from "./ghost-security.js";

const APP_ID = "microduck-sandbox";
const ROOM = "lobby";
const SEND_HZ = 15;
const GHOST_OPACITY = 0.35;
const HANDSHAKE_TIMEOUT_MS = 8000;
const RELAY_CONNECT_TIMEOUT_MS = 5000;
const RELAY_POLL_MS = 50;
// An explicit, small relay set makes connection readiness attributable to
// this room (getRelaySockets() is otherwise module-global) and avoids opening
// Trystero's default five sockets for a three-peer feature.
const NOSTR_RELAY_URLS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.agorist.space",
];
const networkLifecycleKey = Symbol.for("zoo-kinder.public-multiplayer-lifecycle");
const networkLifecycle = globalThis[networkLifecycleKey] ??= {
  shutdown: Promise.resolve(true),
};
// Snapshot interpolation: each ghost renders in the past, lerping between
// the two buffered snapshots that bracket the render time (timed by local
// ARRIVAL, so no clock sync and no payload change - old clients
// interoperate). This replaces the old exponential chase toward the
// latest packet, whose move-then-stall rhythm read as micro-stutter.
//
// The playback delay is ADAPTIVE per ghost: it tracks the measured
// snapshot arrival cadence (fast-attack / slow-release, like a jitter
// buffer), so a healthy 15 Hz peer keeps the ~150 ms floor while a
// background-throttled 1 Hz sender is replayed as continuous slow motion
// ~1.3 s in the past instead of the old sprint-then-freeze (a fixed
// 150 ms delay replayed each 1 s packet gap as a 150 ms dash). The delay
// is slew-rate limited so rate changes (tab hidden <-> shown) glide -
// render time never runs backward and never pops. Arrival stamps are
// also de-jittered: bursts delivered back-to-back by the reliable
// ordered channel (head-of-line blocking) are re-spaced to at least half
// the nominal send interval, so a burst replays as motion instead of a
// teleport. Nobody synchronizes on ghosts, so the latency is invisible.
const INTERP_DELAY_MS = 150; // floor, ~2.25 send intervals at 15 Hz
const INTERP_DELAY_MAX_MS = 2000; // cap for stalled senders
const RESPACE_MIN_MS = 1000 / SEND_HZ / 2; // de-jitter floor between stamps
const GAP_RELEASE = 0.15; // per-packet EWMA rate when arrivals speed up
const DELAY_SLEW = 0.5; // max delay change per ms of real time
const BUF_MAX = 40; // snapshots kept per ghost (~2.5 s at 15 Hz)
// Idle visitors stay invisible: a ghost is only shown once its peer has
// strayed from the pose of its first state message (everyone spawns at
// the arena center). Once revealed it stays visible for the whole peer
// session, so a reset teleporting the duck back to center doesn't blink
// the ghost out.
const REVEAL_DIST = 0.2; // m, horizontal distance from spawn
const REVEAL_YAW = 0.4; // rad (~23deg), turning in place also reveals

// state.p is raw MuJoCo qpos[0..6]: [x, y, z, qw, qx, qy, qz], Z-up.
const yawOf = (p) =>
  Math.atan2(2 * (p[3] * p[6] + p[4] * p[5]), 1 - 2 * (p[5] * p[5] + p[6] * p[6]));
const hasMoved = (spawn, p) => {
  const dx = p[0] - spawn.x, dy = p[1] - spawn.y;
  if (dx * dx + dy * dy > REVEAL_DIST * REVEAL_DIST) return true;
  const dyaw = yawOf(p) - spawn.yaw;
  return Math.abs(Math.atan2(Math.sin(dyaw), Math.cos(dyaw))) > REVEAL_YAW;
};

// Instances not yet destroyed, so a dev-server hot swap of this module can
// tear down the previous one's interval/room instead of stacking them.
const liveInstances = new Set();
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const g of [...liveInstances]) g.destroy();
  });
}

const selectedRelaySockets = (getRelaySockets) => {
  const sockets = getRelaySockets?.() ?? {};
  const allowed = new Set(NOSTR_RELAY_URLS);
  return Object.entries(sockets)
    .filter(([url]) => allowed.has(url))
    .map(([, socket]) => socket);
};

const waitForOpenRelay = (getRelaySockets, shouldJoin) => new Promise((resolve) => {
  const deadline = performance.now() + RELAY_CONNECT_TIMEOUT_MS;
  let timer = null;
  const finish = (ready) => {
    if (timer !== null) clearTimeout(timer);
    resolve(ready);
  };
  const check = () => {
    if (!shouldJoin()) return finish(false);
    if (hasOpenRelay(getRelaySockets?.(), NOSTR_RELAY_URLS)) return finish(true);
    if (performance.now() >= deadline) return finish(false);
    timer = setTimeout(check, RELAY_POLL_MS);
  };
  check();
});

const closeRelaySockets = (getRelaySockets) => {
  for (const socket of selectedRelaySockets(getRelaySockets)) {
    try {
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    } catch {}
  }
};

const trackRelayOpenHistory = (getRelaySockets, openedUrls) => {
  const cleanups = [];
  const allowed = new Set(NOSTR_RELAY_URLS);
  for (const [url, socket] of Object.entries(getRelaySockets?.() ?? {})) {
    if (!allowed.has(url)) continue;
    const markOpen = () => openedUrls.add(url);
    if (socket.readyState === WebSocket.OPEN) markOpen();
    socket.addEventListener?.("open", markOpen);
    cleanups.push(() => socket.removeEventListener?.("open", markOpen));
  }
  return () => cleanups.forEach((cleanup) => cleanup());
};

const waitForActivePeersToClose = async (room) => {
  const deadline = performance.now() + 750;
  while (Object.keys(room.getPeers?.() ?? {}).length && performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

const closeActivePeers = (room) => {
  for (const connection of Object.values(room.getPeers?.() ?? {})) {
    try { connection.close(); } catch {}
  }
};

const leaveRoomSafely = async (room) => {
  if (!room) return true;
  let lastError;
  // room.leave() sends a final action before unregistering the room. A channel
  // that closes during that send rejects the whole operation before cleanup,
  // so close active RTC transports first and retry cleanup a bounded number of
  // times. The remote side observes the RTC close as an immediate peer leave.
  for (let attempt = 0; attempt < 2; attempt++) {
    closeActivePeers(room);
    await waitForActivePeersToClose(room);
    try {
      await room.leave();
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  console.warn("ghosts: room cleanup failed; reload before retrying multiplayer", lastError);
  return false;
};

const watchOpenRelays = (getRelaySockets, onUnavailable) => {
  let stopped = false;
  const sockets = selectedRelaySockets(getRelaySockets);
  const onClose = () => queueMicrotask(() => {
    if (!stopped && !hasOpenRelay(getRelaySockets?.(), NOSTR_RELAY_URLS)) {
      onUnavailable();
    }
  });
  for (const socket of sockets) socket.addEventListener?.("close", onClose);
  // Cover a relay closing between the successful readiness check and listener
  // registration without keeping an interval alive for the whole session.
  onClose();
  return () => {
    stopped = true;
    for (const socket of sockets) socket.removeEventListener?.("close", onClose);
  };
};

export async function initGhosts(env, {
  shouldJoin = () => true,
  onPeerJoin = () => {},
  onUnavailable = () => {},
} = {}) {
  const noop = {
    update() {}, peerCount: () => 0, ghostCount: () => 0, debug: () => [],
    mapDots: () => [], destroy: async () => true, setActive() {}, injectState: () => false,
  };
  // The native reference build sets this Vite constant. Keeping the guard in
  // the same module as the dynamic import lets Rollup remove Trystero/Nostr and
  // its signaling crypto from the packaged iOS web payload entirely.
  if (import.meta.env.VITE_DISABLE_PUBLIC_MULTIPLAYER === "1") return noop;
  if (!await networkLifecycle.shutdown) {
    console.warn("ghosts disabled: previous room cleanup did not complete");
    return noop;
  }
  const admission = createPeerAdmission({
    maxPeers: MAX_GHOSTS,
    reservationMs: HANDSHAKE_TIMEOUT_MS + 1000,
  });
  let room;
  let getRelaySockets;
  let pauseRelayReconnection;
  const openedRelayUrls = new Set();
  let stopRelayOpenTracking = () => {};
  try {
    // Lazy but bundled: only signaling and WebRTC use the network; no
    // executable application code is downloaded at runtime.
    const nostr = await import("trystero/nostr");
    const { joinRoom, resumeRelayReconnection } = nostr;
    ({ getRelaySockets, pauseRelayReconnection } = nostr);
    // Consent can be withdrawn while the lazy chunk is loading. Check at the
    // last synchronous boundary before joinRoom opens signaling sockets.
    if (!shouldJoin()) return noop;

    // Trystero reconnects relay sockets forever by default. Resume any sockets
    // deliberately paused by a previous consent session for one attempt, then
    // re-arm the lock before joining. A failed or later-closed socket therefore
    // stays closed until the user explicitly starts another session.
    resumeRelayReconnection();
    await Promise.resolve();
    await Promise.resolve();
    pauseRelayReconnection();

    room = joinRoom({
      appId: APP_ID,
      relayConfig: {
        urls: NOSTR_RELAY_URLS,
        manualReconnection: true,
      },
    }, ROOM, {
      handshakeTimeoutMs: HANDSHAKE_TIMEOUT_MS,
      onPeerHandshake: async (peerId) => {
        if (!admission.reserve(peerId)) {
          throw new Error("peer admission denied");
        }
      },
      onJoinError: ({ peerId }) => {
        // Includes local rejection, handshake timeout and handshake failure.
        admission.release(peerId);
      },
    });
    stopRelayOpenTracking = trackRelayOpenHistory(getRelaySockets, openedRelayUrls);

    if (!await waitForOpenRelay(getRelaySockets, shouldJoin)) {
      throw new Error("no Nostr signaling relay became available");
    }
  } catch (e) {
    admission.clear();
    pauseRelayReconnection?.();
    stopRelayOpenTracking();
    // Trystero leaves subscriptions waiting on a relay's never-resolved first
    // OPEN even after room.leave(). Re-entering on the same module can then let
    // stale cleanup remove the new room's subscription. Fail closed until a
    // page reload unless every configured relay initialized at least once.
    const canSafelyRejoin = NOSTR_RELAY_URLS.every((url) => openedRelayUrls.has(url));
    closeRelaySockets(getRelaySockets);
    networkLifecycle.shutdown = leaveRoomSafely(room)
      .then((didLeave) => didLeave && canSafelyRejoin);
    await networkLifecycle.shutdown;
    console.warn("ghosts disabled (signaling unavailable):", e);
    return noop;
  }

  const { scene, cloneRig, setJoint, setJawOpen, applyVariant, jointNames, getLocalState } = env;
  // Variant whitelist supplied by the host (this module imports nothing from
  // variants.js, see header). Unknown names from remote peers are coerced to
  // the default so applyVariant never sees a key it can't resolve.
  const knownVariants = env.variantNames ? new Set(env.variantNames) : null;
  const defaultVariant = env.defaultVariant ?? env.variantNames?.[0];
  // Locomotion-variant rig source: state.l 1 = rollers, 0/absent = legs
  // (old clients never send it). Falls back to the leg rig when the local
  // tab hasn't built the roller rig yet - known v1 limitation.
  const rigFor = (l) => (env.getRigFor ? env.getRigFor(l ?? 0) : env.rig);
  // trystero 0.25 (backed by @trystero-p2p): makeAction returns
  // { send, onMessage, onReceiveProgress } where onMessage is a SETTER -
  // the receive handler is registered by assignment, not by calling it.
  const act = room.makeAction("s");
  // send() rejects when a peer's channel drops mid-transfer; that peer will
  // be swept anyway, so failures are non-events.
  const sendState = (data) => {
    const peers = room.getPeers?.() ?? {};
    const targets = selectActivePeerTargets(admission.activePeerIds(), peers);
    if (targets.length) act.send(data, { target: targets }).catch(() => {});
  };

  // Ghosts share geometry with the local rig (cloneRig), but get their own
  // transparent material clones so repainting them never touches the
  // visitor's own duck (variants.js caches materials globally).
  //
  // Rendering: a ghost reads as ONE translucent shell, not ~70 individually
  // transparent meshes (through which every internal motor/PCB used to show).
  // Classic depth-prepass silhouette, kept inside the transparent pass so the
  // grid floor/walls (transparent ShaderMaterials at renderOrder 0) still
  // draw behind ghosts instead of being depth-rejected:
  //   PREPASS (renderOrder 1): every ghost mesh duplicated as a color-less
  //     twin (colorWrite off, depthWrite on) -> the depth buffer ends up
  //     holding the nearest ghost surface per pixel.
  //   BEAUTY (renderOrder 2): the real meshes, transparent + depthWrite off;
  //     the default LessEqual depth test then rejects everything except the
  //     fragment matching the prepass depth, so internals and back shell
  //     layers are skipped and each pixel is shaded exactly once.
  // Orders are shared by all ghosts (not per-ghost pairs): every beauty pass
  // tests against every ghost's prepass depth, so overlapping ghosts occlude
  // each other like solids instead of double-blending.
  const PREPASS_ORDER = 1;
  const BEAUTY_ORDER = 2;
  const ghostify = (rig) => {
    // Collect first: twins are added below and must not be re-traversed.
    const meshes = [];
    rig.root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const cache = new Map();
    let depthMat = null;
    for (const o of meshes) {
      // Materialization-FX wire overlays cloned along with the local rig:
      // drop them, they share the LIVE scan shader material and would
      // flash on this ghost every time the local duck re-materializes.
      if (o.userData.fxOverlay) { o.parent?.remove(o); continue; }
      if (o.userData.ghostPrepass) continue; // twin from a previous ghostify
      let m = cache.get(o.material.uuid);
      if (!m) {
        m = o.material.clone();
        m.transparent = true;
        m.opacity = GHOST_OPACITY;
        m.depthWrite = false;
        cache.set(o.material.uuid, m);
      }
      o.material = m;
      o.renderOrder = BEAUTY_ORDER;
      if (!o.userData.hasGhostTwin) {
        if (!depthMat) {
          // Depth-only material: cloned (no THREE import here) and muted.
          // transparent stays true so the twin sorts into the transparent
          // pass, after the grid but before the beauty meshes.
          depthMat = m.clone();
          depthMat.colorWrite = false;
          depthMat.depthWrite = true;
        }
        // Twin as an identity-transform child: follows joints for free. No
        // userData.meshName, so applyVariant never repaints it.
        const twin = new o.constructor(o.geometry, depthMat);
        twin.renderOrder = PREPASS_ORDER;
        twin.userData.ghostPrepass = true;
        o.userData.hasGhostTwin = true;
        o.add(twin);
      }
    }
  };

  const ghosts = new Map(); // peerId -> ghost
  const inboundRate = createPeerRateLimiter();
  const peerLastSeen = new Map();
  const warnedPeers = new Set(); // bounded by admitted/rendered peers
  let destroyed = false; // set by destroy(): drops any late messages
  // Interpolation snapshot: the pose parts of a state message, stamped
  // with the local arrival time, de-jittered: a snapshot never lands
  // closer than RESPACE_MIN_MS after the previous one, so a burst of
  // queued packets spreads into playable motion (the future-dated stamps
  // stay behind the delayed render time).
  const snapOf = (state, prevAt = -Infinity) => ({
    p: state.p, j: state.j, w: state.w ?? 0,
    at: Math.max(performance.now(), prevAt + RESPACE_MIN_MS),
  });
  const makeGhost = (state) => {
    const rig = cloneRig(rigFor(state.l));
    applyVariant(rig, state.v);
    ghostify(rig);
    scene.add(rig.placer);
    const trunk = rig.bodies.get("trunk_base");
    // Snap straight to the first received pose: no fly-in from the origin.
    trunk.position.set(state.p[0], state.p[1], state.p[2]);
    trunk.quaternion.set(state.p[4], state.p[5], state.p[6], state.p[3]);
    return {
      rig, trunk, buf: [snapOf(state)],
      variant: state.v, loco: state.l ?? 0,
      gapAvg: 1000 / SEND_HZ, // measured arrival cadence, ms
      delay: INTERP_DELAY_MS, // current playback delay, ms
    };
  };

  const removeGhost = (peerId) => {
    const g = ghosts.get(peerId);
    if (!g) return;
    scene.remove(g.rig.placer);
    const seen = new Set();
    g.rig.root.traverse((o) => {
      if (o.isMesh && !seen.has(o.material.uuid)) {
        seen.add(o.material.uuid);
        o.material.dispose();
      }
    });
    ghosts.delete(peerId);
    inboundRate.delete(peerId);
    warnedPeers.delete(peerId);
  };

  // The lobby is public over Nostr relays, so any peer can send anything:
  // validate shape and numeric bounds before touching it, admit no more peers
  // than can be rendered, and cap each admitted sender at twice SEND_HZ.
  const warnMalformed = (peerId) => {
    if (warnedPeers.has(peerId) || warnedPeers.size >= MAX_GHOSTS) return;
    warnedPeers.add(peerId);
    console.warn("ghosts: dropping malformed state from peer", peerId);
  };

  // Handler signature in this build: (payload, context) where context is
  // { peerId } - NOT the bare peerId string of classic trystero.
  const handleState = (state, peerId) => {
    if (destroyed) return;
    // Sanitize the free-form fields in place (state is a fresh deserialized
    // object, never shared): unknown variant -> default, loco flag -> 0|1.
    if (knownVariants && !knownVariants.has(state.v)) state.v = defaultVariant;
    state.l = state.l ? 1 : 0;
    let g = ghosts.get(peerId);
    if (!g) {
      if (ghosts.size >= MAX_GHOSTS) return; // room stays open, rendering capped
      // Nostr relays replay recent events, so states from already-dead
      // sessions can arrive right after joining: only ghost live peers.
      if (!(peerId in room.getPeers())) return;
      g = makeGhost(state);
      // Idle-visitor gate: remember where this peer first appeared and keep
      // its rig invisible until it strays from there (see hasMoved above).
      g.spawn = { x: state.p[0], y: state.p[1], yaw: yawOf(state.p) };
      g.revealed = false;
      g.rig.placer.visible = false;
      ghosts.set(peerId, g);
      g.lastSeen = performance.now();
      return;
    }
    g.lastSeen = performance.now();
    const prevAt = g.buf[g.buf.length - 1]?.at;
    const snap = snapOf(state, prevAt);
    if (prevAt !== undefined) {
      // Arrival cadence, fast attack / slow release: one late packet bumps
      // the estimate (and thus the playback delay) immediately, a resumed
      // fast sender eases it back down over ~a second of packets.
      const gap = snap.at - prevAt;
      g.gapAvg = gap > g.gapAvg ? gap : g.gapAvg + (gap - g.gapAvg) * GAP_RELEASE;
    }
    g.buf.push(snap);
    if (g.buf.length > BUF_MAX) g.buf.shift();
    if (!g.revealed && hasMoved(g.spawn, state.p)) {
      g.revealed = true; // latched for the rest of this peer session
      g.rig.placer.visible = true;
    }
    // Peer switched legs <-> rollers: rebuild its ghost on the other rig
    // (cheap - cloneRig shares geometry). The snapshot buffer carries over
    // so the interpolated motion stays continuous across the swap.
    if (state.l !== g.loco) {
      const { lastSeen, spawn, revealed, buf, gapAvg, delay } = g;
      removeGhost(peerId);
      g = makeGhost(state);
      Object.assign(g, { lastSeen, spawn, revealed, buf, gapAvg, delay });
      g.rig.placer.visible = revealed;
      ghosts.set(peerId, g);
      return;
    }
    if (state.v !== g.variant) {
      g.variant = state.v;
      applyVariant(g.rig, state.v);
      ghostify(g.rig);
    }
  };
  const onState = (state, context = {}) => {
    const peerId = context?.peerId;
    try {
      if (!isValidGhostPeerId(peerId)) {
        warnMalformed(peerId);
        return false;
      }
      const peers = room.getPeers?.() ?? {};
      if (!Object.prototype.hasOwnProperty.call(peers, peerId)) return false;
      if (!admission.isActive(peerId)) return false;
      if (!ghosts.has(peerId) && ghosts.size >= MAX_GHOSTS) return false;
      if (!inboundRate.allow(peerId)) return false;
      if (!isValidGhostState(state, jointNames.length)) {
        warnMalformed(peerId);
        return false;
      }
      handleState(state, peerId);
      peerLastSeen.set(peerId, performance.now());
      return true;
    } catch (e) {
      // Shape-valid but still poisonous payload, or an internal error: drop
      // the message, keep the handler alive for the next one.
      if (!warnedPeers.has(peerId)) {
        warnedPeers.add(peerId);
        console.warn("ghosts: error handling state from peer", peerId, e);
      }
      return false;
    }
  };
  act.onMessage = onState;

  room.onPeerJoin = (peerId) => {
    // onPeerJoin is emitted only after both sides finish the handshake. The
    // pending reservation now becomes an active slot used by targeted sends.
    if (!admission.activate(peerId)) {
      try { room.getPeers?.()[peerId]?.close(); } catch {}
      return;
    }
    peerLastSeen.set(peerId, performance.now());
    onPeerJoin(peerId);
  };

  // Same setter-style registration as onMessage/onPeerJoin.
  room.onPeerLeave = (peerId) => {
    removeGhost(peerId);
    inboundRate.delete(peerId);
    warnedPeers.delete(peerId);
    peerLastSeen.delete(peerId);
    admission.release(peerId);
  };

  // Graceful exit so other tabs drop this ghost immediately...
  const onPagehide = () => api.destroy();
  window.addEventListener("pagehide", onPagehide);
  // ...and a staleness sweep for peers that vanished without leaving
  // (crashed tab, dropped connection): 5 s without a state packet means
  // the peer is gone, not just lagging (even background-throttled tabs
  // still send at ~1 Hz).
  const STALE_MS = 5000;

  // Broadcast + stale sweep on a Web Worker clock: hidden tabs clamp
  // main-thread timers (and rAF) to >= 1 s, which used to degrade a hidden
  // tab's ghost to 1 Hz stepping in everyone else's view. Dedicated-worker
  // timers are exempt, and the postMessage task still runs on the hidden
  // main thread (only timers are throttled), so a backgrounded tab keeps
  // broadcasting at the nominal SEND_HZ. Inline via blob URL - no extra
  // file, no bundler config; falls back to a plain (throttled) interval
  // if workers or blob URLs are unavailable (strict CSP).
  let tickActive = true;
  const tick = () => {
    if (!tickActive) return;
    const s = getLocalState();
    if (s) sendState(s);
    const now = performance.now();
    const peers = room.getPeers?.() ?? {};
    for (const peerId of findStalePeerIds(
      admission.activePeerIds(), peerLastSeen, now, STALE_MS,
    )) {
      // Release before closing so this peer is excluded from the next outbound
      // tick even if the browser defers RTCPeerConnection's close event.
      admission.release(peerId);
      peerLastSeen.delete(peerId);
      removeGhost(peerId);
      try { peers[peerId]?.close(); } catch {}
    }
  };
  let tickWorker = null;
  let tickId = null;
  const startFallbackTimer = () => {
    tickId ??= setInterval(tick, 1000 / SEND_HZ);
  };
  try {
    const url = URL.createObjectURL(new Blob(
      [`let timer = 0;
        const start = () => { timer ||= setInterval(() => postMessage(0), ${1000 / SEND_HZ}); };
        onmessage = (event) => {
          if (event.data === true) start();
          else { clearInterval(timer); timer = 0; }
        };
        start();`],
      { type: "text/javascript" },
    ));
    tickWorker = new Worker(url);
    URL.revokeObjectURL(url); // the worker resolved the URL synchronously
    tickWorker.onmessage = tick;
  } catch {
    startFallbackTimer();
  }

  // Scratch THREE.Quaternions without importing three: slerp needs real
  // instances, cloned here from any node of the already-built local rig.
  const _qa = env.rig.placer.quaternion.clone();
  const _qb = env.rig.placer.quaternion.clone();
  let lastUpdateAt = performance.now(); // update() frame clock for the delay slew
  let stopRelayWatch = () => {};
  let leavePromise = null;
  const api = {
    room,
    setActive(active) {
      tickActive = Boolean(active);
      if (tickWorker) tickWorker.postMessage(tickActive);
      else if (tickActive) startFallbackTimer();
      else if (tickId !== null) {
        clearInterval(tickId);
        tickId = null;
      }
    },
    // Full teardown: without it, every HMR reload of this module stacked a
    // live 15 Hz interval plus a ghost room that kept broadcasting.
    destroy() {
      if (destroyed) return leavePromise ?? Promise.resolve();
      destroyed = true;
      liveInstances.delete(api);
      tickWorker?.terminate();
      if (tickId !== null) clearInterval(tickId);
      window.removeEventListener("pagehide", onPagehide);
      stopRelayWatch();
      pauseRelayReconnection?.();
      stopRelayOpenTracking();
      const canSafelyRejoin = NOSTR_RELAY_URLS.every((url) => openedRelayUrls.has(url));
      closeRelaySockets(getRelaySockets);
      leavePromise = leaveRoomSafely(room)
        .then((didLeave) => didLeave && canSafelyRejoin);
      networkLifecycle.shutdown = leavePromise;
      for (const peerId of [...ghosts.keys()]) removeGhost(peerId);
      inboundRate.clear();
      warnedPeers.clear();
      peerLastSeen.clear();
      admission.clear();
      return leavePromise;
    },
    // Debug/test hook: feed a payload through the exact same guarded path
    // as a network message (console QA of the validation layer).
    injectState: (state, peerId = "__debug") => onState(state, { peerId }),
    peerCount: () => admission.activeCount(),
    ghostCount: () => ghosts.size,
    // Minimap feed: revealed ghosts' arena positions in raw MJCF coords
    // (trunk.position is set from qpos before the root's Z-up fix).
    mapDots: () =>
      [...ghosts.values()]
        .filter((g) => g.revealed)
        .map((g) => ({ x: g.trunk.position.x, y: g.trunk.position.y })),
    debug: () => [...ghosts.values()].map((g) => {
      let meshes = 0, visible = 0, op = null, twins = 0;
      g.rig.root.traverse((o) => {
        if (!o.isMesh) return;
        if (o.userData.ghostPrepass) { twins++; return; }
        meshes++; if (o.visible) visible++; op ??= o.material.opacity;
      });
      const w = g.trunk.getWorldPosition(g.trunk.position.clone());
      return { p: g.trunk.position.toArray(), world: w.toArray(), inScene: !!g.rig.placer.parent, revealed: g.revealed, meshes, visible, twins, op, v: g.variant, gapAvg: g.gapAvg, delay: g.delay, bufLen: g.buf.length };
    }),
    update() {
      const now = performance.now();
      // Frame delta for the delay slew; capped so a long-occluded tab's
      // first frame back just snaps the delay while nobody was watching.
      const dt = Math.min(250, now - lastUpdateAt);
      lastUpdateAt = now;
      for (const g of ghosts.values()) {
        // Adaptive playback delay: track the measured arrival cadence with
        // margin, floored at the healthy-peer delay. Slew-limited to half
        // real time so render time never runs backward while the delay
        // grows (slow-motion instead of reverse) and only gently
        // fast-forwards (x1.5) while it shrinks back.
        const target = Math.min(
          INTERP_DELAY_MAX_MS,
          Math.max(INTERP_DELAY_MS, g.gapAvg * 1.25 + 50),
        );
        const slew = dt * DELAY_SLEW;
        g.delay += Math.min(slew, Math.max(-slew, target - g.delay));
        const renderT = now - g.delay;
        const buf = g.buf;
        // Drop snapshots fully in the past; keep [0] and [1] bracketing
        // renderT (or the two newest, if renderT has caught up).
        while (buf.length > 2 && buf[1].at <= renderT) buf.shift();
        const a = buf[0];
        const b = buf.length > 1 ? buf[1] : a;
        // Clamped: before the segment -> a, past the newest -> hold b.
        const span = b.at - a.at;
        const u = span > 0 ? Math.min(1, Math.max(0, (renderT - a.at) / span)) : 1;
        // Trunk pose in raw MJCF coords: the cloned root applies Z-up -> Y-up.
        g.trunk.position.set(
          a.p[0] + (b.p[0] - a.p[0]) * u,
          a.p[1] + (b.p[1] - a.p[1]) * u,
          a.p[2] + (b.p[2] - a.p[2]) * u,
        );
        _qa.set(a.p[4], a.p[5], a.p[6], a.p[3]); // THREE order x,y,z,w
        _qb.set(b.p[4], b.p[5], b.p[6], b.p[3]);
        g.trunk.quaternion.copy(_qa.slerp(_qb, u));
        for (let i = 0; i < jointNames.length; i++) {
          setJoint(g.rig, jointNames[i], a.j[i] + (b.j[i] - a.j[i]) * u);
        }
        setJawOpen(g.rig, a.w + (b.w - a.w) * u);
      }
    },
  };
  stopRelayWatch = watchOpenRelays(getRelaySockets, () => {
    if (destroyed) return;
    api.destroy();
    onUnavailable();
  });
  liveInstances.add(api);
  return api;
}
