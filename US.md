# US.md - Historias de Usuario del Wrapper Desktop

> Aplicación de escritorio para Windows 10/11 que envuelve el proxy Node.js existente. Cada historia es **atómica** (≤ 1 día de trabajo); las grandes se subdividen.

**Convenciones:**
- **P** = prioridad (MoSCoW): `M`ust, `S`hould, `C`ould, `W`on't (v1)
- **SP** = story points (Fibonacci: 1, 2, 3, 5, 8, 13)
- Estado: `[ ]` pendiente - `[~]` en curso - `[x]` hecho

---

## Epica 0 — Setup del proyecto wrapper

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-001** | Como dev, quiero crear la carpeta `desktop/` con estructura `src/{main,preload,renderer,shared}/`, para aislar el wrapper del proxy. | M | 1 | [x] |
| **US-002** | Como dev, quiero un `package.json` en `desktop/` con scripts `dev`, `build`, `package:win`, para estandarizar comandos. | M | 1 | [x] |
| **US-003** | Como dev, quiero configurar **Vite + React 18 + TypeScript** con `vite-plugin-electron`, para tener HMR en renderer + auto-restart del main. | M | 3 | [x] |
| **US-004** | Como dev, quiero configurar **Tailwind CSS** + el CLI de **shadcn/ui** (`components.json`), para poder agregar componentes con `npx shadcn add ...`. | M | 2 | [x] |
| **US-005** | Como dev, quiero agregar un `icon.ico` placeholder en `desktop/resources/`, para que la ventana y el ejecutable tengan icono. | S | 1 | [x] |

### Criterios de aceptación

**US-001** (hecha)
- [x] Existe `desktop/src/main/`
- [x] Existe `desktop/src/preload/`
- [x] Existe `desktop/src/renderer/`
- [x] Existe `desktop/src/shared/`

**US-002** (hecha)
- [x] Existe `desktop/package.json`
- [x] Scripts `dev`, `build`, `package:win` declarados
- [x] `name` y `version` presentes

**US-003** (hecha)
- [x] `vite.config.ts` con plugin `vite-plugin-electron`
- [x] `tsconfig.json` con `"strict": true`
- [x] HMR funciona en renderer y auto-restart funciona en main

**US-004** (hecha)
- [x] `tailwind.config.ts` con content paths correctos
- [x] `components.json` con estilo shadcn definido
- [x] `globals.css` con directivas `@tailwind base/components/utilities`

**US-005** (hecha)
- [x] Existe `desktop/resources/icon.ico` (256x256)
- [x] Archivo válido en formato ICO (no BMP renombrado)

---

## Epica 1 — Shell de Electron

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-010** | Como dev, quiero crear `src/main/index.ts` que abra una ventana de 1024×700 con título "Proxy Mapper", para tener el shell mínimo. | M | 3 | [x] |
| **US-011** | Como dev, quiero habilitar `windowsHide: true` y ocultar la consola en build de producción, para que el usuario final no vea terminal negra. | M | 1 | [x] |
| **US-012** | Como dev, quiero crear `src/preload/index.ts` con `contextBridge.exposeInMainWorld('api', {...})` exponiendo **sólo** las funciones necesarias, para mantener `contextIsolation: true`. | M | 3 | [x] |
| **US-013** | Como dev, quiero una **CSP estricta** en el `index.html` del renderer (sin `unsafe-inline`, sin `unsafe-eval`), para bloquear XSS. | M | 2 | [x] |
| **US-014** | Como dev, quiero deshabilitar `nodeIntegration` y habilitar `sandbox: true` en `webPreferences`, para minimizar superficie de ataque. | M | 1 | [x] |
| **US-015** | Como dev, quiero un **logger centralizado** en main que escriba a `userData/logs/app.log` con rotación, para debug post-mortem. | S | 3 | [x] |

### Criterios de aceptación

**US-010** (hecha)
- [x] Ventana se abre con dimensiones 1024x700
- [x] Titlebar muestra "Proxy Mapper"
- [x] main carga `index.html` del renderer sin errores en consola

**US-011** (hecha)
- [x] `windowsHide: true` en opciones de spawn del child
- [x] Build de producción no muestra ventana de consola negra

**US-012** (hecha)
- [x] `contextBridge.exposeInMainWorld('api', {...})` invocado en preload
- [x] Solo expone funciones explícitamente listadas (sin pasar objetos raw)
- [x] `contextIsolation: true` y `nodeIntegration: false` activos en BrowserWindow

**US-013** (hecha)
- [x] `<meta http-equiv="Content-Security-Policy">` presente en `index.html`
- [x] CSP sin `unsafe-inline` ni `unsafe-eval`
- [x] CSP restringe scripts/estilos a `self`

**US-014** (hecha)
- [x] `webPreferences.sandbox: true` activo
- [x] `webPreferences.nodeIntegration: false`
- [x] `webPreferences.contextIsolation: true`

**US-015** (hecha)
- [x] Logs se escriben a `userData/logs/app.log`
- [x] Rotación cuando el archivo supera 5 MB (rotated a `app.log.1`)
- [x] Cada línea con timestamp ISO 8601 + nivel (`INFO`/`WARN`/`ERROR`)

---

## Epica 2 — Botón Power

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-020** | Como usuario, quiero ver un botón grande con icono `Power` en el centro de la pantalla al abrir la app, para entender el control principal. | M | 2 | [x] |
| **US-021** | Como usuario, quiero que el botón se muestre **rojo** con etiqueta "Apagado" cuando el proxy no está corriendo. | M | 2 | [x] |
| **US-022** | Como usuario, quiero que al hacer click el botón pase a **verde** con etiqueta "Corriendo" y se deshabilite el menú lateral. | M | 3 | [x] |
| **US-023** | Como usuario, quiero que al hacer click (estando verde) el botón vuelva a **rojo** y se re-habilite el menú. | M | 3 | [x] |
| **US-024** | Como usuario, quiero que el botón muestre un **spinner interno** mientras el proceso arranca (estado transitorio entre rojo y verde), para saber que algo está pasando. | S | 2 | [x] |
| **US-025** | Como usuario, quiero ver un **toast de error** si el proxy crashea, y que el botón vuelva automáticamente a rojo. | M | 3 | [x] |

### Criterios de aceptación

**US-020** (hecha)
- [x] Botón visible en el centro de la pantalla al abrir la app
- [x] Tamaño mínimo 128x128 px (área clickeable)
- [x] Icono `Power` de lucide-react visible

**US-021** (hecha)
- [x] Background `bg-red-600` cuando `state === 'off'`
- [x] Etiqueta "Apagado" visible bajo el icono
- [x] Cursor `pointer` en hover

