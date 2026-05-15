export interface Role {
  id: number
  name: string
  multiplier: number
}

export interface Person {
  id: number
  name: string
  role_id: number | null
  role_name: string | null
  sprint_capacity: number  // days per sprint
  pto_days: number         // PTO/BH days this sprint
  sort_order: number
}

export interface Project {
  id: number
  name: string
  demand_days: number
  color: string
}

export interface Assignment {
  id: number
  person_id: number
  project_id: number
  date: string // ISO "YYYY-MM-DD"
}
