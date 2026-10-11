# Third-party notices

This file accompanies the project `NOTICE` and `ASSET_LICENSES.md`. It records
the direct software dependencies and third-party material known to be shipped
in the browser bundle. It does not grant rights to any item marked `PENDING` in
`ASSET_LICENSES.md`.

## Runtime libraries

Versions below are locked by `app/package-lock.json` at the time this notice
was prepared. The lockfile is authoritative for the exact transitive closure.
The complete 119-package production inventory and its license texts are
preserved in
`app/public/legal/NPM-PRODUCTION-LICENSES.txt`. ONNX Runtime's upstream v1.27.0
binary notices are preserved verbatim in
`app/public/legal/ONNXRUNTIME-THIRD-PARTY-NOTICES.txt`. Both files are copied
into browser and iOS builds.

The libraries statically linked into MuJoCo's 3.11.0 WebAssembly binary and
their exact pinned notices are preserved in
`app/public/legal/MUJOCO-WASM-THIRD-PARTY-NOTICES.txt`.

| Package | Version | License | Copyright / project | Source |
|---|---:|---|---|---|
| `@emotion/react`, `@emotion/styled` | 11.14.0, 11.14.1 | MIT | Emotion team and contributors | <https://github.com/emotion-js/emotion> |
| `@fontsource/anton` / Anton Font | 5.3.0 | SIL OFL 1.1 | 2020 The Anton Project Authors | <https://github.com/googlefonts/AntonFont> |
| `@mui/material` | 9.3.1 | MIT | 2014 Call-Em-All and MUI contributors | <https://github.com/mui/material-ui> |
| `@mujoco/mujoco` | 3.11.0 | Apache-2.0 | Google DeepMind and MuJoCo contributors | <https://github.com/google-deepmind/mujoco> |
| `@react-three/fiber` | 9.7.0 | MIT | 2019-2025 Poimandres | <https://github.com/pmndrs/react-three-fiber> |
| adapted `@react-three/drei` Grid shader | source adaptation | MIT | 2020 react-spring | <https://github.com/pmndrs/drei> |
| `onnxruntime-web` | 1.27.0 | MIT | Microsoft Corporation | <https://github.com/microsoft/onnxruntime> |
| `react`, `react-dom` | 19.2.8 | MIT | Meta Platforms, Inc. and affiliates | <https://github.com/facebook/react> |
| `three` | 0.164.1 | MIT | 2010-2024 three.js authors | <https://github.com/mrdoob/three.js> |
| `trystero` | 0.25.3 | MIT | 2021 Dan Motzenbecker | <https://github.com/dmotz/trystero> |
| `zustand` | 5.0.15 | MIT | 2019 Paul Henschel | <https://github.com/pmndrs/zustand> |

Build-only packages such as Vite and `@vitejs/plugin-react` are also recorded
in the lockfile. If their code is copied into a distribution, preserve their
license files as well. The installed production closure includes permissive
MIT, Apache-2.0, BSD, ISC, and SIL OFL components and may change with any
lockfile update. Regenerate the complete production inventory after every
dependency change; do not assume that the checked-in notice remains current.

## Upstream Microduck policy files

Nine ONNX files identified in `ASSET_LICENSES.md` are redistributed from the
Apache-2.0-licensed `pollen-robotics/microduck` project. Preserve its copyright
and attribution notices. The upstream project is available at:

<https://github.com/pollen-robotics/microduck>

No Pollen 3D assets are shipped: the robot model is LibreZoo's own CAD
(see `ASSET_LICENSES.md` and `docs/robot-model.md`).

The newly generated voice assets use the Apache-2.0 upstream `sounds/` crate
from the same source at revision
`590b986bd8c0d50ae02cb3ea2f59c463b6828168`. No upstream audio recording is
embedded in those generated WAV files. Generation inputs and commands are in
`app/public/assets/voices/README.md`.

`app/src/game/arena.js` contains an adapted implementation of the
`@react-three/drei` Grid shader. Drei is MIT-licensed, Copyright (c) 2020
react-spring. Its MIT terms are reproduced below.

## Creative Commons room assets