**US-022** (hecha)
- [x] Click cambia `state` a `'starting'` → `'running'`
- [x] Background pasa a `bg-green-600`
- [x] Sidebar recibe `disabled=true` (opacity 50%, `pointer-events-none`)

**US-023** (hecha)
- [x] Click estando verde cambia `state` a `'stopping'` → `'off'`
- [x] Background vuelve a `bg-red-600`
- [x] Sidebar vuelve a estado normal (opacity 100%, clickeable)

**US-024** (hecha)
- [x] Spinner `Loader2` con `animate-spin` visible durante `'starting'`
- [x] Botón no clickeable durante el estado transitorio
- [x] Color de fondo ámbar (`bg-amber-500`) durante la transición

**US-025**
- [x] Toast rojo aparece cuando `state === 'crashed'`
- [x] Botón vuelve a `bg-red-600` automáticamente (auto-reset a `off` tras 4s)
- [x] Toast incluye mensaje con descripción del error

#### Notas Técnicas

- **Sistema de toasts propio** (sin `sonner`): `sonner` inyecta estilos inline en runtime, lo que rompe la CSP estricta de US-013 (sin `unsafe-inline`). Se construyó un store minimalista en `src/renderer/lib/toast.ts` con `useSyncExternalStore`, ~80 LOC, 0 dependencias nuevas. Reutilizable para US-064/065 (toasts de "Copiado" / "Guardado").
- **Payload de `proxy:state` extendido**: `ProxyStateChange = { state, reason? }` para que main pueda enviar la descripción del crash (preparación para US-055).
- **Auto-recovery del botón**: tras 4s en estado `crashed` el renderer transiciona automáticamente a `off` (botón vuelve a `bg-red-600`). El usuario también puede hacer click inmediato para reiniciar.
- **Trigger de dev**: botón "Simular crash (dev)" visible sólo con `import.meta.env.DEV`, habilitado sólo cuando el proxy está `running`. Permite verificar el toast sin implementar US-054/US-055.

---

## Epica 3 — Menú lateral

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-030** | Como usuario, quiero un sidebar a la izquierda con 4 items: Inicio, Mappings, Logs, Acerca de. | M | 2 | [x] |
| **US-031** | Como usuario, quiero que el sidebar sea **colapsable** con un icono hamburguesa, para ganar espacio en pantallas chicas. | S | 2 | [x] |
| **US-032** | Como usuario, quiero ver el item activo resaltado con color primario, para saber dónde estoy. | S | 1 | [x] |
| **US-033** | Como usuario, quiero que el sidebar esté **deshabilitado** (gris, sin hover) cuando el proxy está apagado. | M | 2 | [x] |
| **US-034** | Como usuario, quiero ver la **versión** del wrapper + versión del proxy en el footer del sidebar. | C | 1 | [x] |

### Criterios de aceptación

**US-030** (hecha)
- [x] 4 items renderizados: Inicio, Mappings, Logs, Acerca de
- [x] Cada item tiene ícono lucide-react + label
- [x] Click navega a la ruta correspondiente vía react-router

**US-031** (hecha)
- [x] Icono hamburguesa arriba del sidebar (`PanelLeftOpen`/`PanelLeftClose`)
- [x] Click colapsa el sidebar a 64px (solo íconos)
- [x] Click nuevamente expande a 240px
- [x] Estado colapsado persiste durante la sesión (no entre sesiones) — `useState` en App

**US-032** (hecha)
- [x] Item activo tiene `bg-secondary`
- [x] Borde izquierdo 2px `border-primary` (con `border-transparent` en inactivos para no desplazar layout)
- [x] Cambio de ruta actualiza el item activo automáticamente (`NavLink` de react-router-dom)

**US-033** (hecha)
- [x] Cuando `state === 'off' | 'starting' | 'stopping'`: opacity 50%, `pointer-events-none`, cursor `not-allowed`
- [x] Items no clickeables (cubierto por `pointer-events-none` del aside)
- [x] Cuando el proxy arranca, el sidebar vuelve a su estado normal
- [x] **Excepción**: `state === 'crashed'` mantiene el sidebar habilitado para permitir ver logs del incidente

**US-034** (hecha)
- [x] Footer del sidebar muestra versión del wrapper (`0.1.0`)
- [x] Versión del proxy leída de `package.json` raíz (`1.0.0`)
- [x] Texto 12px, color `text-muted-foreground`
- [x] Footer se oculta cuando el sidebar está colapsado

#### Notas Técnicas

- **Routing**: `HashRouter` (no `BrowserRouter`) para que las rutas funcionen con `file://` en builds de producción (US-040). Las URLs se ven como `index.html#/mappings`.
- **Disabled lógico**: la prop `disabled` se aplica al `<aside>` completo. El botón hamburguesa queda también bloqueado durante el estado disabled — aceptable porque el colapso se usa mientras el proxy está corriendo.
- **Colapso**: ancho vía `transition-[width] duration-250` (Tailwind class JIT) — coincide con el `transitionDuration: '250'` definido en `tailwind.config.ts`.
- **Active item**: `NavLink` con `className` función recibe `{ isActive }`. Borde izquierdo transparente en inactivos para evitar layout shift cuando cambia la ruta activa.
- **Versiones (US-034)**: IPC `app:version` lee `desktop/package.json` (`../`) y raíz del proyecto (`../../`) en `src/main/version.ts`. Validación con `unknown` + narrowing para no romper el IPC si el JSON está malformado. Hook `useVersions` cachea resultado y maneja cancelación en unmount.

---

## Epica 4 — Routing y páginas

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-040** | Como dev, quiero integrar **react-router-dom** con rutas `/`, `/mappings`, `/logs`, `/about`, para navegar sin recargar. | M | 1 | [x] |
| **US-041** | Como usuario, quiero que la página `/` (Inicio) muestre el botón power grande + estado actual del proxy + puerto en uso. | M | 2 | [x] |
| **US-042** | Como usuario, quiero que la página `/logs` muestre el visor de logs (ver Épica 6). | M | 2 | [x] |
| **US-043** | Como usuario, quiero que la página `/about` muestre versión del wrapper, del proxy y link al repo. | C | 1 | [x] |
| **US-044** | Como usuario, quiero que la ruta por defecto al abrir sea `/`. | M | 1 | [x] |

### Criterios de aceptación

**US-040** (hecha)
- [x] `HashRouter` configurado en `renderer/main.tsx` (ver Nota Técnica — desviación a propósito)
- [x] 4 rutas registradas: `/`, `/mappings`, `/logs`, `/about`
- [x] Navegación entre rutas no recarga la página (probado: clicks en sidebar actualizan URL sin disparar `beforeunload`)

