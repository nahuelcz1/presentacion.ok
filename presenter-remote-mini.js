/**
 * UI mínima del control remoto (3 botones) — compartida por PiP y popup.
 */
(function (global) {
  const MINI_HTML =
    '<div class="remote-mini" role="toolbar" aria-label="Control del presentador">' +
    '<button class="remote-mini__btn" id="remotePrev" type="button" aria-label="Anterior">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>' +
    "</button>" +
    '<button class="remote-mini__btn remote-mini__btn--marker" id="remoteMarker" type="button" aria-label="Marcador" aria-pressed="false">' +
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z"/><path d="M14 6l4 4"/></svg>' +
    "</button>" +
    '<button class="remote-mini__btn" id="remoteNext" type="button" aria-label="Siguiente">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>' +
    "</button></div>";

  const MINI_CSS =
    "html,body{margin:0;padding:0;overflow:hidden;background:transparent;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}" +
    ".remote-mini{display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 8px;background:rgba(255,255,255,.96);border-radius:999px;box-shadow:0 8px 28px rgba(0,0,0,.18),inset 0 0 0 1px rgba(0,0,0,.06)}" +
    ".remote-mini__btn{width:36px;height:36px;border:0;border-radius:50%;display:grid;place-items:center;background:#fff;color:#1d1d1f;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}" +
    ".remote-mini__btn:hover:not(:disabled){transform:scale(1.06);background:#fafafa}" +
    ".remote-mini__btn:disabled{opacity:.35;cursor:not-allowed}" +
    ".remote-mini__btn--marker.is-active{background:rgba(255,55,95,.14);color:#ff375f}";

  function mountMiniControls(doc, onCommand) {
    doc.head.innerHTML = '<meta charset="UTF-8"><style>' + MINI_CSS + "</style>";
    doc.body.innerHTML = MINI_HTML;
    doc.getElementById("remotePrev")?.addEventListener("click", () => onCommand("prev"));
    doc.getElementById("remoteNext")?.addEventListener("click", () => onCommand("next"));
    doc.getElementById("remoteMarker")?.addEventListener("click", () => onCommand("toggleMarker"));
    return {
      update(state) {
        const prev = doc.getElementById("remotePrev");
        const next = doc.getElementById("remoteNext");
        const marker = doc.getElementById("remoteMarker");
        if (prev) prev.disabled = !state.canPrev;
        if (next) next.disabled = !state.canNext;
        if (marker) {
          marker.classList.toggle("is-active", !!state.markerOn);
          marker.setAttribute("aria-pressed", String(!!state.markerOn));
        }
      },
    };
  }

  global.PuntoOkRemoteMini = { mountMiniControls, MINI_CSS, MINI_HTML };
})(typeof window !== "undefined" ? window : globalThis);
