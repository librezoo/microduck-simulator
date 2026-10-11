# Asset licenses and provenance

This inventory controls the licensing boundary for non-code files in this
repository. The root `LICENSE` covers project-authored source code,
documentation, and only the assets explicitly marked `Apache-2.0` below. It
does not relicense third-party assets, trained-model weights, or other files
listed under separate or pending terms.

`PENDING` means that the repository does not yet contain enough provenance and
license evidence to authorize public redistribution. The project keeps such
files out of publishable releases and treats them as private-development inputs
only; this inventory does not itself establish a license even for that private
use. They must be removed or supported by written permission before publishing
source history, a web build, an App Store build, or another binary
distribution. A free or non-commercial release is still a distribution.

## LibreZoo visual identity

| Files | Owner/source record | License | Status |
|---|---|---|---|
| `app/public/assets/librezoo-mark.svg`, `librezoo-mark-cream.svg`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Hand-authored SVG geometry (one stroked path and three circles) designed from scratch for the project (then named MicroZoo) by Claude (Anthropic) on 2026-10-10; no reference artwork or existing logo was used. Raster files are exports of the same SVG | Apache-2.0, to the extent LibreZoo holds copyright or other licensable rights | Cleared |
| `ios/Microduck/Assets.xcassets/AppIcon.appiconset/AppIcon.png` | Export of the same SVG as a full-bleed ink tile | Apache-2.0, to the extent LibreZoo holds copyright or other licensable rights | Cleared |

The design rationale and the exact geometry are recorded in
`docs/brand/librezoo-identity.md`. The names and source-identifying use of the
artwork remain subject to `TRADEMARKS.md`. The project was named MicroZoo
until 2026-10-11, when it became LibreZoo (狸波); it is the same project under a
new name. The mark (2026-10-10) and the robot CAD export (2026-10-05, see
below) were created under the former name. The earlier generated Zoo Kinder
raster mark and its provenance record were removed when the vector identity
replaced them.

"Cleared" in this inventory means copyright and provenance only. It is not a
trademark clearance: no search has been made for LibreZoo, LIBRE ZOO or 狸波
(see `docs/legal/release-readiness.md`, section 4).

## Generated voice assets

| Files | Generation record | License | Status |
|---|---|---|---|
| `app/public/assets/voices/duck1/**` through `duck4/**`, limited to `chirp_a.wav` through `chirp_l.wav` and `wheee_{start,loop,end}_{a,b}.wav` | Generated on 2026-09-03 as 48 kHz mono PCM from seeded oscillator/noise recipes; no input audio recording was supplied | Apache-2.0 | Cleared |
| `app/public/assets/voices/wawa.wav` | Generated on 2026-09-03 from the same seeded synthesizer's `greet` recipe; no input audio recording was supplied | Apache-2.0 | Cleared |

