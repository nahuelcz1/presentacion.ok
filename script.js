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
    if (testimonialsSlide && slides[current] !== testimonialsSlide) {
      testimonialsTrio?.closest(".testimonials-marquee")?.removeAttribute("data-marquee-primed");
    }
    if (typeof window.syncTestimonialsCarousel === "function") {
      window.syncTestimonialsCarousel();
    }
    syncSupportBgVideo();
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

  // Wheel navigation (debounced)
  let wheelLock = false;
  deck.addEventListener("wheel", (e) => {
    if (overview.classList.contains("is-open")) return;
    if (Math.abs(e.deltaY) < 24 && Math.abs(e.deltaX) < 24) return;
    if (wheelLock) return;
    wheelLock = true;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    delta > 0 ? next() : prev();
    setTimeout(() => (wheelLock = false), 700);
  }, { passive: true });

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
    if (touchTarget?.closest?.(".logos-viewport") || touchTarget?.closest?.(".testimonials-track")) return;
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

  const testimonialsSlide = document.getElementById("slideTestimonials");
  const testimonialsTrio = document.getElementById("testimonialsTrio");
  const testimonialsTrack = document.getElementById("testimonialsTrack");
  const testimonialsShell = document.getElementById("testimonialsShell");

  if (testimonialsTrack && testimonialsShell && testimonialsTrio) {
    let testimonialMarquee = testimonialsTrio.closest(".testimonials-marquee");

    if (!testimonialMarquee) {
      testimonialMarquee = document.createElement("div");
      testimonialMarquee.className = "testimonials-marquee";
      testimonialsTrack.insertBefore(testimonialMarquee, testimonialsTrio);
      testimonialMarquee.appendChild(testimonialsTrio);
    }

    function appendTestimonialClone() {
      const clone = testimonialsTrio.cloneNode(true);
      clone.removeAttribute("id");
      clone.classList.add("testimonials-row--clone");
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll(".quote--testimonial").forEach((q) => {
        q.removeAttribute("tabindex");
        q.removeAttribute("role");
        q.removeAttribute("aria-expanded");
      });
      testimonialMarquee.appendChild(clone);
    }

    function ensureTestimonialClones() {
      const clones = testimonialMarquee.querySelectorAll(".testimonials-row--clone");
      if (clones.length >= 2) return;
      if (clones.length === 0) appendTestimonialClone();
      if (testimonialMarquee.querySelectorAll(".testimonials-row--clone").length < 2) {
        appendTestimonialClone();
      }
    }

    ensureTestimonialClones();

    function testimonialMotionOk() {
      return motionOk();
    }

    function syncTestimonialMarquee() {
      ensureTestimonialClones();
      const loop = testimonialsTrio.offsetWidth + 22;
      testimonialMarquee.style.setProperty("--testimonial-loop", loop + "px");
      const pxPerSec = 28;
      const durationSec = Math.max(75, Math.round(loop / pxPerSec));
      testimonialMarquee.style.setProperty("--testimonial-duration", durationSec + "s");

      const overflow = loop > 0 && testimonialMarquee.offsetWidth > testimonialsTrack.clientWidth + 4;
      testimonialsShell.classList.toggle("has-overflow", overflow);
      testimonialsShell.classList.toggle("is-centered", !overflow);
      const runMarquee =
        overflow &&
        testimonialMotionOk() &&
        testimonialsSlide.classList.contains("is-active");
      testimonialsShell.classList.toggle("is-marquee-active", runMarquee);

      if (runMarquee && !testimonialMarquee.dataset.marqueePrimed) {
        const startAt = durationSec * 0.42;
        testimonialMarquee.style.animationDelay = `-${startAt}s`;
        testimonialMarquee.dataset.marqueePrimed = "1";
      }
      if (!runMarquee) {
        testimonialMarquee.style.animationDelay = "";
        testimonialMarquee.removeAttribute("data-marquee-primed");
      }
    }

    window.syncTestimonialsCarousel = syncTestimonialMarquee;

    window.addEventListener("resize", syncTestimonialMarquee);
    syncTestimonialMarquee();
  }

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
    if (slide.id === "slideTestimonials") {
      document.querySelector(".testimonials-marquee")?.removeAttribute("data-marquee-primed");
      if (typeof window.syncTestimonialsCarousel === "function") window.syncTestimonialsCarousel();
    }
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
