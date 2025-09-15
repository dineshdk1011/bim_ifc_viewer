"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import { useIfc } from "./IfcContext";
import { IFCLoader } from "web-ifc-three/IFCLoader";

export default function IfcViewer({ file }: { file: File | null }) {
  const ifcLoader = new IFCLoader();
  ifcLoader.ifcManager.setWasmPath("/ifc/");
  const { ready, init, loadFile } = useIfc();

  return (
    <div className="h-full w-full" style={{ height: "100%", width: "100%" }}>
      <Canvas
        className="block h-full w-full"
        style={{ display: "block", height: "100%", width: "100%" }}
        dpr={[1, 2]}
        camera={{ position: [10, 10, 10], fov: 45 }}
        onCreated={({ scene }) => init(scene)}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} />
        <gridHelper args={[100, 100]} />
        <axesHelper args={[2]} />
        <OrbitControls makeDefault enableDamping />
        <LoaderOverlay file={file} onLoad={loadFile} ready={ready} />
      </Canvas>
    </div>
  );
}

function LoaderOverlay({
  file,
  onLoad,
  ready,
}: {
  file: File | null;
  onLoad: (f: File) => Promise<void>;
  ready: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "loaded">(
    "idle"
  );
  const currentFile = useMemo(() => file, [file]);

  useEffect(() => {
    let cancelled = false;
    if (currentFile && ready) {
      setStatus("loading");
      onLoad(currentFile)
        .then(() => !cancelled && setStatus("loaded"))
        .catch(() => !cancelled && setStatus("error"));
    } else {
      setStatus("idle");
    }
    return () => {
      cancelled = true;
    };
  }, [currentFile, ready, onLoad]);

  if (status === "loading") {
    return (
      <Html center>
        <div
          style={{
            borderRadius: 12,
            background: "rgba(255,255,255,0.9)",
            padding: "8px 12px",
            boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
          }}
        >
          Loading IFC…
        </div>
      </Html>
    );
  }
  if (status === "error") {
    return (
      <Html center>
        <div
          style={{
            borderRadius: 12,
            background: "#fef2f2",
            color: "#b91c1c",
            padding: "8px 12px",
            boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
          }}
        >
          Failed to load IFC. Please try another file.
        </div>
      </Html>
    );
  }
  return null;
}
