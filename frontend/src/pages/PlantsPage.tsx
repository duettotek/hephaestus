import { useState } from 'react'
import type { Plant } from '../types'
import { createPlant, updatePlant, deletePlant } from '../api'
import { IconEdit, IconDelete } from '../components/Icons'

interface Props {
  plants: Plant[]
  onRefresh: () => void
}

export default function PlantsPage({ plants, onRefresh }: Props) {
  const [editing, setEditing] = useState<Plant | null>(null)
  const [form, setForm] = useState({ name: '', value_stream: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    if (!form.name.trim() || !form.value_stream.trim()) { setError('Both fields are required'); return }
    try {
      if (editing) await updatePlant(editing.id, form)
      else await createPlant(form)
      reset()
      onRefresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this plant?')) return
    await deletePlant(id)
    onRefresh()
  }

  function startEdit(p: Plant) {
    setEditing(p)
    setForm({ name: p.name, value_stream: p.value_stream })
    setAdding(false)
    setError('')
  }

  function startAdd() {
    setEditing(null)
    setForm({ name: '', value_stream: '' })
    setAdding(true)
    setError('')
  }

  function reset() {
    setEditing(null)
    setAdding(false)
    setForm({ name: '', value_stream: '' })
    setError('')
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Plants</h2>
        <button onClick={startAdd} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          + Add plant
        </button>
      </div>

      {(adding || editing) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{editing ? 'Edit plant' : 'New plant'}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. QDA"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Value stream</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. LF-R"
                value={form.value_stream}
                onChange={e => setForm(f => ({ ...f, value_stream: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={reset} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Value stream</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {plants.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-xs">No plants yet</td></tr>
            )}
            {plants.map((p, i) => (
              <tr key={p.id} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                <td className="px-4 py-3 text-gray-500">{p.value_stream}</td>
                <td className="px-4 py-3">
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
