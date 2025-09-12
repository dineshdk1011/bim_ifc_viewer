const fs = require("fs");
const path = require("path");

// Copy WASM files from web-ifc to public directory
const sourceDir = path.join(__dirname, "../node_modules/web-ifc/");
const destDir = path.join(__dirname, "../public/wasm/");

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// All required WASM and worker files for web-ifc-viewer
const filesToCopy = [
  "web-ifc.wasm",
  "web-ifc-mt.wasm",
  "web-ifc.worker.js",
  "web-ifc-mt.worker.js",
];

filesToCopy.forEach((file) => {
  const sourcePath = path.join(sourceDir, file);
  const destPath = path.join(destDir, file);

  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file} to public/wasm/`);
  } else {
    console.warn(`File ${file} not found in web-ifc package`);
  }
});
