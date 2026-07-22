(function () {
  const deck = document.getElementById("deck");
  const slides = Array.from(deck.querySelectorAll(".slide"));
  const total = slides.length;
  const STORAGE_KEY = "puntook_slide";
  let current = 0;
  const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
  if (!Number.isNaN(saved) && saved >= 0 && saved < total) current = saved;

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const dotsWrap = document.getElementById("dots");
  const counter = document.getElementById("counter");
  const progressBar = document.getElementById("progressBar");
  const overview = document.getElementById("overview");
  const overviewGrid = document.getElementById("overviewGrid");

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

  function render() {
    deck.style.transform = "translateX(" + -current * 100 + "vw)";
    slides.forEach((s, i) => s.classList.toggle("is-active", i === current));
    dots.forEach((d, i) => d.classList.toggle("is-active", i === current));
    thumbs.forEach((t, i) => t.classList.toggle("is-current", i === current));
    counter.textContent = current + 1 + " / " + total;
    progressBar.style.width = ((current + 1) / total) * 100 + "%";
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === total - 1;
    document.body.classList.toggle("on-dark", slides[current].classList.contains("slide--dark"));
  }

  function goTo(i) {
    current = Math.max(0, Math.min(total - 1, i));
    try { localStorage.setItem(STORAGE_KEY, String(current)); } catch (e) {}
    render();
  }
  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  // Keyboard
  document.addEventListener("keydown", (e) => {
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

  // Touch swipe
  let tx = 0, ty = 0;
  deck.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  deck.addEventListener("touchend", (e) => {
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

  // Acordeón expandible (tarjetas con dispositivo)
  const expandTiles = Array.from(document.querySelectorAll(".tile--expand"));
  let closeTimer = null;
  function closeTile(t) { t.classList.remove("is-open"); t.setAttribute("aria-expanded", "false"); }
  function toggleTile(tile) {
    const slide = tile.closest(".slide");
    const willOpen = !tile.classList.contains("is-open");
    clearTimeout(closeTimer);

    if (willOpen) {
      const others = expandTiles.filter((t) => t !== tile && t.classList.contains("is-open"));
      // Abrir la nueva de inmediato
      tile.classList.add("is-open");
      tile.setAttribute("aria-expanded", "true");
      if (slide) slide.classList.add("has-open");
      // Mantener la anterior abierta hasta que la nueva termine de expandirse (evita el "salto")
      if (others.length) {
        closeTimer = setTimeout(() => others.forEach(closeTile), 620);
      }
    } else {
      closeTile(tile);
      if (slide) slide.classList.remove("has-open");
    }
  }
  expandTiles.forEach((tile) => {
    tile.addEventListener("click", () => toggleTile(tile));
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleTile(tile); }
    });
  });

  // Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  document.getElementById("fsBtn").addEventListener("click", toggleFullscreen);

  // Keep transform correct on resize (vw based, so just re-render)
  window.addEventListener("resize", render);

  // Posicionamiento inicial sin animación (para restaurar la diapositiva guardada)
  const prevTransition = deck.style.transition;
  deck.style.transition = "none";
  render();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { deck.style.transition = prevTransition; });
  });
})();