The generator is the upstream `sounds/` crate from
[`pollen-robotics/microduck` at `590b986`](https://github.com/pollen-robotics/microduck/tree/590b986bd8c0d50ae02cb3ea2f59c463b6828168),
whose source is Apache-2.0 at that revision. The complete seed, variant, output,
and regeneration record is in `app/public/assets/voices/README.md`. LibreZoo
makes the listed generated files available under Apache-2.0 to the extent it
holds copyright or other licensable rights. This provenance record does not
warrant that no third-party rights exist.

Former duck-head, wordmark, sticker, and AppIcon artwork was replaced because
the repository did not contain a sufficient license record for public reuse.
Removing files from the current tree does not remove them from existing Git
history. Do not publish history containing those files unless the necessary
rights are documented or the files are removed from the history first.

## CC BY 4.0 room assets

The source and license pages below were reviewed on 2026-09-03. The following
assets are licensed separately under the [Creative Commons
Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/).
CC BY 4.0 permits sharing and adaptation, including commercial use, subject to
its attribution and other conditions. The attribution below must travel with
source and binary distributions.

### Dining Room

- Repository file: `app/public/assets/rooms/dining-room.glb`
- Original title: **Dining room | Kichen baked**
- Creator: **ChristyHsu** (`@ida61xq`)
- Source: <https://sketchfab.com/3d-models/dining-room-kichen-baked-4831c2ce6a0044d9bee9eacefcc0f2bd>
- License: <https://creativecommons.org/licenses/by/4.0/>
- Changes: converted from the supplied USDZ representation to GLB for web
  delivery; the simulator recenters and aligns the room, adjusts material
  presentation, and adds separately authored collision proxies.

### Apartment

- Repository file: `app/public/assets/rooms/apartment.glb`
- Original title: **Appartement**
- Creator: **SrMonteiro** (`@crispimrafael`)
- Source: <https://sketchfab.com/3d-models/appartement-6a7a5fe208344b2e8123a88923dbd5b3>
- License: <https://creativecommons.org/licenses/by/4.0/>
- Changes: packaged as GLB for this project and treated as modified; the
  simulator recenters and floor-aligns the room, adjusts material presentation,
  and supplies simulation placement and collision behavior. The historical
  import pipeline is not fully recorded, so no claim of byte identity with the
  source download is made.

### Backrooms

- Repository file: `app/public/assets/rooms/backrooms.glb`
- Original title: **Backrooms VR**
- Creator: **carlcapu9**
- Source: <https://sketchfab.com/3d-models/backrooms-vr-d9b98eca8d064d0eafcd7f5484bb61ed>
- License: <https://creativecommons.org/licenses/by/4.0/>
- Changes: packaged as GLB for this project and treated as modified; the
  simulator rescales, recenters, and floor-aligns the room, adjusts material
  presentation, and supplies simulation placement and collision behavior. The
  historical import pipeline is not fully recorded, so no claim of byte
  identity with the source download is made.

No endorsement by the licensors of LibreZoo, Zoo Kinder, or this adaptation is
implied. CC BY 4.0 provides the licensed material as-is and does not grant
trademark, privacy, publicity, or patent rights that its licensors do not
control.

## Programmatically generated visual assets

The current `Loft 13` and `Vintage Room` environments are generated by project
source code and do not use the former downloaded `loft-13.glb` or
`vintage-living-room.glb` files. Their project-authored source is Apache-2.0.

The current arcade props are likewise built from Three.js primitive geometry
and colour-only materials by `app/src/game/props.js`; no file under the former
`app/public/assets/props/` directory is loaded or shipped. The current football
surface is drawn at runtime by `app/src/game/ball-visual.js`; the former
`soccer-color.png` and `soccer-bump.png` are not loaded or shipped. These
project-authored procedural implementations are Apache-2.0.

The two former GLB files were subject to Sketchfab Free Standard terms, which
did not permit distributing the source models as standalone/extractable files.
They are absent from the current tree. The former downloaded prop GLBs and ball
textures also lacked a sufficient redistribution record and are absent from the
current tree. All of those removed files remain retrievable from pre-removal
Git history unless that history is rewritten or replaced with a clean public
history. Existing history must therefore not be redistributed until those
objects are purged or separate redistribution permission is obtained. Cleaning
the upstream history cannot revoke copies that third parties already obtained.

## LibreZoo robot model

| Files | Source record | License | Status |
|---|---|---|---|
| `app/public/robot/librezoo/**` (GLB, kinematics, MJCF, roller meshes) | Generated by `tools/build_robot_model.py` from LibreZoo's own `microduck_927` CAD export (2026-10-05). Third-party reference parts (battery, SBC, camera, idler bearing) are replaced by bounding-box proxy solids, `REF_POLLEN_*` electronics are dropped, the sole pad and the roller ankle (side plates, rims, tyres) are generated from primitives. See `docs/robot-model.md` | Apache-2.0, to the extent LibreZoo holds copyright or other licensable rights in the CAD | Cleared (LibreZoo-authored CAD); maintainers must confirm CAD ownership before release |

The former Pollen model (`robot/mjlab/**`, "Creative Commons BY-SA-NC" without
a stated version) is no longer shipped; it remains in pre-removal Git history
and that history must not be redistributed without permission. Joint names,
joint order, axes and limits follow the deployed Microduck policy contract: they
are the functional interface the Apache-2.0 policies require, not a copy of
the Pollen meshes. One item still carries a number from the old model: the
mass, inertia and wheel positions of the roller ankle assembly are kept so the
Drive policy sees the dynamics it was trained on. Replace them with values
measured on LibreZoo's own roller hardware, or obtain permission, before a
release that includes roller mode.

## Trained policies and motion data

The following nine deployment policies are byte-identical to files in the
Apache-2.0-licensed [`pollen-robotics/microduck` snapshot at
`590b986`](https://github.com/pollen-robotics/microduck/tree/590b986bd8c0d50ae02cb3ea2f59c463b6828168).
Their filename mapping is also recorded in that upstream project:

- `BEST_alpha_walking.onnx`
- `BEST_alpha_stand.onnx`
- `BEST_alpha_sitstand.onnx`
- `alpha_ground_pick.onnx`
- `ball_kick_left.onnx`
- `ball_kick_right.onnx`
- `BEST_roller.onnx`
- `BEST_roller_crouch.onnx`
- `roulade.onnx`

These files are distributed under Apache-2.0 with the upstream notices; see
`THIRD_PARTY_NOTICES.md`. This statement does not cover similarly named files
from another source or a future replacement.

Do not infer a license from a filename, authoring-tool metadata, repository
access, or the absence of a copyright notice. Replace a pending asset with a
documented original or permissively licensed equivalent, or record written
permission before distribution.

`policies/run.onnx` (DuckEMW fixed-head sprint) and
`policies/microduck_dance_4000.onnx` (beat-conditioned Dance Lab) are policies
trained inside the LibreZoo workspace. This repository does not contain their
training records. Status: **UNCONFIRMED** - maintainers must confirm that the
training code, data and reference motions are LibreZoo's own and record that
here before a public release. The earlier experimental `run.onnx` that had no
redistribution record is not the file shipped today; it remains in pre-removal
Git history.

The former `wbc/microduck-wbc/**` policy, runtime metadata, and CSV references
were also removed because the repository lacked an express redistribution
record for those outputs. The current four Pose motions are deterministic,
project-authored 50 Hz functions in `app/src/game/procedural-motions.js`; they
use no downloaded policy, motion file, or training data and are covered by the
project source license.

## Release checklist

Before publishing any revision or app build:

1. Confirm every shipped non-code file appears in this inventory and is not
   `PENDING`.
2. Confirm the rights holders of code imported before this repository adopted
   Apache-2.0 authorized distribution under compatible terms; a new root
   license cannot retroactively license someone else's contribution.
3. Confirm the former room, prop, ball-texture, brand, and audio assets are
   absent from both the public tree and public Git history.
4. Preserve this file, `NOTICE`, `THIRD_PARTY_NOTICES.md`, and the offline files
   under `app/public/legal/` in the distribution.
5. Make the legal/attribution page reachable from the product UI.
6. Archive source pages, license text, download date, original package, and the
   transformation record for third-party assets in the private release record.
7. Review App Store privacy disclosures and multiplayer consent separately;
   copyright clearance does not satisfy privacy or child-directed-app rules.
8. Confirm that a fresh trademark screen for LibreZoo, LIBRE ZOO, 狸波 and
   Zoo Kinder has been run and its outcome recorded in
   `docs/legal/release-readiness.md`, section 4.

This inventory records project evidence; it is not legal advice and does not
replace review for the jurisdictions in which a release is offered.
