import { useState } from 'react'
import type { Role } from '../types'
import { createRole, updateRole, deleteRole } from '../api'
import { IconEdit, IconDelete } from '../components/Icons'

const ROLE_BG = [
  '#eff6ff',
  '#f0fdf4',
  '#fefce8',
  '#fff7ed',
  '#fdf4ff',
  '#f0fdfa',
  '#fff1f2',
  '#f5f3ff',
]

interface Props {
  roles: Role[]
  onRefresh: () => void
}

const empty = { name: '', multiplier: 1.0 }

export default function RolesPage({ roles, onRefresh }: Props) {
  const [editing, setEditing] = useState<Role | null>(null)
  const [form, setForm] = useState(empty)
  const [adding, setAdding] = useState(false)

  async function handleSave() {
    if (editing) {
      await updateRole(editing.id, form)
    } else {
      await createRole(form)
    }
    setEditing(null)
    setAdding(false)
    setForm(empty)
    onRefresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete role? People assigned this role will lose it.')) return
    await deleteRole(id)
    onRefresh()
  }

  function startEdit(r: Role) {
    setEditing(r)
    setForm({ name: r.name, multiplier: r.multiplier })
    setAdding(false)
  }

  function startAdd() {
    setEditing(null)
    setForm(empty)
    setAdding(true)
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Roles</h2>
        <button onClick={startAdd} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          + Add role
        </button>
      </div>

      {(adding || editing) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{editing ? 'Edit role' : 'New role'}</h3>
          <div className="flex gap-3">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Role name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <input
              type="number" step="0.25" min="0" max="3"
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Multiplier"
              value={form.multiplier}
              onChange={e => setForm(f => ({ ...f, multiplier: parseFloat(e.target.value) }))}
            />
            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save</button>
            <button onClick={() => { setEditing(null); setAdding(false) }} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-right px-4 py-3">Multiplier</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {roles.map((r, i) => (
              <tr key={r.id} style={{ backgroundColor: ROLE_BG[i % ROLE_BG.length] }}>
                <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                <td className="px-4 py-3 text-right text-gray-600">{r.multiplier}×</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(r)} title="Edit" className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"><IconEdit /></button>
                    <button onClick={() => handleDelete(r.id)} title="Delete" className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><IconDelete /></button>
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