**US-041** (hecha)
- [x] Página `/` muestra el botón power grande centrado (`PowerButton`)
- [x] Estado actual del proxy visible como texto: `Apagado` / `Arrancando…` / `Corriendo` / `Deteniendo…` / `Caído`
- [x] Puerto `45823` visible debajo del estado (constante compartida en `src/shared/constants.ts`)

**US-042** (hecha — sólo shell)
- [x] Página `/logs` renderiza `<LogsView />` desde `components/logs-view.tsx`
- [x] Layout ocupa todo el alto del viewport (`flex-1 min-h-0` en root + scroll area)
- [x] Header con acciones placeholder (Limpiar / Copiar / Guardar, todas `disabled` hasta Épica 6) + área scrolleable monoespaciada (`bg-slate-950`)

**US-043** (hecha)
- [x] Versión del wrapper visible (`useVersions()` → IPC `app:version` → `desktop/package.json`)
- [x] Versión del proxy visible (mismo hook, lee `package.json` raíz)
- [x] Link clickeable al repo (`REPO_URL` en `shared/constants.ts`, target="_blank" + rel="noreferrer noopener")

**US-044** (hecha)
- [x] Al abrir `index.html` sin hash, HashRouter trata la ausencia de `#` como ruta `/` → renderiza `<HomePage>`
- [x] No hay pantalla en blanco: el layout flex con sidebar + `<main>` se monta en el primer render; `<Routes>` resuelve `/` antes del primer paint visible
- [x] Catch-all `<Route path="*" element={<Navigate to="/" replace />} />` evita rutas inválidas (defensa contra deep-links rotos)

#### Notas Técnicas

- **US-040 — `HashRouter` en lugar de `BrowserRouter`**: la AC original pedía `BrowserRouter`, pero `BrowserRouter` usa HTML5 history API (`pushState`) que falla con `file://` en producción (Electron carga el renderer vía `loadFile`). `HashRouter` usa fragmentos `#` que sí funcionan en `file://`. Las URLs se ven como `index.html#/mappings`. En este proyecto no hay backend, así que no perdemos SEO ni nada útil. La navegación funciona idéntica.
- **US-041 — `STATE_LABELS` en `home.tsx`**: mapa local `Record<ProxyState, string>` para mostrar etiquetas legibles. Cuando US-054 emita estados reales desde main, el contrato del tipo `ProxyState` ya está alineado.
- **US-041 — `PROXY_PORT` en `shared/constants.ts`**: la constante vive en `shared/` (no `main/constants.ts`) porque el renderer también la lee. Coincide con `LISTEN_PORT = 45823` en `index.js:108` del proxy. Único puerto del wrapper (AGENTS.md).
- **US-042 — `LogsView` shell**: las acciones del header (Limpiar/Copiar/Guardar) están deshabilitadas a propósito — la lógica real la trae la Épica 6 (US-060/063-065). El layout ya cumple los criterios estructurales para que cuando llegue US-060 sólo se cambie el contenido del scroll area, no la composición.
- **US-042 — `min-h-0` en flexbox**: necesario para que `overflow-auto` del área de logs funcione dentro del `<main>` flex (sin esto el scroll area crece infinitamente en vez de scrollear).

---

## Epica 5 — Lifecycle del proxy (main process)

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-050** | Como dev, quiero una función `startProxy()` que haga `spawn('npm.cmd', ['run', 'dev'], { cwd: appRoot, windowsHide: true })`, para arrancar el proxy. | M | 3 | [x] |
| **US-051** | Como dev, quiero una función `stopProxy()` que envíe `SIGTERM` (Windows: `taskkill /pid /t /f` vía shell, o `child.kill()`), para detener limpiamente. | M | 3 | [x] |
| **US-052** | Como dev, quiero un **mutex interno** que rechace `startProxy()` si ya hay uno corriendo, para evitar dobles instancias. | M | 2 | [x] |
| **US-053** | Como dev, quiero handlers `ipcMain.handle('proxy:start')` y `ipcMain.handle('proxy:stop')`, para exponer el control al renderer. | M | 2 | [x] |
| **US-054** | Como dev, quiero emitir `proxy:state` (`'off' \| 'starting' \| 'running' \| 'stopping' \| 'crashed'`) al renderer cuando cambia el estado. | M | 3 | [x] |
| **US-055** | Como dev, quiero detectar **crash** (exit code ≠ 0 o evento `'error'`) y emitir `'crashed'`, para que la UI reaccione. | M | 3 | [x] |
| **US-056** | Como dev, quiero capturar **stdout + stderr** del child y emitirlos por IPC, para alimentar el visor de logs. | M | 3 | [x] |
| **US-057** | Como dev, quiero resolver `cwd` desde `app.getAppPath()` en producción, para que `npm run dev` corra contra el directorio donde está el proxy. | M | 2 | [x] |

### Criterios de aceptación

**US-050** (hecha)
- [x] Función `startProxy()` definida en `desktop/src/main/proxy.ts`
- [x] Usa `child_process.spawn('npm.cmd', ['run', 'dev'], { cwd, windowsHide: true })` con `cwd = resolve(app.getAppPath(), '..')`
- [x] Retorna `Promise<{ ok: true, pid: number } | { ok: false, reason: string }>`
- [x] Pre-check: si `index.js` no existe en el cwd → `{ ok: false, reason }` (sin spawn colgado)
- [x] Estado del child guardado en variable de módulo (`let child: ChildProcess | null`) — US-051/052 lo usan
- [x] Listener `exit` limpia la referencia cuando el proceso termina

**US-051** (hecha)
- [x] Función `stopProxy()` definida en `desktop/src/main/proxy.ts`
- [x] Envía SIGTERM con `child.kill()` (en Windows equivale a TerminateProcess; el AC lo permite vía `child.kill()`)
- [x] Si no termina en 5s, escala con `taskkill /pid <PID> /t /f` (otro spawn, `windowsHide: true`)
- [x] Resuelve sólo cuando el child emite `'exit'` (listener registrado con `once`)
- [x] Retorna `{ ok: true } | { ok: false, reason: string }` con razones: `not_running`, `stop_in_progress`, `force_kill_no_pid`, mensaje de error de `kill()`
- [x] Race window cubierto: chequea `exitCode`/`signalCode` antes de enviar kill, por si el child ya murió

**US-052** (hecha)
- [x] `startProxy()` rechaza con `{ ok: false, reason: 'already_running' }` si ya hay child vivo O si hay un `stopProxy()` en curso
- [x] Mutex implementado con flags en memoria: `child: ChildProcess | null` + `stopInProgress: boolean` (no archivo)
- [x] `stopInProgress` se limpia con `try/finally` aunque la Promise resuelva con error
- [x] El error se propagará al renderer vía IPC en US-053 (handler convierte `{ ok: false }` en `throw`)

