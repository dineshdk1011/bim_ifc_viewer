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
  Walls: 100000001,
  Slabs: 100000002,
  Doors: 100000003,
  Windows: 100000004,
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
  const [viewerInitialized, setViewerInitialized] = useState(false);

  // reset viewer state
  const resetScene = () => {
    const v = viewerRef.current;
    if (!v) return;

    // Clear existing models
    if (v.context?.items?.ifcModels) {
      v.context.items.ifcModels.forEach((model) => {
        if (v.context?.scene && model.mesh) {
          v.context.scene.remove(model.mesh);
        }
      });
      v.context.items.ifcModels = [];
    }

    setBuckets({});
    setModelID(null);
    modelIdRef.current = null;
    setClickedInfo(null);
    setHoverText("");
  };

  // handle file upload
  const handleFile = async (file: File) => {
    if (!viewerRef.current || !viewerInitialized) {
      setError("Viewer not initialized yet");
      return;
    }

    setError(null);
    setLoading(true);
    setHoverText("");
    setClickedInfo(null);

    try {
      if (!file.name.toLowerCase().endsWith(".ifc")) {
        throw new Error("Please select a .ifc file");
      }

      resetScene();

      const viewer = viewerRef.current;

      // Debug: Log WASM path and check if WASM is loaded
      try {
        const ifcManager = viewer.IFC.loader.ifcManager;
        // @ts-ignore
        console.log("WASM path:", ifcManager.wasmPath || ifcManager._wasmPath);
        // @ts-ignore
        if (ifcManager.wasmModule) {
          console.log(
            "WASM module present:",
            Object.keys(ifcManager.wasmModule)
          );
        } else {
          console.warn("WASM module not loaded yet");
        }
      } catch (wasmErr) {
        console.error("Error checking WASM module:", wasmErr);
      }

      // Load IFC file with timeout
      let model;
      try {
        const loadPromise = viewer.IFC.loadIfc(file, false);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("IFC loading timed out")), 30000)
        );
        model = await Promise.race([loadPromise, timeoutPromise]);
      } catch (ifcErr) {
        console.error("Error loading IFC:", ifcErr);
        setError(
          "Error loading IFC: " +
            (ifcErr instanceof Error ? ifcErr.message : String(ifcErr))
        );
        setLoading(false);
        return;
      }

      const id = (model as any).modelID;
      if (!id) throw new Error("Failed to load model - no model ID returned");

      setModelID(id);
      modelIdRef.current = id;

      // Create buckets for different element types
      const newBuckets: Record<string, BucketState> = {};
      const scene = viewer.context.scene;

      for (const [name, typeId] of Object.entries(DEFAULT_BUCKETS)) {
        try {
          const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            id,
            typeId,
            false
          );

          if (!ids || ids.length === 0) continue;

          const subsetId = `subset-${name}-${Date.now()}`;

          // Create subset
          const subset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: id,
            ids,
            scene,
            removePrevious: true,
            customID: subsetId,
            material: new MeshBasicMaterial({
              color: new Color(Math.random() * 0xffffff),
              transparent: true,
              opacity: 0.8,
            }),
          });

          if (subset) {
            subset.visible = true;
            newBuckets[name] = {
              typeId,
              name,
              visible: true,
              ids,
              subsetCustomId: subsetId,
            };
          }
        } catch (err) {
          console.warn(`Could not create subset for ${name}:`, err);
        }
      }

      // Hide original mesh if we have subsets
      if (Object.keys(newBuckets).length > 0) {
        (model as any).mesh.visible = false;
      }

      setBuckets(newBuckets);

      if (viewer.clipper) {
        viewer.clipper.deleteAllPlanes();
      }

      if (viewer.context?.ifcCamera) {
        viewer.context.ifcCamera.fitModelToFrame();
      }
    } catch (e: any) {
      console.error("Error loading IFC:", e);
      setError(
        e?.message || "Error loading IFC file. Please try another file."
      );
    } finally {
      setLoading(false);
    }
  };

  // load demo IFC
  const handleLoadDemo = async () => {
    if (!viewerRef.current || !viewerInitialized) {
      setError("Viewer not initialized yet");
      return;
    }

    setError(null);
    setLoading(true);
    resetScene();

    try {
      const viewer = viewerRef.current;

      // Try to load demo file
      const model = await viewer.IFC.loadIfcUrl("/demo/basic.ifc", false);
      const id = (model as any).modelID;

      if (!id) throw new Error("Failed to load demo model");

      setModelID(id);
      modelIdRef.current = id;

      const newBuckets: Record<string, BucketState> = {};
      const scene = viewer.context.scene;

      for (const [name, typeId] of Object.entries(DEFAULT_BUCKETS)) {
        try {
          const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            id,
            typeId,
            false
          );

          if (!ids || ids.length === 0) continue;

          const subsetId = `subset-${name}-${Date.now()}`;
          const subset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: id,
            ids,
            scene,
            removePrevious: true,
            customID: subsetId,
            material: new MeshBasicMaterial({
              color: new Color(Math.random() * 0xffffff),
              transparent: true,
              opacity: 0.8,
            }),
          });

          if (subset) {
            subset.visible = true;
            newBuckets[name] = {
              typeId,
              name,
              visible: true,
              ids,
              subsetCustomId: subsetId,
            };
          }
        } catch (err) {
          console.warn(`Could not create subset for ${name}:`, err);
        }
      }

      if (Object.keys(newBuckets).length > 0) {
        (model as any).mesh.visible = false;
      }

      setBuckets(newBuckets);

      if (viewer.clipper) {
        viewer.clipper.deleteAllPlanes();
      }

      if (viewer.context?.ifcCamera) {
        viewer.context.ifcCamera.fitModelToFrame();
      }
    } catch (e: any) {
      console.error("Error loading demo:", e);
      setError(
        e?.message ||
          "Failed to load demo IFC. Make sure /demo/basic.ifc exists."
      );
    } finally {
      setLoading(false);
    }
  };

  // highlight component
  const blinkComponent = (bucket: BucketState) => {
    const viewer = viewerRef.current;
    if (!viewer || modelID == null) return;

    try {
      const subset = viewer.IFC.loader.ifcManager.getSubset(
        modelID,
        bucket.subsetCustomId
      );

      if (!subset) return;

      const originalMaterial = subset.material;
      const highlightMaterial = new MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.7,
      });

      subset.material = highlightMaterial;

      setTimeout(() => {
        if (subset) {
          subset.material = originalMaterial;
        }
      }, 800);
    } catch (err) {
      console.warn("Error highlighting component:", err);
    }
  };

  // init viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const initializeViewer = async () => {
      try {
        const viewer = new IfcViewerAPI({
          container: containerRef.current!,
        });

        // Set background color after initialization
        if (viewer.context && viewer.context.getScene) {
          viewer.context.getScene().background = new Color(0xf8fafc);
        }

        // Set up viewer components
        if (viewer.axes && viewer.axes.setAxes) {
          viewer.axes.setAxes();
        }

        if (viewer.grid && viewer.grid.setGrid) {
          viewer.grid.setGrid();
        }

        const ifcManager = viewer.IFC.loader.ifcManager;

        // Set WASM path
        ifcManager.setWasmPath("/wasm/");

        // For older versions, we don't need to call init()
        // The WASM should load automatically when needed

        // Disable web workers for better compatibility
        ifcManager.useWebWorkers(false);

        viewerRef.current = viewer;
        setViewerInitialized(true);
      } catch (err) {
        console.error("Failed to initialize viewer:", err);
        setError(
          "Failed to initialize 3D viewer. The browser may not support WebGL or there are version conflicts."
        );
      }
    };

    initializeViewer();

    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.dispose();
        } catch (err) {
          console.warn("Error disposing viewer:", err);
        }
        viewerRef.current = null;
      }
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

        {!viewerInitialized && (
          <p className="text-yellow-600 mb-2">Initializing viewer...</p>
        )}

        <div className="flex gap-2 mb-3">
          <label className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            Upload .ifc
            <input
              type="file"
              accept=".ifc"
              className="hidden"
              disabled={!viewerInitialized || loading}
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
                e.target.value = ""; // Reset input
              }}
            />
          </label>
          <button
            onClick={handleLoadDemo}
            disabled={!viewerInitialized || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load Demo
          </button>
        </div>

        <button
          onClick={() =>
            viewerRef.current?.context.ifcCamera?.fitModelToFrame()
          }
          disabled={modelID === null}
          className="text-sm mb-3 px-3 py-1.5 rounded-md bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Fit View
        </button>

        {loading && <p className="text-blue-600 mb-2">Loading IFC…</p>}
        {error && <p className="text-red-600 mb-2">{error}</p>}

        <h3 className="font-semibold mb-2">Components</h3>
        {Object.values(buckets).length === 0 && modelID !== null && (
          <p className="text-gray-500 mb-2">
            No components found or model loaded without subsets.
          </p>
        )}
        {modelID === null && (
          <p className="text-gray-500 mb-2">Load a model to see components.</p>
        )}

        {Object.values(buckets).map((b) => (
          <div
            key={b.name}
            className="flex justify-between items-center mb-2 p-1 bg-white rounded"
          >
            <span className="font-medium">{b.name}</span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const v = viewerRef.current;
                  if (!v || modelID == null) return;
                  const subset = v.IFC.loader.ifcManager.getSubset(
                    modelID,
                    b.subsetCustomId
                  );
                  if (subset) {
                    subset.visible = !b.visible;
                    setBuckets((prev) => ({
                      ...prev,
                      [b.name]: { ...b, visible: !b.visible },
                    }));
                  }
                }}
                className="text-xs px-2 py-1 bg-gray-300 hover:bg-gray-400 rounded"
              >
                {b.visible ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => blinkComponent(b)}
                className="text-xs px-2 py-1 bg-red-500 text-white hover:bg-red-600 rounded"
              >
                Highlight
              </button>
            </div>
          </div>
        ))}

        {clickedInfo && (
          <div className="mt-4 p-2 bg-white border rounded">
            <h4 className="font-semibold">Clicked Element Info</h4>
            <pre className="text-xs overflow-auto max-h-32">
              {JSON.stringify(clickedInfo, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Viewer container */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full"></div>
        {hoverText && (
          <div className="absolute top-2 left-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
            <p className="text-sm">Hover: {hoverText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
