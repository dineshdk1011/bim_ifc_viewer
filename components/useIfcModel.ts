'use client'

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

export function useIfcModel(): IfcStore {
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rootGroupRef = useRef<THREE.Object3D | null>(null)
  const loaderRef = useRef<IFCLoader | null>(null)
  const modelIDRef = useRef<number>(0)

  const [items, setItems] = useState<IfcItem[]>([])
  const [ready, setReady] = useState(false)
  const [lastPicked, setLastPicked] = useState<{ id: number; name?: string; type?: string } | null>(null)

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
    if (!sceneRef.current || !rootGroupRef.current) return
    sceneRef.current.remove(rootGroupRef.current)
    rootGroupRef.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if ((mesh as any).isMesh) mesh.geometry?.dispose?.()
    })
    rootGroupRef.current = null
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

      await buildIndex()
    } finally {
      URL.revokeObjectURL(url)
    }
  }, [disposePrevious, buildIndex])

  const setVisible = useCallback((id: number, visible: boolean) => {
    if (!loaderRef.current) return
    const mgr: any = loaderRef.current.ifcManager
    try {
      if (mgr?.ifcAPI?.ToggleItemsVisibility) {
        mgr.ifcAPI.ToggleItemsVisibility(modelIDRef.current, [id], !!visible)
      } else if (sceneRef.current) {
        // subset fallback
        if (!visible) {
          const mat = new THREE.MeshBasicMaterial({ visible: false })
          mgr.createSubset({ modelID: modelIDRef.current, ids: [id], material: mat, scene: sceneRef.current, removePrevious: false })
        } else {
          const tmp = new THREE.MeshBasicMaterial({ visible: true })
          try {
            mgr.createSubset({ modelID: modelIDRef.current, ids: [id], material: tmp, scene: sceneRef.current, removePrevious: true })
            mgr.removeSubset(modelIDRef.current, tmp)
          } finally { tmp.dispose() }
        }
      }
    } catch (e) {
      console.warn('Visibility toggle failed', e)
    }
  }, [])

  const blink = useCallback(async (id: number, durationMs = 1500) => {
    if (!loaderRef.current || !sceneRef.current) return
    const mgr: any = loaderRef.current.ifcManager
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 })
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
