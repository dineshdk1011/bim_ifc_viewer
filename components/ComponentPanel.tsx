'use client'
import { useState, useMemo } from 'react'
import { useIfc } from './IfcContext'

export default function ComponentPanel() {
  const { items, setVisible, blink } = useIfc()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return items.slice(0, 1000)
    return items.filter(i => (i.name?.toLowerCase()?.includes(q) || i.type?.toLowerCase()?.includes(q))).slice(0, 1000)
  }, [items, query])

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-lg">Components</h2>
      <input
        placeholder="Search by name/type…"
        className="w-full rounded-lg border px-3 py-2"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="space-y-2">
        {filtered.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{it.name}</div>
              <div className="truncate text-xs text-gray-500">{it.type} • #{it.id}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setVisible(it.id, true)} className="rounded bg-gray-100 px-2 py-1 text-xs">Show</button>
              <button onClick={() => setVisible(it.id, false)} className="rounded bg-gray-100 px-2 py-1 text-xs">Hide</button>
              <button onClick={() => blink(it.id)} className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white">Highlight</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
