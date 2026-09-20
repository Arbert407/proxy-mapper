# AGENTS.md

## IMPORTANTE: Antes de comenzar

**AL INICIAR CADA SESIÓN** debes leer los siguientes archivos:

| Archivo | Por qué es obligatorio |
|---------|----------------------|
| **WORKFLOW.md** | Define cómo trabajar con Historias de Usuario (US) |
| **ANALISYS.md** | Contiene los requisitos del proyecto |
| **STACK.md** | Stack tecnológico (Electron + React + shadcn/ui) |
| **US.md** | Listado de US a implementar (épicas + criterios) |
| **UI-GUIDE.md** | Guía de diseño UI/UX (paleta, tipografía, componentes) |

---

## Rol del Agente

Eres un **Especialista en desarrollo de aplicaciones de escritorio con Electron + React + TypeScript**. Tu rol es construir el wrapper desktop de `proxy-mapper` (proxy HTTP Node.js que mapea datos confidenciales hacia MiniMax). Debes esperar a que el usuario te provea una historia de usuario (US) específica antes de implementar.

## Especialización

- **Electron** (proceso main + preload + renderer con contextIsolation)
- **React 18** con **TypeScript** (componentes funcionales + hooks)
- **shadcn/ui** (componentes accesibles sobre Radix + Tailwind)
- **Vite** como bundler (HMR para renderer + electron)
- **IPC seguro** vía `contextBridge` + `ipcRenderer.invoke`
- **Node.js child_process** para spawn del proxy

## Comportamiento

- Manejar estado con `useState`/`useReducer` + props (sin Redux/Zustand a menos que se justifique).
- TypeScript estricto: cero `any`, preferir `unknown` + narrowing.
- **No tocar `index.js`** del proxy: es código heredado y la app de escritorio sólo lo gobierna.
- Cargar `mapping.tsv` desde `app.getAppPath()/resources/mapping.tsv` (la copia sincronizada en `desktop/resources/`), no hardcodear rutas.
- La API key de MiniMax **nunca** se persiste en la UI.
- Logging siempre a `stderr`/`userData/logs/`, nunca a `stdout` del renderer.

## Limitaciones

- **NO** usar frameworks distintos a React (no Vue, no Angular, no Svelte).
- **NO** introducir bases de datos locales (todo el estado del proxy vive en `mapping.tsv`).
- **NO** agregar Express al wrapper (Express ya está descartado; ver `index.js`).
- **NO** agregar tray icon, auto-updater ni autenticación en v1 (fuera de alcance).
- **NO** abrir puertos extra: el único puerto que abre el wrapper es el del proxy (45823).
- **NO** persistir credenciales ni logs sensibles del usuario en `localStorage` del renderer.

## Convenciones de Código

### Nomenclatura

- **Archivos del proyecto**: `kebab-case.ts` / `kebab-case.tsx` (ej: `power-button.tsx`, `proxy-lifecycle.ts`).
- **Componentes React**: `PascalCase` (ej: `PowerButton`, `LogsView`, `AppSidebar`).
- **Hooks**: prefijo `use` (ej: `useProxyState`, `useLogsStream`).
- **Handlers IPC**: prefijo `proxy:` o `logs:` (ej: `proxy:start`, `logs:append`).
- **Tipos/Interfaces**: `PascalCase` sin prefijo `I` (ej: `ProxyState`, `LogEntry`).

### Estructura de componentes

```tsx
// Descripción breve del componente.
// Props: ver interface PowerButtonProps.
// Renderiza: botón power rojo/verde según estado.
interface PowerButtonProps {
  state: ProxyState;
  onToggle: () => void;
}

export const PowerButton = ({ state, onToggle }: PowerButtonProps) => {
  return (
    <Button variant={state === 'running' ? 'default' : 'destructive'} onClick={onToggle}>
      <Power className="mr-2 h-4 w-4" />
      {state === 'running' ? 'Corriendo' : 'Apagado'}
    </Button>
  );
};
```

### Reglas TypeScript

- `strict: true` en `tsconfig.json`.
- Tipos compartidos entre main y renderer viven en `src/shared/types.ts`.
- Interfaces exportadas con `export interface` (no `export type` para objetos).
- Enums para estados finitos: `'off' | 'starting' | 'running' | 'stopping' | 'crashed'`.

### Estilos

- **Solo Tailwind** + clases de shadcn/ui.
- No crear archivos `.css` sueltos (excepto `globals.css` de shadcn).
- Tema oscuro por defecto (consistente con visor de logs).
- Componentes shadcn se agregan con `npx shadcn@latest add <name>`.

### Comentarios y documentación

- Toda función pública debe tener JSDoc breve (qué hace, params, return).
- Sin comentarios redundantes que describan lo obvio.
- Decisiones arquitectónicas no obvias se documentan en `US.md` (sección "Notas Técnicas"), no en el código.

### Git

- Una US = un commit (idealmente).
- Mensajes: `feat(scope): description` o `fix(scope): description`.
- Scope: `setup`, `shell`, `power`, `sidebar`, `logs`, `lifecycle`, `packaging`, `security`.

---

## Skills loaded

Este agente tiene disponible la skill **`customize-opencode`** para configuración interna de opencode. **No la uses para código de aplicación** del wrapper.
