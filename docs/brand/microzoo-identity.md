# MicroZoo identity

Date: 2026-10-10 (Asia/Shanghai)

The MicroZoo mark was designed from scratch by Claude (Anthropic) at MicroZoo's
request. It is hand-authored SVG: one stroked path and three circles. No
reference artwork, existing logo, image generator or font outline was used, and
nothing of Pollen Robotics or Microduck appears in it.

## Idea

A small open enclosure, a way out, and the things that live in it.

- **Enclosure** - a rounded square: the zoo, the habitat, one repository.
- **Open side** - the wall does not close. It leaves through the top-right
  corner and ends in a node, the way a branch leaves a commit graph. That is
  the open-source half of the mark: the work does not stay inside the fence.
- **Two dots** - a large and a small creature. Different sizes, one habitat:
  the community. They are the "micro" in MicroZoo.
- **Amber node** - the single accent, the colour of the duck's eye ring. It is
  the contribution leaving the enclosure.

It holds at 16 px (favicon) because it has only three weights of shape.

## Geometry (128 x 128 grid)

| Element | Definition |
|---|---|
| Enclosure | stroke 11, round caps and joins, path `M70 28H44a20 20 0 0 0-20 20v36a20 20 0 0 0 20 20h40a20 20 0 0 0 20-20V68c0-14 4-24 14-34` |
| Large creature | circle, centre (52, 82), r 11 |
| Small creature | circle, centre (76, 62), r 6.5 |
| Node | circle, centre (114, 26), r 12, fill `#FF7A2F` |
| Optical centring | the group is translated by (-8, 2) |

## Colours

| Name | Hex | Use |
|---|---|---|
| Ink | `#0B0B10` | mark on light, tile |
| Cream | `#F6F2E8` | mark on dark |
| Amber | `#FF7A2F` | node, always |

## Files

- `app/public/assets/microzoo-mark.svg` - ink mark, for light grounds
- `app/public/assets/microzoo-mark-cream.svg` - cream mark, for dark grounds
- `app/public/assets/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`
- `ios/Microduck/Assets.xcassets/AppIcon.appiconset/AppIcon.png` - 1024 px,
  opaque, full-bleed ink tile (iOS applies its own corner mask)

The canonical source and all exports live in the `microzoo-web` repository under
`brand/`. Trademark use of the name and mark is governed by `TRADEMARKS.md`.
