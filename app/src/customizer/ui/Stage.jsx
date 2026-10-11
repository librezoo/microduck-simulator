import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { applyPose, buildRig, groundFullBody, loadKinematics } from "../../game/duck.js";
import { inkEdgeStyle, studioMaterialHook, PRINTED_FINISH } from "../studio-materials.js";

const SELECTED_OPACITY_MIN = 0.72;
const SELECTED_OPACITY_MAX = 1;
const SELECTED_STILL_OPACITY = 0.84;
const SELECTED_BREATHING_SPEED = Math.PI * 1.15;
const RECOLOUR_MS = 150;

// ── model ──────────────────────────────────────────────────────────────────
function StudioModel({ studio, urls, colors, selectedId, modelRef, reducedMotion, onReady, onError, onSelect, onHover }) {
  const [rig, setRig] = useState(null);
  const selectedMeshes = useRef([]);
  const reduced = useRef(reducedMotion);
  reduced.current = reducedMotion;

  useFrame(({ clock }) => {
    if (!selectedMeshes.current.length) return;
    const opacity = reduced.current
      ? SELECTED_STILL_OPACITY
      : THREE.MathUtils.lerp(SELECTED_OPACITY_MIN, SELECTED_OPACITY_MAX, (Math.sin(clock.elapsedTime * SELECTED_BREATHING_SPEED) + 1) / 2);
    for (const mesh of selectedMeshes.current) mesh.material.opacity = opacity;
  });

  useEffect(() => {
    let live = true;
    (async () => {
      const kinematics = await loadKinematics(urls.kinematics);
      const built = await buildRig(kinematics, {
        glbUrl: urls.glb,
        materialForMesh: studioMaterialHook(studio),
        inkEdges: inkEdgeStyle,
      });
      applyPose(built, studio.manifest.pose);
      groundFullBody(built, 0);
      built.placer.rotation.y = studio.manifest.view.yaw;
      built.placer.updateMatrixWorld(true);
      if (!live) return;
      const box = new THREE.Box3().setFromObject(built.placer);
      const size = box.getSize(new THREE.Vector3());
      // what the camera has to fit: the height, and the width the model sweeps
      // when it is orbited (its footprint diagonal)
      modelRef.current = {
        root: built.placer,
        center: box.getCenter(new THREE.Vector3()),
        height: size.y,
        spread: Math.hypot(size.x, size.z),
      };
      setRig(built);
      onReady?.(modelRef.current);
    })().catch((error) => live && onError?.(error));
    return () => {
      live = false;
      modelRef.current = null;
    };
  }, [studio, urls, modelRef, onReady, onError]);

  // Colours, selection and the printed finish. Meshes get their own material
  // the first time they are seen, so recolouring one part never touches another.
  useLayoutEffect(() => {
    if (!rig) return undefined;
    const transitions = [];
    const selected = [];
    rig.placer.traverse((object) => {
      if (object.isLineSegments) object.raycast = () => {};
      if (!object.isMesh || !object.userData.meshName) return;
      const part = studio.partForMeshInstance(object.userData.meshName, object.userData.bodyName, object.userData.meshOccurrence);
      if (!part) return;
      object.userData.studioPartId = part.id;
      if (!object.userData.studioMaterial) {
        object.material = object.material.clone();
        object.userData.studioMaterial = true;
        // the English label is what the 3MF files and the parts list carry
        object.userData.partLabel = part.label.en;
      }
      const target = new THREE.Color(colors[part.id]);
      if (!object.userData.studioColorReady || reduced.current) {
        object.material.color.copy(target);
        object.userData.studioColorReady = true;
      } else if (!object.material.color.equals(target)) {
        transitions.push({ material: object.material, from: object.material.color.clone(), to: target });
      }
      object.material.roughness = PRINTED_FINISH.roughness;
      object.material.metalness = PRINTED_FINISH.metalness;
      object.material.emissive.set("#000000");
      object.material.emissiveIntensity = 0;
      const isSelected = part.id === selectedId;
      if (object.material.transparent !== isSelected) {
        object.material.transparent = isSelected;
        object.material.depthWrite = !isSelected;
        object.material.needsUpdate = true;
      }
      object.material.opacity = isSelected ? (reduced.current ? SELECTED_STILL_OPACITY : SELECTED_OPACITY_MAX) : 1;
      if (isSelected) selected.push(object);
    });
    selectedMeshes.current = selected;
    if (!transitions.length) return undefined;
    let frame = 0;
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / RECOLOUR_MS);
      const eased = 1 - (1 - t) ** 3;
      for (const transition of transitions) transition.material.color.lerpColors(transition.from, transition.to, eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      // land on the target even when a newer edit interrupts the fade
      for (const transition of transitions) transition.material.color.copy(transition.to);
    };
  }, [studio, colors, rig, selectedId]);

  if (!rig) return null;
  const partIdOf = (event) => {
    const hits = [event.object, ...(event.intersections ?? []).map((hit) => hit.object)];
    return hits.find((object) => object?.userData?.studioPartId)?.userData?.studioPartId ?? null;
  };
  return (
    <primitive
      object={rig.placer}
      onClick={(event) => {
        const id = partIdOf(event);
        if (!id) return;
        event.stopPropagation();
        onSelect(id);
      }}
      onPointerMove={(event) => {
        // hover is a mouse affordance; a finger is rotating, not pointing
        if (event.nativeEvent.pointerType !== "mouse") return;
        const id = partIdOf(event);
        // the nearest part only: the hits behind it must not overwrite it
        if (id) event.stopPropagation();
        onHover(id, event.nativeEvent.clientX, event.nativeEvent.clientY);
      }}
      onPointerOut={() => onHover(null)}
    />
  );
}

