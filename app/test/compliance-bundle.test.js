import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const appFile = (path) => new URL(`../${path}`, import.meta.url);
const rootFile = (path) => new URL(`../../${path}`, import.meta.url);

const requiredLegalFiles = [
  "public/legal/LICENSE-APACHE-2.0.txt",
  "public/legal/PROJECT-NOTICE.txt",
  "public/legal/PRIVACY.txt",
  "public/legal/TRADEMARKS.txt",
  "public/legal/ASSET-ATTRIBUTIONS.txt",
  "public/legal/THIRD-PARTY-NOTICES.txt",
  "public/legal/NPM-PRODUCTION-LICENSES.txt",
  "public/legal/ONNXRUNTIME-THIRD-PARTY-NOTICES.txt",
  "public/legal/MUJOCO-WASM-THIRD-PARTY-NOTICES.txt",
];

test("ships the complete offline legal and privacy bundle", async () => {
  for (const path of requiredLegalFiles) {
    const info = await stat(appFile(path));
    assert.ok(info.size > 100, `${path} should contain a substantive notice`);
  }
  for (const path of ["LICENSE", "NOTICE", "ASSET_LICENSES.md", "THIRD_PARTY_NOTICES.md", "TRADEMARKS.md", "PRIVACY.md"]) {
    const info = await stat(rootFile(path));
    assert.ok(info.size > 100, `${path} should exist at repository root`);
  }

  const disclosure = await readFile(appFile("src/ui/LegalDisclosure.jsx"), "utf8");
  for (const path of requiredLegalFiles) {
    assert.match(disclosure, new RegExp(path.split("/").at(-1).replaceAll(".", "\\.")));
  }
});

test("does not ship the removed standalone or unproven assets", async () => {
  const forbidden = [
    "public/assets/rooms/loft-13.glb",
    "public/assets/rooms/vintage-living-room.glb",
    "public/assets/props/arcade.glb",
    "public/assets/ball/soccer-color.png",
    "public/assets/duck-head-mark.webp",
    "public/assets/zoo-kinder-mark.webp",
    "public/robot/mjlab/microduck.glb",
    "public/robot/microzoo/microduck.glb",
    "public/assets/microzoo-mark.svg",
    "public/robot/mjlab/robot_allcollisions.xml",
    "public/assets/microduck-wordmark.svg",
    "public/assets/stickers/quack.webp",
    "public/assets/voices/wawa.mp3",
    "public/wbc/microduck-wbc/policy.onnx",
  ];
  for (const path of forbidden) {
    await assert.rejects(access(appFile(path)), undefined, `${path} must stay absent`);
  }
});

test("records every retained Creative Commons room in code and notices", async () => {
  const scenes = await readFile(appFile("src/game/scenes.js"), "utf8");
  const notices = await readFile(appFile("public/legal/ASSET-ATTRIBUTIONS.txt"), "utf8");
  for (const marker of ["ChristyHsu", "crispimrafael", "carlcapu9", "CC BY 4.0"]) {
    assert.match(scenes, new RegExp(marker));
    assert.match(notices, new RegExp(marker));
  }
});

test("trademark notices never claim the publisher names are cleared", async () => {
  for (const file of [rootFile("TRADEMARKS.md"), appFile("public/legal/TRADEMARKS.txt")]) {
    const text = await readFile(file, "utf8");
    assert.match(text, /no (trademark )?(search|clearance)/i);
    assert.doesNotMatch(text, /LibreZoo[^.]*\b(is|are) (cleared|registered)/i);
  }
});
