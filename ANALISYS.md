# ANALISIS.md

## Resumen del Documento de Análisis

Este documento detalla los requerimientos y el diseño técnico para el **wrapper de escritorio** del proyecto `proxy-mapper`. La aplicación envuelve el proxy HTTP Node.js existente (`index.js` + `mapping.tsv`) en una ventana nativa de Windows 10/11, exponiendo un control mínimo: botón power, menú lateral, visor de logs. **No se reescribe la lógica del proxy** — la UI sólo lo gobierna.

---

## Requisitos Funcionales

### RF-001: Plataforma Windows 10/11 con instalador
**Descripción**: La app debe empaquetarse como instalador NSIS (`.exe`) para Windows 10 (1809+) y Windows 11, y también como `.exe` portable sin instalación.
**Prioridad**: Alta

### RF-002: Botón Power de encendido/apagado
**Descripción**: Al abrir la app se muestra un botón power rojo ("Apagado"). Al presionarlo se ejecuta `npm run dev` en el directorio del ejecutable; el botón pasa a verde ("Corriendo"). Al presionarlo de nuevo se envía SIGTERM al proceso y vuelve a rojo.
**Prioridad**: Alta

### RF-003: Menú lateral de navegación
**Descripción**: Sidebar a la izquierda con tres opciones: Inicio, Logs y Acerca de. Se deshabilita visualmente cuando el proxy está apagado. Muestra la versión del wrapper en el footer.
**Prioridad**: Alta

### RF-004: Visor de logs en tiempo real
**Descripción**: Vista `/logs` que muestra `stdout` y `stderr` del proceso proxy con auto-scroll, colorización por nivel (ERROR rojo, LEAK rojo fuerte, `[4/4]` verde), filtro por texto, botones Limpiar / Guardar / Copiar.
**Prioridad**: Alta

### RF-005: Control de ciclo de vida del proceso proxy
**Descripción**: El wrapper lanza `npm run dev` como proceso hijo vía `child_process.spawn`, captura su salida, expone IPC `proxy:start`, `proxy:stop` y emite el evento `proxy:state` (`off | starting | running | stopping | crashed`).
**Prioridad**: Alta

### RF-006: Manejo de errores y crash recovery
**Descripción**: Si el proceso proxy muere de forma inesperada, el botón vuelve a rojo, se muestra un toast de error con la causa y se registra el incidente en el log persistente.
**Prioridad**: Media

---

## Entities del Modelo de Datos

### ProxyState (Unión literal)
| Valor | Significado |
|-------|-------------|
| `off` | Proceso no está corriendo |
| `starting` | Se lanzó `npm run dev`, aún no escuchó |
| `running` | Proxy está aceptando requests en :45823 |
| `stopping` | Se envió SIGTERM, esperando salida |
| `crashed` | Murió de forma inesperada (exit ≠ 0) |

### LogEntry
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `timestamp` | ISO String | Momento de emisión |
| `level` | `'info' \| 'error' \| 'warning' \| 'leak' \| 'chunk'` | Nivel clasificado por regex en main |
| `raw` | string | Línea cruda tal cual salió de stdout/stderr |

### ProxyMeta
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `pid` | number \| null | PID del proceso Node hijo |
| `startedAt` | ISO String \| null | Timestamp de arranque |
| `cwd` | string | Directorio donde se lanzó `npm run dev` |

### UserPreferences (opcional, sólo en memoria)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `autoScroll` | boolean | Auto-scroll del visor de logs (default `true`) |
| `filter` | string | Filtro de texto del visor (default `''`) |

> **No persiste en disco.** Decisión: v1 sin localStorage para credenciales sensibles.

---

## Reglas de Negocio

### RN-001: Una sola instancia del proxy
**Descripción**: El wrapper debe rechazar un segundo `proxy:start` mientras ya hay un proceso en `starting | running | stopping`.
**Validación**: Mutex interno en `src/main/proxy.ts`; el handler IPC responde `{ ok: false, error: 'already-running' }`.

### RN-002: API key nunca persistida
**Descripción**: La API key de MiniMax sigue viajando sólo en headers de cada request (igual que hoy en `index.js`). La UI no la muestra, no la guarda, no la loguea.
**Validación**: `grep -r 'MINIMAX_API_KEY' desktop/src/` debe devolver `0` ocurrencias.

### RN-003: Buffer de logs limitado (FIFO)
**Descripción**: El buffer en memoria mantiene como máximo las últimas 5000 líneas. Cuando se llena, descarta las más antiguas.
**Validación**: Insertar 10001 líneas en main → la línea 1 debe estar fuera del buffer.

### RN-004: Sidebar deshabilitado si proxy apagado
**Descripción**: Cuando `ProxyState !== 'running'`, los items de navegación (excepto Home) se renderizan con `disabled` y `pointer-events: none`.
**Validación**: Apagar el proxy → click en "Logs" no debe cambiar la ruta.