- **Dining room | Kichen baked**, by ChristyHsu (`@ida61xq`):
  <https://sketchfab.com/3d-models/dining-room-kichen-baked-4831c2ce6a0044d9bee9eacefcc0f2bd>
- **Appartement**, by SrMonteiro (`@crispimrafael`):
  <https://sketchfab.com/3d-models/appartement-6a7a5fe208344b2e8123a88923dbd5b3>
- **Backrooms VR**, by carlcapu9:
  <https://sketchfab.com/3d-models/backrooms-vr-d9b98eca8d064d0eafcd7f5484bb61ed>

Each is used under Creative Commons Attribution 4.0 International:
<https://creativecommons.org/licenses/by/4.0/>. The project converts or
packages the rooms as GLB and applies runtime transforms, material adjustments,
placement, and collision behavior. Detailed change notices are in
`ASSET_LICENSES.md`. No endorsement by the creators is implied.

## MIT License text

The following text applies to the MIT-licensed packages identified above,
with the copyright notice for each package as listed in its distributed
package metadata and in the table above:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## SIL Open Font License 1.1

Copyright 2020 The Anton Project Authors
(<https://github.com/googlefonts/AntonFont.git>)

This Font Software is licensed under the SIL Open Font License, Version 1.1:

> PREAMBLE
>
> The goals of the Open Font License (OFL) are to stimulate worldwide
> development of collaborative font projects, to support the font creation
> efforts of academic and linguistic communities, and to provide a free and
> open framework in which fonts may be shared and improved in partnership with
> others.
>
> The OFL allows the licensed fonts to be used, studied, modified and
> redistributed freely as long as they are not sold by themselves. The fonts,
> including any derivative works, can be bundled, embedded, redistributed
> and/or sold with any software provided that any reserved names are not used
> by derivative works. The fonts and derivatives, however, cannot be released
> under any other type of license. The requirement for fonts to remain under
> this license does not apply to any document created using the fonts or their
> derivatives.
>
> DEFINITIONS
>
> "Font Software" refers to the set of files released by the Copyright
> Holder(s) under this license and clearly marked as such. This may include
> source files, build scripts and documentation.
>
> "Reserved Font Name" refers to any names specified as such after the
> copyright statement(s).
>
> "Original Version" refers to the collection of Font Software components as
> distributed by the Copyright Holder(s).
>
> "Modified Version" refers to any derivative made by adding to, deleting, or
> substituting -- in part or in whole -- any of the components of the Original
> Version, by changing formats or by porting the Font Software to a new
> environment.
>
> "Author" refers to any designer, engineer, programmer, technical writer or
> other person who contributed to the Font Software.
>
> PERMISSION & CONDITIONS
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of the Font Software, to use, study, copy, merge, embed, modify, redistribute,
> and sell modified and unmodified copies of the Font Software, subject to the
> following conditions:
>
> 1) Neither the Font Software nor any of its individual components, in Original
> or Modified Versions, may be sold by itself.
>
> 2) Original or Modified Versions of the Font Software may be bundled,
> redistributed and/or sold with any software, provided that each copy contains
> the above copyright notice and this license. These can be included either as
> stand-alone text files, human-readable headers or in the appropriate machine-
> readable metadata fields within text or binary files as long as those fields
> can be easily viewed by the user.
>
> 3) No Modified Version of the Font Software may use the Reserved Font Name(s)
> unless explicit written permission is granted by the corresponding Copyright
> Holder. This restriction only applies to the primary font name as presented
> to the users.
>
> 4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
> Software shall not be used to promote, endorse or advertise any Modified
> Version, except to acknowledge the contribution(s) of the Copyright Holder(s)
> and the Author(s) or with their explicit written permission.
>
> 5) The Font Software, modified or unmodified, in part or in whole, must be
> distributed entirely under this license, and must not be distributed under
> any other license. The requirement for fonts to remain under this license
> does not apply to any document created using the Font Software.
>
> TERMINATION
>
> This license becomes null and void if any of the above conditions are not met.
>
> DISCLAIMER
>
> THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
> OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT,
> TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE
> FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL,
> INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF
> CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE
> THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

The Apache License 2.0 text for this project and MuJoCo is in `LICENSE`.
