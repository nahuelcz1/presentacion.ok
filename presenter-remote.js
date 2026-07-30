/**
 * Popup fallback del control remoto (3 botones).
 */
(function () {
  const CHANNEL = "puntook-presenter-remote";
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
  let ui = null;

  function send(command) {
    channel?.postMessage({ role: "remote", type: "command", command });
  }

  channel?.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg?.role === "host" && msg.type === "state") ui?.update(msg.state);
  });

  window.addEventListener("beforeunload", () => {
    channel?.postMessage({ role: "remote", type: "event", event: "closed" });
  });

  document.addEventListener("DOMContentLoaded", () => {
    ui = window.PuntoOkRemoteMini.mountMiniControls(document, send);
    channel?.postMessage({ role: "remote", type: "requestState" });
  });
})();
