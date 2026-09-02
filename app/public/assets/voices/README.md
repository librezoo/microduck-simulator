# Generated voice assets

The WAV files listed below are original generated assets made for this project and are
released under this repository's Apache License 2.0:

- `duck1` through `duck4`: `chirp_a.wav` through `chirp_l.wav`
- `duck1` through `duck4`: `wheee_start_a.wav`, `wheee_loop_a.wav`,
  `wheee_end_a.wav`, `wheee_start_b.wav`, `wheee_loop_b.wav`, and
  `wheee_end_b.wav`
- `wawa.wav`

The generation path synthesizes PCM from oscillator and noise recipes. No input audio
recording was supplied when these files were rendered.

## Generator provenance

- Repository: [`pollen-robotics/microduck`](https://github.com/pollen-robotics/microduck)
- Source directory in a normal upstream clone: `sounds/`
- Commit: `590b986bd8c0d50ae02cb3ea2f59c463b6828168`
- Generator source license at that revision: Apache License 2.0
- Output format: 48 kHz, mono, 16-bit PCM WAV

This records the generator revision and its declared license; it does not make broader
claims about the repository history or files not listed above. In particular,
`wawa.mp3` is not an output of this workflow and is not covered by this declaration.

## Fixed inputs

| Simulator bank | Generator seed |
| --- | ---: |
| `duck1` | `26090301` |
| `duck2` | `26090302` |
| `duck3` | `26090303` |
| `duck4` | `26090304` |

Each bank uses `chirp` variants 0 through 11 for filenames `a` through `l` and
segmented `wheee` variants 0 and 1 for filenames `a` and `b`. `wawa.wav` uses the
`greet` recipe, seed `26090301`, variant 0.

## Regeneration

Run these commands from a checkout containing both repositories. Replace the two path
placeholders with local absolute paths:

```bash
GENERATOR_ROOT=/path/to/pollen-robotics/microduck
SIMULATOR_ROOT=/path/to/microduck-simulator
VOICE_OUTPUT=$(mktemp -d)

cargo build --release -p sounds --manifest-path "$GENERATOR_ROOT/Cargo.toml"
SOUNDS_BIN="$GENERATOR_ROOT/target/release/sounds"

for pair in "duck1 26090301" "duck2 26090302" "duck3 26090303" "duck4 26090304"; do
  bank=${pair% *}
  seed=${pair#* }
  "$SOUNDS_BIN" render-all "$VOICE_OUTPUT/$bank" --seed "$seed"
  cp "$VOICE_OUTPUT/$bank/chirp/"*.wav \
    "$SIMULATOR_ROOT/app/public/assets/voices/$bank/"
  cp "$VOICE_OUTPUT/$bank/wheee/"wheee_{start,loop,end}_{a,b}.wav \
    "$SIMULATOR_ROOT/app/public/assets/voices/$bank/"
done

"$SOUNDS_BIN" render greet "$SIMULATOR_ROOT/app/public/assets/voices/wawa.wav" \
  --seed 26090301 --variant 0
```

The `render-all` command also creates recipes and variants that the simulator does not
use; the copy commands intentionally select only the files declared above.
