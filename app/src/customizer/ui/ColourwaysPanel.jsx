import Icon from "./icons.jsx";
import { pick, useT } from "./i18n.js";

const sameColors = (a, b) => Object.keys(a).every((id) => a[id] === b[id]);

export function Colourways({ studio, colors, onApply, onShuffle }) {
  const { t, lang } = useT();
  return (
    <section className="lz-ways-wrap" aria-label={t("colourways")}>
      <div className="lz-ways-head">
        <p className="lz-kicker lz-label">{t("colourways")} <span className="lz-ways-scope">· {t("allParts")}</span></p>
        <button type="button" className="lz-btn lz-btn--quiet lz-shuffle" aria-label={t("shuffleAria")} onClick={onShuffle}>
          <Icon name="shuffle" size={16} /> {t("shuffle")}
        </button>
      </div>
      <div className="lz-ways">
        {studio.colorways.map((way) => {
          const active = sameColors(way.colors, colors);
          return (
            <button
              key={way.id}
              type="button"
              className="lz-way"
              data-active={active}
              aria-pressed={active}
              aria-label={t("applyColourway", pick(way.name, lang))}
              onClick={() => onApply(way)}
            >
              <span className="lz-stripe" aria-hidden="true">
                {way.stripe.map((hex) => <i key={hex} style={{ background: hex }} />)}
              </span>
              <span className="lz-way-name">{pick(way.name, lang)}</span>
              {active ? <Icon name="check" size={14} /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Undo and the two resets. Disabled when there is nothing to do, so the
// state of the design is readable from the buttons themselves.
export function EditActions({ canUndo, partAtDefault, allAtDefault, onUndo, onResetPart, onResetAll }) {
  const { t } = useT();
  return (
    <div className="lz-edit">
      <button type="button" className="lz-btn lz-btn--quiet lz-undo" aria-label={t("undo")} title={t("undo")} onClick={onUndo} disabled={!canUndo}>
        <Icon name="undo" size={17} />
      </button>
      <button type="button" className="lz-btn lz-btn--quiet" onClick={onResetPart} disabled={partAtDefault}>
        <Icon name="reset" size={16} /> {t("resetPart")}
      </button>
      <button type="button" className="lz-btn lz-btn--quiet" onClick={onResetAll} disabled={allAtDefault}>
        {t("resetAll")}
      </button>
    </div>
  );
}
