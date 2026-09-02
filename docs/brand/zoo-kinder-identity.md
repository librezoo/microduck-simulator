# Zoo Kinder identity provenance

Date: 2026-09-02 (Asia/Shanghai)

The current Zoo Kinder mark and app icon were generated for this repository
with OpenAI image generation through Codex. The mark was generated from text
only. The app icon used the generated mark as its sole image reference. No
Pollen Robotics or Microduck artwork was supplied to either generation.

This record establishes the project's creation process; it is not a warranty
that no independently created work is similar. MicroZoo releases the final
project files under Apache-2.0 to the extent it holds copyright or other
licensable rights. Product names and source-identifying uses remain governed by
`TRADEMARKS.md`.

## Master mark prompt

```text
Use case: logo-brand
Asset type: transparent master emblem for Zoo Kinder by MicroZoo
Primary request: design a mature postmodern abstract mark: one heavy archway, an offset sun disc, a striped half-circle and a spotted vertical bar arranged as a compact geometric totem; the animal idea must exist only through pattern and rhythm, never through a literal animal silhouette
Style/medium: 1980s European postmodern identity system, Bauhaus-informed geometry, flat screen-printed vector-like raster, asymmetric but disciplined, museum or experimental architecture studio quality
Composition/framing: compact near-square symbol, centered, generous clear space, strong at 32px
Color palette: tangerine orange, warm cream, near-black ink, exactly one small acid-cyan accent
Text: no text
Constraints: true transparent alpha background; completely original; hard flat color only; crisp edges; no glow; no shadow; no gradients; no texture outside the shapes; no animal faces or bodies; no bird or duck; no robot; no existing logo; no watermark
Avoid: cute, childish, nursery, mascot, zoo gate illustration, theme-park logo, glossy rendering, neon glow, photorealism, resemblance to Pollen Robotics or Microduck
```

Generated PNG SHA-256:
`e73eaded0c38865848818f4b84c13e07a518369e14e60cc401cbfe37683e1952`

The tracked 512 px WebP was resized and encoded with `cwebp -q 92 -m 6`.
Tracked file: `app/public/assets/zoo-kinder-mark.webp`.
SHA-256: `35589da2a760606d5a8540865984403ef3775bf2268481774c904d6e60ea223a`.

## App icon prompt

```text
Use case: logo-brand
Asset type: 1024 by 1024 iOS app icon for Zoo Kinder
Input images: Image 1 is the approved postmodern Zoo Kinder master mark and must define the identity
Primary request: adapt the exact same geometric arch, orange disc, striped half-circle, spotted vertical bar, and small cyan circle into a polished square app icon
Style/medium: flat postmodern institutional graphic, crisp vector-like raster
Composition/framing: center and scale the mark with generous iOS-safe padding; keep every element comfortably inside the square
Scene/backdrop: solid warm cream background, fully opaque
Text: no text
Constraints: preserve the mark's geometry, asymmetric balance, palette and proportions; fully opaque square; hard flat colors; no new motifs; no glow; no shadows; no gradients; no words; no watermark
Avoid: childish styling, mascot faces, glossy rendering, rounded-square border, resemblance to Pollen Robotics or Microduck
```

Generated PNG SHA-256:
`bc8a75cd23d9834da7603aab175e451dadea764cd3515895ac3de61e9ae3e573`.

The tracked icon was resized to 1024 x 1024 with macOS `sips`. Both iOS
repositories contain the same bytes.
SHA-256: `176646da371c5f38ea356326266900750415d882c780d330fd356dabb8429e8f`.
