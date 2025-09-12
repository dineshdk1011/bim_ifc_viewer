
const fs = require('fs');
const path = require('path');

function safeCopy(src, dest) {
  try {
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      console.log('Copied', src, '->', dest);
    }
  } catch (e) {
    console.warn('Copy failed for', src, e.message);
  }
}

const root = process.cwd();
const pub = path.join(root, 'public', 'ifc');
const wasm1 = path.join(root, 'node_modules', 'web-ifc', 'web-ifc.wasm');
const wasm2 = path.join(root, 'node_modules', 'web-ifc', 'web-ifc-mt.wasm');
const worker = path.join(root, 'node_modules', 'web-ifc-three', 'IFCWorker.js');

safeCopy(wasm1, path.join(pub, 'web-ifc.wasm'));
safeCopy(wasm2, path.join(pub, 'web-ifc-mt.wasm'));
safeCopy(worker, path.join(pub, 'IFCWorker.js'));