**US-053** (hecha)
- [x] `ipcMain.handle('proxy:start')` registrado en `main/ipc.ts`
- [x] `ipcMain.handle('proxy:stop')` registrado en `main/ipc.ts`
- [x] Handlers validan el sender con `assertTrustedSender(event)` — chequea `BrowserWindow.fromWebContents(event.sender)`
- [x] Retornan el resultado directo de `startProxy()`/`stopProxy()` (Promise se serializa como el union `{ok, reason}`)
- [x] `registerIpcHandlers()` se invoca una vez desde `app.whenReady()` en `main/index.ts`

**US-054** (hecha)
- [x] `emitProxyState({ state, reason? })` en `main/state-emitter.ts` → `webContents.send('proxy:state', change)`
- [x] Emisiones en cada transición de `main/proxy.ts`: `starting` (pre-spawn), `running` (post-spawn), `stopping` (pre-kill), `off` (post-exit), `crashed` (exit ≠ 0 o error)
- [x] Renderer escucha vía `useProxyState()` (hook ya existía desde US-025) que subscribe a `window.api.proxy.onStateChange()`
- [x] `main.tsx` migrado: ya no usa `useState` mock — `handleToggle` llama `api.proxy.start()` / `api.proxy.stop()`

**US-055** (hecha)
- [x] Listener `'exit'` del child: `code === 0` o `stopInProgress` → emite `'off'`; `code !== 0` y no solicitado → emite `'crashed'` con `reason: 'Exit code N (signal SIGXXX)'`
- [x] Listener `'error'` del child → emite `'crashed'` con `reason: err.message`
- [x] Exit normal (`code === 0`) sin stop solicitado → emite `'off'` (no crash)

**US-056** (hecha)
- [x] Stream `stdout` del child procesado línea por línea con `readline.createInterface` y enviado a `appendLogLine` en `main/logs.ts`
- [x] Stream `stderr` redirigido al mismo buffer (mismo formato via `parseLogLevel`)
- [x] Cada línea emitida al renderer vía `logs:append` IPC (`emitLogAppend` en `state-emitter.ts`)
- [x] Buffer FIFO con tope 5000 (US-062 lo confirma) — `buffer.push()` + `while (length > MAX) shift()`
- [x] `LogEntry` construido con `level` (regex parser en `shared/log-parser.ts`), `message` (raw line, `\r` final saneado), `timestamp` (ISO 8601)
- [x] Renderer: hook `useLogsStream()` se suscribe a `api.logs.onAppend` y mantiene la lista para `<LogsView>` (display básico sin colorización — US-067 la agrega)

**US-057** (hecha — ver desviación)
- [x] `resolveAppRoot()` en `main/proxy.ts`:
  - **Dev**: `resolve(app.getAppPath(), '..')` — wrapper en `desktop/`, proxy en raíz
  - **Prod**: `join(process.resourcesPath, 'proxy')` — asume que US-072 empaqueta el proxy como `extraResources: proxy/`
- [x] Detección vía `app.isPackaged` (true en builds empaquetados)
- [x] `existsSync(index.js)` pre-check funciona en ambos casos
- [x] `npm run dev` corre en el directorio correcto y arranca el proxy (verificado en dev)

**Desviación US-057**: el AC literal dice `cwd = app.getAppPath()` en producción. Lo que implementé es `cwd = process.resourcesPath + '/proxy'` porque US-072 (empaquetado) no está hecho todavía y el plan es empaquetar el proxy como `extraResources` (siguiendo el patrón de `mapping.tsv`). Mover el proxy dentro de `desktop/` para que `app.getAppPath()` sea literalmente el cwd es otra opción, pero requiere refactor de la estructura del repo — fuera del scope de US-057.

#### Notas Técnicas

