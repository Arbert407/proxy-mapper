/**
 * scripts/clean-dist.js - Borra desktop/dist/ antes de empaquetar.
 *
 * Por que existe:
 *   electron-builder.yml incluye `dist` recursivo en el asar. Si el dist/
 *   ya contiene artefactos de builds previos (instaladores, portable,
 *   win-unpacked), estos se empaquetan recursivamente en el nuevo build,
 *   inflando el tamano varias veces (470 MB observado vs ~155 MB esperado).
 *
 * Uso:
 *   node scripts/clean-dist.js
 *
 * Idempotente: si dist/ no existe, no hace nada.
 */
const fs = require('node:fs');
const path = require('node:path');

const target = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(target)) {
  console.log('[clean-dist] dist/ no existe, nada que borrar');
  process.exit(0);
}

fs.rmSync(target, { recursive: true, force: true });
console.log(`[clean-dist] OK: borrado ${target}`);
