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
  sort_order: number
}

export interface Project {
  id: number
  name: string
  demand_days: number
  color: string
  pattern_box_group: number | null
}

export interface Assignment {
  id: number
  person_id: number
  project_id: number
  date: string // ISO "YYYY-MM-DD"
}