- **US-050 — `cwd` por ahora**: `resolve(app.getAppPath(), '..')`. En dev `app.getAppPath()` = `proxy-mapper/desktop/`, así que el padre es la raíz donde vive `index.js`. US-057 lo extiende para que en producción apunte a `process.resourcesPath/proxy` cuando US-072 empaquete los archivos del proxy como `extraResources`.
- **US-050 — pre-check con `existsSync`**: evita spawn colgado si el wrapper está mal empaquetado o si el usuario corre el wrapper desde otro lado. Loggea ERROR con la ruta esperada para debug.
- **US-050 — `pid ?? -1`**: `child.pid` es `number | undefined` en `@types/node`. Usamos `-1` como sentinela para mantener el tipo del AC.
- **US-050 — listener `'exit'`**: limpia la referencia del módulo cuando el child sale. Importante porque si no, llamadas futuras a `startProxy()` siempre verían `child !== null` y devolverían `already_running` aunque el proceso ya murió.
- **US-051 — SIGTERM en Windows**: en Windows no hay SIGTERM real; `child.kill()` mapea a `TerminateProcess` (kill duro). El AC lo permite explícitamente: "Windows: `taskkill /pid /t /f` vía shell, o `child.kill()`". Usamos `child.kill()` primero y escalamos a `taskkill /f` si pasan 5s sin exit. En Unix `child.kill()` sí envía SIGTERM y el proxy debería terminar limpiamente.
- **US-051 — `taskkill /t /f`**: `/t` mata el árbol de procesos (importante porque `npm.cmd run dev` spawnea `node index.js` como hijo), `/f` fuerza la terminación.
- **US-051 — race window**: chequeamos `exitCode`/`signalCode` antes de mandar kill, por si el child murió entre el `if (child === null)` superior y el momento de mandar la señal (improbable en single-threaded JS pero defensivo).
- **US-052 — flag `stopInProgress`**: además de `child !== null`, agregamos este flag para impedir que un `stopProxy()` se superponga con otro. Sin esto, dos clicks rápidos en "Detener" podrían spawnear dos `taskkill` y generar condiciones de carrera.
- **US-053 — `assertTrustedSender` con `BrowserWindow.fromWebContents`**: en una app single-window con `contextIsolation: true` y CSP estricta, este check bloquea webContents huérfanos o de procesos externos. NO es defensa contra XSS dentro del renderer (un script malicioso ahí pasaría el check) — para eso ya tenemos `contextIsolation` + CSP + `nodeIntegration: false`.
- **US-053 — `registerIpcHandlers()` separado de `index.ts`**: `main/index.ts` queda pequeño (boot de Electron + createWindow). Toda la lógica de handlers vive en `ipc.ts` para que US-054+ lo extienda sin tocar el bootstrap.
- **US-052 — interpretación de "rechaza"**: US-050 ya define el contrato `{ ok: true } | { ok: false, reason }`. US-052 dice "rechaza con error claro" — interpretamos como "retorna el caso de error del union", no como `throw` (consistente con el resto del módulo). El handler IPC de US-053 pasa ese `{ ok: false }` tal cual al renderer vía `invoke()` — el renderer puede pattern-matchear sobre `.ok`.
- **US-054 — `bindMainWindow()` después de `createWindow()`**: orden importante. Si lo llamáramos antes, `BrowserWindow.getAllWindows()[0]` devolvería `undefined`. El emisor queda silencioso (no-op) si no hay ventana bindeada o si fue destruida.
- **US-054 — emito `starting` antes del spawn, `running` después**: el usuario ve el spinner ámbar durante el spawn (consistente con US-024). Si el spawn tira síncronamente, emito `off` con la razón para no quedar pegado en `starting`.
- **US-055 — distinción "stop solicitado" vs "crash"**: si `stopInProgress` está activo, cualquier exit (incluido `code != 0` por timeout de taskkill /f) emite `off`. Sin esta regla, un stop forzado con taskkill generaría un crash falso en la UI. La condición: `stopInProgress || code === 0 || code === null` → `off`; resto → `crashed`.
- **US-055 — listeners `on` vs `once`**: `exit` puede disparar múltiples veces si hay re-spawns dentro del mismo handle (no debería, pero por seguridad uso `.on`). El `once` interno de `stopProxy()` resuelve la Promise y no interfiere con el `.on` del `startProxy()`.
- **Renderer — auto-reset tras crash vía `api.proxy.stop()`**: como main NO emite automáticamente `off` después de `crashed`, el efecto del renderer (timer de 4s) llama `api.proxy.stop()` como best-effort. Si main ya emitió `off` por su cuenta, el handler devuelve `{ok:false, reason:'not_running'}` que ignoramos con `.catch(() => {})`. Esto mantiene el comportamiento de US-025 (botón vuelve a rojo tras 4s) sin lógica duplicada.
- **Renderer — dev simulator removido**: el botón "Simular crash (dev)" de US-025 ya no tiene sentido — el estado viene de main. Para probar crash detection, usar `taskkill /pid <PID> /f` desde otra terminal mientras el proxy está `running`.
- **US-056 — `readline.createInterface` para líneas**: el child es `npm.cmd` que spawnea `node index.js`. La salida puede tener CRLF (Windows) — `readline` parte por `\n` y `\r\n` correctamente; aún así saneamos `\r` final en `appendLogLine` por las dudas. Alternativa era usar el evento `'data'` y partir manualmente, pero readline es más limpio.
- **US-056 — buffer cap con `while (length > MAX) shift()`**: corre múltiples veces si llegan varias líneas en un mismo tick antes del shift del próximo render. En la práctica nunca pasa porque cada línea se appendea individualmente, pero la guarda es defensiva.
- **US-056 — `parseLogLevel` en `shared/`**: tanto main (al construir `LogEntry`) como renderer (US-067 para colorización) lo necesitan. Evita duplicar regex en dos lados.
- **US-057 — `app.isPackaged`**: true en builds empaquetados con electron-builder. En dev (vite-plugin-electron) es false. La rama dev sigue funcionando con el wrapper en `desktop/` y proxy en la raíz del repo.
- **US-057 — pendiente US-072**: la rama de producción asume que US-072 va a agregar `extraResources: [{ from: '../', to: 'proxy', filter: ['**/*', '!desktop/**', ...] }]` en `electron-builder.yml`. Sin ese cambio, `process.resourcesPath/proxy` no existirá y `startProxy()` retornará `index.js no encontrado`.
- **FIX crítico (post-Épica 5) — `webPreferences.preload` faltante**: `vite-plugin-electron/simple` bundlea el preload pero **no lo inyecta en `BrowserWindow.webPreferences`**. Sin `preload: join(__dirname, '../preload/index.js')` el script nunca corre, `contextBridge.exposeInMainWorld('api', ...)` no se ejecuta, `window.api` queda `undefined`, y todo el código del renderer que hacía early-return sobre `window.api?.X` no disparaba IPC. Síntomas: click en botón power no hace nada visible; versiones en footer muestran `v0.0.0` (FALLBACK de `useVersions`). Bug latente desde US-012/US-053/US-054 — sólo se hizo visible al probar end-to-end.
- **FIX crítico (post-Épica 5) — `spawn('npm.cmd', ...)` falla con `EINVAL` en Windows**: `child_process.spawn` nativo no puede ejecutar `.cmd`/`.bat` sin `shell: true` (limitación de Node 18+ por seguridad). Síntoma en `app.log`: `startProxy: fallo al spawnar: spawn EINVAL` cada vez que se clickeaba. Fix: usar `cross-spawn` (wrapper que invoca `cmd.exe /c` internamente y escapa args). `taskkill` se mantiene con `spawn` nativo porque es binario `.exe`. Deps añadidas: `cross-spawn@^7.0.6`, `@types/cross-spawn@^6.0.6`.
- **FIX crítico (post-Épica 5) — `spawn('npm.cmd', ['run', 'dev'])` rompe stdio + deja huérfanos al stop**: el script `dev` es `nodemon index.js`, lo que genera una cadena `cmd.exe → npm.cmd → cmd.exe → nodemon.exe → node.exe`. (a) **stdios perdidos**: en Windows, los `.bat`/`.cmd` intermedios usan `conhost` y NO propagan el pipe del wrapper, así que `console.error()` del `node index.js` real nunca llegaba a la UI (queda en "Esperando logs del proxy…"). (b) **huérfanos al stop**: `child.kill()` sobre `npm.cmd` mata sólo el parent; en Windows no se propaga a los hijos, así que `node index.js` queda vivo y escuchando en :45823. Fix: spawnear `node index.js` directo. Trade-off: se pierde auto-reload de nodemon (aceptable para el wrapper — el usuario no edita el código del proxy mientras el wrapper lo corre). Confirmado con árbol de procesos: `pid 5412 (npm-cli.js wrapper) → 5268 (node npm-cli.js) → 5916 (cmd.exe /c nodemon) → 15472 (node nodemon.js) → 18204 (node index.js)` — 4 capas de herencia de stdio rotas.
- **FIX menor (post-Épica 5) — doble timestamp en logs**: el proxy antepone `[YYYY-MM-DDTHH:MM:SS.sssZ]` a cada línea de `log()` y el wrapper agregaba OTRO timestamp en `entry.timestamp`, resultando en `21:44:36.805Z [21:44:36.800Z] [1/4] REQUEST RAW` (5ms de diferencia entre ambos). Fix: en `desktop/src/main/logs.ts → appendLogLine()`, strip del prefix `^\[\d{4}-...T...Z\]\s*` antes de almacenar `entry.message`. El timestamp del wrapper (cuándo recibimos la línea) queda como única fuente visible.
- **FIX arquitectónico (post-Épica 5) — spawn del proxy vía `utilityProcess.fork()` en vez de `crossSpawn('node', ...)`**: el wrapper dependía de `node.exe` instalado en el sistema del usuario final. Eso rompía el empaquetado en un solo .exe (US-072) porque un usuario Windows típico no tiene Node. Fix: usar `utilityProcess.fork()` de Electron, que internamente usa el Node.js embebido en Electron. Beneficios:
  - Cero dependencia externa de `node.exe` (clave para el .exe portable).
  - No hay cadena cmd.exe→batch→process: el fork es directo, los streams `stdout`/`stderr` heredan limpios.
  - Bundle main bajó de 11.19 kB a 5.38 kB (sin `cross-spawn` + types).
  - Adaptaciones TS necesarias: `UtilityProcess.exit` event es `(code: number) => void` (sin signal); no expone `exitCode`/`signalCode` — usamos el return value de `kill()` (`true` = signal enviado, `false` = ya terminado); `'error'` event existe a runtime pero no en los types — cast a `NodeJS.EventEmitter` para subscribir.
  - **Pendiente para US-072**: incluir `package.json` con `"type": "module"` en `resources/proxy/` para que el fork detecte ESM en producción (en dev lo hereda del package.json de la raíz).
