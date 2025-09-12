"use client";
import { useState } from "react";
import IfcViewer from "@/components/IfcViewer";
import ComponentPanel from "@/components/ComponentPanel";
import { IfcContext } from "@/components/IfcContext";
import { useIfcModel } from "@/components/useIfcModel";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const store = useIfcModel();

  return (
    <IfcContext.Provider value={store}>
      {/* Horizontal workspace, full viewport, no outer scroll */}
      <main className="flex h-[100dvh] overflow-hidden">
        {/* LEFT: fixed 300px, its own scroll */}
        <aside className="w-[300px] flex-none border-r bg-white p-3 overflow-y-auto">
          <ComponentPanel />
        </aside>

        {/* RIGHT: viewer fills all remaining space */}
        <section className="relative flex-1 min-w-0">
          {/* floating file picker */}
          <div className="absolute z-10 m-3 flex gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 shadow">
              <span className="text-sm font-medium">Load IFC</span>
              <input
                type="file"
                accept=".ifc"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {/* canvas area */}
          <div className="absolute inset-0">
            <IfcViewer file={file} />
          </div>
        </section>
      </main>
    </IfcContext.Provider>
  );
}
