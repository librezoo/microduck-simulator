import { useEffect, useRef, useState } from "react";
import { closestBambuColor, exactBambuColor } from "../bambu-colors.js";
import { getCreature } from "../../creatures/index.js";
import Icon from "./icons.jsx";
import { pick, useT } from "./i18n.js";
import { useReducedMotion } from "./hooks.js";

const filament = (hex) => {
  const exact = exactBambuColor(hex);
  const match = exact ?? closestBambuColor(hex);
  return { code: match.code, exact: !!exact };
};

// Lineage line, quiet and always reachable wherever the creature is shown.
export function Credit({ creatureId }) {
  const { lang } = useT();
  const credit = getCreature(creatureId)?.credit;
  if (!credit) return null;
  return (
    <p className="lz-credit">
      <a href={credit.url} target="_blank" rel="noopener noreferrer">{pick(credit.text, lang)}</a>{" "}
      <span>{pick(credit.notEndorsed, lang)}</span>
    </p>
  );
}

// ── desktop: grouped, collapsible list ─────────────────────────────────────
export function PartsRail({ studio, creatureId, colors, selectedId, onSelect }) {
  const { t, lang } = useT();
  const reduced = useReducedMotion();
  const selected = studio.partById[selectedId];
  const [open, setOpen] = useState(() => new Set([selected.groupId]));
  const scroller = useRef(null);

  // a part picked on the model opens its group and scrolls its row into view
  useEffect(() => {
    setOpen((current) => (current.has(selected.groupId) ? current : new Set(current).add(selected.groupId)));
  }, [selected.groupId]);
  useEffect(() => {
    const row = scroller.current?.querySelector('[data-selected="true"]');
    row?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [selectedId, open, reduced]);

  const toggle = (id) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // arrows walk the visible rows, selection follows focus; one tab stop
  const onKeyDown = (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const rows = [...scroller.current.querySelectorAll('.lz-group[data-open="true"] button.lz-part')];
    const index = rows.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0
      : event.key === "End" ? rows.length - 1
        : Math.max(0, Math.min(rows.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
    rows[next].focus();
    onSelect(rows[next].dataset.part);
  };

  return (
    <aside className="lz-panel lz-rail" aria-label={t("parts")}>
      <header className="lz-panel-head">
        <h2 className="lz-h">{t("parts")}</h2>
        <span className="lz-count">{t("partsCount", studio.parts.length)}</span>
      </header>
      <div className="lz-scroll" ref={scroller} onKeyDown={onKeyDown}>
        {studio.groups.map((group) => {
          const isOpen = open.has(group.id);
          const listId = `lz-group-${group.id}`;
          return (
            <section className="lz-group" key={group.id} data-open={isOpen}>
              <button
                type="button"
                className="lz-group-head"
                aria-expanded={isOpen}
                aria-controls={listId}
                onClick={() => toggle(group.id)}
              >
                <span className="lz-group-name">{pick(group.label, lang)}</span>
                <span className="lz-group-dots" aria-hidden="true">
                  {group.parts.map((part) => <i key={part.id} style={{ background: colors[part.id] }} />)}
                </span>
                <Icon name="chevron" size={16} />
              </button>
              <div className="lz-group-body" id={listId} role="group" aria-label={pick(group.label, lang)}>
                <ul>
                  {group.parts.map((part) => {
                    const active = part.id === selectedId;
                    const { code, exact } = filament(colors[part.id]);
                    return (
                      <li key={part.id}>
                        <button
                          type="button"
                          className="lz-part"
                          data-part={part.id}
                          data-selected={active}
                          aria-pressed={active}
                          aria-label={t("partRowAria", pick(part.label, lang), `${exact ? "" : "≈"}${code}`)}
                          tabIndex={active ? 0 : -1}
                          onClick={() => onSelect(part.id)}
                        >
                          <span className="lz-chip" style={{ background: colors[part.id] }} />
                          <span className="lz-part-name">{pick(part.label, lang)}</span>
                          <span className="lz-part-code" aria-hidden="true">{exact ? "" : "≈"}{code}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
      <footer className="lz-panel-foot"><Credit creatureId={creatureId} /></footer>
    </aside>
  );
}

// ── mobile: group tabs and a grid of parts ─────────────────────────────────
export function PartsGrid({ studio, creatureId, colors, selectedId, onSelect }) {
  const { t, lang } = useT();
  const selected = studio.partById[selectedId];
  const [groupId, setGroupId] = useState(selected.groupId);
  useEffect(() => setGroupId(selected.groupId), [selected.groupId]);
  const group = studio.groups.find((g) => g.id === groupId) ?? studio.groups[0];

  return (
    <div className="lz-pgrid-wrap">
      <div className="lz-seg" role="tablist" aria-label={t("partGroups")}>
        {studio.groups.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={g.id === group.id}
            className="lz-seg-btn"
            onClick={() => setGroupId(g.id)}
          >
            {pick(g.label, lang)}
          </button>
        ))}
      </div>
      <ul className="lz-pgrid">
        {group.parts.map((part) => {
          const active = part.id === selectedId;
          const { code, exact } = filament(colors[part.id]);
          return (
            <li key={part.id}>
              <button
                type="button"
                className="lz-part lz-part--tile"
                data-part={part.id}
                data-selected={active}
                aria-pressed={active}
                aria-label={t("partRowAria", pick(part.label, lang), `${exact ? "" : "≈"}${code}`)}
                onClick={() => onSelect(part.id)}
              >
                <span className="lz-chip" style={{ background: colors[part.id] }} />
                <span className="lz-part-name">{pick(part.label, lang)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Credit creatureId={creatureId} />
    </div>
  );
}