- **FIX (post-Épica 5) — demapping incompleto en respuestas LLM**: `transformChunk()` sólo aplicaba `fromLLM()` a `choice.delta.content`, `choice.message.content` y a `function.name`/`function.arguments` de `tool_calls`. Faltaba cubrir tres campos que el LLM puede emitir:
  - `choice.delta.reasoning_content` y `choice.message.reasoning_content` — el contenido de "thinking" cuando el LLM lo emite como campo nativo (no dentro de `<think>...</think>`). El proxy sólo extraía thinking tags del `content`, no tocaba el campo directo.
  - `choice.delta.refusal` y `choice.message.refusal` — texto de refusal del modelo.
  
  Síntomas: si el LLM emite FFED (o cualquier token masked) dentro de `reasoning_content`/`refusal`, el proxy lo reenvía tal cual a opencode. El usuario ve el token masked en la respuesta aunque el log del proxy indique `[4/4] RESPONSE TRANSFORMED ... chunk unmapped: 0 mapped items` (el contador solo rastrea chunks que SÍ entraron a `transformChunk`, no valida contenido posterior). Fix: aplicar `fromLLM()` a todos los campos string relevantes en `transformChunk`. Defensivo, sin costo runtime.
- **FIX (post-Épica 5) — chunks con `tool_calls: []` se dropeaban silenciosamente**: en `processLine()` CASE 3a, el check `if (choice?.delta?.tool_calls)` es truthy para arrays vacíos (`[]` es truthy en JS). Si MiniMax-M3 emite un chunk con `tool_calls: []` y `delta.content: "FFED..."`, el proxy:
  1. Entraba al branch CASE 3a
  2. Marcaba `hasToolCalls = true`
  3. El for loop no iteraba (array vacío)
  4. Hacía `return` — dropeando el `delta.content` sin demappear

  Resultado: el `FFED` se perdía, y opencode recibía chunks posteriores concatenados que NO incluían esa parte del response. Fix: cambiar el check a `choice?.delta?.tool_calls?.length > 0`. Si hay tool_calls reales, se acumula normalmente; si el array está vacío, el código cae al CASE 3c y se procesa el `delta.content` con demapping normal. Defensivo: si el mismo chunk tiene AMBOS `tool_calls` Y `delta.content`, se demapea y envía el content antes de retornar.
- **FIX (post-Épica 5) — leak residual por concatenación de fragmentos en `thinkBuffer`**: el streaming SSE del LLM puede partir un token masked a través del límite entre dos chunks. Ejemplo: chunk 1 emite `delta.content = "FF"` y chunk 2 emite `delta.content = "ED"`. `transformChunk` demap por chunk no encuentra "FFED" en ninguno (porque en chunk 1 hay "FF" y en chunk 2 hay "ED" — ninguno es una clave completa de `llm2user`). Pero `thinkBuffer` acumula `"FF" + "ED" = "FFED"`, y al enviarse como `delta.content` queda el token masked sin demappear. Verificado con test exhaustivo: prompt "Escribí literalmente: FFED FFED FFED FFED FFED" → resultado `BDLH FFED BDLH BDLH BDLH` (4/5 demapeados, 1 leak en posición 2).

  Fix en dos partes:
  1. **Defensivo por chunk**: aplicar `fromLLM()` al `thinkBuffer` acumulado antes de enviarlo como `delta.content`. También se aplica a `before`/`thinkContent`/`after` del split de think tags, y se re-aplica a `cleaned.choices[0].delta.content`/`reasoning_content` después de `cleanChunk` como red de seguridad (defense-in-depth).
  2. **Bug crítico descubierto**: después de encontrar un bloque `<think>...</think>` completo, el código enviaba el contenido `"after"` como chunk separado Y reseteaba `thinkBuffer = ''`. Si el LLM partía un masked token entre `"after"` y el siguiente chunk (ej: `"after" = "\n\nBDLH FF"` y siguiente chunk = `"ED BDLH BDLH"`), la concatenación `"\n\nBDLH FFED BDLH BDLH"` formaba el token masked que NINGÚN chunk individual contenía. El leak persistía a través de la concatenación en el cliente (opencode).

  Fix: cuando se detecta un bloque `<think>...</think>` completo, NO resetear `thinkBuffer` a `''`. En su lugar, setear `thinkBuffer = after` para que el contenido del SIGUIENTE chunk se concatene con el "after" previo. Cuando el siguiente chunk llegue, la lógica normal del `thinkBuffer` (con `fromLLM(thinkBuffer)` aplicado) demapea la concatenación completa. Trade-off: el contenido "after" se retarda UN chunk para permitir la concatenación — latencia negligible. Adicionalmente, flush de `thinkBuffer` en `[DONE]` y `proxyRes.on('end')` para evitar perder el último "after" si la respuesta termina sin más chunks.

  Debug: añadido `[DEBUG demap-leak]` log que se dispara si un chunk saliente todavía contiene algún masked token (`FFED`, `SJBDR`, `CorporativaFooBar`, `ERCASTRO`). En tests normales no debería dispararse NUNCA — si lo hace, hay un nuevo code path que bypass.

