/**
 * Opciones comunes para `child_process.spawn` del proxy.
 *
 * Usado por `startProxy()` (US-050) y el escalado a `taskkill` (US-051).
 * - `windowsHide: true`: en Windows evita que se abra una ventana de consola
 *   negra al lanzar `npm.cmd run dev`.
 *
 * Nota: `cross-spawn` se encarga del escape de argumentos y del wrapping
 * `cmd.exe /c` para `.cmd`/`.bat`, por lo que no hace falta `shell: true`
 * ni `windowsVerbatimArguments`.
 */
export const PROXY_SPAWN_OPTIONS = {
  windowsHide: true,
} as const;
