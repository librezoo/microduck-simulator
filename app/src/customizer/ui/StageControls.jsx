import { useEffect, useState } from "react";
import { pick, useT } from "./i18n.js";
import Icon from "./icons.jsx";

// Reset view / zoom, a hairline group at the edge of the free stage.
export function ViewControls({ onView }) {
  const { t } = useT();
  return (
    <div className="lz-view" role="group" aria-label={t("viewTools")}>
      <button type="button" aria-label={t("resetView")} title={t("resetView")} onClick={() => onView("home")}>
        <Icon name="home" size={19} />
      </button>
      <button type="button" aria-label={t("zoomIn")} title={t("zoomIn")} onClick={() => onView("in")}>
        <Icon name="plus" size={19} />
      </button>
      <button type="button" aria-label={t("zoomOut")} title={t("zoomOut")} onClick={() => onView("out")}>
        <Icon name="minus" size={19} />
      </button>
    </div>
  );
}

// The line at the foot of the stage: how to move, and whether the design is kept.
export function Hint({ coarse, saved }) {
  const { t } = useT();
  return (
    <p className="lz-hint">
      <span>{t(coarse ? "hintTouch" : "hintDesktop")}</span>
      {saved === null ? null : (
        <span className="lz-saved" data-bad={saved === false}>
          <Icon name={saved ? "check" : "close"} size={13} />
          {t(saved ? "saved" : "notSaved")}
        </span>
      )}
    </p>
  );
}

// The name of the part under the pointer, so picking on the model is never a
// guess. It owns its state and listens on a bus: a pointer move re-renders
// this label and nothing else.
export function HoverTag({ bus, studio }) {
  const { lang } = useT();
  const [hover, setHover] = useState(null);
  useEffect(() => {
    bus.set = setHover;
    return () => {
      bus.set = null;
    };
  }, [bus]);
  const part = hover ? studio.partById[hover.id] : null;
  if (!part) return null;
  return (
    <div className="lz-tag" style={{ left: hover.x + 14, top: hover.y + 18 }} aria-hidden="true">
      {pick(part.label, lang)}
    </div>
  );
}
