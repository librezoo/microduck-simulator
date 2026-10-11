import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { creatureModelUrls } from "../creatures/index.js";
import { simulatorUrl } from "../routes.js";
import { BAMBU_PLA_BASIC } from "./bambu-colors.js";
import { readStudioDesign, saveStudioDesign } from "./design-storage.js";
import { colorsChanged, initialStudioState, randomColors, savedDesignColors, studioReducer } from "./studio-state.js";
import Inspector from "./ui/Inspector.jsx";
import MobileSheet from "./ui/MobileSheet.jsx";
import { PartsRail } from "./ui/PartsPanel.jsx";
import { ErrorCard } from "./ui/States.jsx";
import { HoverTag, Hint, ViewControls } from "./ui/StageControls.jsx";
import Toast from "./ui/Toast.jsx";
import TopBar from "./ui/TopBar.jsx";
import { pick, useT } from "./ui/i18n.js";
import { useCoarsePointer, useLayoutMode, useReducedMotion } from "./ui/hooks.js";
import { StageBoundary, webglAvailable } from "./ui/stage-guard.jsx";

// three and react-three-fiber load after the workshop has painted: the panels
// are usable the moment the manifest is in, and the model arrives behind them.
const importStage = () => import("./ui/Stage.jsx");
let StageView = lazy(importStage);

const sameColors = (a, b) => Object.keys(a).every((id) => a[id] === b[id]);
const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));

let toastSeq = 0;

