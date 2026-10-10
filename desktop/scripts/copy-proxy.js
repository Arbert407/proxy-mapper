/**
 * scripts/copy-proxy.js - Sincroniza los archivos del proxy dentro del wrapper.
 *
 * Source: raiz del repo (../index.js, ../package.json) + starter local
 *         (./mapping.tsv starter, generado si no existe).
 * Target: desktop/proxy/ — los incluye electron-builder via `files` y
 *         `asarUnpack` (ver electron-builder.yml).
 *
 * NOTA: mapping.tsv arranca VACIO. Cada instalacion del wrapper tendra
 * su propio archivo en userData (ver proxy-bootstrap.ts) que se llena
 * con los mapeos del usuario via la UI. El starter embebido es solo un
 * fallback para entornos portables donde el bundle debe ser auto-suficiente
 * (no se filtra el `mapping.tsv` del dev al distribuir).
 *
 * Por que un script y no symlinks:
 * - electron-builder a veces rompe symlinks al empacar (asar/asarUnpack).
 * - Windows no soporta symlinks sin privilegios de admin.
 * - El script es explicito y debuggeable.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const TARGET_DIR = path.join(__dirname, '..', 'proxy');
const FILES = ['index.js', 'package.json'];
const MAPPING_STARTER = 'mapping.tsv';

fs.mkdirSync(TARGET_DIR, { recursive: true });

for (const name of FILES) {
  const src = path.join(REPO_ROOT, name);
  const dst = path.join(TARGET_DIR, name);
  if (!fs.existsSync(src)) {
    console.error(`[copy-proxy] FAIL: source not found: ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, dst);
}

const mappingDst = path.join(TARGET_DIR, MAPPING_STARTER);
if (!fs.existsSync(mappingDst)) {
  fs.writeFileSync(mappingDst, '', 'utf-8');
}

console.log(`[copy-proxy] OK: copied ${FILES.length} files + starter ${MAPPING_STARTER} to ${TARGET_DIR}`);