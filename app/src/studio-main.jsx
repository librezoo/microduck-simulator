// LibreZoo Studio's entry. No MUI, no Anton, no simulator code: React, three
// and the Studio's own stylesheet (which carries the self-hosted fonts).
import { createRoot } from "react-dom/client";
import "./customizer/studio.css";
import Studio from "./customizer/Studio.jsx";

document.body.classList.add("lz-studio");
createRoot(document.getElementById("root")).render(<Studio />);

// three and the rig builder download while the manifest is fetched, after the
// first paint rather than before it.
requestAnimationFrame(() => import("./customizer/ui/Stage.jsx"));
