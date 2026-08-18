(function () {
  const deck = document.getElementById("deck");
  const slides = Array.from(deck.querySelectorAll(".slide"));
  const total = slides.length;
  const meetParams = new URLSearchParams(location.search);
  const isMeetStage = meetParams.get("meet") === "stage";
  if (isMeetStage) document.documentElement.classList.add("meet-stage");

  function motionOk() {
    return !isMeetStage;
  }
  function syncMotionClass() {
    const on = !isMeetStage;
    document.documentElement.classList.toggle("motion-ok", on);
    document.documentElement.classList.toggle("allow-motion", on);
  }
  syncMotionClass();

  const deckConfig = Object.assign(
    {
      storageKey: "puntook-presentacion-slide",
      persist: !isMeetStage,
      emitExternalSlideChanges: true,
    },
    window.PRESENTATION_CONFIG || {}
  );
  const SLIDE_STORE_KEY = deckConfig.storageKey;
  const slideChangeListeners = new Set();

  function clampSlideIndex(i) {
    return Math.max(0, Math.min(total - 1, i));
  }

  function parseSlideIndexFromHash() {
    const h = location.hash.replace(/^#/, "").trim();
    if (!h) return null;
    const m = h.match(/^(?:slide[-=])?(\d+)$/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n - 1;
  }

  function loadSavedSlideIndex() {
    const fromHash = parseSlideIndexFromHash();
    if (fromHash !== null) return clampSlideIndex(fromHash);
    if (isMeetStage || !deckConfig.persist) return 0;
    try {
      const raw = localStorage.getItem(SLIDE_STORE_KEY);
      if (raw === null) return 0;
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) return 0;
      return clampSlideIndex(n);
    } catch {
      return 0;
    }
  }

  function persistSlideIndex() {
    if (!deckConfig.persist) return;
    try {
      localStorage.setItem(SLIDE_STORE_KEY, String(current));
    } catch (_) { /* private mode / blocked storage */ }
    const hash = "#" + (current + 1);
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }

  function getSlideState(index) {
    const i = index == null ? current : clampSlideIndex(index);
    const slide = slides[i];
    return {
      index: i,
      page: i + 1,
      title: slide?.dataset.title || "",
      id: slide?.id || null,
      total,
      hash: "#" + (i + 1),
    };
  }

  function emitSlideChange() {
    const state = getSlideState();
    slideChangeListeners.forEach((fn) => {
      try { fn(state); } catch (_) { /* listener error */ }
    });
    if (deckConfig.emitExternalSlideChanges && window.parent !== window) {
      try {
        window.parent.postMessage({ source: "puntook-deck", type: "state", state }, location.origin);
      } catch (_) { /* cross-origin */ }
    }
  }

  let current = loadSavedSlideIndex();

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const dotsWrap = document.getElementById("dots");
  const counter = document.getElementById("counter");
  const progressBar = document.getElementById("progressBar");
  const progressEl = document.getElementById("progress");
  const slideStatus = document.getElementById("slideStatus");
  const overview = document.getElementById("overview");
  const overviewGrid = document.getElementById("overviewGrid");
  const markSlide = document.getElementById("slideMark");
  const impactSlide = document.getElementById("slideImpact");
  const impactWrap = document.getElementById("impactWrap");
  const impactLinkPath = document.getElementById("impactLinkPath");
  const impactCards = impactSlide ? Array.from(impactSlide.querySelectorAll(".impact-card")) : [];
  const supportSlide = document.getElementById("slideSupport");
  const supportBgVideo = document.getElementById("supportBgVideo");
  const implSlide = document.getElementById("slideImplementation");
  const implTimeline = document.getElementById("implTimeline");
  let implTlTimer = null;
  const traceSlide = document.getElementById("slideTraceability");
  const tracePanel = document.getElementById("tracePanel");
  const traceMap = document.getElementById("traceMap");
  const traceMapCanvas = document.getElementById("traceMapCanvas");
  const traceMapMeta = document.getElementById("traceMapMeta");
  const traceMapLive = document.getElementById("traceMapLive");
  const traceHistList = document.getElementById("traceHistList");
  const traceHistClear = document.getElementById("traceHistClear");
  const traceFaceBtn = document.getElementById("traceFaceBtn");
  const traceFace = document.getElementById("traceFace");
  const traceFaceStatus = document.getElementById("traceFaceStatus");
  const traceFaceLoading = document.getElementById("traceFaceLoading");
  const traceMarkModal = document.getElementById("traceMarkModal");
  const traceMarkModalTitle = document.getElementById("traceMarkModalTitle");
  const traceMarkModalSearch = document.getElementById("traceMarkModalSearch");
  const traceMarkModalRows = document.getElementById("traceMarkModalRows");
  const traceMarkModalFoot = document.getElementById("traceMarkModalFoot");
  const traceMarkModalClose = document.getElementById("traceMarkModalClose");
  let traceTimer = null;
  let traceListenersBound = false;
  let traceFaceBound = false;
  let traceMarkModalBound = false;
  let traceMapClickBound = false;
  let traceMarkModalLngLat = null;
  let traceFaceScanTimer = null;
  let traceFaceDoneTimer = null;
  let traceHistDefaultHTML = traceHistList ? traceHistList.innerHTML : "";
  let tracePeriodDefaultText = "";
  const TRACE_DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  let traceHistDragged = false;
  let traceHistItemActivated = false;
  let traceHistClearBound = false;
  let traceDynamicSeq = 0;
  let traceLibreMap = null;
  let traceMapReady = null;
  let traceGeoPromise = null;
  let traceActiveCoords = null;
  let traceOrigin = { lat: -25.2865, lng: -57.647 };
  const TRACE_FALLBACK = { lat: -25.2865, lng: -57.647 };
  const TRACE_MAP_ZOOM = 17.2;
  const TRACE_GEOFENCE_RADIUS_M = 70;
  const TRACE_GENERIC_TIMES = ["08:00", "12:00", "13:00", "17:30"];
  const TRACE_ROAD_BLUE = "#7a92a8";
  const TRACE_ROAD_BLUE_DARK = "#6a8298";
  const TRACE_ROAD_MINOR = "#ffffff";
  const TRACE_ROAD_CASING = "#e4e4e4";
  const heroSlide = deck.querySelector(".slide--hero");
  const dispersaSlide = document.getElementById("slideDispersa");
  let heroIntroSeen = false;

  // Build dots
  slides.forEach((s, i) => {
    const dot = document.createElement("button");
    dot.className = "dot";
    dot.setAttribute("aria-label", "Ir a la diapositiva " + (i + 1));
    dot.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(dot);
  });
  const dots = Array.from(dotsWrap.children);

  // Build overview thumbnails (page selector)
  slides.forEach((s, i) => {
    const isDark = s.classList.contains("slide--dark");
    const thumb = document.createElement("button");
    thumb.className = "ov-thumb" + (isDark ? " ov-thumb--dark" : "");
    thumb.innerHTML =
      '<span class="ov-thumb__num">Diapositiva ' + (i + 1) + '</span>' +
      '<span class="ov-thumb__title">' + (s.dataset.title || "Slide " + (i + 1)) + "</span>" +
      '<span class="ov-thumb__bar"></span>';
    thumb.addEventListener("click", () => {
      goTo(i);
      closeOverview();
    });
    overviewGrid.appendChild(thumb);
  });
  const thumbs = Array.from(overviewGrid.children);

  slides.forEach((s, i) => {
    s.setAttribute("aria-roledescription", "diapositiva");
    if (!s.getAttribute("aria-label")) {
      s.setAttribute("aria-label", s.dataset.title || "Diapositiva " + (i + 1));
    }
  });
  if (progressEl) progressEl.setAttribute("aria-valuemax", String(total));

  let slideEnterTimer;
  let lastRenderedSlide = -1;

  function replaySlideEntrances(slide) {
    if (!slide || !motionOk()) return;
    if (slide === heroSlide) {
      heroSlide.classList.remove("hero-intro-complete");
      heroIntroSeen = false;
    }
    const anims = slide.querySelectorAll(".anim");
    anims.forEach((el) => {
      el.style.transition = "none";
      el.style.opacity = "0";
      el.style.transform = "translateY(34px)";
    });
    void slide.offsetWidth;
    requestAnimationFrame(() => {
      anims.forEach((el) => {
        el.style.transition = "";
        el.style.opacity = "";
        el.style.transform = "";
      });
    });
    if (!slide.classList.contains("slide--hero")) {
      slide.classList.remove("slide-entering");
      void slide.offsetWidth;
      slide.classList.add("slide-entering");
      clearTimeout(slideEnterTimer);
      slideEnterTimer = setTimeout(() => slide.classList.remove("slide-entering"), 760);
    }
  }

  function render(options) {
    deck.style.transform = "translateX(" + -current * 100 + "vw)";
    slides.forEach((s, i) => {
      const active = i === current;
      s.classList.toggle("is-active", active);
      if (active) {
        s.removeAttribute("inert");
        s.removeAttribute("aria-hidden");
      } else {
        s.setAttribute("inert", "");
        s.setAttribute("aria-hidden", "true");
      }
    });
    dots.forEach((d, i) => d.classList.toggle("is-active", i === current));
    thumbs.forEach((t, i) => t.classList.toggle("is-current", i === current));
    counter.textContent = current + 1 + " / " + total;
    progressBar.style.width = ((current + 1) / total) * 100 + "%";
    if (progressEl) {
      progressEl.setAttribute("aria-valuenow", String(current + 1));
      progressEl.setAttribute("aria-valuetext", "Diapositiva " + (current + 1) + " de " + total);
    }
    if (slideStatus) {
      const title = slides[current].dataset.title || "";
      slideStatus.textContent = "Diapositiva " + (current + 1) + " de " + total + (title ? ": " + title : "");
    }
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === total - 1;
    document.body.classList.toggle("on-dark", slides[current].classList.contains("slide--dark"));
    if (typeof closeFeatSide === "function" && featSlide && slides[current] !== featSlide && featSlide.classList.contains("has-feat-side")) {
      closeFeatSide();
    }
    if (typeof closeAllMarkSides === "function" && markSlide && slides[current] !== markSlide && markSlide.classList.contains("has-mark-side")) {
      closeAllMarkSides(true, true);
    }
    if (impactSlide && slides[current] !== impactSlide && impactSlide.classList.contains("is-impact-linked")) {
      resetImpactLink();
    }
    if (ecoSlide && slides[current] !== ecoSlide) {
      resetEcoSlide();
    }
    if (dispersaSlide && slides[current] !== dispersaSlide && typeof window.resetChaosMagnetic === "function") {
      window.resetChaosMagnetic();
    }
    syncSupportBgVideo();
    syncImplTimeline();
    syncTraceSlide();
    syncHeroIntro();
    const slideChanged = lastRenderedSlide !== current;
    if (slideChanged && motionOk()) {
      if (lastRenderedSlide >= 0) replaySlideEntrances(slides[current]);
      else if (!slides[current]?.classList.contains("slide--hero")) {
        const slide = slides[current];
        slide.classList.add("slide-entering");
        clearTimeout(slideEnterTimer);
        slideEnterTimer = setTimeout(() => slide.classList.remove("slide-entering"), 760);
      }
    }
    if (slideChanged && slides[current] === implSlide) {
      playImplTimeline();
    }
    if (slideChanged && slides[current] === traceSlide) {
      playTraceSlide();
    }
    lastRenderedSlide = current;
  }

  function syncHeroIntro() {
    if (!heroSlide) return;
    const onHero = slides[current] === heroSlide;
    if (onHero) {
      heroIntroSeen = true;
      return;
    }
    if (heroIntroSeen) heroSlide.classList.add("hero-intro-complete");
  }

  function syncSupportBgVideo() {
    if (!supportBgVideo || !supportSlide) return;
    const active = slides[current] === supportSlide;
    if (active) {
      if (supportBgVideo.readyState >= 2) supportBgVideo.play().catch(() => {});
      else {
        supportBgVideo.addEventListener("loadeddata", () => supportBgVideo.play().catch(() => {}), { once: true });
        supportBgVideo.load();
      }
    } else {
      supportBgVideo.pause();
    }
  }

  function implPrefersReducedMotion() {
    if (document.documentElement.classList.contains("motion-ok") ||
        document.documentElement.classList.contains("allow-motion")) {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function resetImplTimeline() {
    if (!implTimeline) return;
    clearTimeout(implTlTimer);
    implTimeline.classList.remove("is-playing", "is-complete");
    delete implTimeline.dataset.hoverStep;
    void implTimeline.offsetWidth;
  }

  function setImplHoverStep(step) {
    if (!implTimeline) return;
    if (step) implTimeline.dataset.hoverStep = String(step);
    else delete implTimeline.dataset.hoverStep;
  }

  function bindImplStepHover() {
    if (!implTimeline || implTimeline.dataset.hoverBound === "1") return;
    implTimeline.dataset.hoverBound = "1";
    const steps = Array.from(implTimeline.querySelectorAll(".impl-tl__step"));
    steps.forEach((step) => {
      const activate = () => {
        if (!implTimeline.classList.contains("is-complete")) return;
        setImplHoverStep(step.dataset.step);
      };
      step.addEventListener("mouseenter", activate);
      step.addEventListener("focus", activate);
      step.addEventListener("blur", (e) => {
        if (!implTimeline.contains(e.relatedTarget)) setImplHoverStep(null);
      });
    });
    implTimeline.addEventListener("mouseleave", () => setImplHoverStep(null));
  }
  bindImplStepHover();

  function playImplTimeline() {
    if (!implTimeline) return;
    resetImplTimeline();
    if (implPrefersReducedMotion()) {
      implTimeline.classList.add("is-complete");
      return;
    }
    requestAnimationFrame(() => {
      implTimeline.classList.add("is-playing");
      implTlTimer = setTimeout(() => {
        implTimeline.classList.add("is-complete");
        implTimeline.classList.remove("is-playing");
      }, 2800);
    });
  }

  function syncImplTimeline() {
    if (!implSlide || !implTimeline) return;
    if (slides[current] !== implSlide) resetImplTimeline();
  }

  function tracePrefersReducedMotion() {
    return implPrefersReducedMotion();
  }

  function ensureTraceGeolocation() {
    if (traceGeoPromise) return traceGeoPromise;
    traceGeoPromise = new Promise((resolve) => {
      const finish = (coords) => {
        traceOrigin = coords;
        if (traceLibreMap && slides[current] === traceSlide) {
          updateTraceMapData();
          refreshTraceMap(false);
        }
        resolve(traceOrigin);
      };
      if (!navigator.geolocation) {
        finish({ ...TRACE_FALLBACK });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          finish({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => finish({ ...TRACE_FALLBACK }),
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
        }
      );
    });
    return traceGeoPromise;
  }

  function coordsForTraceRecord(btn) {
    const dlat = parseFloat(btn && btn.dataset.dlat);
    const dlng = parseFloat(btn && btn.dataset.dlng);
    return {
      lat: traceOrigin.lat + (Number.isFinite(dlat) ? dlat : 0),
      lng: traceOrigin.lng + (Number.isFinite(dlng) ? dlng : 0),
    };
  }

  function buildTraceMapStyle(baseStyle) {
    const style = JSON.parse(JSON.stringify(baseStyle));
    const majorRoadIds = new Set([
      "road_trunk_primary",
      "road_secondary_tertiary",
      "road_motorway",
      "road_motorway_link",
      "bridge_trunk_primary",
      "bridge_secondary_tertiary",
      "bridge_motorway",
      "bridge_motorway_link",
      "tunnel_trunk_primary",
      "tunnel_secondary_tertiary",
      "tunnel_motorway",
      "tunnel_motorway_link",
    ]);
    const majorCasingIds = new Set([
      "road_trunk_primary_casing",
      "road_secondary_tertiary_casing",
      "road_motorway_casing",
      "road_motorway_link_casing",
      "bridge_trunk_primary_casing",
      "bridge_secondary_tertiary_casing",
      "bridge_motorway_casing",
      "bridge_motorway_link_casing",
      "tunnel_trunk_primary_casing",
      "tunnel_secondary_tertiary_casing",
      "tunnel_motorway_casing",
      "tunnel_motorway_link_casing",
    ]);
    const minorRoadIds = new Set([
      "road_minor",
      "road_link",
      "road_service_track",
      "bridge_street",
      "tunnel_street_casing",
    ]);
    const minorCasingIds = new Set([
      "road_minor_casing",
      "road_link_casing",
      "road_service_track_casing",
      "bridge_street_casing",
    ]);

    style.layers = (style.layers || []).map((layer) => {
      if (layer.type === "symbol" || layer.type === "fill-extrusion") {
        layer.layout = Object.assign({}, layer.layout || {}, { visibility: "none" });
        return layer;
      }
      if (layer.id === "background") {
        layer.paint = Object.assign({}, layer.paint || {}, { "background-color": "#ffffff" });
        return layer;
      }
      if (layer.id === "natural_earth") {
        layer.layout = Object.assign({}, layer.layout || {}, { visibility: "none" });
        return layer;
      }
      if (layer.id === "water") {
        layer.paint = Object.assign({}, layer.paint || {}, { "fill-color": "#d7eaf8", "fill-opacity": 1 });
        return layer;
      }
      if (layer.id === "waterway_river" || layer.id === "waterway_other" || layer.id === "waterway_tunnel") {
        layer.paint = Object.assign({}, layer.paint || {}, { "line-color": "#d7eaf8" });
        return layer;
      }
      if (layer.id === "landuse_residential" || /^landuse_/.test(layer.id) || /^aeroway_/.test(layer.id)) {
        if (layer.type === "fill") {
          layer.paint = Object.assign({}, layer.paint || {}, {
            "fill-color": "#ffffff",
            "fill-opacity": 1,
            "fill-outline-color": "#f0f0f0",
          });
        } else if (layer.type === "line") {
          layer.paint = Object.assign({}, layer.paint || {}, { "line-color": "#f2f2f2" });
        }
        return layer;
      }
      if (/park|wood|grass|landcover/i.test(layer.id) && layer.type === "fill") {
        layer.paint = Object.assign({}, layer.paint || {}, {
          "fill-color": "#eef6ea",
          "fill-opacity": 1,
          "fill-outline-color": "#e5efdf",
        });
        return layer;
      }
      if (layer.id === "park_outline") {
        layer.layout = Object.assign({}, layer.layout || {}, { visibility: "none" });
        return layer;
      }
      if (layer.id === "building") {
        layer.paint = Object.assign({}, layer.paint || {}, {
          "fill-color": "#f5f5f5",
          "fill-opacity": 1,
          "fill-outline-color": "#ebebeb",
        });
        return layer;
      }
      if (/^boundary_/.test(layer.id)) {
        layer.layout = Object.assign({}, layer.layout || {}, { visibility: "none" });
        return layer;
      }
      if (majorRoadIds.has(layer.id)) {
        layer.paint = Object.assign({}, layer.paint || {}, {
          "line-color": TRACE_ROAD_BLUE,
          "line-width": ["interpolate", ["exponential", 1.2], ["zoom"], 10, 1.6, 13, 4.5, 15, 8, 17, 13],
          "line-opacity": 1,
        });
        return layer;
      }
      if (majorCasingIds.has(layer.id)) {
        layer.paint = Object.assign({}, layer.paint || {}, {
          "line-color": TRACE_ROAD_BLUE_DARK,
          "line-width": ["interpolate", ["exponential", 1.2], ["zoom"], 10, 2.6, 13, 6.5, 15, 11, 17, 17],
          "line-opacity": 0.45,
        });
        return layer;
      }
      if (minorRoadIds.has(layer.id)) {
        layer.paint = Object.assign({}, layer.paint || {}, {
          "line-color": TRACE_ROAD_MINOR,
          "line-width": ["interpolate", ["exponential", 1.2], ["zoom"], 13, 0.8, 15, 2.6, 18, 9],
        });
        return layer;
      }
      if (minorCasingIds.has(layer.id)) {
        layer.paint = Object.assign({}, layer.paint || {}, {
          "line-color": TRACE_ROAD_CASING,
          "line-width": ["interpolate", ["exponential", 1.2], ["zoom"], 13, 1.4, 15, 3.8, 18, 12],
        });
        return layer;
      }
      if (layer.id === "road_transit_rail" || layer.id === "road_major_rail" ||
          layer.id === "road_major_rail_hatching" || layer.id === "road_transit_rail_hatching" ||
          layer.id === "road_area_pattern") {
        layer.layout = Object.assign({}, layer.layout || {}, { visibility: "none" });
      }
      if (layer.type === "fill" && layer.id !== "water" && !/park|wood|grass|landcover/i.test(layer.id)) {
        layer.paint = Object.assign({}, layer.paint || {}, {
          "fill-color": "#ffffff",
          "fill-opacity": 1,
        });
      }
      return layer;
    });
    return style;
  }

  function createGeoJSONCircle(center, radiusMeters, points) {
    const steps = points || 72;
    const coords = [];
    const lngScale = radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));
    const latScale = radiusMeters / 110540;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      coords.push([
        center.lng + lngScale * Math.cos(theta),
        center.lat + latScale * Math.sin(theta),
      ]);
    }
    return {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [coords] },
      }],
    };
  }

  function formatTraceTime(date) {
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  function formatTraceDateKey(date) {
    return (
      date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }

  function isTraceFixedItem(item) {
    return item?.dataset.traceFixed === "1";
  }

  function getTraceDynamicItems() {
    if (!traceHistList) return [];
    return Array.from(traceHistList.querySelectorAll(".trace-hist__item")).filter((item) => !isTraceFixedItem(item));
  }

  function updateTraceHistClearState() {
    if (!traceHistClear) return;
    traceHistClear.disabled = getTraceDynamicItems().length === 0;
  }

  function clearTraceDynamicHistory() {
    if (!traceHistList) return;
    getTraceDynamicItems().forEach((item) => item.remove());
    const fallback = traceHistList.querySelector(".trace-hist__item.is-active[data-trace-fixed='1']") ||
      traceHistList.querySelector(".trace-hist__item[data-trace-fixed='1']:last-of-type") ||
      traceHistList.querySelector(".trace-hist__item[data-trace-fixed='1']");
    if (fallback) selectTraceRecord(fallback);
    updateTraceHistClearState();
  }

  function appendTraceHistItem(item) {
    if (!traceHistList) return;
    traceHistList.appendChild(item);
  }

  function initTraceHistDates() {
    if (!traceHistList) return;
    traceHistList.querySelectorAll(".trace-hist__item").forEach((btn) => {
      const day = btn.querySelector(".trace-hist__date-num")?.textContent?.trim();
      if (day && isTraceFixedItem(btn)) btn.dataset.date = "2026-08-" + day.padStart(2, "0");
      if (isTraceFixedItem(btn) && !btn.dataset.traceRealSlots) btn.dataset.traceRealSlots = "0,1,2,3";
    });
    if (!tracePeriodDefaultText && tracePanel) {
      tracePeriodDefaultText = tracePanel.querySelector(".trace-hist__period-field > span")?.textContent?.trim() || "08/2026";
    }
    updateTraceHistClearState();
  }

  function getTraceSlotIndex(date) {
    const minutes = date.getHours() * 60 + date.getMinutes();
    if (minutes < 12 * 60) return 0;
    if (minutes <= 13 * 60) return 1;
    if (minutes < 16 * 60) return 2;
    return 3;
  }

  function getTraceMarkType(slotIndex) {
    if (slotIndex === 0) return "Entrada";
    if (slotIndex === 3) return "Salida";
    return "Intermedio";
  }

  function getTraceRealSlots(item) {
    if (!item) return [];
    const raw = item.dataset.traceRealSlots;
    if (raw) {
      return raw.split(",").map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
    }
    const slots = item.querySelectorAll(".trace-hist__time");
    const indices = [];
    slots.forEach((el, i) => {
      const value = el.textContent.trim();
      if (value && value !== "--:--" && !el.classList.contains("trace-hist__time--empty")) indices.push(i);
    });
    return indices;
  }

  function addTraceRealSlot(item, slotIndex) {
    const slots = new Set(getTraceRealSlots(item));
    slots.add(slotIndex);
    item.dataset.traceRealSlots = Array.from(slots).sort((a, b) => a - b).join(",");
  }

  function refreshTraceTimelineSlots(item) {
    const timeline = item?.querySelector(".trace-hist__timeline");
    if (!timeline) return;
    const realSlots = new Set(getTraceRealSlots(item));
    timeline.querySelectorAll(".trace-hist__time").forEach((el, i) => {
      if (realSlots.has(i)) {
        el.classList.remove("trace-hist__time--empty");
        return;
      }
      el.textContent = TRACE_GENERIC_TIMES[i];
      el.classList.remove("trace-hist__time--empty");
    });
  }

  function getTraceSlotTime(item, index) {
    const slot = item?.querySelectorAll(".trace-hist__time")[index];
    if (!slot) return null;
    const value = slot.textContent.trim();
    if (!value || value === "--:--" || slot.classList.contains("trace-hist__time--empty")) return null;
    return value;
  }

  function getTraceTimesFromItem(item) {
    const inter1 = getTraceSlotTime(item, 1);
    const inter2 = getTraceSlotTime(item, 2);
    let intervalos = "--:--";
    if (inter1 && inter2) intervalos = inter1 + "–" + inter2;
    else if (inter1 || inter2) intervalos = inter1 || inter2;
    return {
      entrada: getTraceSlotTime(item, 0) || "--:--",
      intervalos,
      salida: getTraceSlotTime(item, 3) || "--:--",
      markCount: getTraceRealSlots(item).length,
    };
  }

  function formatTraceMarkCount(count) {
    return count === 1 ? "1 marcación" : count + " marcaciones";
  }

  function filterTraceMarkModalRows(query) {
    if (!traceMarkModalRows) return 0;
    const q = (query || "").trim().toLowerCase();
    let visible = 0;
    traceMarkModalRows.querySelectorAll(".trace-mark-modal__row").forEach((row) => {
      const name = row.dataset.name || "";
      const show = !q || name.includes(q);
      row.classList.toggle("is-hidden", !show);
      if (show) visible += 1;
    });
    if (traceMarkModalFoot) {
      traceMarkModalFoot.textContent = visible === 1
        ? "1 colaborador en esta ubicación"
        : visible + " colaboradores en esta ubicación";
    }
    return visible;
  }

  function populateTraceMarkModal(item) {
    if (!item || !traceMarkModalRows) return;
    const times = getTraceTimesFromItem(item);
    const row = traceMarkModalRows.querySelector(".trace-mark-modal__row");
    if (row) {
      row.querySelector('[data-field="entrada"]').textContent = times.entrada;
      row.querySelector('[data-field="intervalos"]').textContent = times.intervalos;
      row.querySelector('[data-field="salida"]').textContent = times.salida;
    }
    if (traceMarkModalTitle) {
      traceMarkModalTitle.textContent = "1 persona · " + formatTraceMarkCount(times.markCount || 1);
    }
    filterTraceMarkModalRows(traceMarkModalSearch?.value || "");
  }

  function positionTraceMarkModal() {
    if (!traceMarkModal || traceMarkModal.hidden || !traceLibreMap || !traceMarkModalLngLat) return;
    const point = traceLibreMap.project(traceMarkModalLngLat);
    const mapW = traceMapCanvas?.clientWidth || traceMap?.clientWidth || 0;
    const mapH = traceMapCanvas?.clientHeight || traceMap?.clientHeight || 0;
    const modalW = traceMarkModal.offsetWidth;
    const modalH = traceMarkModal.offsetHeight;
    const pad = 12;
    const gap = 18;
    let left = point.x - modalW / 2;
    let top = point.y - modalH - gap;
    left = Math.max(pad, Math.min(left, mapW - modalW - pad));
    top = Math.max(pad, Math.min(top, mapH - modalH - pad));
    traceMarkModal.style.left = left + "px";
    traceMarkModal.style.top = top + "px";
    traceMarkModal.style.setProperty("--tail-offset", (point.x - left - modalW / 2) + "px");
  }

  function closeTraceMarkModal() {
    if (!traceMarkModal || !traceMap) return;
    traceMarkModalLngLat = null;
    traceMarkModal.hidden = true;
    traceMap.classList.remove("trace-map--mark-modal-open");
    if (traceMarkModalSearch) traceMarkModalSearch.value = "";
    filterTraceMarkModalRows("");
  }

  function openTraceMarkModal(lngLat) {
    if (!traceMarkModal || !traceMap || !traceHistList) return;
    const active = traceHistList.querySelector(".trace-hist__item.is-active");
    if (!active) return;
    const hasMark = active.dataset.verified === "1" && active.dataset.time && active.dataset.time !== "--:--";
    if (!hasMark) return;
    closeTraceFace();
    traceMarkModalLngLat = lngLat;
    populateTraceMarkModal(active);
    traceMap.classList.add("trace-map--mark-modal-open");
    traceMarkModal.hidden = false;
    requestAnimationFrame(() => {
      positionTraceMarkModal();
      traceMarkModalSearch?.focus({ preventScroll: true });
    });
  }

  function bindTraceMarkModalListeners() {
    if (traceMarkModalBound) return;
    traceMarkModalBound = true;
    traceMarkModalClose?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTraceMarkModal();
    });
    traceMarkModalSearch?.addEventListener("input", () => {
      filterTraceMarkModalRows(traceMarkModalSearch.value);
    });
    traceMarkModalSearch?.addEventListener("click", (e) => e.stopPropagation());
    traceMarkModal?.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && traceMarkModal && !traceMarkModal.hidden) {
        closeTraceMarkModal();
      }
    });
  }

  function bindTraceMapClickHandlers() {
    if (traceMapClickBound || !traceLibreMap) return;
    traceMapClickBound = true;
    const HIT_PAD = 14;
    traceLibreMap.on("click", (e) => {
      const bbox = [
        [e.point.x - HIT_PAD, e.point.y - HIT_PAD],
        [e.point.x + HIT_PAD, e.point.y + HIT_PAD],
      ];
      const hit = traceLibreMap.queryRenderedFeatures(bbox, { layers: ["trace-marks-dots"] });
      if (hit.length) {
        e.originalEvent?.stopPropagation();
        openTraceMarkModal(e.lngLat);
        return;
      }
      if (traceMarkModal && !traceMarkModal.hidden) closeTraceMarkModal();
    });
    traceLibreMap.on("mousemove", (e) => {
      const bbox = [
        [e.point.x - HIT_PAD, e.point.y - HIT_PAD],
        [e.point.x + HIT_PAD, e.point.y + HIT_PAD],
      ];
      const hit = traceLibreMap.queryRenderedFeatures(bbox, { layers: ["trace-marks-dots"] });
      traceLibreMap.getCanvas().style.cursor = hit.length ? "pointer" : "";
    });
    traceLibreMap.on("move", () => {
      if (traceMarkModal && !traceMarkModal.hidden) positionTraceMarkModal();
    });
  }

  function buildTraceTimesForSlot(timeStr, slotIndex) {
    return TRACE_GENERIC_TIMES.map((generic, i) => (i === slotIndex ? timeStr : generic));
  }

  function getTraceMarkOffset() {
    return {
      dlat: ((Math.random() - 0.5) * 0.00032).toFixed(5),
      dlng: ((Math.random() - 0.5) * 0.00032).toFixed(5),
    };
  }

  function buildTraceTimelineHTML(times) {
    const slots = [...times, "--:--", "--:--", "--:--", "--:--"].slice(0, 4);
    const slotClass = (t) => (t === "--:--" ? " trace-hist__time trace-hist__time--empty" : " trace-hist__time");
    const kinds = ["edge", "mid", "mid", "edge"];
    let html = '<div class="trace-hist__timeline" aria-hidden="true">';
    slots.forEach((t, i) => {
      if (i > 0) html += '<span class="trace-hist__seg"></span>';
      html +=
        '<div class="trace-hist__point trace-hist__point--' + kinds[i] + '">' +
        '<span class="trace-hist__dot"></span>' +
        '<span class="' + slotClass(t).trim() + '">' + t + "</span></div>";
    });
    html += "</div>";
    return html;
  }

  function createTraceHistItem({ dateKey, dayNum, dayName, times, dlat, dlng, time, markType, slotIndex, dynamic }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "trace-hist__item";
    btn.role = "option";
    btn.setAttribute("aria-selected", "false");
    btn.dataset.date = dateKey;
    btn.dataset.time = time;
    btn.dataset.type = markType || "Entrada";
    btn.dataset.place = "Sede central";
    btn.dataset.dlat = dlat;
    btn.dataset.dlng = dlng;
    btn.dataset.verified = "1";
    btn.dataset.traceRealSlots = String(slotIndex);
    if (dynamic) btn.dataset.traceDynamic = "1";
    btn.innerHTML =
      '<div class="trace-hist__card-head">' +
      '<span class="trace-hist__date-num">' + dayNum + "</span>" +
      '<span class="trace-hist__day">' + dayName + "</span></div>" +
      buildTraceTimelineHTML(times);
    return btn;
  }

  function updateTracePeriodLabel(date) {
    const periodSpan = tracePanel?.querySelector(".trace-hist__period-field > span");
    if (!periodSpan) return;
    periodSpan.textContent =
      String(date.getMonth() + 1).padStart(2, "0") + "/" + date.getFullYear();
  }

  function confirmTraceFaceMark() {
    if (!traceHistList) return;
    const now = new Date();
    traceDynamicSeq += 1;
    const dateKey = "dynamic-" + now.getTime() + "-" + traceDynamicSeq;
    const timeStr = formatTraceTime(now);
    const dayNum = now.getDate();
    const dayName = TRACE_DAY_NAMES[now.getDay()];
    const offset = getTraceMarkOffset();
    const slotIndex = getTraceSlotIndex(now);
    const markType = getTraceMarkType(slotIndex);

    updateTracePeriodLabel(now);

    const item = createTraceHistItem({
      dateKey,
      dayNum,
      dayName,
      times: buildTraceTimesForSlot(timeStr, slotIndex),
      dlat: offset.dlat,
      dlng: offset.dlng,
      time: timeStr,
      markType,
      slotIndex,
      dynamic: true,
    });
    appendTraceHistItem(item);
    updateTraceHistClearState();

    selectTraceRecord(item);
    const histBody = tracePanel?.querySelector(".trace-hist__body");
    if (histBody) {
      requestAnimationFrame(() => {
        item.scrollIntoView({ block: "nearest", behavior: tracePrefersReducedMotion() ? "auto" : "smooth" });
      });
    }
  }

  function closeTraceFace() {
    clearTimeout(traceFaceScanTimer);
    clearTimeout(traceFaceDoneTimer);
    if (!traceFace || !traceMap) return;
    traceFace.hidden = true;
    traceFace.setAttribute("aria-hidden", "true");
    traceFace.classList.remove("is-scanning", "is-recognized");
    traceMap.classList.remove("trace-map--face-open");
    if (traceFaceStatus) traceFaceStatus.textContent = "Realizando reconocimiento facial";
    if (traceFaceLoading) traceFaceLoading.hidden = true;
  }

  function openTraceFace() {
    if (!traceFace || !traceMap) return;
    closeTraceFace();
    traceMap.classList.add("trace-map--face-open");
    traceFace.hidden = false;
    traceFace.setAttribute("aria-hidden", "false");
    traceFace.classList.add("is-scanning");
    traceFace.classList.remove("is-recognized");
    if (traceFaceStatus) traceFaceStatus.textContent = "Realizando reconocimiento facial";
    if (traceFaceLoading) traceFaceLoading.hidden = false;

    const scanMs = tracePrefersReducedMotion() ? 400 : 1800;
    const holdMs = tracePrefersReducedMotion() ? 300 : 900;

    traceFaceScanTimer = setTimeout(() => {
      if (traceFace.hidden) return;
      traceFace.classList.remove("is-scanning");
      traceFace.classList.add("is-recognized");
      if (traceFaceLoading) traceFaceLoading.hidden = true;
      if (traceFaceStatus) traceFaceStatus.textContent = "Rostro reconocido";
      confirmTraceFaceMark();
      traceFaceDoneTimer = setTimeout(() => closeTraceFace(), holdMs);
    }, scanMs);
  }

  function bindTraceFaceListeners() {
    if (traceFaceBound) return;
    traceFaceBound = true;
    traceFaceBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      openTraceFace();
    });
  }

  function buildTraceMarksGeoJSON() {
    const features = [];
    if (!traceHistList) return { type: "FeatureCollection", features };
    const active = traceHistList.querySelector(".trace-hist__item.is-active");
    if (!active) return { type: "FeatureCollection", features };
    const hasMark = active.dataset.verified === "1" && active.dataset.time && active.dataset.time !== "--:--";
    if (!hasMark) return { type: "FeatureCollection", features };
    const coords = coordsForTraceRecord(active);
    features.push({
      type: "Feature",
      properties: { id: "0", active: 1 },
      geometry: {
        type: "Point",
        coordinates: [coords.lng, coords.lat],
      },
    });
    return { type: "FeatureCollection", features };
  }

  function ensureTraceMapLayers() {
    if (!traceLibreMap || !traceLibreMap.isStyleLoaded()) return;
    if (!traceLibreMap.getSource("trace-geofence")) {
      traceLibreMap.addSource("trace-geofence", {
        type: "geojson",
        data: createGeoJSONCircle(traceOrigin, TRACE_GEOFENCE_RADIUS_M),
      });
      traceLibreMap.addLayer({
        id: "trace-geofence-fill",
        type: "fill",
        source: "trace-geofence",
        paint: {
          "fill-color": "#0071e3",
          "fill-opacity": 0.14,
        },
      });
      traceLibreMap.addLayer({
        id: "trace-geofence-line",
        type: "line",
        source: "trace-geofence",
        paint: {
          "line-color": "#0071e3",
          "line-width": 1.5,
          "line-opacity": 0.8,
        },
      });
    }
    if (!traceLibreMap.getSource("trace-marks")) {
      traceLibreMap.addSource("trace-marks", {
        type: "geojson",
        data: buildTraceMarksGeoJSON(),
      });
      traceLibreMap.addLayer({
        id: "trace-marks-dots",
        type: "circle",
        source: "trace-marks",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "active"], 1], 7.5,
            5,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "active"], 1], "#0071e3",
            "#5aa7ff",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 1,
        },
      });
    }
    bindTraceMapClickHandlers();
  }

  function updateTraceMapData() {
    if (!traceLibreMap) return;
    ensureTraceMapLayers();
    const geofence = traceLibreMap.getSource("trace-geofence");
    if (geofence) geofence.setData(createGeoJSONCircle(traceOrigin, TRACE_GEOFENCE_RADIUS_M));
    const marks = traceLibreMap.getSource("trace-marks");
    if (marks) marks.setData(buildTraceMarksGeoJSON());
  }

  function initTraceMap() {
    if (traceMapReady || !traceMapCanvas || typeof maplibregl === "undefined") {
      return traceMapReady || Promise.resolve(null);
    }
    traceMapReady = fetch("https://tiles.openfreemap.org/styles/liberty")
      .then((res) => res.json())
      .then((baseStyle) => {
        const style = buildTraceMapStyle(baseStyle);
        traceLibreMap = new maplibregl.Map({
          container: traceMapCanvas,
          style,
          center: [traceOrigin.lng, traceOrigin.lat],
          zoom: TRACE_MAP_ZOOM,
          minZoom: 12,
          maxZoom: 19,
          interactive: true,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: true,
          fadeDuration: 0,
        });
        traceLibreMap.addControl(new maplibregl.NavigationControl({
          showCompass: false,
          visualizePitch: false,
        }), "top-right");
        traceLibreMap.on("movestart", () => {
          if (traceMap) traceMap.classList.add("is-interacting");
        });
        traceLibreMap.on("moveend", () => {
          if (traceMap) traceMap.classList.remove("is-interacting");
        });
        traceMapCanvas.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
        traceMapCanvas.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
        traceMapCanvas.addEventListener("touchmove", (e) => e.stopPropagation(), { passive: true });
        return new Promise((resolve) => {
          traceLibreMap.on("load", () => {
            updateTraceMapData();
            traceLibreMap.resize();
            resolve(traceLibreMap);
          });
        });
      })
      .catch(() => {
        traceMapReady = null;
        return null;
      });
    return traceMapReady;
  }

  function refreshTraceMap(animate) {
    if (!traceLibreMap) return;
    traceLibreMap.resize();
    updateTraceMapData();
    const active = tracePanel && (
      tracePanel.querySelector(".trace-hist__item.is-active") ||
      tracePanel.querySelector(".trace-hist__item:last-of-type")
    );
    if (active) moveTraceMapToRecord(active, animate !== false);
  }

  function moveTraceMapToRecord(btn, animate) {
    if (!traceLibreMap || !btn) return;
    const hasMark = btn.dataset.verified === "1" && btn.dataset.time && btn.dataset.time !== "--:--";
    const reduce = tracePrefersReducedMotion() || animate === false;
    traceActiveCoords = hasMark ? coordsForTraceRecord(btn) : null;
    updateTraceMapData();
    traceLibreMap.easeTo({
      center: [traceOrigin.lng, traceOrigin.lat],
      zoom: TRACE_MAP_ZOOM,
      duration: reduce ? 0 : 450,
      essential: true,
    });
  }

  function selectTraceRecord(btn) {
    if (!tracePanel || !btn) return;
    closeTraceMarkModal();
    const items = Array.from(tracePanel.querySelectorAll(".trace-hist__item"));
    items.forEach((el) => {
      const on = el === btn;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-selected", String(on));
    });
    const place = btn.dataset.place || "Sede central";
    const time = btn.dataset.time || "";
    const hasMark = btn.dataset.verified === "1" && time && time !== "--:--";
    initTraceMap().then((map) => {
      if (map) moveTraceMapToRecord(btn, true);
    });
    if (traceMapMeta) {
      traceMapMeta.textContent = hasMark ? place + " · " + time : "Sin marcación";
    }
    if (traceMapLive) {
      traceMapLive.textContent = hasMark
        ? "Ubicación de la marcación: " + place + " · " + time + ". Ubicación verificada."
        : "Sin marcación para este día.";
    }
  }

  function resetTraceSlide() {
    if (!tracePanel) return;
    clearTimeout(traceTimer);
    closeTraceFace();
    closeTraceMarkModal();
    tracePanel.classList.remove("is-playing", "is-complete");
    if (traceHistList && traceHistDefaultHTML) {
      traceHistList.innerHTML = traceHistDefaultHTML;
      traceDynamicSeq = 0;
      initTraceHistDates();
      const periodSpan = tracePanel.querySelector(".trace-hist__period-field > span");
      if (periodSpan && tracePeriodDefaultText) periodSpan.textContent = tracePeriodDefaultText;
    }
    const first = tracePanel.querySelector(".trace-hist__item.is-active") ||
      tracePanel.querySelector(".trace-hist__item:last-of-type") ||
      tracePanel.querySelector(".trace-hist__item");
    if (first) selectTraceRecord(first);
    void tracePanel.offsetWidth;
  }

  function playTraceSlide() {
    if (!tracePanel) return;
    Promise.all([ensureTraceGeolocation(), initTraceMap()]).then(() => {
      if (slides[current] !== traceSlide) return;
      resetTraceSlide();
      requestAnimationFrame(() => {
        refreshTraceMap(false);
        setTimeout(() => refreshTraceMap(false), 120);
      });
      if (tracePrefersReducedMotion()) {
        tracePanel.classList.add("is-complete");
        return;
      }
      requestAnimationFrame(() => {
        tracePanel.classList.add("is-playing");
        traceTimer = setTimeout(() => {
          tracePanel.classList.add("is-complete");
          tracePanel.classList.remove("is-playing");
          refreshTraceMap(false);
        }, 2200);
      });
    });
  }

  function syncTraceSlide() {
    if (!traceSlide || !tracePanel) return;
    if (slides[current] !== traceSlide) {
      resetTraceSlide();
    }
  }

  function bindTraceHistScroll() {
    const viewport = tracePanel?.querySelector(".trace-hist__body");
    if (!viewport || viewport.dataset.scrollBound === "1") return;
    viewport.dataset.scrollBound = "1";

    let pointerDown = false;
    let isDragging = false;
    let dragPointerId = null;
    let dragStartY = 0;
    let dragStartScroll = 0;
    let pressTarget = null;
    const DRAG_THRESHOLD = 8;

    function endDrag(e) {
      if (!pointerDown && !isDragging) return;
      const wasDragging = isDragging;
      const item = pressTarget;
      pointerDown = false;
      isDragging = false;
      dragPointerId = null;
      pressTarget = null;
      viewport.classList.remove("is-dragging");
      if (e?.pointerId != null && viewport.hasPointerCapture?.(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
      if (wasDragging) {
        traceHistDragged = true;
        requestAnimationFrame(() => { traceHistDragged = false; });
      } else if (item) {
        selectTraceRecord(item);
        traceHistItemActivated = true;
        requestAnimationFrame(() => { traceHistItemActivated = false; });
      }
    }

    viewport.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerDown = true;
      isDragging = false;
      dragPointerId = e.pointerId;
      dragStartY = e.clientY;
      dragStartScroll = viewport.scrollTop;
      pressTarget = e.target.closest(".trace-hist__item");
    });

    viewport.addEventListener("pointermove", (e) => {
      if (!pointerDown || e.pointerId !== dragPointerId) return;
      const dy = e.clientY - dragStartY;
      if (!isDragging && Math.abs(dy) < DRAG_THRESHOLD) return;
      if (!isDragging) {
        isDragging = true;
        pressTarget = null;
        viewport.classList.add("is-dragging");
        viewport.setPointerCapture(e.pointerId);
      }
      e.preventDefault();
      viewport.scrollTop = dragStartScroll - dy;
    });

    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    viewport.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    viewport.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    viewport.addEventListener("touchmove", (e) => e.stopPropagation(), { passive: true });
  }

  function bindTraceHistClear() {
    if (traceHistClearBound || !traceHistClear) return;
    traceHistClearBound = true;
    traceHistClear.addEventListener("click", (e) => {
      e.stopPropagation();
      clearTraceDynamicHistory();
    });
  }

  function bindTraceListeners() {
    if (!traceHistList || traceListenersBound) return;
    traceListenersBound = true;
    bindTraceHistScroll();
    bindTraceHistClear();
    traceHistList.addEventListener("click", (e) => {
      if (traceHistDragged || traceHistItemActivated) return;
      const btn = e.target.closest(".trace-hist__item");
      if (!btn || !traceHistList.contains(btn)) return;
      e.preventDefault();
      selectTraceRecord(btn);
    });
    traceHistList.addEventListener("keydown", (e) => {
      const items = Array.from(traceHistList.querySelectorAll(".trace-hist__item"));
      const currentBtn = document.activeElement?.closest?.(".trace-hist__item");
      const idx = items.indexOf(currentBtn);
      if (idx < 0) return;
      let next = -1;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next = Math.min(items.length - 1, idx + 1);
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = Math.max(0, idx - 1);
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = items.length - 1;
      if (next < 0 || next === idx) return;
      e.preventDefault();
      items[next].focus();
      selectTraceRecord(items[next]);
    });
  }
  bindTraceListeners();
  bindTraceFaceListeners();
  bindTraceMarkModalListeners();
  initTraceHistDates();
  ensureTraceGeolocation();

  function goTo(i, options) {
    const opts = options || {};
    const nextIndex = clampSlideIndex(i);
    if (nextIndex === current && !opts.force) {
      emitSlideChange();
      return;
    }
    current = nextIndex;
    if (opts.persist !== false && deckConfig.persist) persistSlideIndex();
    else if (opts.persist === false) {
      const hash = "#" + (current + 1);
      if (location.hash !== hash) history.replaceState(null, "", hash);
    }
    render();
    emitSlideChange();
  }
  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  window.addEventListener("hashchange", () => {
    const fromHash = parseSlideIndexFromHash();
    if (fromHash === null) return;
    const idx = clampSlideIndex(fromHash);
    if (idx !== current) {
      current = idx;
      render();
      emitSlideChange();
    }
  });

  // Keyboard
  document.addEventListener("keydown", (e) => {
    const vm = document.getElementById("vmodal");
    if (vm && vm.classList.contains("is-open")) {
      if (e.key === "Escape") document.getElementById("vmodalClose").click();
      return;
    }
    const sm = document.getElementById("smodal");
    if (sm && sm.classList.contains("is-open")) {
      if (e.key === "Escape") document.getElementById("smodalClose").click();
      return;
    }
    if (featSlide && featSlide.classList.contains("has-feat-side") && e.key === "Escape") {
      if (featSideFrame.classList.contains("is-zoomed")) resetFeatSideZoom();
      else closeFeatSide();
      return;
    }
    if (typeof closeAllMarkSides === "function" && markSlide?.classList.contains("has-mark-side") && e.key === "Escape") {
      closeAllMarkSides();
      return;
    }
    if (overview.classList.contains("is-open")) {
      if (e.key === "Escape") closeOverview();
      return;
    }
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
      case " ":
        e.preventDefault(); next(); break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home": goTo(0); break;
      case "End": goTo(total - 1); break;
      case "g": case "G": openOverview(); break;
      case "f": case "F": toggleFullscreen(); break;
      case "m": case "M": toggleMarker(); break;
      case "Escape": /* nothing */ break;
    }
  });

  // Logo strip: scroll, arrastre y auto-desplazamiento infinito
  const clientsSlide = document.querySelector(".slide--clients");
  const logosAutoTickers = [];

  function logosMotionOk() {
    return motionOk();
  }

  document.querySelectorAll(".clients").forEach((clients) => {
    const shell = clients.querySelector(".logos-shell");
    const viewport = clients.querySelector(".logos-viewport");
    const track = clients.querySelector(".logos-track");
    if (!shell || !viewport || !track) return;

    let isDragging = false;
    let pointerDown = false;
    let dragPointerId = null;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let loopHalf = 0;
    let autoCarry = 0;
    let lastAutoTs = 0;
    const AUTO_SCROLL_SPEED = 24; // px/s (~un poco más lento que antes)

    function canAutoScroll() {
      measureLoopHalf();
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      return maxScroll > 8 && loopHalf > 8;
    }

    function ensureLogosLoop() {
      if (track.dataset.loopReady === "1") return;
      const boxes = Array.from(track.querySelectorAll(":scope > .lbox:not(.lbox--clone)"));
      boxes.forEach((box) => {
        const clone = box.cloneNode(true);
        clone.classList.add("lbox--clone");
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
      track.dataset.loopReady = "1";
    }

    function measureLoopHalf() {
      ensureLogosLoop();
      loopHalf = track.scrollWidth / 2;
      return loopHalf;
    }

    function wrapScroll() {
      if (loopHalf <= 0) return;
      while (viewport.scrollLeft >= loopHalf) viewport.scrollLeft -= loopHalf;
      while (viewport.scrollLeft < 0) viewport.scrollLeft += loopHalf;
    }

    const updateFades = () => {
      measureLoopHalf();
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      const infinite = loopHalf > 6 && maxScroll > 6;
      shell.classList.toggle("logos-loop-active", infinite);
      if (infinite) {
        shell.classList.add("can-scroll-left", "can-scroll-right");
        return;
      }
      shell.classList.remove("logos-loop-active");
      shell.classList.toggle("can-scroll-left", viewport.scrollLeft > 6);
      shell.classList.toggle(
        "can-scroll-right",
        maxScroll > 6 && viewport.scrollLeft < maxScroll - 6
      );
    };

    const endDrag = (e) => {
      if (!pointerDown && !isDragging) return;
      pointerDown = false;
      isDragging = false;
      dragPointerId = null;
      viewport.classList.remove("is-dragging");
      if (e?.pointerId != null && viewport.hasPointerCapture?.(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
      wrapScroll();
      updateFades();
      e?.stopPropagation?.();
    };

    viewport.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerDown = true;
      isDragging = false;
      dragPointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartScroll = viewport.scrollLeft;
      viewport.classList.remove("is-dragging");
      viewport.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });

    viewport.addEventListener("pointermove", (e) => {
      if (!pointerDown || e.pointerId !== dragPointerId) return;
      const dx = e.clientX - dragStartX;
      if (!isDragging && Math.abs(dx) < 5) return;
      if (!isDragging) {
        isDragging = true;
        viewport.classList.add("is-dragging");
      }
      viewport.scrollLeft = dragStartScroll - dx;
      wrapScroll();
      updateFades();
      e.stopPropagation();
    });

    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);

    viewport.addEventListener("wheel", (e) => {
      if (isDragging) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 2) return;
      e.stopPropagation();
      e.preventDefault();
      viewport.scrollLeft += delta;
      wrapScroll();
      updateFades();
    }, { passive: false });

    viewport.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);

    logosAutoTickers.push((now) => {
      if (!clientsSlide?.classList.contains("is-active") || !logosMotionOk() || isDragging) {
        lastAutoTs = 0;
        return;
      }
      if (!canAutoScroll()) return;
      if (!lastAutoTs) {
        lastAutoTs = now;
        return;
      }
      const dt = Math.min(64, now - lastAutoTs) / 1000;
      lastAutoTs = now;
      autoCarry += AUTO_SCROLL_SPEED * dt;
      const step = Math.floor(autoCarry);
      if (step < 1) return;
      autoCarry -= step;
      viewport.scrollLeft += step;
      wrapScroll();
      updateFades();
    });

    updateFades();
  });

  (function startLogosAutoScroll() {
    function tick(now) {
      logosAutoTickers.forEach((step) => step(now));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  // Touch swipe
  let tx = 0, ty = 0, touchTarget = null;
  deck.addEventListener("touchstart", (e) => {
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
    touchTarget = e.target;
  }, { passive: true });
  deck.addEventListener("touchend", (e) => {
    if (touchTarget?.closest?.(".logos-viewport")) return;
    if (touchTarget?.closest?.(".trace-hist__body")) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? next() : prev();
  }, { passive: true });

  // Overview
  function openOverview() { overview.classList.add("is-open"); overview.setAttribute("aria-hidden", "false"); }
  function closeOverview() { overview.classList.remove("is-open"); overview.setAttribute("aria-hidden", "true"); }
  document.getElementById("gridBtn").addEventListener("click", openOverview);
  document.getElementById("overviewClose").addEventListener("click", closeOverview);
  overview.addEventListener("click", (e) => { if (e.target === overview) closeOverview(); });

  // Brand / goto attrs
  document.querySelectorAll("[data-goto]").forEach((el) =>
    el.addEventListener("click", (e) => { e.preventDefault(); goTo(parseInt(el.dataset.goto, 10)); })
  );

  // Acordeón expandible (página 4 — una tarjeta abierta, ecosistema conectado)
  const ecoSlide = document.getElementById("slideEco");
  const ecoWrap = document.getElementById("ecoWrap");
  const ecoFlow = document.getElementById("ecoFlow");
  const ecoLinkPathA = document.getElementById("ecoLinkPathA");
  const ecoLinkPathB = document.getElementById("ecoLinkPathB");
  const expandTiles = ecoSlide ? Array.from(ecoSlide.querySelectorAll(".tile--expand")) : [];
  const ECO_FLOW = {
    web: "La plataforma centraliza datos de tótem y app → <span class=\"eco-flow__step\">RR. HH. visualiza todo en tiempo real</span>.",
    totem: "<span class=\"eco-flow__step\">El colaborador marca</span> <span class=\"eco-flow__arrow\">→</span> la información llega a la plataforma <span class=\"eco-flow__arrow\">→</span> <span class=\"eco-flow__step\">RR. HH. la visualiza en tiempo real</span>.",
    colab: "<span class=\"eco-flow__step\">El colaborador marca</span> <span class=\"eco-flow__arrow\">→</span> la información llega a la plataforma <span class=\"eco-flow__arrow\">→</span> <span class=\"eco-flow__step\">RR. HH. la visualiza en tiempo real</span>.",
  };
  function closeTile(t) { t.classList.remove("is-open"); t.setAttribute("aria-expanded", "false"); }
  function updateExpandSlideState(slide) {
    if (!slide) return;
    const anyOpen = expandTiles.some((t) => slide.contains(t) && t.classList.contains("is-open"));
    slide.classList.toggle("has-open", anyOpen);
  }
  function ecoCardPoint(card) {
    const wrapRect = ecoWrap.getBoundingClientRect();
    const r = card.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - wrapRect.left,
      y: r.top + r.height * 0.22 - wrapRect.top,
    };
  }
  function ecoLinkPath(from, to) {
    const midX = (from.x + to.x) / 2;
    const midY = Math.min(from.y, to.y) - 28;
    return "M " + from.x + " " + from.y + " Q " + midX + " " + midY + " " + to.x + " " + to.y;
  }
  function updateEcoLinks() {
    if (!ecoSlide || !ecoWrap) return;
    const open = expandTiles.find((t) => t.classList.contains("is-open"));
    if (!open) {
      ecoSlide.classList.remove("is-eco-linked");
      ecoLinkPathA?.setAttribute("d", "");
      ecoLinkPathB?.setAttribute("d", "");
      return;
    }
    ecoSlide.classList.add("is-eco-linked");
    const others = expandTiles.filter((t) => t !== open);
    if (others.length < 2) return;
    const from = ecoCardPoint(open);
    ecoLinkPathA?.setAttribute("d", ecoLinkPath(from, ecoCardPoint(others[0])));
    ecoLinkPathB?.setAttribute("d", ecoLinkPath(from, ecoCardPoint(others[1])));
  }
  function updateEcoFlow(tile) {
    if (!ecoFlow) return;
    if (!tile?.classList.contains("is-open")) {
      ecoFlow.innerHTML = "";
      ecoFlow.classList.remove("is-visible");
      return;
    }
    const key = tile.dataset.eco || "web";
    ecoFlow.innerHTML = ECO_FLOW[key] || "";
    ecoFlow.classList.add("is-visible");
  }
  function resetEcoSlide() {
    if (!ecoSlide) return;
    expandTiles.forEach(closeTile);
    ecoSlide.classList.remove("is-eco-linked", "has-open");
    updateEcoLinks();
    updateEcoFlow(null);
  }
  function toggleTile(tile) {
    const slide = tile.closest(".slide");
    if (slide === ecoSlide) {
      const willOpen = !tile.classList.contains("is-open");
      if (willOpen) {
        tile.classList.add("is-open");
        tile.setAttribute("aria-expanded", "true");
      } else {
        closeTile(tile);
      }
      updateExpandSlideState(slide);
      requestAnimationFrame(() => {
        updateEcoLinks();
        updateEcoFlow(tile.classList.contains("is-open") ? tile : null);
      });
      setTimeout(updateEcoLinks, 480);
      return;
    }
    const willOpen = !tile.classList.contains("is-open");
    if (willOpen) {
      expandTiles.forEach((t) => { if (t !== tile) closeTile(t); });
      tile.classList.add("is-open");
      tile.setAttribute("aria-expanded", "true");
    } else {
      closeTile(tile);
    }
    updateExpandSlideState(slide);
    requestAnimationFrame(() => {
      updateEcoLinks();
      updateEcoFlow(tile.classList.contains("is-open") ? tile : null);
    });
    setTimeout(updateEcoLinks, 480);
  }
  expandTiles.forEach((tile) => {
    tile.addEventListener("click", () => toggleTile(tile));
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleTile(tile); }
    });
  });

  // Panel lateral por tarjeta (p?gina 5 ? varios videos abiertos a la vez)
  const markSideBackdrop = document.getElementById("markSideBackdrop");
  const markVideoCards = markSlide ? Array.from(markSlide.querySelectorAll(".ccard--video")) : [];
  const MARK_SIDE_MS = 520;
  const markSideTimers = new WeakMap();

  function syncMarkSlideState() {
    if (!markSlide) return;
    const anyOpen = markVideoCards.some(
      (c) => c.classList.contains("is-mark-open") || c.classList.contains("is-video-active")
    );
    markSlide.classList.toggle("has-mark-side", anyOpen);
    markSideBackdrop?.setAttribute("aria-hidden", anyOpen ? "false" : "true");
  }

  function closeMarkCard(card, clearVideo = true, immediate = false, onClosed) {
    if (!card) return;
    const panel = card.querySelector(".mark-side");
    const video = card.querySelector(".mark-side video");
    const prevTimer = markSideTimers.get(card);
    if (prevTimer) clearTimeout(prevTimer);

    card.classList.remove("is-mark-open");
    panel?.setAttribute("aria-hidden", "true");
    video?.pause();
    syncMarkSlideState();

    const finish = () => {
      if (!card.classList.contains("is-mark-open")) {
        card.classList.remove("is-video-active");
        if (clearVideo && video) {
          video.pause();
          video.removeAttribute("src");
          video.load();
        }
      }
      markSideTimers.delete(card);
      syncMarkSlideState();
      onClosed?.();
    };

    if (immediate) {
      finish();
      return;
    }
    markSideTimers.set(card, setTimeout(finish, MARK_SIDE_MS));
  }

  function closeAllMarkSides(clearVideo = true, immediate = false) {
    markVideoCards.forEach((card) => closeMarkCard(card, clearVideo, immediate));
  }

  function getMarkVideoState() {
    return {
      v1: !!markVideoCards[0]?.classList.contains("is-mark-open"),
      v2: !!markVideoCards[1]?.classList.contains("is-mark-open"),
    };
  }

  function playMarkVideo(which) {
    if (!markSlide || !markVideoCards.length) return;
    const markIndex = slides.indexOf(markSlide);
    if (markIndex < 0) return;
    const idx = which === 2 || which === "v2" || which === "V2" ? 1 : 0;
    const card = markVideoCards[idx];
    const btn = card?.querySelector(".app-play");
    if (!btn) return;

    // Toggle: si ya está abierto, desactivar
    if (card.classList.contains("is-mark-open")) {
      closeMarkCard(card);
      return;
    }

    if (current !== markIndex) goTo(markIndex);
    requestAnimationFrame(() => openMarkCard(btn));
  }

  function openMarkCard(btn) {
    const card = btn.closest(".ccard--video");
    const src = btn.dataset.video || "";
    const panel = card?.querySelector(".mark-side");
    const video = panel?.querySelector("video");
    if (!card || !src || !video || !markSlide) return;

    if (card.classList.contains("is-mark-open")) {
      closeMarkCard(card);
      return;
    }

    card.classList.add("is-video-active");
    video.src = src;
    video.muted = /totem/i.test(src);
    panel.setAttribute("aria-hidden", "false");
    syncMarkSlideState();
    requestAnimationFrame(() => card.classList.add("is-mark-open"));
    video.currentTime = 0;
    video.play().catch(() => {});
  }

  markVideoCards.forEach((card) => {
    card.querySelector(".mark-side__close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMarkCard(card);
    });
  });
  markSideBackdrop?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (document.body.classList.contains("marker-on")) return;
    closeAllMarkSides();
  });

  // Modal de video (reserva)
  const vmodal = document.getElementById("vmodal");
  const vmodalVideo = document.getElementById("vmodalVideo");
  const vmodalTitle = document.getElementById("vmodalTitle");
  function openVideoModal(src, title) {
    vmodalVideo.src = src;
    vmodalTitle.textContent = title || "";
    vmodalVideo.muted = /totem/i.test(src);
    vmodal.classList.add("is-open");
    vmodal.setAttribute("aria-hidden", "false");
    vmodalVideo.currentTime = 0;
    vmodalVideo.play().catch(() => {});
  }
  function closeVideoModal() {
    vmodal.classList.remove("is-open");
    vmodal.setAttribute("aria-hidden", "true");
    vmodalVideo.pause();
    setTimeout(() => {
      if (!vmodal.classList.contains("is-open")) {
        vmodalVideo.removeAttribute("src");
        vmodalVideo.load();
      }
    }, 300);
  }
  document.querySelectorAll(".app-play").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.closest(".ccard--video")) openMarkCard(btn);
      else openVideoModal(btn.dataset.video, btn.dataset.title);
    })
  );
  document.getElementById("vmodalClose").addEventListener("click", closeVideoModal);
  vmodal.addEventListener("click", (e) => { if (e.target === vmodal) closeVideoModal(); });

  // Modal de tienda (Google Play / App Store)
  const smodal = document.getElementById("smodal");
  const smodalTitle = document.getElementById("smodalTitle");
  const smodalBadge = document.getElementById("smodalBadge");
  const smodalHint = document.getElementById("smodalHint");
  const smodalReopen = document.getElementById("smodalReopen");
  const STORE_W = 1280;
  const STORE_H = 720;
  let storePopup = null;
  let storePoll = null;
  let storeUrl = "";
  function launchStorePopup(url) {
    const left = Math.round(window.screenX + (window.outerWidth - STORE_W) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - STORE_H) / 2);
    const features = `popup=yes,width=${STORE_W},height=${STORE_H},left=${left},top=${top},noopener,noreferrer,scrollbars=yes,resizable=yes`;
    return window.open(url, "puntook-store", features);
  }
  function watchStorePopup() {
    clearInterval(storePoll);
    storePoll = setInterval(() => {
      if (!storePopup || storePopup.closed) closeStore();
    }, 500);
  }
  function openStore(url, title, badgeSrc) {
    storeUrl = url;
    smodalTitle.textContent = title || "Tienda";
    smodalBadge.src = badgeSrc || "";
    smodalBadge.alt = title || "Tienda";
    smodal.classList.add("is-open");
    smodal.setAttribute("aria-hidden", "false");
    storePopup = launchStorePopup(url);
    if (storePopup) {
      smodalHint.textContent = "La tienda se abri? en una ventana emergente 16:9. Cerr? ac? cuando termines.";
      watchStorePopup();
    } else {
      smodalHint.textContent = "El navegador bloque? la ventana emergente. Us? el bot?n para abrirla.";
    }
  }
  function closeStore() {
    clearInterval(storePoll);
    storePoll = null;
    if (storePopup && !storePopup.closed) storePopup.close();
    storePopup = null;
    smodal.classList.remove("is-open");
    smodal.setAttribute("aria-hidden", "true");
    smodalBadge.removeAttribute("src");
  }
  document.querySelectorAll(".store-badge").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openStore(link.href, link.querySelector("img")?.alt || "Tienda", link.querySelector("img")?.src);
    });
  });
  smodalReopen.addEventListener("click", () => {
    if (!storeUrl) return;
    if (storePopup && !storePopup.closed) storePopup.focus();
    else {
      storePopup = launchStorePopup(storeUrl);
      if (storePopup) watchStorePopup();
    }
  });
  document.getElementById("smodalClose").addEventListener("click", closeStore);
  smodal.addEventListener("click", (e) => { if (e.target === smodal) closeStore(); });

  // Panel lateral de funcionalidades (página 6)
  const featSlide = document.getElementById("slideFeatures");
  const featSide = document.getElementById("featSide");
  const featSideBackdrop = document.getElementById("featSideBackdrop");
  const featSideFrame = document.getElementById("featSideFrame");
  const featSideImg = document.getElementById("featSideImg");
  const featQuad = document.getElementById("featQuad");
  const sideCards = Array.from(document.querySelectorAll(".qcard--side"));
  const FEAT_SIDE_MS = 520;
  let featSideTimer = null;
  const FEAT_ZOOM = 1.5;
  let featPan = { x: 0, y: 0 };
  let featDrag = null;

  function applyFeatPan() {
    featSideFrame.style.setProperty("--feat-pan-x", featPan.x + "px");
    featSideFrame.style.setProperty("--feat-pan-y", featPan.y + "px");
  }
  function clampFeatPan(x, y) {
    const frameW = featSideFrame.clientWidth;
    const frameH = featSideFrame.clientHeight;
    const baseW = featSideImg.offsetWidth;
    const baseH = featSideImg.offsetHeight;
    const maxX = Math.max(0, (baseW * FEAT_ZOOM - frameW) / 2);
    const maxY = Math.max(0, (baseH * FEAT_ZOOM - frameH) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }
  function resetFeatSideZoom() {
    featPan = { x: 0, y: 0 };
    applyFeatPan();
    featDrag = null;
    featSideFrame.classList.remove("is-zoomed", "is-panning");
    featSideFrame.setAttribute("tabindex", "-1");
    featSideFrame.setAttribute("aria-label", "Ampliar vista");
  }
  function setFeatSideZoom(on) {
    if (on) {
      featPan = clampFeatPan(0, 0);
      applyFeatPan();
      featSideFrame.classList.add("is-zoomed");
      featSideFrame.setAttribute("aria-label", "Arrastrá para mover · click para reducir");
    } else {
      resetFeatSideZoom();
    }
  }
  function toggleFeatSideZoom() {
    setFeatSideZoom(!featSideFrame.classList.contains("is-zoomed"));
  }
  function positionFeatSide(card) {
    const cards = featQuad.querySelectorAll(".qcard");
    const onRight = card.dataset.sidePos === "right";
    const topRow = cards[0];
    const bottomRow = cards[2];
    const midY = (topRow.offsetTop + bottomRow.offsetTop + bottomRow.offsetHeight) / 2;
    featSlide.classList.remove("has-feat-side--left", "has-feat-side--right");
    featSlide.classList.add(onRight ? "has-feat-side--right" : "has-feat-side--left");
    featSide.style.setProperty("--feat-side-top", midY + "px");
  }
  function closeFeatSide(clearImage = true, onClosed) {
    clearTimeout(featSideTimer);
    resetFeatSideZoom();
    featSlide.classList.remove("has-feat-side");
    featSide.setAttribute("aria-hidden", "true");
    featSideBackdrop.setAttribute("aria-hidden", "true");
    featSideFrame.setAttribute("tabindex", "-1");
    sideCards.forEach((c) => { c.classList.remove("is-active"); c.setAttribute("aria-expanded", "false"); });
    featSideTimer = setTimeout(() => {
      if (!featSlide.classList.contains("has-feat-side")) {
        featSlide.classList.remove("has-feat-side--left", "has-feat-side--right");
        if (clearImage) {
          featSideImg.removeAttribute("src");
          featSideImg.alt = "";
        }
      }
      onClosed?.();
    }, FEAT_SIDE_MS);
  }
  function switchFeatSide(card) {
    clearTimeout(featSideTimer);
    const active = sideCards.find((c) => c.classList.contains("is-active"));
    if (active === card) {
      closeFeatSide();
      return;
    }
    if (featSlide.classList.contains("has-feat-side")) {
      closeFeatSide(false, () => openFeatSide(card));
    } else {
      openFeatSide(card);
    }
  }
  function openFeatSide(card) {
    const src = card.dataset.side;
    const title = card.dataset.sideTitle || "";
    resetFeatSideZoom();
    positionFeatSide(card);
    featSideImg.src = src;
    featSideImg.alt = title;
    featSide.setAttribute("aria-hidden", "false");
    featSideBackdrop.setAttribute("aria-hidden", "false");
    featSideFrame.setAttribute("tabindex", "0");
    sideCards.forEach((c) => {
      const on = c === card;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-expanded", String(on));
    });
    if (!featSlide.classList.contains("has-feat-side")) {
      requestAnimationFrame(() => featSlide.classList.add("has-feat-side"));
    } else {
      featSlide.classList.add("has-feat-side");
    }
    requestAnimationFrame(() => positionFeatSide(card));
    featSideImg.onload = () => {
      positionFeatSide(card);
      if (featSideFrame.classList.contains("is-zoomed")) {
        featPan = clampFeatPan(featPan.x, featPan.y);
        applyFeatPan();
      }
    };
  }
  sideCards.forEach((card) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      switchFeatSide(card);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        switchFeatSide(card);
      }
    });
  });
  document.getElementById("featSideClose").addEventListener("click", (e) => { e.stopPropagation(); closeFeatSide(); });
  featSideBackdrop.addEventListener("click", (e) => { e.stopPropagation(); closeFeatSide(); });
  featSideFrame.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    featDrag = {
      startX: e.clientX,
      startY: e.clientY,
      panX: featPan.x,
      panY: featPan.y,
      moved: false,
      zoomed: featSideFrame.classList.contains("is-zoomed"),
    };
    if (featDrag.zoomed) {
      featSideFrame.classList.add("is-panning");
      featSideFrame.setPointerCapture(e.pointerId);
    }
  });
  featSideFrame.addEventListener("pointermove", (e) => {
    if (!featDrag || !featDrag.zoomed) return;
    const dx = e.clientX - featDrag.startX;
    const dy = e.clientY - featDrag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) featDrag.moved = true;
    featPan = clampFeatPan(featDrag.panX + dx, featDrag.panY + dy);
    applyFeatPan();
  });
  function endFeatSideDrag(e) {
    if (!featDrag) return;
    featSideFrame.classList.remove("is-panning");
    if (e?.pointerId !== undefined) featSideFrame.releasePointerCapture?.(e.pointerId);
    const drag = featDrag;
    featDrag = null;
    return drag;
  }
  featSideFrame.addEventListener("pointerup", (e) => {
    e.stopPropagation();
    const drag = endFeatSideDrag(e);
    if (!drag) return;
    if (!drag.zoomed) setFeatSideZoom(true);
    else if (!drag.moved) setFeatSideZoom(false);
  });
  featSideFrame.addEventListener("pointercancel", (e) => { endFeatSideDrag(e); });
  featSideFrame.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      toggleFeatSideZoom();
    }
  });
  window.addEventListener("resize", () => {
    if (!featSideFrame?.classList.contains("is-zoomed")) return;
    featPan = clampFeatPan(featPan.x, featPan.y);
    applyFeatPan();
  });

  // Marcador: dibujar a mano alzada; cada trazo dura 3s y se desvanece
  const SVGNS = "http://www.w3.org/2000/svg";
  const markerLayer = document.createElementNS(SVGNS, "svg");
  markerLayer.setAttribute("class", "marker-layer");
  document.body.appendChild(markerLayer);
  function sizeMarker() {
    markerLayer.setAttribute("viewBox", "0 0 " + window.innerWidth + " " + window.innerHeight);
  }
  sizeMarker();
  window.addEventListener("resize", sizeMarker);

  let markerOn = false;
  let drawing = false, curLine = null, pts = [];
  const markerBtn = document.getElementById("markerBtn");
  const ptsStr = (arr) => arr.map((p) => p[0] + "," + p[1]).join(" ");

  function setMarker(on) {
    markerOn = on;
    document.body.classList.toggle("marker-on", on);
    if (markerBtn) {
      markerBtn.classList.toggle("is-active", on);
      markerBtn.setAttribute("aria-pressed", String(on));
    }
    const presenterMarker = document.getElementById("presenterMarker");
    if (presenterMarker) {
      presenterMarker.classList.toggle("is-active", on);
      presenterMarker.setAttribute("aria-pressed", String(on));
    }
    if (!on && curLine) endStroke();
    document.dispatchEvent(new CustomEvent("puntook:marker", { detail: { on } }));
  }
  function toggleMarker() { setMarker(!markerOn); }
  function isMarkerOn() { return markerOn; }
  if (markerBtn) markerBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleMarker(); });

  function startStroke(x, y) {
    if (!markerOn) return;
    drawing = true;
    pts = [[x, y], [x, y]]; // punto doble -> un click deja un punto visible
    curLine = document.createElementNS(SVGNS, "polyline");
    curLine.setAttribute("class", "marker-stroke");
    curLine.setAttribute("points", ptsStr(pts));
    markerLayer.appendChild(curLine);
  }
  function extendStroke(x, y) {
    if (!drawing || !curLine) return;
    pts.push([x, y]);
    curLine.setAttribute("points", ptsStr(pts));
  }
  function endStroke() {
    if (!curLine) return;
    const line = curLine;
    curLine = null; drawing = false;
    setTimeout(() => line.remove(), 3100); // se elimina tras desvanecerse
  }
  window.addEventListener("pointerdown", (e) => {
    if (!markerOn) return;
    if (e.target.closest("button, a, .app-play, .vmodal, .smodal, .overview, .feat-side, .feat-side-backdrop, .qcard--side, input, .iconbtn, .arrow, .topbar, .presenter-shell")) return;
    startStroke(e.clientX, e.clientY);
  });
  window.addEventListener("pointermove", (e) => extendStroke(e.clientX, e.clientY));
  window.addEventListener("pointerup", endStroke);
  window.addEventListener("pointercancel", endStroke);

  // Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  document.getElementById("fsBtn").addEventListener("click", toggleFullscreen);

  // Keep transform correct on resize (vw based, so just re-render)
  window.addEventListener("resize", () => {
    render();
    updateImpactLinks();
    updateEcoLinks();
  });

  function resetImpactLink() {
    if (!impactSlide) return;
    impactSlide.classList.remove("is-impact-linked");
    impactCards.forEach((c) => {
      c.classList.remove("is-impact-active");
      c.setAttribute("aria-pressed", "false");
    });
    if (impactLinkPath) impactLinkPath.setAttribute("d", "");
  }

  function cardLinkPoint(card) {
    const wrapRect = impactWrap.getBoundingClientRect();
    const r = card.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - wrapRect.left,
      y: r.top + r.height * 0.38 - wrapRect.top,
    };
  }

  function updateImpactLinks() {
    if (!impactSlide?.classList.contains("is-impact-linked") || !impactLinkPath || impactCards.length < 3) return;
    const pts = impactCards.map(cardLinkPoint);
    const d =
      "M " + pts[0].x + " " + pts[0].y +
      " L " + pts[1].x + " " + pts[1].y +
      " L " + pts[2].x + " " + pts[2].y +
      " Z";
    impactLinkPath.setAttribute("d", d);
  }

  function linkImpact(fromCard) {
    if (!impactSlide) return;
    impactSlide.classList.add("is-impact-linked");
    impactCards.forEach((c) => {
      const on = c === fromCard;
      c.classList.toggle("is-impact-active", on);
      c.setAttribute("aria-pressed", String(on));
    });
    requestAnimationFrame(updateImpactLinks);
  }

  impactCards.forEach((card) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      if (impactSlide.classList.contains("is-impact-linked")) {
        resetImpactLink();
        return;
      }
      linkImpact(card);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
  });

  const DEMO_URL = "https://www.alpha.puntook.com.py/empresa-v2";

  function replayCurrentAnimation() {
    const slide = slides[current];
    if (!slide) return;
    if (slide === heroSlide) heroSlide.classList.remove("hero-intro-complete");
    const anims = Array.from(slide.querySelectorAll(".anim"));
    anims.forEach((el) => {
      el.style.transition = "none";
      el.style.opacity = "0";
      el.style.transform = "translateY(34px)";
    });
    void slide.offsetWidth;
    requestAnimationFrame(() => {
      anims.forEach((el) => {
        el.style.transition = "";
        el.style.opacity = "";
        el.style.transform = "";
      });
      render();
    });
    if (slide === implSlide) playImplTimeline();
    if (slide === traceSlide) playTraceSlide();
  }

  function togglePresentationVideos() {
    const slide = slides[current];
    let anyPlaying = false;
    slide?.querySelectorAll("video").forEach((video) => {
      if (!video.paused && !video.ended) anyPlaying = true;
    });
    if (supportBgVideo && slide === supportSlide && !supportBgVideo.paused) anyPlaying = true;
    const vmodalOpen = vmodal?.classList.contains("is-open");
    if (vmodalOpen && vmodalVideo && !vmodalVideo.paused) anyPlaying = true;

    const shouldPause = anyPlaying;
    slide?.querySelectorAll("video").forEach((video) => {
      if (shouldPause) video.pause();
      else video.play().catch(() => {});
    });
    if (supportBgVideo && slide === supportSlide) {
      if (shouldPause) supportBgVideo.pause();
      else syncSupportBgVideo();
    }
    if (vmodalOpen && vmodalVideo) {
      if (shouldPause) vmodalVideo.pause();
      else vmodalVideo.play().catch(() => {});
    }
    return { playing: !shouldPause };
  }

  function resetPresentation() {
    if (typeof setMarker === "function") setMarker(false);
    if (typeof closeOverview === "function") closeOverview();
    if (typeof closeVideoModal === "function") closeVideoModal();
    if (typeof closeAllMarkSides === "function") closeAllMarkSides(true, true);
    if (typeof closeFeatSide === "function") closeFeatSide(true, true);
    if (typeof resetImpactLink === "function") resetImpactLink();
    if (typeof resetEcoSlide === "function") resetEcoSlide();
    if (heroSlide) heroSlide.classList.remove("hero-intro-complete");
    heroIntroSeen = false;
    goTo(0, { force: true });
  }

  function openDemo() {
    window.open(DEMO_URL, "_blank", "noopener,noreferrer");
  }

  function onSlideChange(fn) {
    if (typeof fn !== "function") return () => {};
    slideChangeListeners.add(fn);
    return () => slideChangeListeners.delete(fn);
  }

  window.PuntoOkDeck = {
    goTo: (index, options) => goTo(index, options),
    next,
    prev,
    first: () => goTo(0),
    last: () => goTo(total - 1),
    getCurrent: () => current,
    getTotal: () => total,
    getSlide: (index) => getSlideState(index),
    getSlides: () => slides.map((s, i) => ({
      index: i,
      page: i + 1,
      title: s.dataset.title || "",
      id: s.id || null,
    })),
    getState: () => getSlideState(),
    onSlideChange,
    replayAnimation: replayCurrentAnimation,
    toggleVideos: togglePresentationVideos,
    reset: resetPresentation,
    openDemo,
    toggleMarker,
    isMarkerOn,
    playMarkVideo,
    getMarkVideoState,
    isMeetStage: () => isMeetStage,
  };

  // Efectos premium: parallax, tilt 3D, botones magnéticos y glow ambiental
  (function initPremiumMotion() {
    if (isMeetStage) return;

    const cursorGlow = document.getElementById("cursorGlow");
    const heroStack = document.querySelector(".hero-device-stack");
    const heroGlowEnter = document.querySelector(".hero-glow--enter");
    const chaosWrap = document.getElementById("chaosWrap");
    const chaosPieces = chaosWrap ? Array.from(chaosWrap.querySelectorAll(".chaos-piece")) : [];
    const dispersaSlide = document.getElementById("slideDispersa");
    const tiltCards = Array.from(document.querySelectorAll(".tile, .qcard, .ccard, .impact-card"));
    const magneticEls = Array.from(document.querySelectorAll(
      ".iconbtn, .arrow, .marker-dock, .app-play, .brand, .dot, #presenterOpenBtn"
    ));

    tiltCards.forEach((el) => el.classList.add("tilt-card"));
    magneticEls.forEach((el) => el.classList.add("magnetic"));

    let glowX = window.innerWidth / 2;
    let glowY = window.innerHeight / 2;
    let targetX = glowX;
    let targetY = glowY;
    const TILT_MAX = 4;
    const MAG_RADIUS = 72;
    const MAG_MAX = 4;
    const CHAOS_MAG_RADIUS = 200;
    const CHAOS_MAG_MAX = 42;

    function resetChaosMagnetic() {
      chaosPieces.forEach((piece) => {
        const img = piece.querySelector(".chaos-piece__img");
        img?.style.setProperty("--chaos-mag-x", "0px");
        img?.style.setProperty("--chaos-mag-y", "0px");
      });
    }

    function updateChaosMagnetic(e) {
      if (!motionOk() || !dispersaSlide?.classList.contains("is-active")) {
        resetChaosMagnetic();
        return;
      }
      chaosPieces.forEach((piece) => {
        const img = piece.querySelector(".chaos-piece__img");
        if (!img) return;
        const r = piece.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > CHAOS_MAG_RADIUS || dist < 0.001) {
          img.style.setProperty("--chaos-mag-x", "0px");
          img.style.setProperty("--chaos-mag-y", "0px");
          return;
        }
        const pull = (1 - dist / CHAOS_MAG_RADIUS) * CHAOS_MAG_MAX;
        img.style.setProperty("--chaos-mag-x", ((-dx / dist) * pull).toFixed(2) + "px");
        img.style.setProperty("--chaos-mag-y", ((-dy / dist) * pull).toFixed(2) + "px");
      });
    }

    if (chaosWrap) {
      chaosWrap.addEventListener("pointermove", updateChaosMagnetic, { passive: true });
      chaosWrap.addEventListener("pointerleave", resetChaosMagnetic);
    }
    window.resetChaosMagnetic = resetChaosMagnetic;

    document.addEventListener("pointermove", (e) => {
      if (!motionOk()) return;
      targetX = e.clientX;
      targetY = e.clientY;

      if (heroStack && heroSlide?.classList.contains("is-active") && heroSlide.classList.contains("hero-intro-complete")) {
        const r = heroStack.getBoundingClientRect();
        if (r.width > 0) {
          const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
          const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
          heroStack.style.setProperty("--hero-nx", nx.toFixed(3));
          heroStack.style.setProperty("--hero-ny", ny.toFixed(3));
          if (heroGlowEnter) {
            heroGlowEnter.style.setProperty("--hero-nx", nx.toFixed(3));
            heroGlowEnter.style.setProperty("--hero-ny", ny.toFixed(3));
          }
        }
      }

      magneticEls.forEach((btn) => {
        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > MAG_RADIUS || dist < 0.001) {
          btn.style.setProperty("--mag-x", "0px");
          btn.style.setProperty("--mag-y", "0px");
          return;
        }
        const pull = (1 - dist / MAG_RADIUS) * MAG_MAX;
        btn.style.setProperty("--mag-x", ((dx / dist) * pull).toFixed(2) + "px");
        btn.style.setProperty("--mag-y", ((dy / dist) * pull).toFixed(2) + "px");
      });
    }, { passive: true });

    tiltCards.forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        if (!motionOk()) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--tilt-y", (px * TILT_MAX).toFixed(2) + "deg");
        el.style.setProperty("--tilt-x", (-py * TILT_MAX).toFixed(2) + "deg");
      });
      el.addEventListener("pointerleave", () => {
        el.style.setProperty("--tilt-x", "0deg");
        el.style.setProperty("--tilt-y", "0deg");
      });
    });

    function tickGlow() {
      if (motionOk() && cursorGlow) {
        glowX += (targetX - glowX) * 0.055;
        glowY += (targetY - glowY) * 0.055;
        cursorGlow.style.setProperty("--glow-x", glowX.toFixed(1) + "px");
        cursorGlow.style.setProperty("--glow-y", glowY.toFixed(1) + "px");
      }
      requestAnimationFrame(tickGlow);
    }
    tickGlow();
  })();

  // Posicionamiento inicial sin animación (para restaurar la diapositiva guardada)
  const prevTransition = deck.style.transition;
  deck.style.transition = "none";
  render();
  if (deckConfig.persist) persistSlideIndex();
  emitSlideChange();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { deck.style.transition = prevTransition; });
  });
})();
