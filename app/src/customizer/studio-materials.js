import * as THREE from "three";

// The materialForMesh hook the Studio hands to buildRig: printed parts start
// in their default colour, everything else (bought hardware) takes the look
// the manifest gives it. Specs use linear RGB, like the simulator's variants.
const spec = (material) => ({
  color: new THREE.Color(material.color).toArray(),
  roughness: material.roughness,
  metalness: material.metalness,
});

export const PRINTED_FINISH = Object.freeze({ roughness: 0.42, metalness: 0.02 });

export function studioMaterialHook(studio) {
  const { hardware } = studio.manifest;
  const fallback = spec(hardware.default);
  const byMesh = new Map(Object.entries(hardware.meshes).map(([mesh, material]) => [mesh, spec(material)]));
  return (meshName, bodyName, _rgba, occurrence) => {
    const part = studio.partForMeshInstance(meshName, bodyName, occurrence);
    if (part) return { color: new THREE.Color(part.color).toArray(), ...PRINTED_FINISH };
    return byMesh.get(meshName) ?? fallback;
  };
}

// Interior ink lines, as the Studio has always drawn them.
export const inkEdgeStyle = Object.freeze({ color: 0x101018, opacity: 0.26, threshold: 48 });
