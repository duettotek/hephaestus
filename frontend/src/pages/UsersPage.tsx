import { useEffect, useState } from 'react'
import { getUsers, createUser, deleteUser, adminSetPassword, changePassword, type UserRecord } from '../api'
import { IconEdit, IconDelete } from '../components/Icons'

interface Props {
  currentUsername: string
}

interface PasswordDialog {
  user: UserRecord
  isSelf: boolean
  currentPw: string
  newPw: string
  confirmPw: string
  error: string
}

export default function UsersPage({ currentUsername }: Props) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [adding, setAdding] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [addError, setAddError] = useState('')
  const [pwDialog, setPwDialog] = useState<PasswordDialog | null>(null)

  async function load() {
    setUsers(await getUsers())
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    setAddError('')
    if (!newUsername.trim() || !newPassword.trim()) { setAddError('Username and password are required'); return }
    try {
      await createUser(newUsername.trim(), newPassword)
      setAdding(false)
      setNewUsername('')
      setNewPassword('')
      load()
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Error creating user')
    }
  }

  async function handleDelete(user: UserRecord) {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return
    await deleteUser(user.id)
    load()
  }

  function openPwDialog(user: UserRecord) {
    setPwDialog({ user, isSelf: user.username === currentUsername, currentPw: '', newPw: '', confirmPw: '', error: '' })
  }

  async function handleSavePassword() {
    if (!pwDialog) return
    if (!pwDialog.newPw) { setPwDialog(d => d ? { ...d, error: 'New password is required' } : d); return }
    if (pwDialog.newPw !== pwDialog.confirmPw) { setPwDialog(d => d ? { ...d, error: 'Passwords do not match' } : d); return }
    try {
      if (pwDialog.isSelf) {
        if (!pwDialog.currentPw) { setPwDialog(d => d ? { ...d, error: 'Current password is required' } : d); return }
        await changePassword(pwDialog.currentPw, pwDialog.newPw)
      } else {
        await adminSetPassword(pwDialog.user.id, pwDialog.newPw)
      }
      setPwDialog(null)
    } catch (e: unknown) {
      setPwDialog(d => d ? { ...d, error: e instanceof Error ? e.message : 'Failed to update password' } : d)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Users</h2>
        <button onClick={() => { setAdding(true); setAddError('') }} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          + Add user
        </button>
      </div>

      {adding && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">New user</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Username</label>
              <input autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="username"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Password</label>
              <input type="password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              />
            </div>
          </div>
          {addError && <p className="text-xs text-red-500 mb-2">{addError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setAddError('') }} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Create</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Username</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {u.username}
                  {u.username === currentUsername && (
                    <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">you</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openPwDialog(u)} title="Change password" className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors">
                      <IconEdit />
                    </button>
                    {u.username !== currentUsername && (
                      <button onClick={() => handleDelete(u)} title="Delete user" className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                        <IconDelete />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Change password dialog */}
      {pwDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25" onClick={e => { if (e.target === e.currentTarget) setPwDialog(null) }}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <p className="text-sm font-semibold text-gray-800 mb-1">Change password</p>
            <p className="text-xs text-gray-400 mb-4">{pwDialog.user.username}</p>
            <div className="space-y-3">
              {pwDialog.isSelf && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Current password</label>
                  <input type="password"
                    autoFocus
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="••••••••"
                    value={pwDialog.currentPw}
                    onChange={e => setPwDialog(d => d ? { ...d, currentPw: e.target.value, error: '' } : d)}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">New password</label>
                <input type="password"
                  autoFocus={!pwDialog.isSelf}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="••••••••"
                  value={pwDialog.newPw}
                  onChange={e => setPwDialog(d => d ? { ...d, newPw: e.target.value, error: '' } : d)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Confirm new password</label>
                <input type="password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="••••••••"
                  value={pwDialog.confirmPw}
                  onChange={e => setPwDialog(d => d ? { ...d, confirmPw: e.target.value, error: '' } : d)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSavePassword() }}
                />
              </div>
              {pwDialog.error && <p className="text-xs text-red-500">{pwDialog.error}</p>}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setPwDialog(null)} className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleSavePassword} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
