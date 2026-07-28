(function () {
  const deck = document.getElementById("deck");
  const slides = Array.from(deck.querySelectorAll(".slide"));
  const total = slides.length;
  let current = 0;

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const dotsWrap = document.getElementById("dots");
  const counter = document.getElementById("counter");
  const progressBar = document.getElementById("progressBar");
  const overview = document.getElementById("overview");
  const overviewGrid = document.getElementById("overviewGrid");
  const markSlide = document.getElementById("slideMark");
  const supportSlide = document.getElementById("slideSupport");
  const supportBgVideo = document.getElementById("supportBgVideo");

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

  function render(options) {
    deck.style.transform = "translateX(" + -current * 100 + "vw)";
    slides.forEach((s, i) => s.classList.toggle("is-active", i === current));
    dots.forEach((d, i) => d.classList.toggle("is-active", i === current));
    thumbs.forEach((t, i) => t.classList.toggle("is-current", i === current));
    counter.textContent = current + 1 + " / " + total;
    progressBar.style.width = ((current + 1) / total) * 100 + "%";
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === total - 1;
    document.body.classList.toggle("on-dark", slides[current].classList.contains("slide--dark"));
    if (typeof closeFeatSide === "function" && featSlide && slides[current] !== featSlide && featSlide.classList.contains("has-feat-side")) {
      closeFeatSide();
    }
    if (typeof closeAllMarkSides === "function" && markSlide && slides[current] !== markSlide && markSlide.classList.contains("has-mark-side")) {
      closeAllMarkSides(true, true);
    }
    syncSupportBgVideo();
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

  function goTo(i) {
    current = Math.max(0, Math.min(total - 1, i));
    render();
  }
  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

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

  // Logo strip: scroll con m?scara de borde (sin overlays)
  document.querySelectorAll(".clients").forEach((clients) => {
    const shell = clients.querySelector(".logos-shell");
    const viewport = clients.querySelector(".logos-viewport");
    if (!shell || !viewport) return;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;

    const updateFades = () => {
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      shell.classList.toggle("can-scroll-left", viewport.scrollLeft > 6);
      shell.classList.toggle("can-scroll-right", maxScroll > 6 && viewport.scrollLeft < maxScroll - 6);
    };

    const endDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      viewport.classList.remove("is-dragging");
      if (viewport.hasPointerCapture?.(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
      updateFades();
      e.stopPropagation();
    };

    viewport.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartScroll = viewport.scrollLeft;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });

    viewport.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      viewport.scrollLeft = dragStartScroll - (e.clientX - dragStartX);
      updateFades();
      e.stopPropagation();
    });

    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    viewport.addEventListener("wheel", (e) => {
      if (isDragging) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 2) return;
      e.stopPropagation();
      e.preventDefault();
      viewport.scrollLeft += delta;
      updateFades();
    }, { passive: false });

    viewport.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);
    updateFades();
  });

  // Touch swipe
  let tx = 0, ty = 0, touchTarget = null;
  deck.addEventListener("touchstart", (e) => {
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
    touchTarget = e.target;
  }, { passive: true });
  deck.addEventListener("touchend", (e) => {
    if (touchTarget?.closest?.(".logos-viewport")) return;
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

  // Acordeón expandible (página 4 — varias tarjetas abiertas a la vez)
  const expandTiles = Array.from(document.querySelectorAll(".tile--expand"));
  function closeTile(t) { t.classList.remove("is-open"); t.setAttribute("aria-expanded", "false"); }
  function updateExpandSlideState(slide) {
    if (!slide) return;
    const anyOpen = expandTiles.some((t) => slide.contains(t) && t.classList.contains("is-open"));
    slide.classList.toggle("has-open", anyOpen);
  }
  function toggleTile(tile) {
    const slide = tile.closest(".slide");
    const willOpen = !tile.classList.contains("is-open");
    if (willOpen) {
      tile.classList.add("is-open");
      tile.setAttribute("aria-expanded", "true");
    } else {
      closeTile(tile);
    }
    updateExpandSlideState(slide);
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

  // Panel lateral de funcionalidades (p?gina 6)
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
      featSideFrame.setAttribute("aria-label", "Arrastr? para mover ? click para reducir");
    } else {
      resetFeatSideZoom();
      return;
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
    if (!featSideFrame.classList.contains("is-zoomed")) return;
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
    markerBtn.classList.toggle("is-active", on);
    markerBtn.setAttribute("aria-pressed", String(on));
    if (!on && curLine) endStroke();
  }
  function toggleMarker() { setMarker(!markerOn); }
  markerBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleMarker(); });

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
    if (e.target.closest("button, a, .app-play, .vmodal, .smodal, .overview, .feat-side, .feat-side-backdrop, .mark-side-backdrop, .mark-side, .qcard--side, input, video")) return;
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
  window.addEventListener("resize", () => render());

  // Posicionamiento inicial sin animaci?n (para restaurar la diapositiva guardada)
  const prevTransition = deck.style.transition;
  deck.style.transition = "none";
  render();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { deck.style.transition = prevTransition; });
  });
})();
