// Ball visuals: the soccer panel and bump maps are baked from the original
// spherical-Voronoi generator. Loading two local textures avoids doing
// millions of site comparisons and trigonometric operations on every boot.
import * as THREE from "three";
import { BALL_RADIUS } from "./constants.js";
import { signed } from "./signed.js";

async function loadSoccerBallTexture(renderer) {
  const loader = new THREE.TextureLoader();
  const [map, bumpMap] = await Promise.all([
    loader.loadAsync(signed("./assets/ball/soccer-color.png")),
    loader.loadAsync(signed("./assets/ball/soccer-bump.png")),
  ]);
  map.colorSpace = THREE.SRGBColorSpace;
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  map.anisotropy = anisotropy;
  bumpMap.anisotropy = anisotropy;
  return { map, bumpMap };
}

// Same Z-up -> Y-up trick as the duck rig: the group takes the axis fix,
// the mesh inside takes the raw MJCF free-joint pose.
export async function createBallVisual(renderer) {
  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  const tex = await loadSoccerBallTexture(renderer);
  const mesh = new THREE.Mesh(
    // 48x32 segments: the coarser default makes the UV interpolation near
    // the poles visibly scallop the round cap edge of the texture.
    new THREE.SphereGeometry(BALL_RADIUS, 48, 32),
    new THREE.MeshPhysicalMaterial({
      map: tex.map,
      bumpMap: tex.bumpMap,
      bumpScale: 0.0012,
      metalness: 0,
      roughness: 0.55,
      clearcoat: 0.2,
      clearcoatRoughness: 0.35,
    }),
  );
  mesh.userData.meshName = "ball";
  // The 48x32 render sphere is far too dense for the wireframe scan (it
  // reads as a solid glowing blob); the FX overlay uses this geodesic
  // stand-in instead - 80 triangles, clean hologram lines.
  mesh.userData.fxWireGeometry = new THREE.IcosahedronGeometry(BALL_RADIUS, 1);
  mesh.visible = false;
  group.add(mesh);
  return { group, mesh };
}
