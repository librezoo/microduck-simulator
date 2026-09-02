import Box from "@mui/material/Box";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useGame, setMultiplayerEnabled } from "../store.js";
import { getPerformanceProfile } from "../native/runtime.js";
import { MONO, ORANGE } from "../theme.js";

const STATUS_LABELS = {
  off: "OFF · NO PUBLIC ROOM CONNECTION",
  pending: "ON · JOINS AFTER ENTRY",
  joining: "ON · JOINING PUBLIC ROOM",
  connected: "ON · PUBLIC ROOM ACTIVE",
  unavailable: "ON · NETWORK CURRENTLY UNAVAILABLE",
};

export default function PublicMultiplayerConsent() {
  const nativeApp = getPerformanceProfile().native;
  const enabled = useGame((s) => s.multiplayerEnabled);
  const status = useGame((s) => s.multiplayerStatus);

  if (nativeApp) {
    return (
      <Box
        data-multiplayer-consent="true"
        role="status"
        sx={{
          width: "100%",
          maxWidth: "34rem",
          p: "0.7rem 0.8rem",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderLeft: "3px solid rgba(255, 255, 255, 0.3)",
          background: "rgba(255, 255, 255, 0.045)",
          textAlign: "left",
          "@media (orientation: landscape) and (max-height: 520px)": {
            p: "0.45rem 0.6rem",
          },
        }}
      >
        <Typography sx={{ fontFamily: MONO, fontSize: "0.68rem", fontWeight: 800, color: "#fff" }}>
          OFFLINE APP · PUBLIC MULTIPLAYER DISABLED
        </Typography>
        <Typography sx={{ mt: "0.2rem", fontSize: "0.62rem", lineHeight: 1.35, color: "rgba(255,255,255,0.62)" }}>
          The iOS reference build does not connect to public Nostr relays or WebRTC peers.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      data-multiplayer-consent="true"
      role="group"
      aria-labelledby="public-multiplayer-label"
      sx={{
        width: "100%",
        maxWidth: "34rem",
        p: "0.7rem 0.8rem",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        borderLeft: `3px solid ${enabled ? ORANGE : "rgba(255, 255, 255, 0.3)"}`,
        background: "rgba(255, 255, 255, 0.045)",
        textAlign: "left",
        "@media (orientation: landscape) and (max-height: 520px)": {
          p: "0.5rem 0.6rem",
        },
      }}
    >
      <Box
        component="label"
        sx={{
          display: "flex",
          alignItems: "center",
          minHeight: 44,
          gap: "0.45rem",
          cursor: "pointer",
        }}
      >
        <Switch
          checked={enabled}
          onChange={(event) => setMultiplayerEnabled(event.target.checked)}
          size="small"
          color="warning"
          slotProps={{
            input: {
              "aria-labelledby": "public-multiplayer-label",
              "aria-describedby": "public-multiplayer-detail public-multiplayer-status",
            },
          }}
        />
        <Typography
          id="public-multiplayer-label"
          component="span"
          sx={{
            fontFamily: MONO,
            fontSize: "0.72rem",
            fontWeight: 800,
            letterSpacing: "0.09em",
            color: "#fff",
          }}
        >
          PUBLIC MULTIPLAYER (OPTIONAL)
        </Typography>
      </Box>
      <Typography
        id="public-multiplayer-detail"
        sx={{
          mt: "0.25rem",
          fontSize: "0.66rem",
          lineHeight: 1.4,
          color: "rgba(255, 255, 255, 0.66)",
          "@media (orientation: landscape) and (max-height: 520px)": {
            fontSize: "0.58rem",
            lineHeight: 1.25,
          },
        }}
      >
        When on, your duck&apos;s live pose is shared with other visitors.
        Public Nostr signaling relays and WebRTC peers receive connection and
        network metadata, including IP addresses. Your choice is stored only
        on this device and can be switched off at any time.
      </Typography>
      <Typography
        id="public-multiplayer-status"
        aria-live="polite"
        sx={{
          mt: "0.35rem",
          fontFamily: MONO,
          fontSize: "0.57rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: enabled ? ORANGE : "rgba(255, 255, 255, 0.42)",
        }}
      >
        {STATUS_LABELS[status] ?? STATUS_LABELS.pending}
      </Typography>
    </Box>
  );
}
