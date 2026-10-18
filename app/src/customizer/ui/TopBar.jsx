import { useCallback, useEffect, useRef, useState } from "react";
import { listCreatures } from "../../creatures/index.js";
import { homeUrl } from "../../routes.js";
import Icon from "./icons.jsx";
import { pick, setLang, useT } from "./i18n.js";
import { useDismiss } from "./hooks.js";

// The LibreZoo lockup. English shows LibreZoo; Chinese shows LibreZoo first
// and 狸波 beside it, smaller (the .cn rule of the sites: 0.62em, min 12px).
export function Lockup() {
  const { t, lang } = useT();
  return (
    <a className="lz-lockup" href={homeUrl()} aria-label={t("lockupAria")}>
      <img className="lz-mark" src="./assets/librezoo-mark-cream.svg" alt="" width="32" height="32" />
      <span className="lz-word">
        <span className="lz-name">LibreZoo</span>
        {lang === "zh" ? <span className="lz-cn">狸波</span> : null}
      </span>
    </a>
  );
}

export function LangToggle() {
  const { t, lang } = useT();
  return (
    <button
      type="button"
      className="lz-lang"
      aria-label={t("langAria")}
      lang={lang === "en" ? "zh" : "en"}
      onClick={() => setLang(lang === "en" ? "zh" : "en")}
    >
      {t("langShort")}
    </button>
  );
}

// Built from the registry: every creature the Studio knows, and an honest
// invitation to bring one.
export function CreatureSwitcher({ creatureId, onSwitch }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const creatures = listCreatures();
  const current = creatures.find((creature) => creature.id === creatureId) ?? creatures[0];
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);

  useEffect(() => {
    if (open) root.current?.querySelector('[aria-checked="true"]')?.focus();
  }, [open]);

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    const items = [...root.current.querySelectorAll('[role^="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  };

  return (
    <div className="lz-switch" ref={root} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={trigger}
        className="lz-switch-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("chooseCreature")}: ${pick(current.name, lang)}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="lz-switch-label">{t("creature")}</span>
        <span className="lz-switch-name">{pick(current.name, lang)}</span>
        <Icon name="chevron" size={16} />
      </button>
      {open ? (
        <div className="lz-menu" role="menu" aria-label={t("chooseCreature")}>
          {creatures.map((creature) => (
            <button
              key={creature.id}
              type="button"
              role="menuitemradio"
              aria-checked={creature.id === current.id}
              className="lz-menu-item"
              onClick={() => {
                setOpen(false);
                if (creature.id !== current.id) onSwitch(creature.id);
              }}
            >
              <span className="lz-menu-name">{pick(creature.name, lang)}</span>
              {creature.id === current.id ? <Icon name="check" size={16} /> : null}
            </button>
          ))}
          <a
            className="lz-menu-item lz-menu-item--invite"
            role="menuitem"
            href="https://github.com/librezoo/microduck-simulator"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              <span className="lz-menu-name">{t("bringCreature")}</span>
              <span className="lz-menu-note">{t("bringCreatureNote")}</span>
            </span>
            <Icon name="external" size={15} />
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function ActionButtons({ ready, exporting, onRun, onExport }) {
  const { t } = useT();
  return (
    <>
      <button type="button" className="lz-btn lz-btn--ghost" aria-label={t("runDesignAria")} disabled={!ready} onClick={onRun}>
        <Icon name="play" size={15} /> <span>{t("runDesign")}</span>
      </button>
      <button
        type="button"
        className="lz-btn lz-btn--primary"
        aria-label={exporting ? t("exportingAria") : t("exportAria")}
        aria-busy={exporting}
        disabled={!ready || exporting}
        onClick={onExport}
      >
        {exporting ? <span className="lz-spinner" aria-hidden="true" /> : <Icon name="download" size={16} />}
        <span>{exporting ? t("exporting") : t("exportZip")}</span>
      </button>
    </>
  );
}

export default function TopBar({ creatureId, onSwitchCreature, layout, ready, exporting, onRun, onExport }) {
  const { t } = useT();
  return (
    <header className="lz-top">
      <Lockup />
      <span className="lz-product">
        <span className="lz-slash" aria-hidden="true">/</span>
        <span>{t("studio")}</span>
      </span>
      <CreatureSwitcher creatureId={creatureId} onSwitch={onSwitchCreature} />
      <div className="lz-top-end">
        <LangToggle />
        {layout === "desktop" ? <ActionButtons ready={ready} exporting={exporting} onRun={onRun} onExport={onExport} /> : null}
      </div>
    </header>
  );
}