### RN-005: Crash → estado visible
**Descripción**: Cualquier exit code ≠ 0 o evento `'error'` del child process dispara `proxy:state = 'crashed'`. El botón vuelve a rojo y aparece un toast.
**Validación**: Matar el Node desde Task Manager → UI debe reflejar el crash en ≤ 1s.

### RN-006: Botón power bloqueado durante transiciones
**Descripción**: Mientras `state ∈ { 'starting', 'stopping' }` el botón muestra spinner y no responde a clicks.
**Validación**: Click rápido 3 veces durante `starting` → sólo se debe lanzar un `npm run dev`.

---

## Casos de Uso

### UC-001: Encender el proxy
**Actor**: Usuario autenticado (no hay auth; v1 sin login)
**Flujo principal**:
1. El usuario abre la app (o hace doble clic en el `.exe`).
2. La UI muestra el botón power en estado rojo.
3. El usuario hace click en el botón.
4. El main lanza `npm run dev` en el directorio del ejecutable.
5. El botón transiciona a "starting" (spinner).
6. El proxy emite `=== Proxy Started ===` por stderr.
7. El main detecta el log y emite `proxy:state = 'running'`.
8. El botón pasa a verde con etiqueta "Corriendo".

**Flujo alternativo**: Si el puerto 45823 está ocupado, `npm run dev` falla, el botón vuelve a rojo y se muestra un toast.

### UC-002: Apagar el proxy
**Actor**: Usuario
**Flujo principal**:
1. Estado actual: `running`.
2. El usuario hace click en el botón verde.
3. El main captura el click → IPC `proxy:stop`.
4. El main envía SIGTERM al proceso Node hijo.
5. El estado pasa a `stopping` (spinner amarillo).
6. El proceso termina con exit code 0.
7. El main emite `proxy:state = 'off'`.
8. El botón vuelve a rojo.

**Flujo alternativo**: Si el proceso no termina en 5s, se envía SIGKILL forzado.

### UC-003: Ver logs en tiempo real
**Actor**: Usuario
**Flujo principal**:
1. El usuario hace click en "Logs" del sidebar.
2. La ruta cambia a `/logs`.
3. El componente `LogsView` se monta y pide el buffer actual al main.
4. Cada nueva línea que emite el proceso se envía vía IPC `logs:append` y se concatena al final.
5. Si `autoScroll === true`, el scroll sigue al fondo.

**Flujo alternativo**: Si el filtro está activo, sólo se renderizan las líneas que coincidan.

### UC-004: Filtrar logs por texto
**Actor**: Usuario
**Flujo principal**:
1. En `/logs`, el usuario escribe en el input de filtro.
2. La lista se re-renderiza mostrando sólo líneas que contengan el texto (case-insensitive).
3. El filtro es cliente puro (no se piden más datos al main).

### UC-005: Exportar logs a archivo
**Actor**: Usuario
**Flujo principal**:
1. En `/logs`, el usuario hace click en "Guardar".
2. Se abre el diálogo nativo de Windows (SaveFileDialog).
3. El usuario elige ruta + nombre `.txt`.
4. Se escribe el buffer actual al disco.
5. Toast de confirmación.

### UC-006: Recovery ante crash
**Actor**: Sistema
**Flujo principal**:
1. El proceso Node muere por error no controlado (exit code ≠ 0 o `error` event).
2. El main detecta y emite `proxy:state = 'crashed'`.
3. La UI vuelve el botón a rojo automáticamente.
4. Se emite un toast con el mensaje "Proxy cayó: <exitCode>".
5. La última línea de stderr queda visible en `/logs`.

---

## Requisitos No Funcionales

- **Rendimiento**: Latencia máxima entre línea emitida por el proxy y visible en UI: **100 ms** (medido en localhost).
- **Rendimiento**: Visor de logs fluido con 1000+ líneas visible (virtualización con `react-virtuoso`).
- **Rendimiento**: CPU en idle: **< 1%**.
- **Tamaño**: Binario instalador: **≤ 150 MB**.
- **Seguridad**: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`. CSP estricta sin `unsafe-inline`.
- **Seguridad**: La API key de MiniMax no aparece nunca en el renderer (logs, localStorage, DevTools).
- **Compatibilidad**: Windows 10 build 1809+ y Windows 11 (cualquier edición).
- **Resiliencia**: Si el renderer crashea, la ventana se recarga sin matar el proxy (US-082).
- **Mantenibilidad**: TypeScript estricto, sin `any`, sin dependencias innecesarias.

---

## Supuestos y Dependencias

- **Supuesto 1**: Node.js 18+ está disponible en el sistema del usuario final (viene en `Program Files` junto al `.exe` o se instala vía NSIS como prerequisito).
- **Supuesto 2**: El usuario edita `mapping.tsv` manualmente con un editor de texto antes de abrir la app.
- **Dependencia externa**: shadcn/ui se descarga vía `npx shadcn@latest add <componente>` durante desarrollo — la CLI requiere Node.js y conexión a internet en build time.
- **Dependencia externa**: `electron-builder` requiere permisos de escritura en `desktop/dist/` durante `npm run package:win`.
