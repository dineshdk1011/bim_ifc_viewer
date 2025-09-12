# BIM IFC Viewer (Next.js + TypeScript)

A minimal BIM IFC viewer with:
- Load local `.ifc`
- 3D controls (orbit / pan / zoom)
- Component list with show / hide
- Highlight (blink red) per component
- Optional metadata on click (HUD)
- Responsive UI, error states
- No backend required

## Tech
Next.js 14 (App Router) + TypeScript, TailwindCSS, React Three Fiber (`@react-three/fiber`), `@react-three/drei`, IFC.js (`web-ifc` + `web-ifc-three`).

## Getting Started
```bash
# install deps
npm i    # or: npm i / yarn

# run dev
npm dev  # http://localhost:3000
```

## Build
```bash
npm build && npm start
```

## Deploy (Vercel)
1. Push to GitHub.
2. Import repo on vercel.com → Framework: **Next.js** → Deploy.
3. No environment variables required.

## Notes
- WASM files for `web-ifc` are loaded from `/` (public). Next serves `/public` at the app root.
- Tested with React 18 / Next 14 / Three r160.

## Shortcuts (optional ideas)
- Press **H** to re-highlight last selection, etc. (not implemented by default)


## Troubleshooting (Windows / npm)
If you see an error like `BatchedMesh is not exported from 'three'`, ensure you are using the pinned versions in `package.json` (Three 0.149 + three-stdlib 2.23.9 + three-mesh-bvh 0.6.10).

If install gets stuck, delete `node_modules` and `package-lock.json`, then run:
```
npm install
npm run dev
```

This project copies IFC WASM/worker files on `postinstall` to `public/ifc/`. If you run into WASM path issues, verify those files exist and that `useIfcModel.ts` calls:
```ts
loader.ifcManager.setWasmPath('/ifc/')
```
