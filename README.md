---
title: Microduck Sandbox
emoji: 🐤
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 8080
pinned: false
---

# Zoo Kinder simulator

Real trained RL policies compatible with the Microduck robot, running fully in the
browser: MuJoCo compiled to WebAssembly steps the physics, onnxruntime-web
runs the policy network at 50 Hz. No server, no backend.

The simulator is served at https://duck.librezoo.com/sim/ (a live deployment, not a
cleared release; see docs/legal/release-readiness.md for the open name and
rights items). The LibreZoo web
sites (https://librezoo.com and https://duck.librezoo.com) live in the
`librezoo_web` repository, not in this one.

Two locomotion variants of the same robot are included: **legs** (walking,
the default) and **rollers** (the wheeled skating variant). Press `M` (or
hold D-pad up ~1 s on a gamepad) to switch; the roller model, meshes and
policies are lazy-loaded on the first switch.

The feet model also has a **Pose motions** control stack. Select `Motions` in
the HUD, then choose one of four original movement styles. Each 14-joint motion
offset is generated deterministically in the browser at 50 Hz from smooth
functions around the neutral pose and layered over the existing feedback-
stabilized Stand policy. This path loads no tracking model, recording or CSV.

The HUD can also switch between the compact **Arcade** and a full-size
**Dining Room**. The room asset is loaded only on first use; both scene
collision sets are already resident, so later switches are immediate. Scene
switching preserves the selected Skills/Motions control stack and respawns the
robot at a safe scene-specific start point.

## Policies and motions

The complete default policy set is taken from `microduck/robotd-params` and
the simulator copies are byte-for-byte identical to the deployment assets.
Initial boot loads only the seven leg deployment networks; Roller Drive is
loaded on the first switch to rollers, while Roller Crouch remains inventory
only.
Idle legs use the standing network at the deployed 0.05 twist threshold;
roller mode is deliberately one self-contained Drive skill. Its checkpoint
inventory still includes Roller Crouch for completeness, but the simulator
does not schedule another action policy while rollers are active.

| Mode | Implementation | What it does |
|--------|-----------|--------------|
| Walk (legs) | `BEST_alpha_walking.onnx` | Velocity-tracking locomotion (arrows / WASD to steer) |
| Stand / recover (legs) | `BEST_alpha_stand.onnx` | Holds at idle and owns automatic fall recovery |
| Sit / rise (legs) | `BEST_alpha_sitstand.onnx` | Sits down on its hull, stands back up |
| Ground pick (legs) | `alpha_ground_pick.onnx` | Phase-driven beak-to-ground motion |
| Roll (legs) | `roulade.onnx` | Forward roulade; hold gamepad X to chain |
| Kick (legs) | `ball_kick_left.onnx` / `ball_kick_right.onnx` | Blind one-shot kick (0.5 s window, zeroed commands), left or right leg |
| Drive (rollers) | `BEST_roller.onnx` | Velocity-tracking skating on 4 passive wheels (higher top speed: 0.6 m/s) |
| Roller Crouch (bundled only) | `BEST_roller_crouch.onnx` | Official checkpoint retained in the catalogue; not scheduled in Roller mode |
| Pose motions (legs) | `src/game/procedural-motions.js` | Generates four gentle 50 Hz joint-offset sequences over the stabilized Stand policy |

Policies from
[micro-zoo/microduck](https://github.com/micro-zoo/microduck)
and [micro-zoo/microduck_rl](https://github.com/micro-zoo/microduck_rl). The
robot model is LibreZoo's own `microduck_927` CAD, generated into
`app/public/robot/librezoo/` by `tools/build_robot_model.py`; see
[docs/robot-model.md](docs/robot-model.md).
The four pose motions are project-authored procedural code. Their existing clip
IDs and timings remain stable for saved selections and native diagnostics, but
their joint trajectories do not depend on an external motion asset.

## Controls

- Arrows or WASD (ZQSD): forward / back + turn
- M: switch legs <-> rollers
- X: forward roll (feet only)
- G: ground pick (feet only)
- Q / E (A / E on AZERTY): kick left / right (feet only)
- R: sit / stand (feet only)
- C: toggle the chase camera (on by default; dragging detaches it)
- Space: reset
- Drag to orbit, scroll to zoom
- Colour dots: repaint the duck (it quacks)
- Scene panel: switch between Arcade and Dining Room
- Control panel: switch between operator-driven Skills and Pose motions
- Pose Motion: switching styles starts the new motion at frame 0 without
  resetting physics

## Color Studio

The title screen links to a dedicated browser-based Color Studio (`?studio=1`).
It reuses the simulator's production robot geometry and visual language,
while adding per-part color controls, full-robot colorways and a live orbit
preview with direct part picking. Export produces a ZIP containing a
standards-based complete-assembly `.3mf`, a CSV part manifest, and individually
numbered `.3mf` files grouped by five-digit Bambu colour code. The picker
includes the 30 Bambu PLA Basic display colours and catalogue colour numbers;
exact matches are named in the 3MF material table. Designs are saved locally,
and **Run design**
opens the real simulator with the same per-part palette on both feet and roller
models.

Roller mode only runs its Drive skill. Roll, ground pick, kicks, sit/stand
and head-mode inputs are ignored until you switch back to Feet.

Pose motions are feet-only. Selecting Motions while rollers are active switches
back to feet; selecting rollers during a motion returns to the Skills stack.
Normal locomotion, sit, roll, kick and head-mode inputs do not alter the robot
while a pose motion owns control. Reset restarts the selected motion. Each
generated sequence runs once and returns to Skills after its final frame.

### URL parameters

- `?boot=1`: skip the welcome modal and land straight on the BIOS console,
  which then shows the real loading progress live (honest loader) before
  the normal entrance plays. Boot failures (missing asset, policy fetch
  error...) freeze the console on a `SYSTEM HALTED` screen with the error
  detail - handy for debugging.

The ball is local-only: it lives in your tab's physics and is not shared
with the multiplayer ghosts. Arcade uses a 3 x 3 m safety arena; Dining Room
uses the 10.4 x 10.4 m boundary and furniture collision proxies from the
referenced room setup.

Dining Room uses [Dining room | Kichen baked](https://sketchfab.com/3d-models/dining-room-kichen-baked-4831c2ce6a0044d9bee9eacefcc0f2bd)
by [ChristyHsu](https://sketchfab.com/ida61xq), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its placement and
collision proxies follow the read-only
[microduck-racer reference](https://huggingface.co/spaces/Nirav-Madhani/microduck-racer).

### Gamepad

Plug in a controller and the same mapping as the real robot runtime applies:

- Left stick: forward / back + turn
- Right stick: orbit the camera (detaches the chase cam)
- R3 (right stick click): toggle the chase cam back on
- X: forward roll; hold to chain another (feet only)
- A: ground pick (feet only)
- RB / LB: right / left kick (feet only)
- D-pad down: sit / stand toggle (feet only)
- D-pad up: hold ~1 s to switch legs <-> rollers (the real robot uses a 3 s hold)
- D-pad right: hold ~1 s to toggle Pose motions
- Right trigger: mouth (analog) + quack

## Multiplayer ghosts

Public multiplayer is optional and **off by default**. After a user explicitly
enables it, other opted-in visitors show up as translucent ducks. Peer-to-peer
WebRTC uses [Trystero](https://github.com/dmotz/trystero) with public Nostr
signaling relays, so peers and relay operators receive connection metadata as
described in [PRIVACY.md](PRIVACY.md). Each enabled tab broadcasts its duck's
pose (trunk + 14 joints + jaw + colour + locomotion variant) at 15 Hz. The
reference client admits and renders at most 3 peers and rate-limits inbound
state. Turning the option off leaves the room immediately.

Ghost limitations in v1: a peer in roller mode renders with the roller rig
only if your tab has already loaded it (otherwise it falls back to the leg
rig), and ghost wheels don't spin (passive wheel joints aren't broadcast).
Old clients simply ignore the new variant flag.

## How it works

The app is a Vite + React + MUI shell around an imperative game core:
React/MUI renders the UI chrome (title menu, BIOS console, HUD, touch
overlay), react-three-fiber owns the canvas/lights/environment, and the
physics/policy/rig loop lives in framework-agnostic modules under
`app/src/game/`. A zustand store bridges the two (game state out,
UI intents in).

- `app/src/game/game.js` fetches the MJCF (`robot_allcollisions.xml`, or
  `robot_allcollisions_rollers.xml` for the roller variant), strips the
  visual geoms, injects a floor, arena walls, a ball, a collision box for
  the arcade cabinet row and a STAND keyframe, and compiles it with the
  official `@mujoco/mujoco` WASM bindings.
- The regular Skills stack on both variants shares the exact same policy interface: 61D observation
  (gyro, projected gravity, 14 joint pos/vel, last action, 13D command)
  and 14 position-targets, matching [`microduck_rl/scripts/infer_policy.py`](https://github.com/pollen-robotics/microduck_rl/blob/main/scripts/infer_policy.py).
  The roller variant adds 4 passive wheel hinges that appear in `qpos`
  (zeroed in the keyframe) but not in the observation.
- Pose motions layer 14 deterministic offsets over the feedback-stabilized
  Stand policy at the same 50 Hz control cadence. A zero-slope envelope makes
  every style depart from and return to its neutral target smoothly before
  ownership returns to Skills.
- Rendering is a three.js rig built from `kinematics.json` /
  `kinematics_rollers.json` + decimated STL meshes, driven directly from
  MuJoCo `qpos` (including the passive wheel spin).
- Switching variants swaps the compiled model + data + rig + ONNX sessions
  wholesale; both stay resident after the first load so toggling back and
  forth is instant.

## Zoo Kinder iOS app

`ios/Microduck.xcodeproj` builds **Zoo Kinder**, published under the LibreZoo
brand. It is a native SwiftUI app that hosts the same simulator in one
long-lived `WKWebView`. The Vite bundle, MuJoCo and ONNX Runtime WASM, fonts,
policies, scenes, meshes and audio are copied into the `.app`; simulation is
fully offline. The iOS reference build disables public multiplayer and public
community links. `Microduck` remains the internal compatibility/target name.

Before the first build, materialize the Git LFS assets and install JavaScript
dependencies:

```bash
git lfs install
git lfs pull
cd app && npm ci
open ../ios/Microduck.xcodeproj
```

Choose your Development Team in Xcode, then run the `Microduck` scheme on an
iPhone running iOS 17 or later. The checked-in project can be regenerated from
`ios/project.yml` with `cd ios && xcodegen generate`.

The iOS host serves bundle files through a path-restricted `microduck://`
scheme with explicit WASM, model, font and audio MIME types plus byte-range
support. It forwards app lifecycle, thermal state and Low Power Mode to the
simulator, reloads after a WebContent process termination and opens HTTPS links
in the system browser.

The native performance profiles favor sustained frame pacing over peak refresh:

- normal: 60 fps, DPR 1.5, 2x offscreen MSAA;
- thermal `fair`: 60 fps, DPR 1.25;
- Low Power Mode or thermal `serious`: 30 fps, DPR 1, no extra MSAA or animated noise;
- background or thermal `critical`: physics, inference, rendering and ghost broadcasts pause.

`WKWebView` currently has no public ProMotion/120 Hz control, so the app targets
a stable 60 fps ceiling. A true 120 Hz requirement would need a later native
Metal renderer rather than a private WebKit setting.

## Licensing and asset boundary

The declared license for project-authored source code and documentation is the
[Apache License 2.0](LICENSE). Copyright remains with each contributor, and the
license can cover only material whose rights holder authorized it; adding the
license file does not retroactively relicense third-party work. That license
also does not automatically cover every model, room, policy, sound, font,
texture, or brand asset in `app/public/`.

- [ASSET_LICENSES.md](ASSET_LICENSES.md) is the controlling per-asset inventory
  and identifies both separately licensed files and unresolved `PENDING`
  material.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) contains software, font, and
  Creative Commons attribution notices.
- [TRADEMARKS.md](TRADEMARKS.md) explains the separate Zoo Kinder and LibreZoo
  brand-use boundary, and that the LibreZoo / 狸波 names are not yet cleared.
- [PRIVACY.md](PRIVACY.md) describes the default-off public multiplayer data
  flow and the additional review required for child-directed distribution.
- `app/public/legal/` is copied into web and iOS builds so the applicable
  license and attribution text accompanies binary distributions.
- [docs/legal/release-readiness.md](docs/legal/release-readiness.md) records the
  remaining model, historical-source, contributor, trademark, and publisher
  decisions that code changes alone cannot clear.

Do not publish a revision or binary that contains an item marked `PENDING`.
Until those entries are removed or separately cleared, the complete runnable
distribution must not be described as wholly open source, even when it is
offered without charge.

Command-line verification:

```bash
cd app && npm test && npm run build
cd ../ios
xcodebuild -project Microduck.xcodeproj -scheme Microduck \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

## Development

```bash
cd app
npm install
npm run dev     # dev server on http://localhost:5173
npm run build   # production bundle in app/dist/
```

The Space builds with the included `Dockerfile` (Vite build, served by
nginx-unprivileged on port 8080). Static assets (meshes, policies, audio,
images) live in `app/public/` and keep their historical URLs.
