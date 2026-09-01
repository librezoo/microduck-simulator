// R3F shell around the imperative game core. The Canvas owns the renderer,
// default camera and the rAF loop; <Game> boots the core once and drives it
// from useFrame. Lights and environment are declarative; the grid, walls,
// duck rig, ball and props are added to the scene by the core (they carry
// ceremony-driven shader state).
import { useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { bootGame } from "../game/game.js";
import { gameApi } from "../store.js";
import { SPAWN_X, SPAWN_Y } from "../game/constants.js";
import CrtDistortion, { CRT_DISTORTION_ENABLED } from "./CrtDistortion.jsx";
import { useGame } from "../store.js";
import {
  getPerformanceProfile,
  postNative,
  subscribePerformanceProfile,
} from "../native/runtime.js";

function usePerformanceProfile() {
  const [profile, setProfile] = useState(getPerformanceProfile);
  useEffect(() => subscribePerformanceProfile(() => setProfile(getPerformanceProfile())), []);
  return profile;
}

function FrameScheduler({ targetFps, suspended }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (suspended) return undefined;
    let frameId = 0;
    let previous = 0;
    const interval = 1000 / targetFps;
    const tick = (now) => {
      if (!previous || now - previous >= interval - 1) {
        previous = now;
        invalidate();
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [invalidate, suspended, targetFps]);

  return null;
}

function Game() {
  const { scene, camera, gl } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color(0x08080c);
    gl.setClearColor(0x08080c, 1);
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
    scene.environmentIntensity = 0.45;
    bootGame({ scene, camera, renderer: gl });
  }, [scene, camera, gl]);

  useEffect(() => {
    const canvas = gl.domElement;
    const onContextLost = (event) => {
      event.preventDefault();
      postNative({ type: "webgl-context-lost" });
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    return () => canvas.removeEventListener("webglcontextlost", onContextLost);
  }, [gl]);

  // dt clamped so a background-tab stall can't slingshot the camera orbit.
  useFrame((_, dt) => {
    gameApi.frame?.(Math.min(dt, 0.05));
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 2]} intensity={1.6} />
      <directionalLight position={[-2, 2, 1.5]} intensity={0.4} />
      <directionalLight color={0xffb366} position={[0, 3, -2]} intensity={0.7} />
    </>
  );
}

export default function GameCanvas() {
  const profile = usePerformanceProfile();
  const menuOpen = useGame((state) => state.menuOpen);
  const targetFps = profile.native && menuOpen ? 15 : profile.targetFps;

  return (
    <Canvas
      style={{ position: "fixed", inset: 0, zIndex: 1 }}
      dpr={profile.native ? profile.maxDpr : [1, profile.maxDpr]}
      frameloop={profile.native ? "demand" : "always"}
      gl={{ antialias: !profile.native, alpha: false }}
      // Boot framing translated onto the spawn cell (the orbit target
      // follows), so the follow-cam has nothing to drift toward during boot.
      camera={{
        fov: 40,
        near: 0.02,
        // The Backrooms scene keeps its authored ~29 m span; a 50 m far
        // plane leaves room for its widest chase/orbit framing.
        far: 50,
        position: [SPAWN_X + 0.55, 0.35, -SPAWN_Y + 0.7],
      }}
    >
      {profile.native ? (
        <FrameScheduler targetFps={targetFps} suspended={profile.suspended} />
      ) : null}
      <Game />
      {CRT_DISTORTION_ENABLED && <CrtDistortion samples={profile.msaaSamples} />}
    </Canvas>
  );
}
