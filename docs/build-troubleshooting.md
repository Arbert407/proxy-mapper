# Build Troubleshooting

Recopilación de errores comunes durante el build, empaquetado y ejecución
del wrapper Electron. Cada sección describe el síntoma, la causa raíz y la
solución. Para issues no listados acá, abrir un issue en GitHub con el log
completo de `electron-builder` (vía flag `--debug` o `--projectDir`).

> **Convención**: los paths asumen Windows. Ajustar separadores para
> otras plataformas si el lector las usa (sabiendo que el wrapper NO se
> empaqueta fuera de Windows).

---

## Tabla de Contenidos

- [Errores de `npm install`](#errores-de-npm-install)
- [Errores de `npm run build`](#errores-de-npm-run-build)
- [Errores de `npm run package:win`](#errores-de-npm-run-packagewin)
  - [Cannot create symbolic link en 7za.exe](#cannot-create-symbolic-link-en-7zaexe)
  - [app.asar inflado (>400 MB)](#appasar-inflado-400-mb)
  - [El portable no incluye proxy/index.js](#el-portable-no-incluye-proxyindexjs)
- [Errores en runtime (desarrollo)](#errores-en-runtime-desarrollo)
  - [Proxy no arranca: index.js no encontrado](#proxy-no-arranca-indexjs-no-encontrado)
  - [Mappings no se persisten entre reinicios](#mappings-no-se-persisten-entre-reinicios)
- [Errores en runtime (producción)](#errores-en-runtime-producción)
  - [La app no abre después de instalar](#la-app-no-abre-después-de-instalar)
  - [El icono del taskbar es el genérico de Electron](#el-icono-del-taskbar-es-el-genérico-de-electron)

---

## Errores de `npm install`

### `gyp ERR! find Python` durante `node-gyp`

**Síntoma**: el install falla con:
```
gyp ERR! find Python
gyp ERR! find Python did not find a usable version of Python
```

**Causa**: Windows no tiene Python 3 instalado, necesario para compilar
módulos nativos (e.g. `better-sqlite3`, `node-gyp-build`).

**Solución**:
1. Instalar [Python 3.10+](https://www.python.org/downloads/) (tildar
   "Add to PATH" en el instalador).
2. Instalar [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   con el workload "Desktop development with C++".
3. Reintentar `npm install`.

**Alternativa rápida**: si no necesitás los módulos nativos en dev,
`npm install --ignore-scripts` (no recomendado, puede romper funcionalidades).

---

## Errores de `npm run build`

### `TS2xxx`: TypeScript strict fallando

**Síntoma**: `tsc -p tsconfig.json --noEmit` falla con errores de tipos.

**Causa**: el código no satisface `strict: true` de `tsconfig.json` (no
implicit any, strict null checks, etc.).

**Solución**:
1. Leer el error: el archivo y línea están en el output.
2. Resolver el tipo propiamente (no usar `as any` para silenciar).
3. Si el tipo viene de una API externa sin typings, declarar un
   `*.d.ts` con `unknown` + narrowing.

### `Cannot find module '@shared/...'`

**Síntoma**: TypeScript o Vite no resuelve imports `@shared/types`.

**Causa**: el alias `@shared` está definido en `vite.config.ts` pero no en
`tsconfig.json`.

**Solución**: verificar que `tsconfig.json` tiene:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

### El `prebuild` hook falla al copiar el proxy

**Síntoma**:
```
[copy-proxy] ERROR: no se encontró <path>/proxy/index.js
```

**Causa**: `desktop/scripts/copy-proxy.js` busca `../proxy/` (raíz del
repo) y no lo encuentra. Probablemente el repo está clonado sin la carpeta
`proxy/` o se borró por accidente.

**Solución**:
1. Verificar que existe `<repo>/proxy/index.js`. Si no, restaurar.
2. Si moviste el proxy a otra ubicación, actualizar `REPO_ROOT` en
   `desktop/scripts/copy-proxy.js:23`.

---

## Errores de `npm run package:win`

### `Cannot create symbolic link` en `7za.exe`

**Síntoma**: el build aborta con:
```
Error: EACCES: permission denied, symlink '...\winCodeSign\...' 
  at ...\node_modules\7zip-bin\win\x64\7za.exe
```

**Causa**: `electron-builder` usa `7za.exe` para empaquetar el portable y
los `winCodeSign` symlinks. Windows requiere **Developer Mode** habilitado
para que un proceso no-elevado cree symlinks.

**Solución**:
- **Recomendada**: Settings → Privacy & security → For developers →
  Developer Mode = On. Reintentar.
- **Alternativa**: ejecutar la terminal con permisos de admin (NO recomendado
  para CI; el hook falla igual si la máquina CI no tiene el modo).

**Nota histórica**: el bug se documentó en `US.md:680` (nota técnica de
US-070). El `package-portable.ps1` incluye un wrapper C# con `WaitForExit(15min)`
que mitiga parcialmente el problema.

### `app.asar` inflado (>400 MB)

**Síntoma**: el instalador NSIS pesa >400 MB en vez de ~67 MB.

**Causa**: el `dist/` de un build previo no se borró antes de empaquetar.
`electron-builder` incluyó recursivamente TODO el contenido de `dist/`
(incluido el instalador anterior y `win-unpacked/`), creando un loop de
auto-inclusión.

**Solución**:
1. `npm run clean:dist` (lo borra recursivamente).
2. `npm run package:win` de nuevo.

**Por qué pasa**: el hook `prepackage:win` corre `clean:dist`, pero si
invocás `electron-builder` directamente (sin pasar por `npm run`), se
saltea el hook. El `package.json:18` incluye `clean:dist` explícitamente
en el script por defensa:
```json
"package:win": "npm run clean:dist && npm run build && electron-builder --win --publish never"
```

### El portable no incluye `proxy/index.js`

**Síntoma**: el portable arranca pero el botón Power queda en "Crashed" o
"Apagado", y `app.log` muestra:
```
bootstrap: fallo al copiar index.js: ENOENT: no such file or directory,
copyfile '...\resources\proxy\index.js' -> '...\userData\proxy\index.js'
```

**Causa**: el `extraResources` apunta a una carpeta vacía o el 7z del
portable excluye los `.js`.

**Solución A — verificar extraResources**:
En `desktop/electron-builder.yml`:
```yaml
extraResources:
  - from: '../proxy'
    to: 'proxy'
```

Confirmar que `../proxy` (relativo a `desktop/electron-builder.yml`) existe
y contiene `index.js`, `package.json`, `mapping.tsv`.

**Solución B — `preCompressedFileExtensions` mal configurado**:
NO incluir `preCompressedFileExtensions` con `.js` en el bloque `nsis:`.
Electron-builder lo aplica al 7z del portable como `excluded: ['*.js',...]`,
eliminando todos los `.js` del archivo.

```yaml
# MAL — borra *.js del portable
nsis:
  preCompressedFileExtensions: [.css, .html, .js, .svg]
```

Más detalles en `US.md:683-704` (nota técnica de US-070).

---

## Errores en runtime (desarrollo)

### Proxy no arranca: `index.js no encontrado`

**Síntoma**: al presionar Power, el botón vuelve a "Apagado" y `app.log`
muestra:
```
[ERROR] startProxy: index.js no encontrado en <path>/proxy
[ERROR] bootstrap: fallo al copiar index.js: ENOENT
```

**Causa**: los paths en `src/main/proxy.ts`, `src/main/mappings.ts` o
`src/main/proxy-bootstrap.ts` están desfasados. En dev, `app.getAppPath()`
retorna `desktop/` (no `desktop/dist/main/`), así que para llegar a
`<repo>/proxy/` hay que subir **1** nivel, no 2.

**Paths correctos**:

| Función | Path dev correcto |
|---|---|
| `proxy.ts:resolveAppRoot()` | `resolve(app.getAppPath(), '..', 'proxy')` |
| `mappings.ts:resolveMappingPath()` | `join(app.getAppPath(), '..', 'proxy', 'mapping.tsv')` |
| `proxy-bootstrap.ts:getBundleProxyDir()` | `join(app.getAppPath(), '..', 'proxy')` |
| `version.ts:readVersions()` (proxy pkg) | `join(mainDir, '../../../proxy/package.json')` |

> **Nota**: `version.ts` usa `mainDir = __dirname` (que en dev ES
> `desktop/dist/main/`, no `app.getAppPath()`), por eso ahí sí son 3 `..`.

**Cómo verificarlo**: agregar un `logger.debug` al inicio de
`resolveAppRoot()` y ver qué path retorna en dev. Comparar con
`fs.existsSync(retval)`.

### Mappings no se persisten entre reinicios

**Síntoma**: agregar pares en la UI, cerrar la app, reabrir → los pares
desaparecieron.

**Causa A**: la app está corriendo en dev (`npm run dev`) y los mappings
se guardan en `<repo>/proxy/mapping.tsv`. Si el dev está en una rama con
ese archivo en `.gitignore` y se commitea mal, podría sobrescribirse.

**Causa B**: la app está empaquetada pero `%APPDATA%\proxy-mapper-desktop\proxy\mapping.tsv`
se borra manualmente o se está corriendo con un userData temporal.

**Solución**:
- En dev: el mapping.tsv está en `<repo>/proxy/mapping.tsv`. Verificar que
  el archivo se está actualizando con `Get-Content -Wait`.
- En prod: `%APPDATA%\proxy-mapper-desktop\proxy\mapping.tsv`. Verificar que
  no esté en una sesión temporal (e.g. `RUNAS /user:...`).

---

## Errores en runtime (producción)

### La app no abre después de instalar

**Síntoma**: doble click en el acceso directo del NSIS no hace nada, o
abre y cierra inmediatamente.

**Causa A — instalador corrupto**: el instalador NSIS no terminó bien
(antivirus lo interrumpió, disco lleno, etc.).

**Causa B — dependencia faltante**: Electron requiere WebView2 runtime
en Windows 10. En Windows 11 viene preinstalado; en Windows 10 build < 1809
falta.

**Causa C — puerto 45823 ocupado**: si otro proceso usa el puerto, el
proxy falla al arrancar y la app podría mostrar el botón en estado
"Crashed" permanentemente. Pero esto no debería impedir la apertura.

**Solución**:
1. Verificar el log: `%APPDATA%\proxy-mapper-desktop\logs\app.log`.
2. Si está vacío, ejecutar `Proxy Mapper.exe` desde la carpeta de
   instalación en una terminal para ver stdout/stderr.
3. En Windows 10, instalar manualmente
   [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### El icono del taskbar es el genérico de Electron

**Síntoma**: tras instalar, el icono del taskbar muestra el logo de
Electron, no `icon.ico` de la app.

**Causa**: `AppUserModelId` no se está seteando, o el .exe no tiene el
icono embebido.

**Solución**:
1. Verificar que `desktop/src/main/index.ts` tiene:
   ```ts
   app.setAppUserModelId('com.anomaly.proxy-mapper-desktop');
   ```
2. Verificar que `desktop/electron-builder.yml` tiene:
   ```yaml
   appId: com.anomaly.proxy-mapper-desktop
   win:
     icon: resources/icon.ico
   ```
3. Si el icono sigue sin verse, cerrar sesión de Windows y reabrir (el
   cache de iconos del taskbar se refresca con un nuevo login).

Más detalles en `US.md:742` (nota técnica de US-073).

---

## Recursos adicionales

- [Electron Builder docs](https://www.electron.build/)
- [Electron troubleshooting](https://www.electronjs.org/docs/latest/tutorial/troubleshooting)
- [Vite troubleshooting](https://vite.dev/guide/troubleshooting.html)
- [NSIS error codes](https://nsis.sourceforge.io/Docs/Chapter4.html#flags)
- [Repo US.md](./../US.md) (notas técnicas de cada US que introdujo cambios)
