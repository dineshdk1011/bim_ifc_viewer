"use client";

import dynamic from "next/dynamic";
const IFCViewer = dynamic(() => import("../components/IFCViewer"), {
  ssr: false,
});

export default function Page() {
  return (
    <main className="p-4 h-screen bg-slate-100">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">BIM IFC Viewer</h1>
        <p className="text-sm text-slate-600">
          Load .ifc, view & interact with your model.
        </p>
      </header>
      <IFCViewer />
    </main>
  );
}
