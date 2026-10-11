import { useEffect } from "react";
import { useT } from "./i18n.js";
import Icon from "./icons.jsx";

// One quiet status line at a time. role="status" is read out politely.
export default function Toast({ toast, onDismiss }) {
  const { t } = useT();
  useEffect(() => {
    if (!toast || toast.persist) return undefined;
    const timer = setTimeout(onDismiss, toast.action ? 6000 : 3800);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div className="lz-toast-zone">
      {toast ? (
        <div className="lz-toast" role="status" key={toast.id}>
          {toast.busy ? <span className="lz-spinner" aria-hidden="true" /> : <Icon name="check" size={16} />}
          <span>{toast.text}</span>
          {toast.action ? (
            <button type="button" className="lz-toast-action" onClick={() => { toast.action.run(); onDismiss(); }}>
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
