// Original, texture-free room sets assembled from Three.js primitives.
//
// These environments deliberately avoid downloaded meshes, image textures and
// font assets.  A small set of shared geometries/materials keeps them cheap to
// render on mobile while still giving each room a distinct architectural voice.

function makeRoomKit(THREE, palette) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.MeshStandardMaterial) {
    throw new Error("procedural room requires a complete THREE namespace");
  }

  const root = new THREE.Group();
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
    sphere: new THREE.SphereGeometry(1, 16, 10),
    torus: new THREE.TorusGeometry(1, 0.1, 10, 28),
  };
  const materials = Object.fromEntries(Object.entries(palette).map(([key, value]) => [
    key,
    new THREE.MeshStandardMaterial({
      color: value.color,
      roughness: value.roughness ?? 0.78,
      metalness: value.metalness ?? 0.02,
      emissive: value.emissive ?? 0x000000,
      emissiveIntensity: value.emissiveIntensity ?? 0,
    }),
  ]));

  function primitive(type, name, scale, position, material, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometries[type], materials[material]);
    mesh.name = name;
    mesh.scale.set(...scale);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    root.add(mesh);
    return mesh;
  }

  const box = (name, size, position, material, rotation) => (
    primitive("box", name, size, position, material, rotation)
  );
  const cylinder = (name, radius, depth, position, material, rotation) => (
    primitive("cylinder", name, [radius, depth, radius], position, material, rotation)
  );
  const sphere = (name, radius, position, material) => (
    primitive("sphere", name, [radius, radius, radius], position, material)
  );
  const torus = (name, radius, position, material, rotation = [0, 0, 0]) => (
    primitive("torus", name, [radius, radius, radius], position, material, rotation)
  );

  return { root, box, cylinder, sphere, torus };
}

function markOriginal(root, roomId) {
  root.userData = {
    ...root.userData,
    roomId,
    procedural: true,
    externalAssets: [],
    designOrigin: "MicroZoo original geometry",
  };
  return root;
}

export function createLoftRoom({ THREE }) {
  const { root, box, cylinder, sphere, torus } = makeRoomKit(THREE, {
    plaster: { color: 0xc8c2b7, roughness: 0.94 },
    concrete: { color: 0x777873, roughness: 0.9 },
    charcoal: { color: 0x202326, roughness: 0.7, metalness: 0.08 },
    clay: { color: 0x9a4f39, roughness: 0.82 },
    petrol: { color: 0x31575b, roughness: 0.72 },
    steel: { color: 0x8d9391, roughness: 0.42, metalness: 0.56 },
    glow: {
      color: 0xe0b879,
      roughness: 0.48,
      emissive: 0xb66f2f,
      emissiveIntensity: 0.22,
    },
  });

  // Architectural shell: warm concrete, an open camera side, and an
  // asymmetric structural rhythm instead of a literal domestic interior.
  box("loft-floor", [9.6, 0.16, 9.6], [0, -0.08, 0], "concrete");
  box("loft-back-wall", [9.6, 3.5, 0.16], [0, 1.75, -4.72], "plaster");
  box("loft-left-wall", [0.16, 3.5, 9.6], [-4.72, 1.75, 0], "plaster");
  box("loft-right-reveal", [0.16, 3.5, 2.6], [4.72, 1.75, -3.48], "charcoal");
  box("loft-overhead-beam", [9.55, 0.2, 0.22], [0, 3.18, -3.62], "charcoal");
  box("loft-column-a", [0.22, 3.2, 0.22], [-1.7, 1.6, -3.62], "steel");
  box("loft-column-b", [0.22, 3.2, 0.22], [2.25, 1.6, -3.62], "steel");

  // A deep teal portal interrupts the otherwise neutral shell.
  box("loft-portal-left", [0.25, 2.25, 0.36], [0.72, 1.125, -4.48], "petrol");
  box("loft-portal-right", [0.25, 2.25, 0.36], [2.62, 1.125, -4.48], "petrol");
  box("loft-portal-lintel", [2.15, 0.25, 0.36], [1.67, 2.125, -4.48], "petrol");

  // Low conversation island.  The spawn aisle along positive X remains clear.
  box("loft-island-plinth", [3.5, 0.12, 2.4], [-1.55, 0.06, 1.42], "charcoal");
  box("loft-sofa-seat-a", [1.7, 0.3, 0.72], [-2.22, 0.32, 1.66], "clay");
  box("loft-sofa-back-a", [1.7, 0.76, 0.18], [-2.22, 0.72, 1.98], "clay");
  box("loft-sofa-seat-b", [0.72, 0.3, 1.52], [-0.55, 0.32, 1.15], "petrol");
  box("loft-sofa-back-b", [0.18, 0.76, 1.52], [-0.24, 0.72, 1.15], "petrol");
  cylinder("loft-table", 0.48, 0.32, [-1.25, 0.28, 0.92], "steel");

  // Gallery objects: primitive, abstract, and intentionally non-figurative.
  cylinder("loft-sculpture-plinth", 0.55, 0.72, [-3.62, 0.36, -2.52], "charcoal");
  torus("loft-sculpture-ring", 0.67, [-3.62, 1.42, -2.52], "clay", [Math.PI / 2, 0.22, 0]);
  sphere("loft-sculpture-orb", 0.18, [-3.62, 1.42, -2.52], "glow");
  box("loft-diagonal-relief-a", [1.65, 0.16, 0.12], [-2.7, 2.38, -4.58], "clay", [0, 0, -0.38]);
  box("loft-diagonal-relief-b", [1.2, 0.16, 0.12], [-3.04, 1.76, -4.58], "petrol", [0, 0, 0.62]);
  sphere("loft-pendant", 0.18, [3.28, 2.56, -2.72], "glow");
  cylinder("loft-pendant-stem", 0.025, 0.62, [3.28, 2.96, -2.72], "steel");

  return markOriginal(root, "loft");
}

