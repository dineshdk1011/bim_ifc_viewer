"use client";

import React, { useEffect, useRef, useState } from "react";
import { IfcViewerAPI } from "web-ifc-viewer";
import { Color, MeshBasicMaterial } from "three";

interface BucketState {
  typeId: number;
  name: string;
  visible: boolean;
  ids: number[];
  subsetCustomId: string;
}

const DEFAULT_BUCKETS: Record<string, number> = {
  Walls: 103090709, // IFCWALLSTANDARDCASE
  Slabs: 103090709, // reuse for simplicity, add more as needed
};

export default function IFCViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<IfcViewerAPI | null>(null);
  const modelIdRef = useRef<number | null>(null);

  const [buckets, setBuckets] = useState<Record<string, BucketState>>({});
  const [modelID, setModelID] = useState<number | null>(null);
  const [hoverText, setHoverText] = useState("");
  const [clickedInfo, setClickedInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasModelLoaded = () => modelID !== null;

  // reset viewer state
  const resetScene = () => {
    const v = viewerRef.current;
    if (!v) return;
    v.context.items.ifcModels.forEach((m) => {
      v.context.getScene().remove(m.mesh);
    });
    setBuckets({});
    setModelID(null);
    setClickedInfo(null);
    setHoverText("");
  };

  // handle file upload
  const handleFile = async (file: File) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    setError(null);
    setLoading(true);
    setHoverText("");
    setClickedInfo(null);

    try {
      if (!file.name.toLowerCase().endsWith(".ifc")) {
        throw new Error("Please select a .ifc file");
      }

      resetScene();

      const watchdog = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error("IFC parsing timed out")), 45000);
      });

      const loadPromise = viewer.IFC.loadIfc(file, true) as Promise<{
        modelID: number;
        mesh: any;
      }>;
      const model = await Promise.race([loadPromise, watchdog]).catch((e) => {
        console.error("loadIfc error:", e);
        return null;
      });

      if (!model)
        throw new Error(
          "Failed to load IFC (file invalid or timed out). Try a different sample."
        );

      const id = model.modelID;
      setModelID(id);
      modelIdRef.current = id;

      const newBuckets: Record<string, BucketState> = {};
      const scene = viewer.context.getScene();

      for (const [name, typeId] of Object.entries(DEFAULT_BUCKETS)) {
        try {
          const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            id,
            typeId,
            false
          );
          if (!ids?.length) continue;

          const subsetId = `subset-${name}`;
          const subset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: id,
            ids,
            scene,
            removePrevious: true,
            customID: subsetId,
          });
          if (subset) subset.visible = true;

          newBuckets[name] = {
            typeId,
            name,
            visible: true,
            ids,
            subsetCustomId: subsetId,
          };
        } catch {}
      }

      if (Object.keys(newBuckets).length === 0) model.mesh.visible = true;
      else model.mesh.visible = false;

      setBuckets(newBuckets);
      viewer.context.ifcCamera.fitModelToFrame();
    } catch (e: any) {
      setError(e?.message || "Error loading IFC.");
    } finally {
      setLoading(false);
    }
  };

  // load demo IFC from /public/demo/basic.ifc
  const handleLoadDemo = async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setError(null);
    setLoading(true);
    resetScene();

    try {
      const model = await viewer.IFC.loadIfcUrl("/demo/basic.ifc", true);
      const id = model.modelID;
      setModelID(id);
      modelIdRef.current = id;

      const newBuckets: Record<string, BucketState> = {};
      const scene = viewer.context.getScene();

      for (const [name, typeId] of Object.entries(DEFAULT_BUCKETS)) {
        try {
          const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            id,
            typeId,
            false
          );
          if (!ids?.length) continue;
          const subsetId = `subset-${name}`;
          const subset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: id,
            ids,
            scene,
            removePrevious: true,
            customID: subsetId,
          });
          if (subset) subset.visible = true;
          newBuckets[name] = {
            typeId,
            name,
            visible: true,
            ids,
            subsetCustomId: subsetId,
          };
        } catch {}
      }

      if (Object.keys(newBuckets).length === 0) model.mesh.visible = true;
      else model.mesh.visible = false;

      setBuckets(newBuckets);
      viewer.context.ifcCamera.fitModelToFrame();
    } catch (e: any) {
      setError(e?.message || "Failed to load demo IFC.");
    } finally {
      setLoading(false);
    }
  };

  // highlight (blink red)
  const blinkComponent = (bucket: BucketState) => {
    const viewer = viewerRef.current;
    if (!viewer || modelID == null) return;

    try {
      const subset = viewer.IFC.loader.ifcManager.getSubset(
        modelID,
        bucket.subsetCustomId
      );
      if (!subset) return;
      const original = subset.material;
      subset.material = new MeshBasicMaterial({ color: 0xff0000 });
      setTimeout(() => (subset.material = original), 800);
    } catch {}
  };

  // init viewer
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new IfcViewerAPI({ container: containerRef.current });
    viewer.context.getScene().background = new Color("#f8fafc");
    viewer.axes.setAxes();
    viewer.grid.setGrid();

    const ifcManager = viewer.IFC.loader.ifcManager;
    ifcManager.setWasmPath("/wasm/");

    // disable workers in dev
    try {
      ifcManager.useWebWorkers(false);
    } catch {}

    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, []);

  return (
    <div className="flex h-[90vh]">
      {/* Left panel */}
      <div className="w-64 p-3 bg-gray-100 border-r overflow-y-auto text-sm">
        <h2 className="font-bold mb-2">IFC Controls</h2>
        <p className="mb-2 text-gray-600">
          Load a .ifc and manage visibility/highlight.
        </p>

        <div className="flex gap-2 mb-3">
          <label className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-md cursor-pointer">
            Upload .ifc
            <input
              type="file"
              accept=".ifc"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
            />
          </label>
          <button
            onClick={handleLoadDemo}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md"
          >
            Load Demo
          </button>
        </div>

        <button
          onClick={() => viewerRef.current?.context.ifcCamera.fitModelToFrame()}
          className="text-sm mb-3 px-3 py-1.5 rounded-md bg-gray-300 hover:bg-gray-400"
        >
          Fit View
        </button>

        {loading && <p className="text-blue-600 mb-2">Loading IFC…</p>}
        {error && <p className="text-red-600 mb-2">{error}</p>}

        <h3 className="font-semibold mb-2">Components</h3>
        {Object.values(buckets).length === 0 && (
          <p className="text-gray-500 mb-2">
            Buckets will appear here after loading a model.
          </p>
        )}

        {Object.values(buckets).map((b) => (
          <div key={b.name} className="flex justify-between items-center mb-1">
            <span>{b.name}</span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const v = viewerRef.current;
                  if (!v || modelID == null) return;
                  const subset = v.IFC.loader.ifcManager.getSubset(
                    modelID,
                    b.subsetCustomId
                  );
                  if (subset) subset.visible = !b.visible;
                  setBuckets((prev) => ({
                    ...prev,
                    [b.name]: { ...b, visible: !b.visible },
                  }));
                }}
                className="text-xs px-2 py-0.5 bg-gray-300 hover:bg-gray-400 rounded"
              >
                {b.visible ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => blinkComponent(b)}
                className="text-xs px-2 py-0.5 bg-red-500 text-white hover:bg-red-600 rounded"
              >
                Highlight
              </button>
            </div>
          </div>
        ))}

        {clickedInfo && (
          <div className="mt-4 p-2 bg-white border rounded">
            <h4 className="font-semibold">Clicked Info</h4>
            <pre className="text-xs">
              {JSON.stringify(clickedInfo, null, 2)}
            </pre>
          </div>
        )}

        {hoverText && (
          <div className="mt-2 p-2 bg-yellow-50 border rounded">
            <p className="text-xs">Hover: {hoverText}</p>
          </div>
        )}
      </div>

      {/* Viewer container */}
      <div className="flex-1" ref={containerRef}></div>
    </div>
  );
}
