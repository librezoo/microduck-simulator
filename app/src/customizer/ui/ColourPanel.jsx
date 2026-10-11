import { useEffect, useState } from "react";
import { BAMBU_PLA_BASIC, bambuLabel, closestBambuColor, exactBambuColor } from "../bambu-colors.js";
import { normalizeHex, readableOn } from "../color-utils.js";
import Icon from "./icons.jsx";
import { pick, useT } from "./i18n.js";

// Six hex digits typed or pasted apply at once; 3-digit shorthand applies on
// Enter or when the field is left. Anything else puts the old colour back.
function HexField({ color, onColor }) {
  const { t } = useT();
  const [draft, setDraft] = useState(color.slice(1));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(color.slice(1));
  }, [color, focused]);

  const commit = () => {
    const hex = normalizeHex(draft);
    if (hex) {
      setInvalid(false);
      if (hex !== color) onColor(hex);
      setDraft(hex.slice(1));
    } else {
      setInvalid(draft.length > 0);
      setDraft(color.slice(1));
    }
  };

  return (
    <div className="lz-field-wrap">
      <div className="lz-field" data-invalid={invalid}>
        <span className="lz-field-hash" aria-hidden="true">#</span>
        <input
          className="lz-field-input"
          value={draft}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          maxLength={7}
          aria-label={t("hexAria")}
          aria-invalid={invalid}
          aria-describedby={invalid ? "lz-hex-help" : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); commit(); }}
          onChange={(event) => {
            const next = event.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 6).toUpperCase();
            setInvalid(false);
            setDraft(next);
            if (next.length === 6) onColor(`#${next}`);
          }}
          onKeyDown={(event) => { if (event.key === "Enter") commit(); }}
        />
        <span className="lz-field-chip" style={{ background: color }} aria-hidden="true" />
      </div>
      {invalid ? <p className="lz-field-help" id="lz-hex-help" role="alert">{t("hexInvalid")}</p> : null}
    </div>
  );
}

function SwatchGrid({ color, onColor, onPreview }) {
  const { t } = useT();
  return (
    <div className="lz-swatches" role="group" aria-label={t("bambu")} onPointerLeave={() => onPreview(null)}>
      {BAMBU_PLA_BASIC.map((swatch) => {
        const active = swatch.hex === color;
        return (
          <button
            key={swatch.code}
            type="button"
            className="lz-swatch"
            data-active={active}
            style={{ "--sw": swatch.hex, "--on": readableOn(swatch.hex) }}
            aria-pressed={active}
            aria-label={t("useBambu", `${bambuLabel(swatch)} ${swatch.hex}`)}
            onClick={() => onColor(swatch.hex)}
            onPointerEnter={(event) => event.pointerType === "mouse" && onPreview(swatch)}
            onFocus={() => onPreview(swatch)}
            onBlur={() => onPreview(null)}
          >
            {active ? <Icon name="check" size={16} /> : null}
          </button>
        );
      })}
    </div>
  );
}

// The selected part: its colour, the code field and the Bambu PLA Basic
// swatches with the catalogue number of the closest filament. Desktop shows
// the full inspector; the phone sheet is shorter: name, swatches first (the
// quickest way to a printable colour), then the code.
export default function ColourPanel({ studio, part, color, onColor, variant = "desktop", atDefault = true, onReset }) {
  const { t, lang } = useT();
  const [preview, setPreview] = useState(null);
  const exact = exactBambuColor(color);
  const match = exact ?? closestBambuColor(color);
  const shown = preview ?? match;
  const name = pick(part.label, lang);
  const index = studio.parts.indexOf(part);
  const group = studio.groups.find((g) => g.id === part.groupId);

  const picker = (
    <input
      type="color"
      className="lz-well-input"
      value={color.toLowerCase()}
      aria-label={t("fineTuneAria", name)}
      onChange={(event) => onColor(event.target.value.toUpperCase())}
    />
  );

  if (variant === "mobile") {
    return (
      <div className="lz-colour" data-variant="mobile">
        <header className="lz-mc-head">
          <label className="lz-well lz-well--chip" style={{ background: color, color: readableOn(color) }}>
            {picker}
            <Icon name="dropper" size={17} />
          </label>
          <div className="lz-mc-title">
            <h2 className="lz-part-title">{name}</h2>
            <p className="lz-closest" aria-live="polite">
              <i className="lz-closest-dot" style={{ background: shown.hex }} />
              <b>{shown.code}</b> · {shown.name}
              <span className="lz-match" data-exact={!!exact && !preview}>{preview ? "" : exact ? t("exactMatch") : t("closestMatch")}</span>
            </p>
          </div>
          <button type="button" className="lz-btn lz-btn--quiet lz-iconbtn" aria-label={t("resetPart")} title={t("resetPart")} onClick={onReset} disabled={atDefault}>
            <Icon name="reset" size={17} />
          </button>
        </header>
        <SwatchGrid color={color} onColor={onColor} onPreview={setPreview} />
        <p className="lz-kicker lz-label">{t("colourCode")}</p>
        <HexField color={color} onColor={onColor} />
      </div>
    );
  }

  return (
    <div className="lz-colour" data-variant="desktop">
      <header className="lz-colour-head">
        <p className="lz-kicker">
          {pick(group.label, lang)} · {t("partsOf", index + 1, studio.parts.length)}
        </p>
        <h2 className="lz-part-title">{name}</h2>
      </header>

      <label className="lz-well" style={{ background: color, color: readableOn(color) }}>
        {picker}
        <span className="lz-well-cta"><Icon name="dropper" size={16} /> {t("fineTune")}</span>
      </label>

      <p className="lz-kicker lz-label">{t("colourCode")}</p>
      <HexField color={color} onColor={onColor} />

      <div className="lz-bambu-head">
        <p className="lz-kicker lz-label">{t("bambu")}</p>
        <p className="lz-match" data-exact={!!exact && !preview}>
          {preview ? null : <Icon name={exact ? "check" : "dropper"} size={13} />}
          {preview ? "" : exact ? t("exactMatch") : t("closestMatch")}
        </p>
      </div>
      <p className="lz-closest" aria-live="polite">
        <i className="lz-closest-dot" style={{ background: shown.hex }} />
        <b>{shown.code}</b> · {shown.name} · <span>{shown.hex}</span>
      </p>
      <SwatchGrid color={color} onColor={onColor} onPreview={setPreview} />
    </div>
  );
}
