// Cache-busting version appended to the GLB / kinematics / leftover STL
// fetches and to the Studio manifest. Bump whenever microduck.glb is
// regenerated or moved. Its own module so the Studio can read it without
// loading the rig builder (and three) first.
export const MESH_VERSION = "14";
