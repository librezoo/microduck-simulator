// The simulator's entry. main.jsx loads it only on simulator routes, so the
// MuJoCo/ONNX/MUI weight never reaches the Studio.
import { createRoot } from "react-dom/client";
import "@fontsource/anton/400.css";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "./theme.js";
import App from "./App.jsx";
import { initializeNativeRuntime } from "./native/runtime.js";

// Build tag: bump to change the bundle's content hash, e.g. to bust a stale
// edge-cached asset URL on the HF Space.
const BUILD_TAG = "2026-09-20";
console.info(`Microduck build ${BUILD_TAG}`);
initializeNativeRuntime();

// No StrictMode: the game core is a heavyweight singleton (MuJoCo WASM,
// ONNX sessions, WebRTC room) and dev double-mounting would double-boot it.
createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>,
);
