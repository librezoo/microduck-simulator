import { listCreatures } from "../../creatures/index.js";
import { homeUrl, studioUrl } from "../../routes.js";
import { LangToggle, Lockup } from "./TopBar.jsx";
import { pick, useT } from "./i18n.js";
import Icon from "./icons.jsx";

// Full-page states of the Studio: opening, failing, and asking for a creature
// it does not have. The bar is the usual one, so the page never feels lost.
function Page({ children }) {
  const { t } = useT();
  return (
    <div className="lz-app lz-page" data-layout="page">
      <header className="lz-top">
        <Lockup />
        <span className="lz-product"><span className="lz-slash" aria-hidden="true">/</span><span>{t("studio")}</span></span>
        <div className="lz-top-end"><LangToggle /></div>
      </header>
      <main className="lz-state">{children}</main>
    </div>
  );
}

export function OpeningWorkshop() {
  const { t } = useT();
  return (
    <Page>
      <div className="lz-loader" role="status">
        <img className="lz-loader-mark" src="./assets/librezoo-mark-cream.svg" alt="" width="56" height="56" />
        <p className="lz-kicker">{t("openingWorkshop")}</p>
        <span className="lz-bar" aria-hidden="true" />
      </div>
    </Page>
  );
}

export function ErrorCard({ title, body, detail, onRetry, retry = true }) {
  const { t } = useT();
  return (
    <div className="lz-card" role="alert">
      <h1 className="lz-card-title">{title}</h1>
      <p className="lz-card-body">{body}</p>
      {detail ? <code className="lz-card-detail">{detail}</code> : null}
      <div className="lz-card-actions">
        {retry ? (
          <button type="button" className="lz-btn lz-btn--primary" onClick={onRetry}>{t("retry")}</button>
        ) : null}
        <a className="lz-btn lz-btn--ghost" href={homeUrl()}>{t("backHome")}</a>
      </div>
    </div>
  );
}

export function LoadFailed({ detail, onRetry }) {
  const { t } = useT();
  return (
    <Page>
      <ErrorCard title={t("errorTitle")} body={t("errorBody")} detail={detail} onRetry={onRetry} />
    </Page>
  );
}

export function UnknownCreature({ requested }) {
  const { t, lang } = useT();
  return (
    <Page>
      <div className="lz-card" role="alert">
        <h1 className="lz-card-title">
          <span className="lz-serif">{t("unknownTitle", requested)}</span>
        </h1>
        <p className="lz-card-body">{t("unknownBody")}</p>
        <ul className="lz-card-list">
          {listCreatures().map((creature) => (
            <li key={creature.id}>
              <a className="lz-card-link" href={studioUrl(creature.id)}>
                <span>{pick(creature.name, lang)}</span>
                <span className="lz-card-link-cta">{t("unknownOpen")} <Icon name="arrow" size={15} /></span>
              </a>
            </li>
          ))}
        </ul>
        <p className="lz-card-body lz-card-body--dim">{t("bringBody")}</p>
        <div className="lz-card-actions">
          <a className="lz-btn lz-btn--ghost" href="https://github.com/micro-zoo/microduck-simulator" target="_blank" rel="noopener noreferrer">
            {t("bringLink")} <Icon name="external" size={15} />
          </a>
        </div>
      </div>
    </Page>
  );
}
