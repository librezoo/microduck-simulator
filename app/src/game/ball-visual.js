// Original procedural ball visual. A small equirectangular pattern is painted
// once onto a canvas at boot, avoiding bundled or downloaded image assets.
import * as THREE from "three";
import { BALL_RADIUS } from "./constants.js";

export const BALL_TEXTURE_SIZE = Object.freeze({ width: 512, height: 256 });

const PANELS = Object.freeze([
  [0.00, 0.50, 0.075, 0.00],
  [0.25, 0.50, 0.075, 0.18],
  [0.50, 0.50, 0.075, -0.08],
  [0.75, 0.50, 0.075, 0.12],
  [1.00, 0.50, 0.075, 0.00],
  [0.125, 0.19, 0.055, 0.18],
  [0.375, 0.22, 0.055, -0.12],
  [0.625, 0.22, 0.055, 0.12],
  [0.875, 0.19, 0.055, -0.18],
  [0.125, 0.81, 0.055, -0.18],
  [0.375, 0.78, 0.055, 0.12],
  [0.625, 0.78, 0.055, -0.12],
  [0.875, 0.81, 0.055, 0.18],
]);

function polygon(ctx, cx, cy, radius, rotation, sides = 5) {
  ctx.beginPath();
  for (let index = 0; index < sides; index++) {
    const angle = rotation - Math.PI / 2 + (index * Math.PI * 2) / sides;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Paint the complete texture; exported so its deterministic recipe is tested. */
export function drawBallPattern(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = "#e8e1d5";
  ctx.fillRect(0, 0, width, height);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // A restrained seam lattice gives the sphere a familiar football read.
  ctx.strokeStyle = "#77787b";
  ctx.globalAlpha = 0.62;
  ctx.lineWidth = Math.max(1.5, width / 220);
  const rows = [
    [[0, 0.5], [0.125, 0.19], [0.25, 0.5], [0.375, 0.22], [0.5, 0.5], [0.625, 0.22], [0.75, 0.5], [0.875, 0.19], [1, 0.5]],
    [[0, 0.5], [0.125, 0.81], [0.25, 0.5], [0.375, 0.78], [0.5, 0.5], [0.625, 0.78], [0.75, 0.5], [0.875, 0.81], [1, 0.5]],
  ];
  for (const row of rows) {
    ctx.beginPath();
    row.forEach(([x, y], index) => {
      const px = x * width;
      const py = y * height;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // Graphite pentagons plus one cobalt panel form an original, logo-free
  // postmodern treatment while retaining the instant visual cue of a ball.
  ctx.globalAlpha = 1;
  for (const [index, [x, y, radius, rotation]] of PANELS.entries()) {
    polygon(ctx, x * width, y * height, radius * width, rotation, 5);
    ctx.fillStyle = index === 6 ? "#3159c7" : "#202124";
    ctx.fill();
    ctx.strokeStyle = "#171719";
    ctx.lineWidth = Math.max(1, width / 300);
    ctx.stroke();
  }

  // The red equatorial dash is intentionally asymmetric; it also makes spin
  // easy to read at phone scale without increasing sphere tessellation.
  ctx.fillStyle = "#d55237";
  ctx.fillRect(width * 0.575, height * 0.475, width * 0.055, height * 0.05);
  ctx.restore();
}

export function createBallTexture(renderer, documentRef = globalThis.document) {
  if (!documentRef?.createElement) {
    throw new Error("Canvas support is required to create the ball texture");
  }
  const canvas = documentRef.createElement("canvas");
  canvas.width = BALL_TEXTURE_SIZE.width;
  canvas.height = BALL_TEXTURE_SIZE.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Unable to create the ball texture canvas");
  drawBallPattern(ctx, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "procedural-football-pattern";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

// Same Z-up -> Y-up trick as the duck rig: the group takes the axis fix,
// the mesh inside takes the raw MJCF free-joint pose.
export async function createBallVisual(renderer) {
  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  const map = createBallTexture(renderer);
  const mesh = new THREE.Mesh(
    // 48x32 segments: the coarser default makes the UV interpolation near
    // the poles visibly scallop the round cap edge of the texture.
    new THREE.SphereGeometry(BALL_RADIUS, 48, 32),
    new THREE.MeshPhysicalMaterial({
      map,
      metalness: 0,
      roughness: 0.62,
      clearcoat: 0.12,
      clearcoatRoughness: 0.46,
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