// ── floor: two thin amber orbits and a pool of shade, like the site ────────
function useFloorTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    glow.addColorStop(0, "rgba(255,122,47,0.16)");
    glow.addColorStop(0.55, "rgba(255,122,47,0.05)");
    glow.addColorStop(1, "rgba(255,122,47,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);
    const shade = ctx.createRadialGradient(128, 128, 0, 128, 128, 74);
    shade.addColorStop(0, "rgba(0,0,0,0.62)");
    shade.addColorStop(0.6, "rgba(0,0,0,0.32)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

function Floor() {
  const texture = useFloorTexture();
  return (
    <group rotation-x={-Math.PI / 2} position-y={0.0004}>
      <mesh>
        <circleGeometry args={[0.62, 64]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.254, 0.2556, 128]} />
        <meshBasicMaterial color="#ff7a2f" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.395, 0.3964, 128]} />
        <meshBasicMaterial color="#ff7a2f" transparent opacity={0.24} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── camera: orbit, framing inside the free area between the panels ─────────
// The canvas fills the stage and the panels float over it, so the model is
// fitted to the rectangle the panels leave free (CSS draws that rectangle; the
// probe element measures it) and the projection is shifted to its centre.
function StageCamera({ view, bounds, freeRef, action, reducedMotion }) {
  const { camera, gl, size } = useThree();
  const controlsRef = useRef(null);
  // moved: the person has orbited or zoomed, so a resize keeps their view.
  // silent: the change events of our own home/zoom moves are not theirs.
  const framing = useRef({ moved: false, distance: 0.75, gesture: false, silent: false });
  const homeDirection = useMemo(
    () => new THREE.Vector3(...view.camera).sub(new THREE.Vector3(...view.target)).normalize(),
    [view],
  );

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enablePan = false;
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = 0.08;
    controls.addEventListener("start", () => { framing.current.gesture = true; });
    controls.addEventListener("end", () => { framing.current.gesture = false; });
    controls.addEventListener("change", () => {
      if (framing.current.gesture && !framing.current.silent) framing.current.moved = true;
    });
    controlsRef.current = controls;
    return () => controls.dispose();
  }, [camera, gl, reducedMotion]);

  const home = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { distance } = framing.current;
    framing.current.silent = true;
    controls.target.copy(bounds ? bounds.center : new THREE.Vector3(...view.target));
    camera.position.copy(controls.target).addScaledVector(homeDirection, distance);
    controls.update();
    framing.current.silent = false;
    framing.current.moved = false;
  };

  // fit the model to the free rectangle whenever the stage or the model changes
  useLayoutEffect(() => {
    const controls = controlsRef.current;
    const probe = freeRef.current;
    if (!controls || !probe || !size.width) return undefined;
    const fit = () => {
      const canvas = gl.domElement.getBoundingClientRect();
      const free = probe.getBoundingClientRect();
      if (!free.width || !free.height) return;
      const offsetX = free.left + free.width / 2 - canvas.left - canvas.width / 2;
      const offsetY = free.top + free.height / 2 - canvas.top - canvas.height / 2;
      camera.setViewOffset(canvas.width, canvas.height, -offsetX, -offsetY, canvas.width, canvas.height);
      camera.updateProjectionMatrix();
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const half = { y: (bounds?.height ?? 0.3) / 2, x: (bounds?.spread ?? 0.3) / 2 };
      const distance = Math.max(
        (half.y * canvas.height) / (tan * free.height * 0.8),
        (half.x * canvas.height) / (tan * free.width * 0.82),
      );
      framing.current.distance = distance;
      controls.minDistance = distance * 0.35;
      controls.maxDistance = distance * 2.4;
      if (!framing.current.moved) home();
      else controls.update();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(probe);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, size.width, size.height, bounds, freeRef]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !action?.seq) return;
    if (action.type === "home") home();
    else {
      const factor = action.type === "in" ? 0.82 : 1.22;
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
      framing.current.silent = true;
      controls.update();
      framing.current.silent = false;
      framing.current.moved = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  useFrame(() => controlsRef.current?.update());
  return null;
}

// ── the canvas ─────────────────────────────────────────────────────────────
export default function Stage({
  studio, urls, colors, selectedId, modelRef, freeRef, action, reducedMotion,
  onReady, onError, onSelect, onHover,
}) {
  const [bounds, setBounds] = useState(null);
  const handleReady = useMemo(() => (model) => {
    setBounds({ center: model.center, height: model.height, spread: model.spread });
    onReady?.(model);
  }, [onReady]);

  return (
    <Canvas
      className="lz-canvas"
      camera={{ fov: studio.manifest.view.fov, near: 0.01, far: 50, position: studio.manifest.view.camera }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={1.45} />
      <hemisphereLight color="#fff8eb" groundColor="#1c1823" intensity={1.25} />
      <directionalLight color="#fff0d6" position={[1.5, 2.2, 1.8]} intensity={2.6} />
      <directionalLight color="#ff7a2f" position={[-1.2, 0.8, -1.2]} intensity={1.15} />
      <Floor />
      <StudioModel
        studio={studio}
        urls={urls}
        colors={colors}
        selectedId={selectedId}
        modelRef={modelRef}
        reducedMotion={reducedMotion}
        onReady={handleReady}
        onError={onError}
        onSelect={onSelect}
        onHover={onHover}
      />
      <StageCamera view={studio.manifest.view} bounds={bounds} freeRef={freeRef} action={action} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