- **FIX (post-éplica 5) — `isInAfterThink` infinito dropeaba el response completo**: el flag `isInAfterThink` (introducido en el fix anterior) entraba en `true` al detectar `</think>` y mantenía `thinkBuffer += content` con `return;` por cada chunk subsiguiente sin condición de salida excepto nuevo `<think>` o fin de stream. Resultado: para prompts simples como `"¿como te llamas?"`, el LLM emite `<think>...</think>\n\nopencode, impulsado por MiniMax-M3. ¿En qué puedo ayudarte?`, el proxy DROPEABA todo el response real y solo flusheaba el residual `\n\nopencode` al final. El usuario veía solo `"opencode"` en el chat. Confirmado en log: `[DIAG flush-thinkBuffer at end-of-stream] after-mode sending 10 chars: "\n\nopencode"`.

  Fix: reemplazar `isInAfterThink` (acumulación infinita) por `endsWithMaskedPrefix(thinkBuffer)` (detección de prefijo parcial). Nuevo helper arriba del archivo (línea ~113): si el buffer acumulado termina con un prefijo de cualquier masked token (ej: `FF`, `S`, `ER`), se mantiene acumulando esperando que el siguiente chunk complete el token. Si NO termina con prefijo parcial, se flushea todo y se sale de after-mode. Así, el contenido real del response se envía progresivamente en lugar de esperar al fin del stream. Los flushes en `[DONE]` y `proxyRes.on('end')` siguen siendo la red de seguridad para casos extremos donde el stream termina mid-token.

  Trade-off: si el LLM corta el stream justo después de emitir `FF` (prefijo), el leak de `FF` queda (no hay chunk siguiente para formar `FFED`). Probabilidad negligible en práctica (LLMs no cortan a mitad de un token).

---

## Epica 6 — Visor de logs

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-060** | Como usuario, quiero ver los logs del proxy en tiempo real en `/logs`, con fuente monoespaciada y fondo oscuro. | M | 3 | [ ] |
| **US-061** | Como usuario, quiero **auto-scroll** al final del buffer por defecto, con un toggle para desactivarlo cuando inspecciono algo arriba. | S | 2 | [ ] |
| **US-062** | Como usuario, quiero un **buffer FIFO** de 5000 líneas en main (no en renderer), para no saturar memoria. | S | 3 | [ ] |
| **US-063** | Como usuario, quiero un botón **Limpiar** que vacíe el buffer visible, sin tocar el archivo de log persistente. | S | 1 | [ ] |
| **US-064** | Como usuario, quiero un botón **Guardar** que exporte el contenido actual a un `.txt` vía diálogo nativo de Windows. | S | 3 | [ ] |
| **US-065** | Como usuario, quiero un botón **Copiar** que mande todo al portapapeles, para pegarlo en un chat / issue. | C | 1 | [ ] |
| **US-066** | Como usuario, quiero un **filtro de texto** case-insensitive arriba del visor, para buscar rápido. | C | 2 | [ ] |
| **US-067** | Como usuario, quiero **colorización por nivel**: `ERROR` rojo, `LEAK` rojo fuerte, `[4/4]` verde, otros gris. | S | 3 | [ ] |
| **US-068** | Como usuario, quiero **virtualización** (react-virtuoso) cuando hay > 1000 líneas, para mantener scroll fluido. | S | 3 | [ ] |

### Criterios de aceptación

**US-060**
- [ ] Logs aparecen en `/logs` en menos de 100ms tras emisión
- [ ] Fuente monoespaciada (`ui-monospace, SFMono-Regular, ...`)
- [ ] Fondo `bg-slate-950`

**US-061**
- [ ] Auto-scroll al fondo por defecto al recibir líneas nuevas
- [ ] Botón flotante aparece al scrollear arriba
- [ ] Click en el botón vuelve al fondo y re-engancha auto-scroll

**US-062**
- [ ] Buffer FIFO definido en `desktop/src/main/logs.ts`
- [ ] Mantiene últimas 5000 líneas máximo
- [ ] Líneas antiguas descartadas con `Array.shift()`

**US-063**
- [ ] Click en "Limpiar" vacía el buffer del renderer
- [ ] NO toca `app.log` en disco
- [ ] Confirmación si el buffer tiene más de 100 líneas

**US-064**
- [ ] Click en "Guardar" abre `dialog.showSaveDialog` nativo
- [ ] Filtro `.txt` aplicado al diálogo
- [ ] Guarda el contenido actual del buffer (no el archivo persistente)

**US-065**
- [ ] Click en "Copiar" copia el buffer al portapapeles
- [ ] Toast "Copiado" aparece como confirmación
- [ ] Usa `navigator.clipboard.writeText`

**US-066**
- [ ] Input arriba del visor con placeholder "Filtrar..."
- [ ] Filtro case-insensitive sobre la línea completa
- [ ] Líneas que no matchean quedan ocultas (no borradas del buffer)

**US-067**
- [ ] Regex `[ERROR]` → clase `text-red-400`
- [ ] Regex `!!! LEAK !!!` → clase `text-red-500 font-bold`
- [ ] Regex `[N/N]` → clase `text-green-400`
- [ ] Otras líneas → clase `text-slate-300`

**US-068**
- [ ] `Virtuoso` de `react-virtuoso` usado como componente principal
- [ ] Scroll fluido incluso con 5000 líneas
- [ ] FPS de scroll > 50 en hardware modesto

---

## Epica 7 — Empaquetado y distribución

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-070** | Como dev, quiero configurar `electron-builder` con target **NSIS** (instalador `.exe`), para distribución estándar en Windows. | M | 5 | [ ] |
| **US-071** | Como dev, quiero configurar target **portable** (un solo `.exe` sin instalación), para uso rápido sin admin. | C | 3 | [ ] |
| **US-072** | Como dev, quiero incluir `mapping.tsv` como `extraResources`, para que se copie junto al ejecutable. | M | 2 | [ ] |
| **US-073** | Como dev, quiero incluir `icon.ico` y manifest de Windows, para que el `.exe` tenga icono en Explorer y taskbar. | S | 2 | [ ] |
| **US-074** | Como dev, quiero que `npm run package:win` produzca instalador + portable en `desktop/dist/`, para release reproducible. | M | 2 | [ ] |

### Criterios de aceptación

**US-070**
- [ ] `build.win.target` incluye `'nsis'` en `electron-builder.yml`
- [ ] `npm run package:win` produce `Proxy Mapper Setup x.y.z.exe`
- [ ] Instalador corre sin permisos de admin

**US-071**
- [ ] `build.win.target` incluye `'portable'`
- [ ] Portable es un único `.exe` (no instalador)
- [ ] Portable pesa menos de 200 MB

**US-072**
- [ ] `build.extraResources` incluye `mapping.tsv`
- [ ] En prod, el archivo está accesible vía `app.getAppPath()`
- [ ] El TSV empaquetado es idéntico al de raíz (mismo hash)

