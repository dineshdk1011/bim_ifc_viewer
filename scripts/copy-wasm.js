const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");

const srcCandidates = [
  path.join(projectRoot, "node_modules", "web-ifc"),
  path.join(projectRoot, "node_modules", "web-ifc", "dist"),
];

const destPrimary = path.join(projectRoot, "public", "wasm");
const destNextChunks = path.join(
  projectRoot,
  "public",
  "_next",
  "static",
  "chunks",
  "wasm"
);

const files = [
  "web-ifc.wasm",
  "web-ifc-mt.wasm",
  "web-ifc.wasm.map",
  "web-ifc.worker.js",
  "web-ifc-mt.worker.js",
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function findSrcDir() {
  for (const d of srcCandidates) {
    if (fs.existsSync(d)) return d;
  }
  return null;
}

function copyFileIfExists(fromDir, toDir, file) {
  const src = path.join(fromDir, file);
  const dst = path.join(toDir, file);

  if (!fs.existsSync(src)) {
    console.warn(`Missing: ${file} in ${fromDir}`);
    return false;
  }

  ensureDir(toDir);
  fs.copyFileSync(src, dst);
  console.log(`Copied ${file} -> ${toDir.replace(projectRoot, "") || "."}`);
  return true;
}

function main() {
  const srcDir = findSrcDir();
  if (!srcDir) {
    console.error("Could not find node_modules/web-ifc. Did you run `npm i`?");
    process.exit(1);
  }

  let copiedAny = false;
  for (const f of files) {
    copiedAny = copyFileIfExists(srcDir, destPrimary, f) || copiedAny;
    // Mirror to the path Next dev sometimes uses
    copiedAny = copyFileIfExists(srcDir, destNextChunks, f) || copiedAny;
  }

  if (!copiedAny) {
    console.error("No WASM files were copied.");
    process.exit(1);
  } else {
    console.log(
      "WASM files ready in /public/wasm and mirrored to /public/_next/static/chunks/wasm"
    );
  }
}

main();
