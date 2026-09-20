# STACK.md

## Stack tecnológico del wrapper desktop

> Stack confirmado para la conversión del proxy a aplicación de escritorio Windows.

---

## Lenguajes

- **TypeScript 5.5+** — renderer, preload y main (tipado estricto).
- **JavaScript (Node.js ESM)** — para `index.js` del proxy (no se modifica, sigue en JS legacy).
- **HTML5 / CSS3 (Tailwind)** — UI del renderer.

---

## Frameworks y librerías

### Runtime / Shell / Routing
| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `electron` | ^31.0.0 | Runtime de escritorio; provee main + preload + renderer. |
| `react` | ^18.3.0 | UI del renderer. |
| `react-dom` | ^18.3.0 | Mount point. |
| `react-router-dom` | ^6.26.0 | Routing `/`, `/mappings`, `/logs`, `/about`. |

### UI
| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `tailwindcss` | ^3.4.0 | Utilidades CSS base. |
| `shadcn/ui` | CLI (no dep) | Componentes accesibles sobre Radix + Tailwind. |
| `lucide-react` | latest | Iconos (`Power`, `Logs`, `Info`, etc.). |
| `class-variance-authority` | latest | Variantes de componentes shadcn. |
| `clsx` + `tailwind-merge` | latest | Helper `cn()` para shadcn. |
| `tailwindcss-animate` | latest | Animaciones para componentes shadcn (accordion, dialog, etc.). |
| `react-virtuoso` | ^4.7.0 | Virtualización del visor de logs. |

### Build / Tooling
| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `vite` | ^5.4.0 | Bundler del renderer. |
| `vite-plugin-electron` | ^0.28.0 | Integra Vite con el main de Electron (HMR). |
| `electron-builder` | ^24.13.0 | Empaqueta instalador NSIS y portable. |
| `typescript` | ^5.5.0 | Compilador TS. |
| `@vitejs/plugin-react` | ^4.3.0 | Plugin React para Vite. |
| `@types/react`, `@types/react-dom` | latest | Tipos. |
| `postcss` + `autoprefixer` | latest | Pipeline de Tailwind. |

---

## Estructura del Proyecto

```
proxy-mapper/
|-- index.js                    # Proxy heredado (NO TOCAR)
|-- mapping.tsv                 # Diccionario real->masked (NO TOCAR)
|-- package.json                # Raíz (scripts start/dev del proxy)
|
|-- desktop/                    # ← NUEVO wrapper Electron
|   |-- package.json
|   |-- electron-builder.yml    # Config instalador NSIS + portable
|   |-- vite.config.ts
|   |-- tsconfig.json
|   |-- tsconfig.node.json
|   |-- tailwind.config.ts
|   |-- postcss.config.js
|   |-- components.json         # Config de shadcn/ui
|   |-- .gitignore
|   |
|   |-- src/
|   |   |-- main/               # Proceso principal Electron
|   |   |   |-- index.ts        #   - crea ventana, lifecycle app
|   |   |   |-- proxy.ts        #   - spawn/kill/estado del proxy
|   |   |   |-- logs.ts         #   - buffer FIFO + IPC streaming
|   |   |   |-- logger.ts       #   - logging centralizado a userData/logs/
|   |   |   \-- ipc.ts          #   - registro de handlers ipcMain
|   |   |
|   |   |-- preload/
|   |   |   \-- index.ts        #   - expone API segura via contextBridge
|   |   |
|   |   |-- renderer/
|   |   |   |-- index.html
|   |   |   |-- main.tsx       #   - bootstrap React + router
|   |   |   |-- App.tsx        #   - layout (sidebar + outlet)
|   |   |   |
|   |   |   |-- components/
|   |   |   |   |-- ui/        #   - shadcn (Button, Sidebar, ...)
|   |   |   |   |-- power-button.tsx
|   |   |   |   |-- app-sidebar.tsx
|   |   |   |   \-- logs-view.tsx
|   |   |   |
|   |   |   |-- pages/
|   |   |   |   |-- home.tsx
|   |   |   |   |-- mappings.tsx
|   |   |   |   |-- logs.tsx
|   |   |   |   \-- about.tsx
|   |   |   |
|   |   |   |-- hooks/
|   |   |   |   |-- use-proxy-state.ts
|   |   |   |   \-- use-logs-stream.ts
|   |   |   |
|   |   |   |-- lib/
|   |   |   |   |-- utils.ts   #   - cn() helper
|   |   |   |   \-- ipc.ts     #   - tipos del bridge
|   |   |   |
|   |   |   \-- styles/
|   |   |       \-- globals.css #   - Tailwind base + shadcn tokens
|   |   |
|   |   \-- shared/
|   |       \-- types.ts       #   - tipos compartidos main <-> renderer
|   |
|   |-- resources/
|   |   |-- icon.ico           #   - icono de la ventana y del .exe
|   |   \-- mapping.tsv        #   - copia sincronizada del raíz
|   |
|   \-- dist/                  #   - output de build (gitignored)
|
|-- AGENTS.md
|-- ANALISIS.md
|-- STACK.md
|-- UI-GUIDE.md
|-- US.md
\-- WORKFLOW.md
```

