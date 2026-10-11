import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { LANGS, STRINGS, translate } from "../src/customizer/ui/strings.js";

// Parameters to call the function-valued strings with.
const SAMPLE = [3, 12, "Head dome"];
const render = (lang, key) => {
  const value = STRINGS[key][lang];
  return typeof value === "function" ? value(...SAMPLE) : value;
};

// Words that are the same in both languages on purpose: product names that
// Bambu Lab prints, and the product name itself.
const SAME_IN_BOTH = new Set(["studio", "bambu"]);

test("every string has English and Chinese, as the same kind of value", () => {
  for (const [key, entry] of Object.entries(STRINGS)) {
    for (const lang of LANGS) {
      assert.ok(lang in entry, `${key}.${lang} is missing`);
      assert.equal(typeof entry[lang], typeof entry.en, `${key}: ${lang} and en differ in kind`);
      assert.ok(String(render(lang, key)).trim().length > 0, `${key}.${lang} is empty`);
    }
    if (typeof entry.en === "function") assert.equal(entry.zh.length, entry.en.length, `${key}: parameter count`);
  }
});

test("Chinese strings are translated, not copied", () => {
  for (const key of Object.keys(STRINGS)) {
    if (SAME_IN_BOTH.has(key)) continue;
    assert.notEqual(render("zh", key), render("en", key), `${key} is untranslated`);
  }
});

test("brand rule: Chinese copy that says LibreZoo also says 狸波", () => {
  for (const key of Object.keys(STRINGS)) {
    const zh = String(render("zh", key));
    if (zh.includes("LibreZoo")) assert.ok(zh.includes("狸波"), `${key}: ${zh}`);
  }
  // and no forbidden names creep into the English
  for (const key of Object.keys(STRINGS)) {
    const text = `${render("en", key)} ${render("zh", key)}`;
    assert.doesNotMatch(text, /MicroZoo|microzoo\.ai/i, key);
  }
});

test("translate falls back to English and to the key", () => {
  assert.equal(translate("zh", "exportZip"), "导出 ZIP");
  assert.equal(translate("en", "exportZip"), "Export ZIP");
  assert.equal(translate("en", "partsOf", 2, 32), "Part 2 of 32");
  assert.equal(translate("zh", "partsOf", 2, 32), "第 2 / 32 个");
  assert.equal(translate("fr", "exportZip"), "Export ZIP");
  assert.equal(translate("en", "nope"), "nope");
});

test("every t(\"key\") in the Studio UI exists in the dictionary", () => {
  const dirs = [new URL("../src/customizer/", import.meta.url), new URL("../src/customizer/ui/", import.meta.url)];
  const used = new Map();
  for (const dir of dirs) {
    for (const file of readdirSync(dir)) {
      if (!/\.jsx?$/.test(file) || file === "strings.js") continue;
      const source = readFileSync(new URL(file, dir), "utf8");
      for (const match of source.matchAll(/\bt\(\s*"([A-Za-z0-9]+)"/g)) used.set(match[1], file);
      // keys held in tables (tab labels)
      for (const match of source.matchAll(/\[\s*"[a-z]+"\s*,\s*"([A-Za-z0-9]+)"\s*\]/g)) if (match[1] in STRINGS) used.set(match[1], file);
    }
  }
  assert.ok(used.size > 40, "found the keys in use");
  for (const [key, file] of used) assert.ok(key in STRINGS, `${file} uses missing string "${key}"`);
  // and nothing in the dictionary is dead weight
  const all = [...dirs].flatMap((dir) => readdirSync(dir).filter((f) => /\.jsx?$/.test(f) && f !== "strings.js").map((f) => readFileSync(new URL(f, dir), "utf8"))).join("\n");
  const unused = Object.keys(STRINGS).filter((key) => !all.includes(`"${key}"`));
  assert.deepEqual(unused, [], "strings nothing refers to");
});
