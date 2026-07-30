/**
 * Escenario principal de Google Meet — carga la presentación y sincroniza con el panel lateral.
 */
(function (global) {
  const cfg = () => global.MeetConfig;
  const controls = () => global.PuntoOkMeetControls;

  async function waitForDeck(frameWindow, timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 15000);
    while (Date.now() < deadline) {
      if (frameWindow?.PuntoOkDeck) return frameWindow.PuntoOkDeck;
      await new Promise((r) => setTimeout(r, 60));
    }
    return null;
  }

  async function initMainStage() {
    const frame = document.getElementById("presentation-frame");
    if (!frame) throw new Error("No se encontró #presentation-frame");

    let handleCommand = async () => {};
    const bridge = controls().createBridge("main", {
      onMessage(msg) {
        handleCommand(msg);
      },
    });

    frame.src = cfg().urls.presentation;

    const hasMeet = await bridge.initMeetClient((session) => session.createMainStageClient());
    if (!hasMeet) {
      bridge.initBroadcastChannel();
      console.info("[PuntoOk Meet] Modo prueba: BroadcastChannel activo.");
    }

    frame.addEventListener("load", async () => {
      const deck = await waitForDeck(frame.contentWindow);
      if (!deck) {
        console.error("[PuntoOk Meet] PuntoOkDeck no disponible en el iframe.");
        return;
      }

      deck.onSlideChange((state) => {
        bridge.publishState(state);
      });

      global.addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow) return;
        const data = event.data;
        if (!data || data.source !== "puntook-deck" || data.type !== "state") return;
        bridge.publishState(data.state);
      });

      bridge.publishState(deck.getState());
      bridge.send(bridge.createMessage("event", { event: "activityReady" }));
    });

    async function handleCommandImpl(msg) {
      if (msg.type !== "command") return;
      const deck = frame.contentWindow?.PuntoOkDeck;
      if (!deck) {
        await bridge.send(bridge.createMessage("event", { event: "error", data: { message: "Presentación no cargada" } }));
        return;
      }

      if (msg.command === "requestState") {
        await bridge.publishState(deck.getState());
        return;
      }

      const result = controls().dispatchDeckCommand(deck, msg.command, msg.data || {});
      if (msg.command === "toggleVideo") {
        await bridge.send(bridge.createMessage("event", { event: "video", data: result }));
      }
      if (msg.command === "requestState" || msg.command === "goTo" || msg.command === "next" || msg.command === "prev" || msg.command === "first" || msg.command === "last" || msg.command === "reset" || msg.command === "replayAnimation") {
        await bridge.publishState(deck.getState());
      }
    }

    handleCommand = handleCommandImpl;

    return bridge;
  }

  global.PuntoOkMeetMain = { initMainStage };
})(typeof window !== "undefined" ? window : globalThis);