// The Studio proper, for one creature whose manifest is already loaded.
export default function Workshop({ studio, creature, onSwitchCreature }) {
  const { t, lang } = useT();
  const layout = useLayoutMode();
  const reducedMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  const desktop = layout === "desktop";

  const [state, dispatch] = useReducer(
    (current, action) => studioReducer(current, action, studio),
    null,
    () => initialStudioState(studio, savedDesignColors(studio, readStudioDesign(creature.id))),
  );
  const { colors, selectedId } = state;
  const part = studio.partById[selectedId];
  const meshColors = useMemo(() => studio.colorOverridesForParts(colors), [studio, colors]);
  const urls = useMemo(() => creatureModelUrls(creature, studio.manifest), [creature, studio]);

  const [model, setModel] = useState(() => (webglAvailable() ? { status: "loading" } : { status: "error", kind: "webgl" }));
  const [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState({ seq: 0, type: "home" });
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [saved, setSaved] = useState(null);
  const [tab, setTab] = useState("parts");
  const [collapsed, setCollapsed] = useState(false);

  const modelRef = useRef(null);
  const freeRef = useRef(null);
  const stageRef = useRef(null);
  const hoverBus = useRef({ set: null }).current;
  const ready = model.status === "ready";

  // ── persistence: the design is kept on this device and travels to the simulator
  useEffect(() => {
    setSaved(!!saveStudioDesign({ colors, meshColors }, creature.id));
  }, [creature.id, colors, meshColors]);

  // ── messages
  const say = useCallback((text, options = {}) => setToast({ id: ++toastSeq, text, ...options }), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const withUndo = useCallback((text) => say(text, { action: { label: t("undo"), run: undo } }), [say, t, undo]);

  // ── model lifecycle
  const handleReady = useCallback(() => setModel({ status: "ready" }), []);
  const handleModelError = useCallback((error) => setModel({ status: "error", kind: "load", detail: error?.message }), []);
  const retryModel = useCallback(() => {
    // a chunk that failed to load is cached by React.lazy as failed: ask again
    StageView = lazy(importStage);
    setModel({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  // ── selection
  const selectPart = useCallback((id) => {
    dispatch({ type: "select", id });
  }, []);
  const pickOnModel = useCallback((id) => {
    dispatch({ type: "select", id });
    // a part picked on the model while the sheet is folded opens its colour
    if (collapsed) {
      setTab("colour");
      setCollapsed(false);
    }
  }, [collapsed]);

  // ── colour edits
  const setColor = useCallback((color) => dispatch({ type: "color", color }), []);
  const applyWay = useCallback((way) => {
    if (sameColors(way.colors, colors)) return;
    dispatch({ type: "apply", colors: way.colors });
    withUndo(t("toastColourway", pick(way.name, lang)));
  }, [colors, lang, t, withUndo]);
  const shuffle = useCallback(() => {
    dispatch({ type: "apply", colors: randomColors(studio, BAMBU_PLA_BASIC.map((swatch) => swatch.hex)) });
    withUndo(t("toastShuffled"));
  }, [studio, t, withUndo]);
  const resetPart = useCallback(() => {
    dispatch({ type: "resetPart" });
    withUndo(t("toastResetPart", pick(part.label, lang)));
  }, [part, lang, t, withUndo]);
  const resetAll = useCallback(() => {
    dispatch({ type: "resetAll" });
    withUndo(t("toastResetAll"));
  }, [t, withUndo]);

  const edit = useMemo(() => ({
    canUndo: state.past.length > 0,
    partAtDefault: colors[part.id] === part.color,
    allAtDefault: !colorsChanged(studio, colors),
    onUndo: undo,
    onResetPart: resetPart,
    onResetAll: resetAll,
  }), [state.past.length, colors, part, studio, undo, resetPart, resetAll]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key.toLowerCase() !== "z" || !(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  // ── run in the simulator / export
  const runDesign = useCallback(() => {
    if (!saveStudioDesign({ colors, meshColors }, creature.id)) {
      say(t("storageBlocked"));
      return;
    }
    location.assign(simulatorUrl({ design: true, creature: creature.id }));
  }, [colors, meshColors, creature.id, say, t]);

  const exportDesign = useCallback(async () => {
    if (!ready || exporting) return;
    setExporting(true);
    say(t("packaging"), { busy: true, persist: true });
    // let the busy state paint before the synchronous packaging starts
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    try {
      const { createThreeMfBundle } = await import("./three-mf.js");
      const info = studio.manifest.export;
      const bundle = createThreeMfBundle({
        root: modelRef.current?.root,
        selectedPart: part.label.en,
        meshOrder: studio.printMeshOrder,
        filePrefix: info.filePrefix,
        title: info.title,
        description: info.description,
      });
      const blob = new Blob([bundle.bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${info.zipPrefix}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(t("exported", bundle.partCount, bundle.colorCount, (blob.size / 1024 / 1024).toFixed(1)));
    } catch (error) {
      say(`${t("exportFailed")}: ${error?.message ?? error}`);
    } finally {
      setExporting(false);
    }
  }, [ready, exporting, studio, part, say, t]);

  const onView = useCallback((type) => setAction(({ seq }) => ({ seq: seq + 1, type })), []);
  const onHover = useCallback((id, x, y) => {
    if (stageRef.current) stageRef.current.dataset.hover = id ? "true" : "false";
    hoverBus.set?.(id ? { id, x, y } : null);
  }, [hoverBus]);

  const creatureName = pick(creature.name, lang);

  return (
    <div className="lz-app" data-layout={layout}>
      <div className="lz-stage-bg" ref={stageRef} role="img" aria-label={t("stageAria", creatureName)}>
        {model.status === "error" && model.kind === "webgl" ? null : (
          <StageBoundary key={attempt} onCatch={handleModelError}>
            <Suspense fallback={null}>
              <StageView
                studio={studio}
                urls={urls}
                colors={colors}
                selectedId={selectedId}
                modelRef={modelRef}
                freeRef={freeRef}
                action={action}
                reducedMotion={reducedMotion}
                onReady={handleReady}
                onError={handleModelError}
                onSelect={pickOnModel}
                onHover={onHover}
              />
            </Suspense>
          </StageBoundary>
        )}
      </div>

      <div className="lz-ui">
        <TopBar
          creatureId={creature.id}
          onSwitchCreature={onSwitchCreature}
          layout={layout}
          ready={ready}
          exporting={exporting}
          onRun={runDesign}
          onExport={exportDesign}
        />

        {desktop ? (
          <PartsRail studio={studio} creatureId={creature.id} colors={colors} selectedId={selectedId} onSelect={selectPart} />
        ) : null}

        <main className="lz-free" ref={freeRef}>
          {model.status === "loading" ? (
            <div className="lz-overlay" role="status">
              <div className="lz-loader">
                <p className="lz-kicker">{t("loadingModel")}</p>
                <span className="lz-bar" aria-hidden="true" />
              </div>
            </div>
          ) : null}
          {model.status === "error" ? (
            <div className="lz-overlay">
              {model.kind === "webgl" ? (
                <ErrorCard title={t("webglTitle")} body={t("webglBody")} retry={false} />
              ) : (
                <ErrorCard title={t("errorTitle")} body={t("errorBody")} detail={model.detail} onRetry={retryModel} />
              )}
            </div>
          ) : null}
          <ViewControls onView={onView} />
          <Hint coarse={coarse} saved={saved} />
        </main>

        {desktop ? (
          <Inspector
            studio={studio}
            part={part}
            colors={colors}
            onColor={setColor}
            onApplyWay={applyWay}
            onShuffle={shuffle}
            edit={edit}
          />
        ) : (
          <MobileSheet
            studio={studio}
            creatureId={creature.id}
            colors={colors}
            selectedId={selectedId}
            part={part}
            tab={tab}
            onTab={setTab}
            collapsed={collapsed}
            onCollapsed={setCollapsed}
            onSelect={selectPart}
            onColor={setColor}
            onApplyWay={applyWay}
            onShuffle={shuffle}
            edit={edit}
            ready={ready}
            exporting={exporting}
            onRun={runDesign}
            onExport={exportDesign}
          />
        )}
      </div>

      <HoverTag bus={hoverBus} studio={studio} />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
