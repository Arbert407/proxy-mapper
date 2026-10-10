# Proxy Mapper — Wrapper Desktop

Aplicación de escritorio (Electron + React + TypeScript) que envuelve al proxy HTTP
[`proxy-mapper`](../proxy/) como un botón de encendido/apagado con visor de logs
y editor de mappings.

> **Lee primero**: [`AGENTS.md`](../AGENTS.md) (convenciones de código) y
> [`WORKFLOW.md`](../WORKFLOW.md) (flujo de trabajo con US).

---

## Tabla de Contenidos

- [Prerrequisitos](#prerrequisitos)
- [Instalación](#instalación)
- [Desarrollo](#desarrollo)
- [Build](#build)
- [Empaquetado y distribución](#empaquetado-y-distribución)
- [Smoke test post-build](#smoke-test-post-build)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Troubleshooting](#troubleshooting)

---

## Prerrequisitos

| Herramienta | Versión | Notas |
|---|---|---|
| Node.js | 20.x o superior | Usar la LTS. Verificar con `node --version`. |
| npm | 10.x o superior | Viene con Node 20. |
| Windows | 10 (build 1809+) o 11 | Target del wrapper. |
| Developer Mode (opcional) | — | Solo requerido para `npm run package:win`. Ver [Troubleshooting](./README.md#cannot-create-symbolic-link-en-7zaexe). |

> **Nota Linux/macOS**: el wrapper es **solo Windows**. En otras plataformas el
> proxy puede correr standalone (`node ../proxy/index.js`), pero la app
> desktop no se empaqueta.

---

## Instalación

Clonar el repo y luego instalar dependencias **del wrapper** (en `desktop/`) y
**del proxy** (en `proxy/`):

```bash
# desde la raíz del repo
cd desktop
npm install
```

Eso es suficiente para `dev` y `build`. El proxy no necesita `npm install` en
desarrollo (solo tiene `crypto` y `http` de Node stdlib — sin dependencias
externas); `proxy/package.json` existe solo para `package.json` versionado y
scripts auxiliares.

> **No commitees `node_modules/`**: ya está en `.gitignore` raíz y
> `desktop/.gitignore`.

---

## Desarrollo

### `npm run dev`

Arranca Vite + el main process de Electron con HMR en el renderer.

```bash
cd desktop
npm run dev
```

- **Vite dev server**: `http://localhost:5173/` (HMR para el renderer).
- **Devtools**: se abre automáticamente en modo detached.
- **Hot reload**: editar archivos en `src/renderer/` recarga la vista sin
  perder estado del proxy. Editar `src/main/` o `src/preload/` reinicia
  Electron completo.
- **Logs en vivo**: `%APPDATA%\proxy-mapper-desktop\logs\app.log` (la app lo
  crea al primer arranque).

Para detener: `Ctrl+C` en la terminal o cerrar la ventana.

---

## Build

### `npm run build`

Compila `src/main/`, `src/preload/` y `src/renderer/` a `desktop/dist/`. **No
genera instalador**, solo el árbol de archivos listo para empaquetar o
inspeccionar.

```bash
cd desktop
npm run build
```

**Hooks automáticos**:
- `prebuild` → corre `copy-proxy` (sincroniza `../proxy/` → `desktop/proxy/`,
  que es el bundle que se inyecta en el instalador como `extraResources`).

**Output**:
```
desktop/dist/
├── main/index.js          # main process bundleado
├── preload/index.js       # preload bundleado
├── renderer/              # assets estáticos del frontend
│   ├── index.html
│   └── assets/
└── (icon.ico y demás)     # electron-builder mete otros archivos en package:win
```

**Tipos de errores comunes**:
- `TS2xxx`: TypeScript strict fallando. Resolver antes de empaquetar.
- `Cannot find module '@shared/...'`: alias roto. Ver `vite.config.ts`.

### `npm run clean:dist`

Borra `desktop/dist/` recursivamente. **Crítico** antes de `package:win` para
evitar el bug de auto-inclusión recursiva (cada build previo quedaría dentro
del `app.asar` del nuevo build, inflándolo a >400 MB).

```bash
cd desktop
npm run clean:dist
```

`package:win` lo corre automáticamente vía `prepackage:win`.

### `npm run app:dir`

Smoke test rápido: compila y descomprime el binario **sin** generar
instalador. Útil para verificar que la app abre y los IPC handlers
responden, sin esperar los 3-5 min de un instalador NSIS.

```bash
cd desktop
npm run app:dir
```

**Output**: `desktop/dist/win-unpacked/Proxy Mapper.exe`. Doble click y se
abre.

### `npm run app:dist`

Corre todos los targets que `electron-builder.yml` defina (NSIS + portable por
default) sin pasar flags.

```bash
cd desktop
npm run app:dist
```

> **No usar en CI/release**: `app:dist` puede tomar el target del OS actual
> y tratar de generar `.dmg`/`.AppImage` en máquinas no-Windows. Para releases
> usar `package:win` (siempre Windows-only).

---

## Empaquetado y distribución

### `npm run package:win` (recomendado)

Compila y genera **instalador NSIS** + **portable .exe** en `desktop/dist/`.

```bash
cd desktop
npm run package:win
```

**Pipeline interno**:
1. `clean:dist` — borra builds previos.
2. `build` — compila TypeScript + Vite.
3. `electron-builder --win --publish never` — genera los 2 artefactos.

**Output esperado**:
| Archivo | Tamaño típico | Ubicación |
|---|---|---|
| `Proxy Mapper Setup <version>.exe` | ~67 MB | `desktop/dist/` |
| `Proxy Mapper-<version>-portable.exe` | ~67 MB | `desktop/dist/` |
| `win-unpacked/` (testing) | ~250 MB | `desktop/dist/` |

> **Límite GitHub Releases**: 100 MB por archivo. Ambos artefactos caben.

### Script alternativo: solo el portable

```powershell
# desde la raíz del repo
.\desktop\scripts\package-portable.ps1            # fast mode (~2-3 min, +30% tamaño)
.\desktop\scripts\package-portable.ps1 -Fast:$false # max compression (~7-10 min)
```

El script es equivalente a `clean:dist` + `build` + `electron-builder --win
portable --publish never` pero aísla la variable `ELECTRON_BUILDER_COMPRESSION_LEVEL`.

---

## Smoke test post-build

Después de generar el instalador o el portable, verificar:

### Instalador NSIS

1. Doble click en `Proxy Mapper Setup <version>.exe`.
2. Wizard debería ofrecer carpeta de instalación (default: `%LOCALAPPDATA%\Programs\proxy-mapper-desktop`).
3. Completar instalación.
4. Verificar:
   - [ ] Icono del taskbar muestra `icon.ico` (no el genérico de Electron).
   - [ ] Ventana abre sin devtools.
   - [ ] Botón Power arranca en rojo ("Apagado").
   - [ ] Al presionar Power, arranca el proxy y queda verde ("Corriendo").
   - [ ] `%APPDATA%\proxy-mapper-desktop\proxy\` contiene `index.js`, `package.json`, `mapping.tsv`.
   - [ ] Logs visibles en `%APPDATA%\proxy-mapper-desktop\logs\app.log`.

### Portable

1. Copiar `Proxy Mapper-<version>-portable.exe` a una carpeta temporal.
2. Ejecutar.
3. Mismas verificaciones que el NSIS (excepto icono del taskbar, que el
   portable no instala).

### Mapping.tsv post-arranque

Después del primer arranque del binario (instalador o portable), `%APPDATA%\proxy-mapper-desktop\proxy\mapping.tsv` debe existir y estar vacío (si es la primera vez) o contener los pares de la sesión anterior (persiste entre reinicios, updates y reinstalaciones).

---

## Estructura del proyecto

```
desktop/
├── src/
│   ├── main/          # Electron main process (Node.js + IPC handlers)
│   ├── preload/       # contextBridge — expone API segura al renderer
│   ├── renderer/      # React 18 + shadcn/ui (UI)
│   └── shared/        # Tipos y utils compartidos main↔renderer
├── scripts/           # Build helpers (no se compilan al asar)
│   ├── clean-dist.js
│   ├── copy-proxy.js
│   └── package-portable.ps1
├── resources/         # Assets estáticos (icon.ico)
├── electron-builder.yml  # Config de empaquetado (NSIS, portable, asar)
├── vite.config.ts     # Config de Vite (renderer + main + preload)
├── tsconfig.json      # TS strict para src/
├── tsconfig.node.json # TS para vite.config.ts y scripts/*.js
└── package.json
```

Ver detalles de cada archivo en [`STACK.md`](../STACK.md#estructura-del-proyecto).

---

## Troubleshooting

Errores comunes durante build y empaquetado. Para más detalle ver
[`docs/build-troubleshooting.md`](../docs/build-troubleshooting.md).

### `npm install` falla con `gyp ERR! find Python`

Windows no tiene Python instalado (necesario para compilar módulos nativos
de Electron). Solución: usar el `windows-build-tools` o instalar Python 3 +
Visual Studio Build Tools.

### `Cannot create symbolic link` en `7za.exe`

`electron-builder` usa `7za.exe` (de `7zip-bin`) para empaquetar el portable.
En Windows sin **Developer Mode** habilitado, `7za.exe` no puede crear los
symlinks que `winCodeSign` necesita. Solución: habilitar Developer Mode en
Windows Settings → Privacy & security → For developers, o ejecutar el script
con permisos de admin.

### `app.asar` inflado (>400 MB)

Probablemente `desktop/dist/` de un build previo quedó incluido. Solución:
`npm run clean:dist` antes de `package:win` (ya lo hace `prepackage:win`, pero
si invocás `electron-builder` directo se saltea el hook).

### `Error: Cannot find module '@shared/...'`

El alias `@shared` está definido en `vite.config.ts` pero `tsconfig.json` no
lo conoce. Verificar que `tsconfig.json` tiene:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

### Proxy no arranca: `index.js no encontrado en <path>`

Bug de path en `src/main/proxy.ts` o `src/main/proxy-bootstrap.ts`.
Verificar que `resolveAppRoot()` y `getBundleProxyDir()` apuntan a:
- **Dev**: `<repo>/proxy/` (un nivel arriba de `desktop/`).
- **Packaged**: `process.resourcesPath/proxy/`.

Más detalles en [`docs/build-troubleshooting.md`](../docs/build-troubleshooting.md).
