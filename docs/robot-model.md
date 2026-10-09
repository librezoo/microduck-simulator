# Robot model

The simulator renders and simulates MicroZoo's own body, the `microduck_927` CAD
export (the robot that is printed and assembled), not a third-party model.
Everything under `app/public/robot/microzoo/` is generated; do not edit it by
hand.

```bash
python3 -m venv .venv && .venv/bin/pip install numpy trimesh shapely mapbox_earcut lxml \
    fast-simplification mujoco
.venv/bin/python tools/build_robot_model.py --src /path/to/microduck_927 \
    --out app/public/robot/microzoo
```

`--src` is the directory holding `microduck_927.xml` and `meshes/*.stl`.

## What the generator does

| Output | Content |
|---|---|
| `microduck.glb` | every part welded and decimated (~150k triangles in total). File names travel as glTF `extras.meshFile` because three's loader strips `.` from node names. Also holds the convex collision hulls (`col_*`) that MuJoCo reads back out as STL |
| `kinematics.json` / `kinematics_rollers.json` | body tree, joints and visual geoms; same schema `duck.js` has always read |
| `robot_allcollisions.xml` / `_rollers.xml` | physics MJCF. Inertials, joints, sensors and actuator defaults are the CAD's; colliders are the feet, battery, hips, shins and head shells, like the deployment stack's all-collisions set |
| `meshes/*.stl` | roller-only parts, lazy-loaded with the roller variant |
| `model-report.json` | per-part source, triangle counts, notes |

Parts get readable names (`head_dome`, `shin_left`, ...) through `ALIASES` and
`SIDE_ALIASES` in the tool; left and right are resolved from the geometry. The
Color Studio part list (`app/src/customizer/studio-parts.js`) and the colour
slots (`app/src/game/variants.js`) use those names, so renaming a part means
changing all three.

## What is generated, not copied

- **Reference parts** (battery, SBC, camera, idler bearing) become proxy solids
  sized to their bounding boxes. The `REF_POLLEN_*` electronics are dropped.
- **Sole pad.** The CAD has no pad. A slab with the foot block's footprint is
  generated under each foot, 2.86 mm thick, which restores the 2.8 mm sole
  height the policies were trained at. Its mass is 13.2 g: the printed 7.5 g
  pad plus about 5.7 g of foot hardware that is not modelled. The CAD ankle is
  13 g lighter than the assembly the shipped policies were trained on; with the
  measured 7.5 g alone walking works but the sprint policy tops out near
  0.9 m/s, with 13.2 g it holds the same speed without falling. Override with
  `--pad-mass`.
- **Roller ankle.** The CAD has no roller hardware, so side plates, rims, tyres
  and axle caps are generated from primitives. The assembly's mass, inertia and
  wheel positions are carried over from the previous roller model so the Drive
  policy keeps the dynamics it was trained on. This is an open item in
  `ASSET_LICENSES.md`: replace it with values measured on MicroZoo hardware.
- **No beak.** The 927 head is a closed visor with one camera eye, so the quack
  animation (`setJawOpen` in `duck.js`) pulses the eye ring and lens instead of
  swinging a jaw.

## Checks worth running after regenerating

```bash
cd app && npm test                      # part lists resolve exactly once
npm run dev                             # walk, Shift+W sprint, M for rollers, ?studio=1
```

The studio test (`test/studio-parts.test.js`) fails if a printed part is added
to or removed from the model without updating `studio-parts.js`.
