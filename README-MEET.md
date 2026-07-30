# Punto Ok · Complemento privado de Google Meet

Integración de la presentación HTML (11 diapositivas, animaciones, videos e interacciones) como **Google Meet Add-on** con:

- **Escenario principal:** la presentación visible para todos en la reunión.
- **Panel lateral:** control del presentador (solo visible para quien comparte).
- **Versión web standalone:** sigue funcionando en `/presentacion.ok/` sin cambios para el público general.

---

## Archivos del complemento

| Archivo | Rol |
|---------|-----|
| `meet/main-stage.html` | Entrada del escenario principal en Meet (iframe con la presentación). |
| `meet/side-panel.html` | Panel lateral del presentador. |
| `meet-main.js` | Lógica del escenario: SDK Meet, iframe, `notifySidePanel()`. |
| `meet-controls.js` | Protocolo de mensajes, `BroadcastChannel` y UI del panel. |
| `meet-config.js` | URLs, proyecto GCP y constantes (placeholders). |
| `deployment.json` | Manifiesto para el despliegue del add-on en Google Cloud. |

### Cambios en la presentación existente

| Archivo | Cambio |
|---------|--------|
| `script.js` | Expone `window.PuntoOkDeck` y modo `?meet=stage`. |
| `styles.css` | Oculta chrome (topbar, dots, flechas) en modo escenario Meet. |

---

## API expuesta (`window.PuntoOkDeck`)

Usada por el escenario principal para control remoto desde el panel:

```javascript
PuntoOkDeck.goTo(index, options?)
PuntoOkDeck.next()
PuntoOkDeck.prev()
PuntoOkDeck.first()
PuntoOkDeck.last()
PuntoOkDeck.getState()        // { index, page, title, total, hash }
PuntoOkDeck.onSlideChange(fn) // callback al cambiar slide (teclado incluido)
PuntoOkDeck.replayAnimation()
PuntoOkDeck.toggleVideos()
PuntoOkDeck.reset()
PuntoOkDeck.openDemo()
```

Cuando el presentador usa **← →**, **Inicio** o **Fin** en el escenario, se llama `notifySidePanel()` y el panel lateral se actualiza.

---

## Modo prueba fuera de Meet (`BroadcastChannel`)

1. Serví el repo: `node serve.mjs` → http://localhost:5173  
2. Abrí en **dos pestañas**:
   - http://localhost:5173/meet/main-stage.html  
   - http://localhost:5173/meet/side-panel.html  
3. El panel envía comandos por `BroadcastChannel("puntook-meet-controller")`.
4. No hace falta Google Meet ni SDK para probar navegación, selector 1–11, videos y demo.

En GitHub Pages, reemplazá `localhost:5173` por  
`https://nahuelcz1.github.io/presentacion.ok/`.

---

## Configuración previa al despliegue

Editá **`meet-config.js`**:

```javascript
cloudProjectNumber: "123456789012",  // Número del proyecto GCP
addOnOrigin: "https://nahuelcz1.github.io",
```

Las URLs se calculan solas según la ruta (`/presentacion.ok/` en GitHub Pages).

Editá **`deployment.json`** si cambiás dominio o rutas:

```json
"sidePanelUrl": "https://nahuelcz1.github.io/presentacion.ok/meet/side-panel.html",
"addOnOrigins": ["https://nahuelcz1.github.io"]
```

El escenario principal se abre con `startActivity({ mainStageUrl })` apuntando a:

`https://nahuelcz1.github.io/presentacion.ok/meet/main-stage.html`

---

## Pasos para instalar el complemento privado en Google Meet

### 1. Google Cloud

1. Creá un [proyecto en Google Cloud](https://console.cloud.google.com/).
2. Anotá el **número del proyecto** (Project **number**, no el ID).
3. Habilitá la **Google Meet API** (Google Workspace Marketplace SDK / Meet add-ons según la consola actual).
4. Configurá la **pantalla de consentimiento OAuth** si la consola lo solicita.

### 2. Publicar el sitio estático

1. Subí este repositorio a GitHub Pages en  
   `https://nahuelcz1.github.io/presentacion.ok/`
2. Verificá que carguen:
   - `/presentacion.ok/index.html`
   - `/presentacion.ok/meet/main-stage.html`
   - `/presentacion.ok/meet/side-panel.html`
3. Los videos `.mp4` deben servirse con soporte **Range** (GitHub Pages lo permite; `serve.mjs` también).

### 3. Desplegar el add-on (HTTP / Cloud Deployment)

1. En [Google Cloud Console](https://console.cloud.google.com/) → **Google Workspace Marketplace SDK** (o la sección **Meet add-ons**).
2. Creá un despliegue **HTTP** / **Cloud deployment resource**.
3. Pegá el contenido de **`deployment.json`** (ajustado con tus URLs).
4. Asociá el despliegue al proyecto GCP y completá la configuración **privada** (solo tu organización / lista de testers).

Documentación oficial:  
https://developers.google.com/workspace/meet/add-ons/guides/deploy-add-on

### 4. Instalación privada en tu dominio Workspace

1. En **Admin console** de Google Workspace (admin.google.com):
   - **Apps** → **Google Workspace Marketplace apps** → **Add custom app** (o flujo de app privada según tu edición).
2. Instalá el complemento para tu unidad organizativa o un grupo de prueba.
3. Alternativa: desde **Marketplace SDK** → despliegue privado → compartir enlace de instalación con testers autorizados.

### 5. Usar en una reunión

1. Entrá a [Google Meet](https://meet.google.com/).
2. Abrí **Actividades** / **Complementos** → **Punto Ok Presentación**.
3. En el **panel lateral**, tocá **Iniciar en escenario principal**.
4. Controlá la presentación desde el panel; el resto ve el escenario principal.

---

## Sincronización Meet SDK

| Dirección | Método |
|-----------|--------|
| Panel → Escenario | `sidePanelClient.notifyMainStage(payload)` |
| Escenario → Panel | `mainStageClient.notifySidePanel(payload)` |

Payload JSON (versión `v: 1`):

```json
{ "v": 1, "type": "command", "command": "next" }
{ "v": 1, "type": "state", "state": { "page": 3, "title": "Impacto", "total": 11 } }
```

Comandos del panel: `goTo`, `next`, `prev`, `first`, `last`, `reset`, `replayAnimation`, `toggleVideo`, `openDemo`, `requestState`.

---

## Panel lateral — controles

- Página actual y título  
- Anterior / Siguiente  
- Selector de páginas 1–11  
- Primera / Última  
- Reiniciar presentación  
- Repetir animación de la slide actual  
- Play / Pausa videos (slide activa, modales y fondo de soporte)  
- Abrir demo (nueva pestaña)

---

## Notas

- **No** se convierte a Google Slides; es la misma app HTML/CSS/JS.
- El marcador (pincel) sigue disponible en la versión standalone; en Meet el control principal es el panel lateral.
- `supportsScreenSharing: true` permite compartir pantalla del add-on además del escenario.
- Para otro dominio que no sea `github.io`, actualizá `addOnOrigins` y las URLs en `deployment.json` y `meet-config.js`.

---

## Referencias

- [Meet add-ons overview](https://developers.google.com/workspace/meet/add-ons/guides/overview)
- [Use the Meet add-ons SDK](https://developers.google.com/workspace/meet/add-ons/guides/use-sdk)
- [Frame-to-frame messaging](https://developers.google.com/workspace/meet/add-ons/guides/frame-to-frame-messaging)
- [Deploy a Meet add-on](https://developers.google.com/workspace/meet/add-ons/guides/deploy-add-on)
