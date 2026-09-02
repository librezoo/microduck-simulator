import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const voiceRoot = new URL("../public/assets/voices/", import.meta.url);

function assertGeneratedPcmWav(bytes, name) {
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${name} must be RIFF`);
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WAVE", `${name} must be WAVE`);
  assert.equal(bytes.readUInt16LE(20), 1, `${name} must use integer PCM`);
  assert.equal(bytes.readUInt16LE(22), 1, `${name} must be mono`);
  assert.equal(bytes.readUInt32LE(24), 48_000, `${name} must be 48 kHz`);
  assert.equal(bytes.readUInt16LE(34), 16, `${name} must be 16-bit`);
  assert.ok(bytes.byteLength > 44, `${name} must contain audio samples`);
}

test("ships four complete generated PCM voice banks", async () => {
  const names = [
    ...[..."abcdefghijkl"].map((take) => `chirp_${take}.wav`),
    ...["a", "b"].flatMap((take) => [
      `wheee_start_${take}.wav`,
      `wheee_loop_${take}.wav`,
      `wheee_end_${take}.wav`,
    ]),
  ];

  for (const bank of ["duck1", "duck2", "duck3", "duck4"]) {
    const files = await Promise.all(names.map(async (name) => [
      name,
      await readFile(new URL(`${bank}/${name}`, voiceRoot)),
    ]));
    for (const [name, bytes] of files) assertGeneratedPcmWav(bytes, `${bank}/${name}`);
  }
});

test("ships the generated Wawa recipe as PCM WAV", async () => {
  assertGeneratedPcmWav(await readFile(new URL("wawa.wav", voiceRoot)), "wawa.wav");
});
