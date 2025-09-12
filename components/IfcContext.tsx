'use client'
import { createContext, useContext } from 'react'
import type { IfcStore } from './useIfcModel'

export const IfcContext = createContext<IfcStore | null>(null)

export function useIfc() {
  const ctx = useContext(IfcContext)
  if (!ctx) throw new Error('useIfc must be used within <IfcProvider>')
  return ctx
}
