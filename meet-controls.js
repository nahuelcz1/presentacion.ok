/**
 * Transporte y protocolo compartido entre escenario principal y panel lateral.
 * Usa notifyMainStage / notifySidePanel en Meet, o BroadcastChannel en modo prueba.
 */
(function (global) {
  const cfg = () => global.MeetConfig;

  function parseMeetMessage(raw) {
    if (raw == null) return null;
    let data = raw;
    if (typeof raw === "string") {
      try { data = JSON.parse(raw); } catch { return null; }
    }
    if (!data || typeof data !== "object" || data.v !== cfg().messageVersion) return null;
    return data;
  }

  function createMessage(type, payload) {
    return { v: cfg().messageVersion, type, ts: Date.now(), ...payload };
  }

  function createBridge(role, handlers) {
    const state = {
      role,
      meetClient: null,
      channel: null,
    };

    async function initMeetClient(createClientFn) {
      if (!global.meet?.addon?.createAddonSession) return false;
      try {
        const session = await global.meet.addon.createAddonSession({
          cloudProjectNumber: String(cfg().cloudProjectNumber),
        });
        state.meetClient = await createClientFn(session);
        state.meetClient.on("frameToFrameMessage", (arg) => {
          const msg = parseMeetMessage(arg?.message ?? arg?.payload ?? arg);
          if (msg) handlers.onMessage?.(msg);
        });
        return true;
      } catch (err) {
        console.warn("[PuntoOk Meet] SDK no disponible:", err);
        return false;
      }
    }

    function initBroadcastChannel() {
      if (!("BroadcastChannel" in global)) return false;
      state.channel = new BroadcastChannel(cfg().broadcastChannelName);
      state.channel.onmessage = (event) => {
        const msg = parseMeetMessage(event.data);
        if (msg) handlers.onMessage?.(msg);
      };
      return true;
    }

    async function send(message) {
      const payload = JSON.stringify(message);
      if (state.meetClient) {
        if (state.role === "main" && state.meetClient.notifySidePanel) {
          await state.meetClient.notifySidePanel(payload);
          return true;
        }
        if (state.role === "side" && state.meetClient.notifyMainStage) {
          await state.meetClient.notifyMainStage(payload);
          return true;
        }
      }
      if (state.channel) {
        state.channel.postMessage(message);
        return true;
      }
      return false;
    }

    return {
      state,
      createMessage,
      initMeetClient,
      initBroadcastChannel,
      send,
      requestState() {
        return send(createMessage("command", { command: "requestState" }));
      },
      publishState(deckState) {
        return send(createMessage("state", { state: deckState }));
      },
      sendCommand(command, data) {
        return send(createMessage("command", { command, data: data || {} }));
      },
    };
  }

  function dispatchDeckCommand(deck, command, data) {
    if (!deck) return null;
    switch (command) {
      case "goTo":
        if (data?.index != null) deck.goTo(Number(data.index), { persist: false });
        else if (data?.page != null) deck.goTo(Number(data.page) - 1, { persist: false });
        break;
      case "next": deck.next(); break;
      case "prev": deck.prev(); break;
      case "first": deck.first(); break;
      case "last": deck.last(); break;
      case "reset": deck.reset(); break;
      case "replayAnimation": deck.replayAnimation(); break;
      case "toggleVideo": return deck.toggleVideos();
      case "openDemo": deck.openDemo(); break;
      case "requestState":
      default:
        break;
    }
    return deck.getState();
  }

  function createSidePanelController(bridge) {
    const els = {
      status: document.getElementById("meetStatus"),
      pageLabel: document.getElementById("meetPageLabel"),
      titleLabel: document.getElementById("meetTitleLabel"),
      slideSelect: document.getElementById("meetSlideSelect"),
      btnStart: document.getElementById("meetStartActivity"),
      btnPrev: document.getElementById("meetPrev"),
      btnNext: document.getElementById("meetNext"),
      btnFirst: document.getElementById("meetFirst"),
      btnLast: document.getElementById("meetLast"),
      btnReset: document.getElementById("meetReset"),
      btnReplay: document.getElementById("meetReplay"),
      btnVideo: document.getElementById("meetToggleVideo"),
      btnDemo: document.getElementById("meetOpenDemo"),
    };

    let sidePanelClient = null;

    function setStatus(text, kind) {
      if (!els.status) return;
      els.status.textContent = text;
      els.status.dataset.kind = kind || "info";
    }

    function renderState(state) {
      if (!state) return;
      if (els.pageLabel) els.pageLabel.textContent = String(state.page);
      if (els.titleLabel) els.titleLabel.textContent = state.title || "—";
      if (els.slideSelect) els.slideSelect.value = String(state.page);
      if (els.btnPrev) els.btnPrev.disabled = state.page <= 1;
      if (els.btnNext) els.btnNext.disabled = state.page >= state.total;
    }

    function initSlideOptions(total) {
      if (!els.slideSelect || !total) return;
      els.slideSelect.innerHTML = "";
      for (let page = 1; page <= total; page += 1) {
        const opt = document.createElement("option");
        opt.value = String(page);
        opt.textContent = "Página " + page;
        els.slideSelect.appendChild(opt);
      }
    }

    function wireCommand(button, command, data) {
      button?.addEventListener("click", () => bridge.sendCommand(command, data));
    }

    wireCommand(els.btnPrev, "prev");
    wireCommand(els.btnNext, "next");
    wireCommand(els.btnFirst, "first");
    wireCommand(els.btnLast, "last");
    wireCommand(els.btnReset, "reset");
    wireCommand(els.btnReplay, "replayAnimation");
    wireCommand(els.btnVideo, "toggleVideo");
    wireCommand(els.btnDemo, "openDemo");

    els.slideSelect?.addEventListener("change", () => {
      const page = parseInt(els.slideSelect.value, 10);
      if (Number.isFinite(page)) bridge.sendCommand("goTo", { page });
    });

    els.btnStart?.addEventListener("click", async () => {
      if (!sidePanelClient?.startActivity) {
        setStatus("En modo prueba la presentación ya está en main-stage.html.", "warn");
        return;
      }
      try {
        await sidePanelClient.startActivity({ mainStageUrl: cfg().urls.mainStage });
        setStatus("Presentación iniciada en el escenario.", "ok");
      } catch (err) {
        console.error(err);
        setStatus("No se pudo iniciar la actividad.", "error");
      }
    });

    return {
      setSidePanelClient(client) {
        sidePanelClient = client;
      },
      handleMessage(msg) {
        if (msg.type === "state" && msg.state) {
          renderState(msg.state);
          if (msg.state.total) initSlideOptions(msg.state.total);
          setStatus("Sincronizado con la presentación.", "ok");
          return;
        }
        if (msg.type === "event" && msg.event === "activityReady") {
          setStatus("Escenario principal listo.", "ok");
          bridge.requestState();
        }
        if (msg.type === "event" && msg.event === "video") {
          setStatus(msg.data?.playing ? "Videos en reproducción." : "Videos en pausa.", "info");
        }
      },
      async bootstrap() {
        initSlideOptions(11);
        const hasMeet = await bridge.initMeetClient((session) => session.createSidePanelClient());
        if (hasMeet) {
          this.setSidePanelClient(bridge.state.meetClient);
          setStatus("Conectado a Google Meet. Iniciá la actividad.", "ok");
        } else if (bridge.initBroadcastChannel()) {
          setStatus("Modo prueba: abrí meet/main-stage.html en otra pestaña.", "warn");
        } else {
          setStatus("Sin Meet SDK ni BroadcastChannel.", "error");
        }
        await bridge.requestState();
      },
    };
  }

  global.PuntoOkMeetControls = {
    parseMeetMessage,
    createMessage,
    createBridge,
    createSidePanelController,
    dispatchDeckCommand,
  };
})(typeof window !== "undefined" ? window : globalThis);
