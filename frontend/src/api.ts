import type { Role, Person, Project, Plant, Assignment } from './types'

const BASE = '/api'

export function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

export function setToken(token: string) {
  localStorage.setItem('auth_token', token)
}

export function clearToken() {
  localStorage.removeItem('auth_token')
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { headers, ...init })
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Auth
export const login = (username: string, password: string) => {
  const body = new URLSearchParams({ username, password })
  return fetch(`${BASE}/auth/login`, { method: 'POST', body }).then(async res => {
    if (!res.ok) throw new Error(await res.text())
    return res.json() as Promise<{ access_token: string; token_type: string }>
  })
}

export const getMe = () => json<{ username: string }>(`${BASE}/auth/me`)

export const changePassword = (current_password: string, new_password: string) =>
  json(`${BASE}/auth/password`, { method: 'PUT', body: JSON.stringify({ current_password, new_password }) })

// User management
export interface UserRecord { id: number; username: string; is_active: boolean }
export const getUsers = () => json<UserRecord[]>(`${BASE}/users`)
export const createUser = (username: string, password: string) =>
  json<UserRecord>(`${BASE}/users`, { method: 'POST', body: JSON.stringify({ username, password }) })
export const adminSetPassword = (user_id: number, new_password: string) =>
  json(`${BASE}/users/${user_id}/password`, { method: 'PUT', body: JSON.stringify({ new_password }) })
export const deleteUser = (user_id: number) =>
  json(`${BASE}/users/${user_id}`, { method: 'DELETE' })

// Plants
export const getPlants = () => json<Plant[]>(`${BASE}/plants`)
export const createPlant = (data: Omit<Plant, 'id'>) => json<Plant>(`${BASE}/plants`, { method: 'POST', body: JSON.stringify(data) })
export const updatePlant = (id: number, data: Omit<Plant, 'id'>) => json<Plant>(`${BASE}/plants/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deletePlant = (id: number) => json(`${BASE}/plants/${id}`, { method: 'DELETE' })

// Roles
export const getRoles = () => json<Role[]>(`${BASE}/roles`)
export const createRole = (data: Omit<Role, 'id'>) => json<Role>(`${BASE}/roles`, { method: 'POST', body: JSON.stringify(data) })
export const updateRole = (id: number, data: Omit<Role, 'id'>) => json<Role>(`${BASE}/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteRole = (id: number) => json(`${BASE}/roles/${id}`, { method: 'DELETE' })

// People
export const getPeople = () => json<Person[]>(`${BASE}/people`)
export const createPerson = (data: Omit<Person, 'id' | 'role_name'>) => json<Person>(`${BASE}/people`, { method: 'POST', body: JSON.stringify(data) })
export const updatePerson = (id: number, data: Omit<Person, 'id' | 'role_name'>) => json<Person>(`${BASE}/people/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deletePerson = (id: number) => json(`${BASE}/people/${id}`, { method: 'DELETE' })
export const reorderPeople = (ids: number[]) => json(`${BASE}/people/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) })

// Projects
export const getProjects = () => json<Project[]>(`${BASE}/projects`)
export const createProject = (data: Omit<Project, 'id'>) => json<Project>(`${BASE}/projects`, { method: 'POST', body: JSON.stringify(data) })
export const updateProject = (id: number, data: Omit<Project, 'id'>) => json<Project>(`${BASE}/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteProject = (id: number) => json(`${BASE}/projects/${id}`, { method: 'DELETE' })
export const reorderProjects = (ids: number[]) => json(`${BASE}/projects/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) })

// Assignments
export const getAssignments = (dateFrom: string, dateTo: string) =>
  json<Assignment[]>(`${BASE}/assignments?date_from=${dateFrom}&date_to=${dateTo}`)

export const bulkAssign = (person_id: number, project_id: number, dates: string[]) =>
  json(`${BASE}/assignments/bulk`, { method: 'POST', body: JSON.stringify({ person_id, project_id, dates }) })

export const bulkDelete = (person_id: number, dates: string[]) =>
  json(`${BASE}/assignments/bulk`, { method: 'DELETE', body: JSON.stringify({ person_id, dates }) })

export const updateAssignmentText = (person_id: number, date: string, short_text: string) =>
  json(`${BASE}/assignments/text`, { method: 'PUT', body: JSON.stringify({ person_id, date, short_text }) })

// Cell notes (persist independently of assignments)
export const getNotes = (dateFrom: string, dateTo: string) =>
  json<{ person_id: number; date: string; note: string; plant: string | null; value_stream: string | null }[]>(`${BASE}/notes?date_from=${dateFrom}&date_to=${dateTo}`)

export const upsertNote = (person_id: number, date: string, note: string, plant: string | null, value_stream: string | null) =>
  json(`${BASE}/notes`, { method: 'PUT', body: JSON.stringify({ person_id, date, note, plant, value_stream }) })
