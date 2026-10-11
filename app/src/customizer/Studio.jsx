import { useCallback, useEffect, useState } from "react";
import { creatureFromSearch } from "../creatures/index.js";
import { studioUrl } from "../routes.js";
import { loadStudio } from "./studio-loader.js";
import Workshop from "./Workshop.jsx";
import { LoadFailed, OpeningWorkshop, UnknownCreature } from "./ui/States.jsx";
import { pick, useT } from "./ui/i18n.js";

// LibreZoo Studio: which creature, then its studio manifest, then the workshop.
// ?creature=<id> picks the creature (default Duck); an id the registry does not
// know gets a friendly page that lists the ones it does.
function CreatureStudio({ creature, onSwitchCreature }) {
  const { t, lang } = useT();
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    loadStudio(creature, { signal: controller.signal })
      .then((studio) => setLoad({ status: "ready", studio }))
      .catch((error) => {
        if (!controller.signal.aborted) setLoad({ status: "error", error });
      });
    return () => controller.abort();
  }, [creature, attempt]);

  // the title follows the creature and the language, before and after the workshop opens
  useEffect(() => {
    document.title = t("docTitle", pick(creature.name, lang));
  }, [t, creature, lang]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (load.status === "loading") return <OpeningWorkshop />;
  if (load.status === "error") return <LoadFailed detail={load.error?.message} onRetry={retry} />;
  return <Workshop studio={load.studio} creature={creature} onSwitchCreature={onSwitchCreature} />;
}

export default function Studio() {
  const [route, setRoute] = useState(() => creatureFromSearch(location.search));

  useEffect(() => {
    const onPop = () => setRoute(creatureFromSearch(location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const switchCreature = useCallback((id) => {
    history.pushState(null, "", studioUrl(id));
    setRoute(creatureFromSearch(location.search));
  }, []);

  if (!route.known) return <UnknownCreature requested={route.requested} />;
  return <CreatureStudio key={route.creature.id} creature={route.creature} onSwitchCreature={switchCreature} />;
}
