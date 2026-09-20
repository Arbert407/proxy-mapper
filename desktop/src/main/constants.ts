/**
 * Opciones comunes para `child_process.spawn` del proxy.
 *
 * Usado por `startProxy()` (US-050) y cualquier otro spawn del child.
 * - `windowsHide: true`: en Windows evita que se abra una ventana de consola
 *   negra al lanzar `npm.cmd run dev`.
 */
export const PROXY_SPAWN_OPTIONS = {
  windowsHide: true,
} as const;