export function createVintageRoom({ THREE }) {
  const { root, box, cylinder, sphere, torus } = makeRoomKit(THREE, {
    stone: { color: 0x6e6c68, roughness: 0.94 },
    parchment: { color: 0xc7bba6, roughness: 0.9 },
    oxblood: { color: 0x5f2835, roughness: 0.78 },
    midnight: { color: 0x26364a, roughness: 0.72 },
    ochre: { color: 0xa57835, roughness: 0.8 },
    black: { color: 0x181a1d, roughness: 0.62, metalness: 0.12 },
    brass: { color: 0x9a8254, roughness: 0.36, metalness: 0.62 },
    glow: {
      color: 0xe4cfa4,
      roughness: 0.5,
      emissive: 0xa76832,
      emissiveIntensity: 0.2,
    },
  });

  // A postmodern salon: historical proportions are reduced to planes,
  // circles and stepped masses rather than copied period furniture.
  box("vintage-floor", [8.6, 0.16, 8.6], [0, -0.08, 0], "stone");
  box("vintage-back-wall", [8.6, 3.25, 0.16], [0, 1.625, -4.22], "parchment");
  box("vintage-right-wall", [0.16, 3.25, 8.6], [4.22, 1.625, 0], "midnight");
  box("vintage-left-return", [0.16, 3.25, 2.25], [-4.22, 1.625, -3.1], "oxblood");
  box("vintage-back-dado", [8.28, 0.72, 0.12], [0, 0.36, -4.10], "oxblood");

  // Circular wall composition nods to the 1970s without reproducing a
  // particular object or using a decorative texture.
  torus("vintage-wall-ring", 0.92, [1.76, 1.76, -4.04], "brass");
  cylinder(
    "vintage-wall-disc",
    0.69,
    0.12,
    [1.76, 1.76, -4.02],
    "midnight",
    [Math.PI / 2, 0, 0],
  );
  box("vintage-wall-bar", [2.25, 0.16, 0.12], [-1.6, 2.12, -4.02], "black", [0, 0, -0.18]);
  box("vintage-wall-block", [0.78, 0.78, 0.12], [-2.66, 1.48, -4.02], "ochre", [0, 0, 0.12]);

  // Stepped lounge platform sits on the positive side, leaving the existing
  // negative-X spawn and its forward route unobstructed.
  box("vintage-platform-low", [3.3, 0.16, 2.55], [1.72, 0.08, 1.18], "black");
  box("vintage-platform-high", [2.55, 0.18, 1.82], [1.9, 0.25, 1.34], "oxblood");
  box("vintage-seat-a", [1.58, 0.3, 0.72], [1.55, 0.51, 1.56], "parchment");
  box("vintage-seat-back-a", [1.58, 0.8, 0.18], [1.55, 0.91, 1.87], "parchment");
  box("vintage-seat-b", [0.72, 0.3, 1.35], [2.82, 0.51, 0.78], "midnight");
  box("vintage-seat-back-b", [0.18, 0.8, 1.35], [3.13, 0.91, 0.78], "midnight");
  cylinder("vintage-table-stem", 0.12, 0.42, [0.42, 0.45, 0.58], "brass");
  cylinder("vintage-table-top", 0.52, 0.1, [0.42, 0.7, 0.58], "black");

  // Asymmetric console and freestanding light balance the composition.
  box("vintage-console-low", [1.75, 0.54, 0.5], [-0.55, 0.27, -3.58], "midnight");
  box("vintage-console-high", [0.64, 1.1, 0.5], [0.25, 0.55, -3.58], "ochre");
  cylinder("vintage-lamp-base", 0.38, 0.12, [-3.38, 0.06, 2.72], "black");
  cylinder("vintage-lamp-stem", 0.035, 1.82, [-3.38, 0.97, 2.72], "brass");
  sphere("vintage-lamp-globe", 0.28, [-3.38, 1.94, 2.72], "glow");
  box("vintage-screen", [0.12, 1.95, 1.5], [3.88, 0.975, -2.1], "oxblood", [0, -0.28, 0]);
  torus("vintage-floor-object", 0.5, [-0.72, 0.58, 2.9], "ochre", [Math.PI / 2, 0.32, 0]);

  return markOriginal(root, "vintage");
}
