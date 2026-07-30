/**
 * Configuración compartida del complemento de Google Meet — Punto Ok Presentación.
 * Reemplazá los placeholders antes de desplegar el add-on privado.
 */
(function (global) {
  const DEFAULT_GITHUB_PAGES_ORIGIN = "https://nahuelcz1.github.io";
  const DEFAULT_REPO_BASE_PATH = "/presentacion.ok";

  function normalizeBasePath(pathname) {
    if (!pathname || pathname === "/") return "/";
    let base = pathname.replace(/\/meet\/[^/]*$/, "").replace(/\/index\.html$/, "");
    if (!base.endsWith("/")) base += "/";
    return base;
  }

  function resolveBaseUrl() {
    const origin = global.location?.origin || DEFAULT_GITHUB_PAGES_ORIGIN;
    const basePath = normalizeBasePath(global.location?.pathname || DEFAULT_REPO_BASE_PATH + "/");
    return origin + basePath;
  }

  const baseUrl = resolveBaseUrl().replace(/\/$/, "") + "/";

  const MeetConfig = {
    /** Número del proyecto Google Cloud (no el ID). */
    cloudProjectNumber: "YOUR_CLOUD_PROJECT_NUMBER",

    /** Origen principal del add-on (debe coincidir con addOnOrigins en deployment.json). */
    addOnOrigin: DEFAULT_GITHUB_PAGES_ORIGIN,

    /** Base pública de la presentación (GitHub Pages). */
    baseUrl,

    /** Canal para pruebas locales fuera de Meet. */
    broadcastChannelName: "puntook-meet-controller",

    /** URLs de entrada del complemento. */
    urls: {
      presentation: baseUrl + "index.html?meet=stage",
      mainStage: baseUrl + "meet/main-stage.html",
      sidePanel: baseUrl + "meet/side-panel.html",
    },

    /** URL externa de la demo (slide 8). */
    demoUrl: "https://www.alpha.puntook.com.py/empresa-v2",

    /** SDK de Meet (gstatic). */
    meetSdkUrl: "https://www.gstatic.com/meetjs/addons/1.1.0/meet.addons.js",

    /** Versión del protocolo de mensajes frame-to-frame / BroadcastChannel. */
    messageVersion: 1,
  };

  global.MeetConfig = Object.freeze(MeetConfig);
})(typeof window !== "undefined" ? window : globalThis);
