"use client";

import { useCallback, useRef, useState } from 'react'
import * as THREE from 'three'
import { IFCLoader } from 'web-ifc-three/IFCLoader'
import {
  IFCBUILDING, IFCBUILDINGSTOREY, IFCSPACE,
  IFCWALL, IFCWALLSTANDARDCASE, IFCSLAB, IFCROOF,
  IFCBEAM, IFCCOLUMN, IFCDOOR, IFCWINDOW,
  IFCOPENINGELEMENT, IFCFURNISHINGELEMENT
} from 'web-ifc'

export type IfcItem = { id: number; name: string; type: string }

export type IfcStore = {
  ready: boolean
  items: IfcItem[]
  lastPicked: { id: number; name?: string; type?: string } | null
  init: (scene: THREE.Scene) => void
  loadFile: (file: File) => Promise<void>
  setVisible: (id: number, visible: boolean) => void
  blink: (id: number, durationMs?: number) => Promise<void>
  pickAt: (coords: { x: number; y: number }, camera: THREE.Camera) => Promise<{ id: number; props: any } | null>
}

const BASE_ID = 'BASE_VISIBLE'

export function useIfcModel(): IfcStore {
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rootGroupRef = useRef<THREE.Object3D | null>(null)
  const loaderRef = useRef<IFCLoader | null>(null)
  const modelIDRef = useRef<number>(0)

  const [items, setItems] = useState<IfcItem[]>([])
  const [ready, setReady] = useState(false)
  const [lastPicked, setLastPicked] = useState<{ id: number; name?: string; type?: string } | null>(null)

  // NEW: base-subset state
  const baseMatRef = useRef<THREE.Material | null>(null)
  const baseActiveRef = useRef<boolean>(false)
  const allIdsRef = useRef<number[]>([])
  const hiddenRef = useRef<Set<number>>(new Set())

  const init = useCallback((scene: THREE.Scene) => {
    sceneRef.current = scene
    if (!loaderRef.current) {
      if (typeof window !== 'undefined') {
        ;(window as any).__web_ifc_wasm_location__ = '/ifc/web-ifc.wasm'
      }
      const loader = new IFCLoader()
      loader.ifcManager.setWasmPath('/ifc/')
      ;(loader.ifcManager as any).setWorkerPath?.('/ifc/')
      loaderRef.current = loader
    }
    setReady(true)
  }, [])

  const disposePrevious = useCallback(() => {
    const mgr: any = loaderRef.current?.ifcManager
    if (modelIDRef.current && mgr) {
      try { mgr.removeSubset(modelIDRef.current, undefined, BASE_ID) } catch {}
    }

    if (sceneRef.current && rootGroupRef.current) {
      sceneRef.current.remove(rootGroupRef.current)
      rootGroupRef.current.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if ((mesh as any).isMesh) {
          mesh.geometry?.dispose?.()
          const m = mesh.material as any
          m?.dispose?.()
        }
      })
    }
    rootGroupRef.current = null
    baseMatRef.current = null
    baseActiveRef.current = false
    allIdsRef.current = []
    hiddenRef.current.clear()
    setItems([])
    setLastPicked(null)
  }, [])

  const buildIndex = useCallback(async () => {
    const mgr: any = loaderRef.current!.ifcManager
    const modelID = modelIDRef.current

    // Try "all items" first
    try {
      const all = await mgr.getAllItemsOfType(modelID, null, true)
      if (Array.isArray(all) && all.length) {
        setItems(all.map((it: any) => ({
          id: it.expressID,
          name: it?.Name?.value || `#${it.expressID}`,
          type: it?.type || 'IFCENTITY'
        })))
        return
      }
    } catch { /* ignore */ }

    // Fallback: query common IFC numeric constants
    const TYPES = [
      IFCBUILDING, IFCBUILDINGSTOREY, IFCSPACE,
      IFCWALL, IFCWALLSTANDARDCASE, IFCSLAB, IFCROOF,
      IFCBEAM, IFCCOLUMN, IFCDOOR, IFCWINDOW,
      IFCOPENINGELEMENT, IFCFURNISHINGELEMENT
    ]

    const seen = new Set<number>()
    const rows: IfcItem[] = []
    for (const t of TYPES) {
      try {
        const arr = await mgr.getAllItemsOfType(modelID, t, true)
        if (Array.isArray(arr)) {
          for (const it of arr) {
            const eid = it.expressID
            if (!seen.has(eid)) {
              seen.add(eid)
              rows.push({
                id: eid,
                name: it?.Name?.value || `#${eid}`,
                type: it?.type || String(t)
              })
            }
          }
        }
      } catch { /* skip type on failure */ }
    }
    setItems(rows)
  }, [])

  // NEW: rebuild the base subset from (allIds - hidden)
  const rebuildBaseSubset = useCallback(() => {
    if (!loaderRef.current || !sceneRef.current) return
    const mgr: any = loaderRef.current.ifcManager
    const modelID = modelIDRef.current
    if (modelID == null || !baseMatRef.current) return

    const visibleIds = allIdsRef.current.filter(id => !hiddenRef.current.has(id))
    mgr.createSubset({
      modelID,
      ids: visibleIds,
      material: baseMatRef.current,
      scene: sceneRef.current,
      removePrevious: true,
      customID: BASE_ID,
    })
  }, [])

  const loadFile = useCallback(async (file: File) => {
    if (!loaderRef.current || !sceneRef.current) return
    disposePrevious()

    const url = URL.createObjectURL(file)
    try {
      const group = await new Promise<THREE.Object3D>((resolve, reject) => {
        loaderRef.current!.load(url, (obj) => resolve(obj), undefined, (err) => reject(err))
      })
      rootGroupRef.current = group
      sceneRef.current.add(group)

      const mgr: any = loaderRef.current.ifcManager
      const models = mgr?.models ?? []
      modelIDRef.current = models[0]?.modelID ?? 0

      // --- gather all IDs that have geometry (prefer Representation) ---
      const ids: number[] = []
      try {
        const all = await mgr.getAllItemsOfType(modelIDRef.current, null, true)
        if (Array.isArray(all)) {
          for (const it of all) if (it?.Representation) ids.push(it.expressID)
        }
      } catch {
        // (ok, we'll just keep ids empty and let fallback handle)
      }

      allIdsRef.current = ids

      // If we found any IDs, build the base subset and hide original mesh
      if (ids.length > 0) {
        baseMatRef.current = new THREE.MeshPhongMaterial({ color: 0xffffff })
        baseActiveRef.current = true
        rebuildBaseSubset()
        // hide original IFC meshes so only subsets draw
        rootGroupRef.current.traverse(o => ((o as any).visible = false))
      } else {
        // keep original mesh visible; base subset flow is inactive
        baseActiveRef.current = false
      }

      await buildIndex()
    } finally {
      URL.revokeObjectURL(url)
    }
  }, [disposePrevious, buildIndex, rebuildBaseSubset])

  // ►► ONLY THIS PART IS WHAT YOUR BUTTONS CALL
  const setVisible = useCallback((id: number, visible: boolean) => {
    if (!loaderRef.current || !sceneRef.current) return
    const mgr: any = loaderRef.current.ifcManager
    const modelID = modelIDRef.current
    if (modelID == null) return

    if (baseActiveRef.current) {
      // maintain hidden set then rebuild base subset
      if (visible) hiddenRef.current.delete(id)
      else hiddenRef.current.add(id)
      try { rebuildBaseSubset() } catch (e) { console.warn('rebuild failed', e) }
      return
    }

    // Fallback: per-ID hidden subset (keeps original mesh visible)
    try {
      if (!visible) {
        const mat = new THREE.MeshBasicMaterial({ visible: false })
        mgr.createSubset({
          modelID,
          ids: [id],
          material: mat,
          scene: sceneRef.current,
          removePrevious: true,
          customID: `HIDE_${id}`,
        })
      } else {
        try { mgr.removeSubset(modelID, undefined, `HIDE_${id}`) } catch {}
      }
    } catch (e) {
      const msg = String((e as any)?.message || e)
      if (!msg.includes('Model without geometry')) {
        console.warn('Visibility toggle failed', e)
      }
    }
  }, [rebuildBaseSubset])

  const blink = useCallback(async (id: number, durationMs = 1500) => {
    if (!loaderRef.current || !sceneRef.current) return
    const mgr: any = loaderRef.current.ifcManager
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.45, depthWrite: false })
    try {
      mgr.createSubset({ modelID: modelIDRef.current, ids: [id], material: mat, scene: sceneRef.current, removePrevious: true })
      await new Promise((r) => setTimeout(r, durationMs))
    } finally {
      try { mgr.removeSubset(modelIDRef.current, mat) } catch {}
      mat.dispose()
    }
  }, [])

  const pickAt = useCallback(async (coords: { x: number; y: number }, camera: THREE.Camera) => {
    if (!loaderRef.current || !rootGroupRef.current) return null
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(coords as any, camera)
    const hit = raycaster.intersectObject(rootGroupRef.current, true)[0]
    if (!hit) return null
    const faceIndex = hit.faceIndex ?? 0
    const id = loaderRef.current.ifcManager.getExpressId(hit.object as any, faceIndex)
    const props = await loaderRef.current.ifcManager.getItemProperties(modelIDRef.current, id, true)
    setLastPicked({ id, name: props?.Name?.value, type: props?.type })
    return { id, props }
  }, [])

  return { ready, items, lastPicked, init, loadFile, setVisible, blink, pickAt }
}
