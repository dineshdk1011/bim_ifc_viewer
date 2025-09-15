// copies WebIFC runtime files into public/ifc so they are available after static export
import { copyFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const outDir = `${__dirname}/../public/ifc`;
mkdirSync(outDir, { recursive: true });

const candidates = [
  // web-ifc package (most common)
  ['../node_modules/web-ifc/web-ifc.wasm',            `${outDir}/web-ifc.wasm`],
  ['../node_modules/web-ifc/web-ifc-mt.wasm',         `${outDir}/web-ifc-mt.wasm`],
  ['../node_modules/web-ifc/web-ifc.wasm.wasm',       `${outDir}/web-ifc.wasm`],       // some versions publish with .wasm.wasm
  ['../node_modules/web-ifc/web-ifc-mt.wasm.wasm',    `${outDir}/web-ifc-mt.wasm`],
  ['../node_modules/web-ifc/web-ifc.worker.js',       `${outDir}/web-ifc.worker.js`],

  // fallback locations used by some @ifcjs versions
  ['../node_modules/web-ifc-three/wasm/web-ifc.wasm', `${outDir}/web-ifc.wasm`],
  ['../node_modules/web-ifc-three/wasm/web-ifc-mt.wasm', `${outDir}/web-ifc-mt.wasm`],
  ['../node_modules/web-ifc-three/wasm/web-ifc.worker.js', `${outDir}/web-ifc.worker.js`],
];

let copiedAny = false;
for (const [src, dest] of candidates) {
  try {
    copyFileSync(src, dest);
    copiedAny = true;
  } catch (_) { /* ignore missing variants */ }
}

if (!copiedAny) {
  console.warn(
    '⚠️ Could not find WebIFC runtime files in node_modules. ' +
    'Check your web-ifc/web-ifc-three/@ifcjs versions.'
  );
} else {
  console.log('✅ WebIFC files copied to public/ifc');
}
