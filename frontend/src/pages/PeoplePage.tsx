import { useState, useEffect, useRef } from 'react'
import type { Person, Role, Project } from '../types'
import { createPerson, updatePerson, deletePerson, reorderPeople } from '../api'
import { isoDate } from '../utils/dates'

interface Props {
  people: Person[]
  roles: Role[]
  projects: Project[]
  rangeStart: Date
  rangeEnd: Date
  onRefresh: () => void
}

const empty = { name: '', role_id: null as number | null, sprint_capacity: 10, pto_days: 0, sort_order: 0 }

export default function PeoplePage({ people, roles, projects, rangeStart, rangeEnd, onRefresh }: Props) {
  const [editing, setEditing] = useState<Person | null>(null)
  const [form, setForm] = useState(empty)
  const [adding, setAdding] = useState(false)
  const [ptoDaysMap, setPtoDaysMap] = useState<Map<number, number>>(new Map())

  // drag state
  const dragId = useRef<number | null>(null)
  const [dropId, setDropId] = useState<number | null>(null)

  const ptoProject = projects.find(p => p.name.toLowerCase() === 'pto')

  useEffect(() => {
    if (!ptoProject) return
    fetch(`/api/stats?date_from=${isoDate(rangeStart)}&date_to=${isoDate(rangeEnd)}`)
      .then(r => r.json())
      .then((data: { people: { person_id: number; by_project: Record<number, number> }[] }) => {
        const map = new Map<number, number>()
        data.people.forEach(ps => {
          map.set(ps.person_id, ps.by_project[ptoProject!.id] ?? 0)
        })
        setPtoDaysMap(map)
      })
  }, [ptoProject?.id, rangeStart, rangeEnd])

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
    setForm({ name: p.name, role_id: p.role_id, sprint_capacity: p.sprint_capacity, pto_days: p.pto_days, sort_order: p.sort_order })
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sprint capacity (days)</label>
              <input type="number" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.sprint_capacity}
                onChange={e => setForm(f => ({ ...f, sprint_capacity: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">PTO / BH this sprint (days)</label>
              <input type="number" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.pto_days}
                onChange={e => setForm(f => ({ ...f, pto_days: Number(e.target.value) }))}
              />
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
              <th className="text-right px-4 py-3">Capacity (d)</th>
              <th className="text-right px-4 py-3" title="Days assigned to the PTO project in the timeline">
                PTO (d)
                {ptoProject && <span className="ml-1 text-indigo-400">●</span>}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {people.map((p, i) => {
              const ptoDays = ptoDaysMap.get(p.id) ?? (ptoProject ? 0 : p.pto_days)
              return (
                <tr
                  key={p.id}
                  draggable
                  onDragStart={() => onDragStart(p.id)}
                  onDragOver={e => onDragOver(e, p.id)}
                  onDrop={() => onDrop(p.id)}
                  onDragEnd={reset}
                  className={`transition-colors ${
                    dropId === p.id
                      ? 'bg-indigo-50 border-t-2 border-indigo-400'
                      : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <td className="px-2 py-3 text-center cursor-grab text-gray-300 hover:text-gray-500 select-none">⠿</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.role_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.sprint_capacity}d</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {ptoDays > 0
                      ? <span className="font-medium text-amber-600">{ptoDays}d</span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(p)} className="text-indigo-600 hover:underline mr-3">Edit</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {ptoProject && (
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            <span className="text-indigo-400">●</span> PTO days counted from assignments to the <strong>{ptoProject.name}</strong> project · {isoDate(rangeStart)} – {isoDate(rangeEnd)}
          </div>
        )}
        {!ptoProject && (
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-amber-600">
            No project named "PTO" found — showing static pto_days field. Create a project named "PTO" to track it dynamically.
          </div>
        )}
      </div>
    </div>
  )
}
