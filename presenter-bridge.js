/**
 * Control del presentador siempre en ventana separada (PiP o popup).
 */
(function () {
  if (document.documentElement.classList.contains("meet-stage")) return;

  const CHANNEL = "puntook-presenter-remote";

  const els = {
    openBtn: document.getElementById("presenterOpenBtn"),
    toast: document.getElementById("presenterToast"),
  };

  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
  let remoteWin = null;
  let pipWindow = null;
  let externalUi = null;
  let watchTimer = null;
  let toastTimer = null;

  const PIP_W = 248;
  const PIP_H = 52;

  function deck() {
    return window.PuntoOkDeck;
  }

  function isDetached() {
    const pipApi = window.documentPictureInPicture;
    return !!(
      (pipWindow && !pipWindow.closed) ||
      (remoteWin && !remoteWin.closed) ||
      (pipApi?.window && !pipApi.window.closed)
    );
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.hidden = false;
    els.toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 4500);
  }

  function getRemoteState() {
    const d = deck();
    const state = d?.getState?.() || { page: 1, title: "", total: 11 };
    const markOpen = d?.getMarkVideoState?.() || { v1: false, v2: false };
    return {
      page: state.page,
      title: state.title,
      total: state.total,
      markerOn: d?.isMarkerOn?.() ?? document.body.classList.contains("marker-on"),
      canPrev: state.page > 1,
      canNext: state.page < state.total,
      markV1Open: !!markOpen.v1,
      markV2Open: !!markOpen.v2,
    };
  }

  function publishState() {
    const state = getRemoteState();
    channel?.postMessage({ role: "host", type: "state", state });
    externalUi?.update(state);
  }

  function runCommand(command) {
    const d = deck();
    if (!d) return;
    switch (command) {
      case "prev": d.prev(); break;
      case "next": d.next(); break;
      case "toggleMarker": d.toggleMarker?.(); break;
      case "playMarkV1": d.playMarkVideo?.(1); break;
      case "playMarkV2": d.playMarkVideo?.(2); break;
      default: break;
    }
    publishState();
  }

  function setDetached(on) {
    els.openBtn?.classList.toggle("is-active", on);
    els.openBtn?.setAttribute("aria-pressed", String(on));
    document.body.classList.toggle("presenter-detached", on);
  }

  function onRemoteClosed() {
    pipWindow = null;
    remoteWin = null;
    externalUi = null;
    clearInterval(watchTimer);
    watchTimer = null;
    setDetached(false);
  }

  function watchPopupWindow(win) {
    clearInterval(watchTimer);
    watchTimer = setInterval(() => {
      if (!win || win.closed) onRemoteClosed();
    }, 400);
  }

  async function openDocumentPiP() {
    const pipApi = window.documentPictureInPicture;
    if (!pipApi) return false;

    if (pipApi.window && !pipApi.window.closed) {
      pipApi.window.focus();
      setDetached(true);
      return true;
    }

    try {
      pipWindow = await pipApi.requestWindow({ width: PIP_W, height: PIP_H });
    } catch (err) {
      if (err?.name === "NotAllowedError") return false;
      console.warn("[PuntoOk Presenter] PiP:", err);
      return false;
    }

    externalUi = window.PuntoOkRemoteMini.mountMiniControls(pipWindow.document, runCommand);
    pipWindow.addEventListener("pagehide", onRemoteClosed);

    setDetached(true);
    publishState();
    return true;
  }

  function openPopupWindow() {
    if (remoteWin && !remoteWin.closed) {
      remoteWin.focus();
      setDetached(true);
      return true;
    }

    const url = new URL("presenter-remote.html", location.href).href;
    remoteWin = window.open(
      url,
      "puntook-presenter-remote",
      "popup,width=" + PIP_W + ",height=" + PIP_H + ",left=80,top=80,menubar=no,toolbar=no,location=no,status=no,resizable=no,scrollbars=no"
    );

    if (!remoteWin) {
      showToast("Permití ventanas emergentes para abrir el control.");
      return false;
    }

    watchPopupWindow(remoteWin);
    setDetached(true);
    publishState();
    return true;
  }

  async function openDetachedWindow() {
    if (isDetached()) {
      if (pipWindow && !pipWindow.closed) pipWindow.focus();
      else if (remoteWin && !remoteWin.closed) remoteWin.focus();
      else if (window.documentPictureInPicture?.window) {
        window.documentPictureInPicture.window.focus();
      }
      setDetached(true);
      return true;
    }

    const pipOk = await openDocumentPiP();
    if (pipOk) return true;
    return openPopupWindow();
  }

  channel?.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg?.role !== "remote") return;
    if (msg.type === "command") runCommand(msg.command);
    if (msg.type === "requestState") publishState();
    if (msg.type === "event" && msg.event === "closed") onRemoteClosed();
  });

  els.openBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openDetachedWindow();
  });

  function bootstrap() {
    if (!deck()) {
      requestAnimationFrame(bootstrap);
      return;
    }
    deck().onSlideChange(() => publishState());
    document.addEventListener("puntook:marker", () => publishState());
    publishState();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") {
      if (e.target.closest("input, textarea, select")) return;
      e.preventDefault();
      openDetachedWindow();
    }
  });

  window.PuntoOkPresenter = {
    openDetached: openDetachedWindow,
    closeDetached: onRemoteClosed,
    isDetached,
  };

  bootstrap();
})();
