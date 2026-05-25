# Hephaestus — Capacity Planner

A lightweight team capacity planning tool for tracking who works on what, when.

## Purpose

Hephaestus helps team leads and project managers plan and visualise resource allocation across projects and time. You can paint assignments day by day on an interactive timeline grid, track demand vs. allocated days per project, annotate individual days with notes and tags, and export the plan as CSV for reporting.

## Features

### Timeline grid
- Interactive grid: click and drag to assign days to a project, right-click a cell to add a note
- Supports full year, semester, quarter, month and sprint views with navigation
- Non-working days (weekends and Italian public holidays) are read-only and visually distinct
- Today column is highlighted in blue; fiscal quarter boundaries are marked in violet
- Zoom control (14 – 80 px cell width)

### Notes & tags
- Per-cell notes saved independently of assignments (notes survive reassignment)
- Tag selector per note: **LF-R**, **LF-F**, **SF**, **MF**, or None
- Suggestion chips (*Support*, *Team Coord*, *Courses*) appear on empty non-project cells
- Notes are indicated by a white triangle in the top-right corner of the cell
- Tag value shown as a small badge in the bottom-left corner of the cell

### People, Projects & Roles
- Manage people with optional roles; drag-and-drop reorder
- Role-based pastel row colours for quick visual scanning
- Projects carry a demand (days) target, a colour, and an optional pattern box group
- Project rows tinted with the project colour

### Stats
- Per-person allocation summary for the selected date range
- Per-project demand vs. allocated days with utilisation percentage
- Effective working days calculated excluding weekends and Italian holidays

### Exports
| Button | Content |
|---|---|
| **Export CSV** | Full timeline grid — one column per working day, one row per person |
| **Export Plan** | Notes grouped by tag — excludes Non-Project Time entries |

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4 |
| Backend | Python, FastAPI, SQLAlchemy, SQLite |

## Running locally

```bash
./start.sh
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
