# Adding a creature to the simulator and LibreZoo Studio

LibreZoo is a collection; Duck is its first creature. The browser tools
(simulator and Studio) know a creature through three things. Nothing else in
`app/src` names one.

1. **A model directory**: `app/public/robot/<dir>/` with the GLB, the
   kinematics JSON and a generated `studio.json`.
2. **A registry entry** in `app/src/creatures/index.js`.
3. **A website entry** in `librezoo_web/site/data/creatures.json` (the other
   repo; it links to `/<id>/sim/` and to `?creature=<id>` on the Studio).

## What the model tool must emit

`tools/build_robot_model.py --src <CAD dir> --out app/public/robot/<dir>`
writes the model. `--manifest-only` writes only `studio.json` and leaves the
GLB, kinematics and MJCF alone:

```bash
tools-venv/bin/python tools/build_robot_model.py \
  --src ../microduck_927 --out app/public/robot/librezoo --manifest-only
```

`studio.json` (schema `librezoo.studio/1`, checked by
`app/src/customizer/studio-manifest.js`; a broken file is refused with the
reason, and the build tool fails if a target is missing from the model or a
mesh is neither printed nor listed as hardware):

| key | meaning |
|---|---|
| `schema`, `creature` | `"librezoo.studio/1"` and the creature id |
| `model.glb`, `model.kinematics` | file names inside the model directory |
| `export` | `filePrefix` (`duck-<n>-<code>.3mf`), `zipPrefix` (`<zipPrefix>-<date>.zip`), `title`, `description` written into the 3MF |
| `view` | `fov`, `camera`, `target`, `yaw` of the home view |
| `pose` | joint name to angle, the display pose |
| `hardware` | look of bought parts: `default` and per-mesh `{color, roughness, metalness}` |
| `groups[]` | `{id, label{en,zh}, parts[]}`; a part is `{id, label{en,zh}, color, targets[]}`, a target is `{body, mesh, occurrence}` exactly as `game/duck.js` numbers mesh instances |
| `printOrder` | every part id once; the absolute numbers of the exported files follow it |
| `colorways[]` | `{id, name{en,zh}, stripe[3 colours], colors{partId: hex}}`, complete or partial |

Both languages are required for every label. Chinese part names are Chinese.
Colours are `#RRGGBB`. A mesh instance belongs to at most one part.

## The registry entry

```js
{
  id: "heron",                       // ?creature=heron, /heron/sim/, storage key
  name: { en: "Heron", zh: "Heron" },
  modelDir: "./robot/heron",
  studioManifest: "./robot/heron/studio.json",
  credit: { ... },                   // optional lineage line, shown in the Studio
}
```

Once the entry exists the Studio lists the creature in its switcher, opens
`?creature=heron`, builds the parts rail, the colour inspector, the colourways
and the numbered 3MF export from `studio.json`, and saves the design under
`librezoo.color-studio.v2.heron` (Duck keeps the original key, which the
simulator reads). An unknown `?creature=` shows a page that lists the known
ones. The simulator side of a new creature (policies, joint names, scenes) is
separate work; the Studio needs only the model and the manifest.

Bump `MESH_VERSION` (`app/src/game/mesh-version.js`) when a model or manifest
changes: it is the cache-buster of every model file and of `studio.json`.

## Routes

| where | what |
|---|---|
| `/` (local dev) | simulator; `?studio=1` is the Studio |
| `/<id>/sim/` | the simulator, served by a container |
| `studio.<host>/` | the Studio (`?creature=<id>`, default Duck) |
| `studio.<host>/<id>/sim/` | the same simulator build, same origin, so "Run design" hands the palette over through localStorage |
| any path ending in `/studio/` | the Studio |

The build uses relative asset URLs (`base: "./"`), so one `dist/` works at
all of them. The operator has to answer `/<id>/sim/` and `/studio/` with that
`dist/` and strip (or rewrite away) the prefix for files; the SPA fallback is
`index.html`. See `app/src/routes.js` for the exact rules.
