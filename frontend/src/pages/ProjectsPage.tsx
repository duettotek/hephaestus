import { useState, useRef } from 'react'
import type { Project } from '../types'
import { createProject, updateProject, deleteProject, reorderProjects } from '../api'
import { projectInitials } from '../utils/dates'
import { IconEdit, IconDelete } from '../components/Icons'

interface Props {
  projects: Project[]
  onRefresh: () => void
}

const PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
]

export default function ProjectsPage({ projects, onRefresh }: Props) {
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState({ name: '', demand_days: 0, color: PALETTE[0], pattern_box_group: null as number | null, text_avatar: '' })
  const [adding, setAdding] = useState(false)

  // drag state
  const dragId   = useRef<number | null>(null)
  const [dropId, setDropId] = useState<number | null>(null)  // row being hovered over

  async function handleSave() {
    const payload = { ...form, text_avatar: form.text_avatar.trim() || null }
    if (editing) await updateProject(editing.id, payload)
    else await createProject(payload)
    setEditing(null)
    setAdding(false)
    setForm({ name: '', demand_days: 0, color: PALETTE[0], pattern_box_group: null, text_avatar: '' })
    onRefresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete project? All assignments for this project will be removed.')) return
    await deleteProject(id)
    onRefresh()
  }

  function startEdit(p: Project) {
    setEditing(p)
    setForm({ name: p.name, demand_days: p.demand_days, color: p.color, pattern_box_group: p.pattern_box_group, text_avatar: p.text_avatar ?? '' })
    setAdding(false)
  }

  function startAdd() {
    setEditing(null)
    setForm({ name: '', demand_days: 0, color: PALETTE[projects.length % PALETTE.length], pattern_box_group: null, text_avatar: '' })
    setAdding(true)
  }

  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  function onDragStart(id: number) {
    dragId.current = id
  }

  function onDragOver(e: React.DragEvent, id: number) {
    e.preventDefault()
    if (dragId.current !== id) setDropId(id)
  }

  async function onDrop(targetId: number) {
    const sourceId = dragId.current
    if (sourceId === null || sourceId === targetId) { reset(); return }

    const ids = projects.map(p => p.id)
    const from = ids.indexOf(sourceId)
    const to   = ids.indexOf(targetId)
    ids.splice(from, 1)
    ids.splice(to, 0, sourceId)

    reset()
    await reorderProjects(ids)
    onRefresh()
  }

  function reset() {
    dragId.current = null
    setDropId(null)
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Projects</h2>
        <button onClick={startAdd} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          + Add project
        </button>
      </div>

      {(adding || editing) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{editing ? 'Edit project' : 'New project'}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Project name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Demand (days)</label>
              <input type="number" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.demand_days}
                onChange={e => setForm(f => ({ ...f, demand_days: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pattern box group</label>
              <input type="number" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Optional"
                value={form.pattern_box_group ?? ''}
                onChange={e => setForm(f => ({ ...f, pattern_box_group: e.target.value === '' ? null : Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Avatar text</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. PR"
                maxLength={4}
                value={form.text_avatar}
                onChange={e => setForm(f => ({ ...f, text_avatar: e.target.value }))}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-1 ring-gray-500 scale-110' : 'hover:scale-105'}`}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-7 h-7 rounded-full cursor-pointer border-0 p-0"
                title="Custom color"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setEditing(null); setAdding(false) }} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="w-8 px-2 py-3" />
              <th className="text-left px-4 py-3">Project</th>
              <th className="text-left px-4 py-3">Pattern box group</th>
              <th className="text-right px-4 py-3">Demand (d)</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr
                key={p.id}
                draggable
                onDragStart={() => onDragStart(p.id)}
                onDragOver={e => onDragOver(e, p.id)}
                onDrop={() => onDrop(p.id)}
                onDragEnd={reset}
                style={{ backgroundColor: dropId !== p.id ? p.color + '18' : undefined }}
                className={`transition-colors ${dropId === p.id ? 'bg-indigo-50 border-t-2 border-indigo-400' : ''}`}
              >
                {/* Drag handle */}
                <td className="px-2 py-3 text-center cursor-grab text-gray-300 hover:text-gray-500 select-none">
                  ⠿
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold select-none"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.text_avatar || projectInitials(p.name)}
                    </span>
                    <span className="font-medium text-gray-800">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm">{p.pattern_box_group ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-right text-gray-600">{p.demand_days}d</td>
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
