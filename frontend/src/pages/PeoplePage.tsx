import { useState, useRef } from 'react'
import type { Person, Role } from '../types'
import { createPerson, updatePerson, deletePerson, reorderPeople } from '../api'
import { IconEdit, IconDelete } from '../components/Icons'

interface Props {
  people: Person[]
  roles: Role[]
  onRefresh: () => void
}

const empty = { name: '', role_id: null as number | null, sort_order: 0 }

const ROLE_BG = [
  '#eff6ff', // blue-50
  '#f0fdf4', // green-50
  '#fefce8', // yellow-50
  '#fff7ed', // orange-50
  '#fdf4ff', // fuchsia-50
  '#f0fdfa', // teal-50
  '#fff1f2', // rose-50
  '#f5f3ff', // violet-50
]

function roleBg(roleId: number | null, roles: Role[]): string | undefined {
  if (roleId === null) return undefined
  const idx = roles.findIndex(r => r.id === roleId)
  return idx >= 0 ? ROLE_BG[idx % ROLE_BG.length] : undefined
}

export default function PeoplePage({ people, roles, onRefresh }: Props) {
  const [editing, setEditing] = useState<Person | null>(null)
  const [form, setForm] = useState(empty)
  const [adding, setAdding] = useState(false)

  // drag state
  const dragId = useRef<number | null>(null)
  const [dropId, setDropId] = useState<number | null>(null)

  async function handleSave() {
    if (editing) await updatePerson(editing.id, form)
    else await createPerson(form)
    setEditing(null)
    setAdding(false)
    setForm(empty)
    onRefresh()
  }

  function onDragStart(id: number) { dragId.current = id }
  function onDragOver(e: React.DragEvent, id: number) { e.preventDefault(); if (dragId.current !== id) setDropId(id) }
  async function onDrop(targetId: number) {
    const sourceId = dragId.current
    if (sourceId === null || sourceId === targetId) { reset(); return }
    const ids = people.map(p => p.id)
    const from = ids.indexOf(sourceId), to = ids.indexOf(targetId)
    ids.splice(from, 1); ids.splice(to, 0, sourceId)
    reset()
    await reorderPeople(ids)
    onRefresh()
  }
  function reset() { dragId.current = null; setDropId(null) }

  async function handleDelete(id: number) {
    if (!confirm('Delete person? All their assignments will be removed.')) return
    await deletePerson(id)
    onRefresh()
  }

  function startEdit(p: Person) {
    setEditing(p)
    setForm({ name: p.name, role_id: p.role_id, sort_order: p.sort_order })
    setAdding(false)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">
          People <span className="text-gray-400 font-normal text-base">({people.length})</span>
        </h2>
        <button onClick={() => { setEditing(null); setForm(empty); setAdding(true) }}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          + Add person
        </button>
      </div>

      {(adding || editing) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{editing ? 'Edit person' : 'New person'}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.role_id ?? ''}
                onChange={e => setForm(f => ({ ...f, role_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">— no role —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setEditing(null); setAdding(false) }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="w-8 px-2 py-3" />
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr
                key={p.id}
                draggable
                onDragStart={() => onDragStart(p.id)}
                onDragOver={e => onDragOver(e, p.id)}
                onDrop={() => onDrop(p.id)}
                onDragEnd={reset}
                style={{ backgroundColor: dropId !== p.id ? roleBg(p.role_id, roles) : undefined }}
                className={`transition-colors ${dropId === p.id ? 'bg-indigo-50 border-t-2 border-indigo-400' : ''}`}
              >
                <td className="px-2 py-3 text-center cursor-grab text-gray-300 hover:text-gray-500 select-none">⠿</td>
                <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.role_name ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(p)} title="Edit" className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"><IconEdit /></button>
                    <button onClick={() => handleDelete(p.id)} title="Delete" className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><IconDelete /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
