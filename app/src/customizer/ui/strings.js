// Every string of the Studio, in English and Simplified Chinese. A value is a
// string or a function of its parameters. Brand rule: Chinese copy shows
// LibreZoo first and 狸波 beside it ("LibreZoo 狸波" in running text; the
// lockup draws it smaller). Bambu product names and catalogue numbers stay as
// Bambu Lab prints them.
export const STRINGS = {
  // top bar
  studio: { en: "Studio", zh: "Studio" },
  lockupAria: { en: "LibreZoo home", zh: "LibreZoo 狸波 主页" },
  creature: { en: "Creature", zh: "生物" },
  chooseCreature: { en: "Choose a creature", zh: "选择生物" },
  bringCreature: { en: "Bring a creature", zh: "带一个小生物" },
  bringCreatureNote: { en: "Add yours to the Studio", zh: "把你的生物加进 Studio" },
  langAria: { en: "Switch language to Simplified Chinese", zh: "切换到 English" },
  langShort: { en: "中", zh: "EN" },
  runDesign: { en: "Run design", zh: "运行设计" },
  runDesignAria: { en: "Run this design in the simulator", zh: "在模拟器中运行这个设计" },
  exportZip: { en: "Export ZIP", zh: "导出 ZIP" },
  exporting: { en: "Building…", zh: "打包中…" },
  exportAria: { en: "Export the 3MF ZIP print package", zh: "导出 3MF ZIP 打印包" },
  exportingAria: { en: "Building the 3MF ZIP print package", zh: "正在生成 3MF ZIP 打印包" },

  // parts
  parts: { en: "Parts", zh: "零件" },
  partsCount: { en: (n) => `${n} printed parts`, zh: (n) => `${n} 个打印件` },
  partsOf: { en: (i, n) => `Part ${i} of ${n}`, zh: (i, n) => `第 ${i} / ${n} 个` },
  partRowAria: { en: (name, code) => `${name}, filament ${code}`, zh: (name, code) => `${name}，耗材 ${code}` },
  nearest: { en: "nearest Bambu colour", zh: "最接近的 Bambu 颜色" },
  partGroups: { en: "Part groups", zh: "零件分组" },

  // colour
  colour: { en: "Colour", zh: "颜色" },
  colourCode: { en: "Colour code", zh: "颜色代码" },
  hexAria: { en: "Hex colour code", zh: "十六进制颜色代码" },
  hexInvalid: { en: "Use a code like #FF7A2F", zh: "请输入如 #FF7A2F 的颜色代码" },
  fineTune: { en: "Fine tune", zh: "精细调色" },
  fineTuneAria: { en: (name) => `Fine tune the colour of ${name}`, zh: (name) => `精细调整「${name}」的颜色` },
  bambu: { en: "Bambu PLA Basic", zh: "Bambu PLA Basic" },
  exactMatch: { en: "Exact match", zh: "完全匹配" },
  closestMatch: { en: "Closest match", zh: "最接近" },
  useBambu: { en: (label) => `Use Bambu ${label}`, zh: (label) => `使用 Bambu ${label}` },

  // colourways
  colourways: { en: "Colourways", zh: "配色方案" },
  allParts: { en: "all parts", zh: "全部零件" },
  applyColourway: { en: (name) => `Apply the ${name} colourway`, zh: (name) => `应用配色方案「${name}」` },
  shuffle: { en: "Shuffle", zh: "随机配色" },
  shuffleAria: { en: "Random colourway from the Bambu palette", zh: "从 Bambu 色板中随机配色" },

  // edit actions
  resetPart: { en: "Reset part", zh: "重置此零件" },
  resetAll: { en: "Reset all", zh: "全部重置" },
  undo: { en: "Undo", zh: "撤销" },
  saved: { en: "Saved on this device", zh: "已保存在本设备" },
  notSaved: { en: "Can't save on this device", zh: "无法保存在本设备" },
  storageBlocked: {
    en: "Your browser blocks storage, so the design can't travel to the simulator.",
    zh: "浏览器禁用了存储，设计无法带到模拟器。",
  },
  toastColourway: { en: (name) => `${name} applied`, zh: (name) => `已应用「${name}」` },
  toastShuffled: { en: "New random colourway", zh: "已生成随机配色" },
  toastResetAll: { en: "All parts reset", zh: "已重置全部零件" },
  toastResetPart: { en: (name) => `${name} reset`, zh: (name) => `已重置「${name}」` },

  // stage
  hintDesktop: {
    en: "Drag to orbit · scroll to zoom · click a part to select",
    zh: "拖动旋转 · 滚轮缩放 · 点击零件即可选择",
  },
  hintTouch: {
    en: "Tap a part · drag to rotate · pinch to zoom",
    zh: "点按零件 · 拖动旋转 · 双指缩放",
  },
  viewTools: { en: "View controls", zh: "视角控制" },
  resetView: { en: "Reset view", zh: "重置视角" },
  zoomIn: { en: "Zoom in", zh: "放大" },
  zoomOut: { en: "Zoom out", zh: "缩小" },
  stageAria: { en: (name) => `3D model of ${name}`, zh: (name) => `${name} 的 3D 模型` },

  // loading and errors
  openingWorkshop: { en: "Opening the workshop", zh: "正在打开工坊" },
  loadingModel: { en: "Loading print geometry", zh: "正在载入打印几何体" },
  errorTitle: { en: "The model didn't load", zh: "模型未能加载" },
  errorBody: { en: "Check your connection and try again.", zh: "请检查网络连接后重试。" },
  backHome: { en: "Back to LibreZoo", zh: "返回 LibreZoo 狸波" },
  retry: { en: "Try again", zh: "重试" },
  webglTitle: { en: "3D isn't available here", zh: "此处无法使用 3D" },
  webglBody: {
    en: "LibreZoo Studio draws the model with WebGL. Try another browser or device.",
    zh: "LibreZoo 狸波 Studio 使用 WebGL 显示模型，请换一个浏览器或设备。",
  },
  unknownTitle: { en: (id) => `No creature called “${id}”`, zh: (id) => `还没有名为“${id}”的生物` },
  unknownBody: { en: "These are in the Studio today:", zh: "目前 Studio 里有：" },
  unknownOpen: { en: "Open in Studio", zh: "在 Studio 中打开" },
  bringBody: {
    en: "The enclosure has room. A new creature needs its model, a studio manifest and one registry entry.",
    zh: "围栏里还有位置。新的生物只需要模型、一份 Studio 清单和一条注册记录。",
  },
  bringLink: { en: "How to add one", zh: "如何添加" },

  // export
  packaging: { en: "Packaging full-resolution geometry…", zh: "正在打包全分辨率几何体…" },
  exported: {
    en: (parts, colours, mb) => `${parts} parts · ${colours} colours · ${mb} MB`,
    zh: (parts, colours, mb) => `${parts} 个零件 · ${colours} 种颜色 · ${mb} MB`,
  },
  exportFailed: { en: "Export failed", zh: "导出失败" },

  // mobile sheet
  tabParts: { en: "Parts", zh: "零件" },
  tabColour: { en: "Colour", zh: "颜色" },
  tabWays: { en: "Colourways", zh: "配色" },
  sheetTabs: { en: "Studio panels", zh: "Studio 面板" },
  collapse: { en: "Collapse panel", zh: "收起面板" },
  expand: { en: "Expand panel", zh: "展开面板" },

  // document
  docTitle: { en: (name) => `${name} · LibreZoo Studio`, zh: (name) => `${name} · LibreZoo 狸波 Studio` },
};

export const LANGS = ["en", "zh"];

// Pure lookup, so the dictionary is testable without React.
export function translate(lang, key, ...params) {
  const entry = STRINGS[key];
  if (!entry) return key;
  const value = entry[lang] ?? entry.en;
  return typeof value === "function" ? value(...params) : value;
}
