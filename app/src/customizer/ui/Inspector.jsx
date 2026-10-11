import ColourPanel from "./ColourPanel.jsx";
import { Colourways, EditActions } from "./ColourwaysPanel.jsx";
import { useT } from "./i18n.js";

// Desktop: the right-hand panel. The selected part's colour on top, the whole
// design's colourways under it, and undo/reset pinned to the bottom so they
// are in reach whatever the window height.
export default function Inspector({ studio, part, colors, onColor, onApplyWay, onShuffle, edit }) {
  const { t } = useT();
  return (
    <aside className="lz-panel lz-inspector" aria-label={t("colour")}>
      <div className="lz-scroll">
        <ColourPanel studio={studio} part={part} color={colors[part.id]} onColor={onColor} />
        <Colourways studio={studio} colors={colors} onApply={onApplyWay} onShuffle={onShuffle} />
      </div>
      <footer className="lz-panel-foot">
        <EditActions {...edit} />
      </footer>
    </aside>
  );
}
