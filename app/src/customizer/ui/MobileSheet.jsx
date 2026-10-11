import ColourPanel from "./ColourPanel.jsx";
import { Colourways, EditActions } from "./ColourwaysPanel.jsx";
import { PartsGrid } from "./PartsPanel.jsx";
import { ActionButtons } from "./TopBar.jsx";
import Icon from "./icons.jsx";
import { useT } from "./i18n.js";

const TABS = [
  ["parts", "tabParts"],
  ["colour", "tabColour"],
  ["ways", "tabWays"],
];

// Phones: tabs under the stage. Parts picks, Colour tunes, Colourways applies
// a whole palette. The sheet folds down to its tab bar to give the model room.
export default function MobileSheet({
  studio, creatureId, colors, selectedId, part, tab, onTab, collapsed, onCollapsed,
  onSelect, onColor, onApplyWay, onShuffle, edit, ready, exporting, onRun, onExport,
}) {
  const { t } = useT();

  const onKeyDown = (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = TABS.findIndex(([id]) => id === tab);
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length][0];
    onTab(next);
    document.getElementById(`lz-tab-${next}`)?.focus();
  };

  return (
    <section className="lz-sheet" data-collapsed={collapsed}>
      <div className="lz-tabs" role="tablist" aria-label={t("sheetTabs")} onKeyDown={onKeyDown}>
        {TABS.map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`lz-tab-${id}`}
            className="lz-tab"
            aria-selected={tab === id}
            aria-controls="lz-sheet-body"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => { onTab(id); onCollapsed(false); }}
          >
            {t(key)}
          </button>
        ))}
        <button
          type="button"
          className="lz-sheet-toggle"
          aria-label={collapsed ? t("expand") : t("collapse")}
          aria-expanded={!collapsed}
          onClick={() => onCollapsed(!collapsed)}
        >
          <Icon name={collapsed ? "sheetUp" : "sheetDown"} size={20} />
        </button>
      </div>
      {collapsed ? null : (
        <div className="lz-sheet-body" role="tabpanel" id="lz-sheet-body" aria-labelledby={`lz-tab-${tab}`}>
          {tab === "parts" ? (
            <PartsGrid studio={studio} creatureId={creatureId} colors={colors} selectedId={selectedId} onSelect={onSelect} />
          ) : null}
          {tab === "colour" ? (
            <ColourPanel
              studio={studio}
              part={part}
              color={colors[part.id]}
              onColor={onColor}
              variant="mobile"
              atDefault={edit.partAtDefault}
              onReset={edit.onResetPart}
            />
          ) : null}
          {tab === "ways" ? (
            <>
              <Colourways studio={studio} colors={colors} onApply={onApplyWay} onShuffle={onShuffle} />
              <EditActions {...edit} />
            </>
          ) : null}
        </div>
      )}
      <div className="lz-actionbar">
        <ActionButtons ready={ready} exporting={exporting} onRun={onRun} onExport={onExport} />
      </div>
    </section>
  );
}
