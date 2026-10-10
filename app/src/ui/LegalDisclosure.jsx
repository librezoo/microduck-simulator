import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { signed } from "../game/signed.js";
import { MONO, ORANGE } from "../theme.js";
import { ANTON, COMIC_INK, CREAM } from "./comic.jsx";

const NOTICE_FILES = [
  ["PROJECT NOTICE", "./legal/PROJECT-NOTICE.txt"],
  ["PRIVACY", "./legal/PRIVACY.txt"],
  ["TRADEMARKS", "./legal/TRADEMARKS.txt"],
  ["ASSET ATTRIBUTIONS", "./legal/ASSET-ATTRIBUTIONS.txt"],
  ["THIRD-PARTY SOFTWARE", "./legal/THIRD-PARTY-NOTICES.txt"],
  ["NPM PRODUCTION LICENSES", "./legal/NPM-PRODUCTION-LICENSES.txt"],
  ["ONNX RUNTIME NOTICES", "./legal/ONNXRUNTIME-THIRD-PARTY-NOTICES.txt"],
  ["MUJOCO WASM NOTICES", "./legal/MUJOCO-WASM-THIRD-PARTY-NOTICES.txt"],
  ["APACHE 2.0", "./legal/LICENSE-APACHE-2.0.txt"],
];

export default function LegalDisclosure() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || notice || error) return;
    let cancelled = false;
    Promise.all(NOTICE_FILES.map(async ([title, path]) => {
      const response = await fetch(signed(path), { cache: "force-cache" });
      if (!response.ok) throw new Error(`${title}: HTTP ${response.status}`);
      return `===== ${title} =====\n\n${await response.text()}`;
    }))
      .then((parts) => { if (!cancelled) setNotice(parts.join("\n\n")); })
      .catch((reason) => { if (!cancelled) setError(String(reason)); });
    return () => { cancelled = true; };
  }, [open, notice, error]);

  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen(true)}
        sx={{
          appearance: "none",
          minHeight: 44,
          px: "0.75rem",
          border: 0,
          background: "transparent",
          color: "rgba(250, 248, 242, 0.62)",
          cursor: "pointer",
          fontFamily: MONO,
          fontSize: "0.58rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textDecoration: "underline",
          textUnderlineOffset: "0.25em",
          textTransform: "uppercase",
          "&:focus-visible": { outline: `2px dashed ${CREAM}`, outlineOffset: 2 },
          "@media (orientation: landscape) and (max-height: 520px)": {
            minHeight: 32,
          },
        }}
      >
        Legal · Privacy · Credits
      </Box>
      <Box
        component="a"
        href="https://github.com/pollen-robotics/microduck"
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          maxWidth: "22rem",
          px: "0.75rem",
          color: "rgba(250, 248, 242, 0.42)",
          fontFamily: MONO,
          fontSize: "0.5rem",
          letterSpacing: "0.06em",
          lineHeight: 1.5,
          textAlign: "center",
          textDecoration: "none",
          "&:hover, &:focus-visible": { color: "rgba(250, 248, 242, 0.7)", textDecoration: "underline" },
        }}
      >
        Improves on the Apache-2.0 Microduck by Pollen Robotics
      </Box>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="legal-dialog-title"
        fullWidth
        maxWidth="md"
        sx={{
          "& .MuiBackdrop-root": { background: "rgba(8, 8, 12, 0.92)" },
          "& .MuiDialog-paper": {
            height: "min(44rem, calc(100% - 2rem - var(--safe-top) - var(--safe-bottom)))",
            maxHeight: "none",
            m: "calc(1rem + var(--safe-top)) calc(1rem + var(--safe-right)) calc(1rem + var(--safe-bottom)) calc(1rem + var(--safe-left))",
            border: `2px solid ${CREAM}`,
            borderRadius: 0,
            background: COMIC_INK,
            boxShadow: `6px 6px 0 ${ORANGE}`,
          },
        }}
      >
        <Box data-legal-dialog="true" sx={{ display: "contents" }}>
          <DialogTitle
            id="legal-dialog-title"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              p: "0.7rem 0.8rem",
              borderBottom: `1px solid ${CREAM}`,
              fontFamily: ANTON,
              color: ORANGE,
              letterSpacing: "0.08em",
            }}
          >
            LEGAL · PRIVACY · CREDITS
            <Box
              component="button"
              type="button"
              aria-label="Close legal notices"
              autoFocus
              onClick={() => setOpen(false)}
              sx={{
                minWidth: 44,
                minHeight: 44,
                border: `2px solid ${CREAM}`,
                background: ORANGE,
                color: COMIC_INK,
                cursor: "pointer",
                fontFamily: ANTON,
              }}
            >
              CLOSE
            </Box>
          </DialogTitle>
          <DialogContent
            component="pre"
            tabIndex={0}
            sx={{
              m: 0,
              p: "1rem",
              overflow: "auto",
              color: CREAM,
              fontFamily: MONO,
              fontSize: "0.7rem",
              lineHeight: 1.55,
              textAlign: "left",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {error ? `Unable to load notices. ${error}` : notice || "Loading notices…"}
          </DialogContent>
        </Box>
      </Dialog>
    </>
  );
}