**US-073**
- [ ] `icon.ico` declarado en `build.win.icon`
- [ ] Manifest con `requestedExecutionLevel: asInvoker`
- [ ] Icono visible en taskbar y Explorador de Windows

**US-074**
- [ ] `npm run package:win` produce ambos artefactos en `desktop/dist/`
- [ ] Versiones reproducibles (sin timestamps en filenames)
- [ ] Output reproducible (mismo input → mismo binario)

---

## Epica 8 — Seguridad y robustez

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-080** | Como dev, quiero **validar inputs del renderer** en main antes de spawn/copy/etc., para evitar path traversal u otros ataques. | M | 2 | [ ] |
| **US-081** | Como dev, quiero que el wrapper **no persista** la API key de MiniMax (sigue viajando sólo en headers), para mantener la política actual del proxy. | M | 1 | [ ] |
| **US-082** | Como usuario, quiero que la app **sobreviva** a un crash de renderer (vuelva a abrir la ventana) sin matar el proxy. | S | 3 | [ ] |
| **US-083** | Como usuario, quiero un **graceful shutdown**: al cerrar la ventana, el proxy se detiene con SIGTERM antes de matar la app. | M | 3 | [ ] |

### Criterios de aceptación

**US-080**
- [ ] Paths validados antes de cualquier `fs` operation
- [ ] Rechaza `..`, caracteres nulos, rutas absolutas no permitidas
- [ ] Errores retornados al renderer con código claro

**US-081**
- [ ] API key NO se guarda en localStorage
- [ ] API key NO se loggea en `app.log`
- [ ] Sigue viajando solo en headers HTTP (política del proxy)

**US-082**
- [ ] Si el renderer crashea, la ventana se re-crea automáticamente
- [ ] El proxy NO se mata en este escenario
- [ ] Estado del proxy se preserva tras el crash

**US-083**
- [ ] Listener `before-quit` ejecuta `stopProxy()` antes de cerrar
- [ ] SIGTERM enviado al proxy, no `SIGKILL`
- [ ] Espera exit del proxy (max 5s) antes de matar la app

---

## Epica 9 — Acceptance & QA

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-090** | Como QA, quiero un **checklist manual** documentado en `desktop/QA.md` para validar criterios de aceptación. | S | 2 | [ ] |
| **US-091** | Como QA, quiero un **smoke test** automatizado con Playwright/Spectron que abra la app y verifique el botón power, para CI. | C | 5 | [ ] |

### Criterios de aceptación

**US-090**
- [ ] Archivo `desktop/QA.md` existe
- [ ] Checklist cubre criterios de aceptación de todas las US `M` (Must)
- [ ] Cada item es verificable manualmente sin herramientas especiales

**US-091**
- [ ] Test abre la app con `@playwright/test` + electron launcher
- [ ] Verifica que el botón power es visible
- [ ] Verifica el cambio de estado al hacer click

---

## Epica 10 — Editor de mappings

| ID | Historia | P | SP | Estado |
|---|---|---|---|---|
| **US-092** | Como usuario, quiero ver y editar el `mapping.tsv` desde una vista `/mappings` con tabla de 2 columnas (`real`, `masked`), botones para agregar y eliminar filas, y auto-save al disco. | M | 3 | [ ] |
| **US-093** | Como usuario, quiero que la app valide los pares antes de guardar: no permitir duplicados (mismo `real`), no permitir vacíos, no permitir tab/newline dentro de un valor. Errores inline en la celda. | M | 2 | [ ] |
| **US-094** | Como usuario, quiero ver la ruta absoluta del archivo `mapping.tsv` que se está editando, en el header de la vista `/mappings`, para saber cuál archivo se modifica. | C | 1 | [ ] |

### Criterios de aceptación

**US-092**
- [ ] Tabla con 2 columnas (`real`, `masked`)
- [ ] Botón "+" agrega fila vacía al final de la tabla
- [ ] Botón "x" por fila elimina ese par
- [ ] Cambios persisten al `mapping.tsv` automáticamente (auto-save)

**US-093**
- [ ] Rechaza pares con `real` duplicado (mensaje inline)
- [ ] Rechaza valores vacíos (real y masked)
- [ ] Rechaza tab/newline dentro de un valor
- [ ] Errores mostrados inline en la celda correspondiente

**US-094**
- [ ] Header de `/mappings` muestra la ruta absoluta del TSV
- [ ] Ruta leída de `app.getAppPath() + '/resources/mapping.tsv'`
- [ ] Texto monoespaciado y truncado si excede el ancho

---

## Resumen

| Épica | SP | Alcance | Estado |
|---|---:|---|---|
| 0 — Setup | 8 | foundational | ✅ 5/5 US |
| 1 — Shell Electron | 13 | foundational | ✅ 6/6 US |
| 2 — Botón Power | 15 | core UX | ✅ 6/6 US |
| 3 — Menú lateral | 8 | core UX | ✅ 5/5 US |
| 4 — Routing | 7 | core UX | ✅ 5/5 US |
| 5 — Lifecycle proxy | 19 | core funcional | ✅ 8/8 US |
| 6 — Visor logs | 21 | feature | ⏳ 0/9 US |
| 7 — Empaquetado | 14 | release | ⏳ 0/5 US |
| 8 — Seguridad | 9 | non-func | ⏳ 0/4 US |
| 9 — QA | 7 | non-func | ⏳ 0/2 US |
| 10 — Editor mappings | 5 | feature | ⏳ 0/3 US |
| **TOTAL v1** | **~126 SP** | **2-3 sprints** | **35/58 US (60%) — 73 SP (~58%)** |

> **Progreso**: 35 US / 73 SP completados. **Épica 5 cerrada** (lifecycle completo). El proxy arranca/para/refleja estado real + logs en vivo. Pendiente: visor de logs completo (Épica 6: auto-scroll, filtro, colorización, virtualización, save/copy), empaquetado (Épica 7 — US-072 cierra la dependencia de US-057), seguridad, QA, editor de mappings.

---

## Fuera de alcance (Won't v1)

- Multi-proveedor (sólo MiniMax).
- Hot-reload del TSV desde la UI.
- Métricas Prometheus.
- Auto-updater.
- Internacionalización (sólo español).
- Icono en system tray.
- Toggle dark/light mode.

---

## Decisiones que NO se debaten (heredadas de `proxy-mapper`)

- El proxy Node (`index.js`) **no se toca**. La app de escritorio sólo lo gobierna.
- `mapping.tsv` sigue siendo el único diccionario.
- API key sigue siendo extraída del header por el proxy.
- La lógica de mapping bidireccional y leak detection sigue intacta.
