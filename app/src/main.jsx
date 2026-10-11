// Entry. The page is either the simulator or LibreZoo Studio; deciding before
// loading either keeps each from paying for the other (the Studio needs none
// of MuJoCo, ONNX or MUI, and the simulator none of the Studio).
import { isStudioRoute } from "./routes.js";

if (isStudioRoute()) import("./studio-main.jsx");
else import("./sim-main.jsx");