---

## Reglas de Organización

- **Todo el código del wrapper vive bajo `desktop/`** — nada al nivel raíz, excepto los archivos de documentación `.md`.
- **El proxy (`index.js`, `mapping.tsv`) NO se mueve ni se modifica.** La carpeta `desktop/` es aditiva.
- **`resources/mapping.tsv`** debe ser idéntico al raíz y se sincroniza manualmente (o en build step) — el wrapper lo copia en runtime.
- **Tipos compartidos** entre main y renderer en `desktop/src/shared/types.ts` (importado por ambos).
- **Sin bases de datos**: estado del proxy vive en memoria + `mapping.tsv`. Persistencia de preferencias (si se agrega) sólo en RAM (no localStorage sensible).
- **Sin Express, sin Fastify, sin nada que levante servidor** en el wrapper: el único servidor es el del proxy en :45823.
- **shadcn no es una dependencia**: se invoca con `npx shadcn@latest add <componente>` y los componentes se copian a `components/ui/`. Esto da control total sobre el código generado.

---

## Programación

### Paradigma

- **React**: componentes funcionales + hooks (no class components).
- **TypeScript**: tipado estructural; preferir `unknown` + narrowing sobre `any`.
- **Main process**: módulos CommonJS-style (Electron lo requiere) — usar `import` ESM con `target: ESNext` y dejar que Vite/electron-builder resuelva.
- **Estado**: `useState` / `useReducer` + props. Zustand sólo si la complejidad lo justifica.
- **Sin singletons en el renderer** que dependan del main: toda comunicación pasa por IPC tipado.

### Tamaño de funciones

- **Límite recomendado: 50 líneas** por función.
- **Excepciones permitidas** sólo si la función tiene una única responsabilidad clara (ej: `processLine` en SSE).
- **Helper extractions**: si un callback o bloque de JSX crece, extraer a una sub-función local.

---

## Documentación

### Reglas de comentarios

**Para cada archivo `.ts` / `.tsx`:**
```ts
/**
 * power-button.tsx - Botón power del wrapper desktop.
 *
 * Renderiza un botón grande con icono Power. Cambia de rojo (Apagado)
 * a verde (Corriendo) según el estado del proxy recibido por props.
 *
 * Estado que recibe:
 *   - off | starting | running | stopping | crashed
 *
 * Componentes usados:
 *   - Button (shadcn/ui)
 *   - Power (lucide-react)
 */
```

**Para cada función pública / exportada:**
```ts
/**
 * Construye el payload para iniciar el proxy.
 * @param cwd - Directorio donde correr `npm run dev`.
 * @returns Objeto con ok=true y el PID, o ok=false con motivo del fallo.
 */
export const startProxy = async (cwd: string): Promise<StartResult> => {
  // ...
};
```

### Reglas para componentes React

- Cada componente tiene un JSDoc breve (qué renderiza, qué props recibe).
- Props tipadas con `interface ComponentNameProps`.
- No exportar componentes default — usar `export const`.
- Hooks siempre con prefijo `use` y retorno documentado.

### Decisiones arquitectónicas

- Las decisiones arquitectónicas **no obvias** (trade-offs, elecciones de librería, gotchas del proxy heredado) se documentan en `US.md` dentro de la US correspondiente, en una subsección **"Notas Técnicas"**. NO se documentan en el código como `// comments` largos ni en un `ARCHITECTURE.md` separado.
- Ejemplos de lo que SÍ va en Notas Técnicas: por qué `app.getAppPath()` en vez de `process.execPath`; por qué el FIFO de logs vive en main y no en preload; por qué el botón power usa un reducer en vez de `useState` directo.

---

## APIs Externas

| API | Origen | Notas |
|-----|--------|-------|
| `child_process.spawn` | Node.js stdlib | Lanzar `npm run dev`. |
| `fs` | Node.js stdlib | Leer `mapping.tsv` desde `app.getAppPath()`. |
| Electron `BrowserWindow` | Electron | Ventana principal. |
| Electron `Menu` | Electron | Menú nativo (opcional). |
| Context Bridge `contextBridge` | Electron | API segura al renderer. |
| Electron `dialog.showSaveDialog` | Electron | Diálogo Guardar logs. |
| shadcn/ui (Radix UI) | Radix | Primitivos accesibles. |

---

## Dependencias (Resumen)

```jsonc
// desktop/package.json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "react-virtuoso": "^4.7.0",
    "lucide-react": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.0",
    "vite": "^5.4.0",
    "vite-plugin-electron": "^0.28.0",
    "typescript": "^5.5.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@types/node": "latest",
    "tailwindcss": "^3.4.0",
    "postcss": "latest",
    "autoprefixer": "latest",
    "tailwindcss-animate": "latest"
  }
}
```

> **Notas:**
> - shadcn/ui no aparece como dep porque se consume por CLI (`npx shadcn@latest add`).
> - `nodemon` NO se incluye en el wrapper (Vite + vite-plugin-electron ya proveen HMR).
> - El proxy heredado en raíz sigue usando sus propias deps (`express`, etc.) pero el wrapper **no las importa**.
