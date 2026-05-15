import type { Role, Person, Project, Assignment } from './types'

const BASE = '/api'

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

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
