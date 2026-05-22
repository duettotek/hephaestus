from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from pydantic import BaseModel
from typing import Optional
from datetime import date
import models
from database import engine, get_db, Base

Base.metadata.create_all(bind=engine)

# Add sort_order column to existing DBs that predate this field
from sqlalchemy import text
with engine.connect() as _conn:
    for _tbl, _col in [("projects", "sort_order"), ("people", "sort_order")]:
        try:
            _conn.execute(text(f"ALTER TABLE {_tbl} ADD COLUMN {_col} INTEGER DEFAULT 0"))
            _conn.execute(text(f"UPDATE {_tbl} SET {_col} = id"))
            _conn.commit()
        except Exception:
            pass  # column already exists
    try:
        _conn.execute(text("ALTER TABLE projects ADD COLUMN pattern_box_group INTEGER"))
        _conn.commit()
    except Exception:
        pass  # column already exists

app = FastAPI(title="Capacity Planner")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ──────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str
    multiplier: float = 1.0

class RoleOut(RoleCreate):
    id: int
    class Config:
        from_attributes = True

class PersonCreate(BaseModel):
    name: str
    role_id: Optional[int] = None

class PersonOut(BaseModel):
    id: int
    name: str
    role_id: Optional[int]
    role_name: Optional[str]
    sort_order: int = 0
    class Config:
        from_attributes = True

class ReorderPeopleRequest(BaseModel):
    ids: list[int]

class ProjectCreate(BaseModel):
    name: str
    demand_days: int = 0
    color: str = "#6366f1"
    pattern_box_group: Optional[int] = None

class ProjectOut(ProjectCreate):
    id: int
    sort_order: int = 0
    class Config:
        from_attributes = True

class ReorderRequest(BaseModel):
    ids: list[int]

class AssignmentCreate(BaseModel):
    person_id: int
    project_id: int
    date: date

class AssignmentOut(BaseModel):
    id: int
    person_id: int
    project_id: int
    date: date
    class Config:
        from_attributes = True

class BulkAssignRequest(BaseModel):
    person_id: int
    project_id: int
    dates: list[date]

class BulkDeleteRequest(BaseModel):
    person_id: int
    dates: list[date]


# ── Roles ─────────────────────────────────────────────────────────────────────

@app.get("/api/roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db)):
    return db.query(models.Role).all()

@app.post("/api/roles", response_model=RoleOut)
def create_role(role: RoleCreate, db: Session = Depends(get_db)):
    db_role = models.Role(**role.model_dump())
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

@app.put("/api/roles/{role_id}", response_model=RoleOut)
def update_role(role_id: int, role: RoleCreate, db: Session = Depends(get_db)):
    db_role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    for k, v in role.model_dump().items():
        setattr(db_role, k, v)
    db.commit()
    db.refresh(db_role)
    return db_role

@app.delete("/api/roles/{role_id}")
def delete_role(role_id: int, db: Session = Depends(get_db)):
    db_role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    db.delete(db_role)
    db.commit()
    return {"ok": True}


# ── People ────────────────────────────────────────────────────────────────────

@app.get("/api/people", response_model=list[PersonOut])
def list_people(db: Session = Depends(get_db)):
    people = db.query(models.Person).order_by(models.Person.sort_order).all()
    return [
        PersonOut(
            id=p.id, name=p.name, role_id=p.role_id,
            role_name=p.role.name if p.role else None,
            sort_order=p.sort_order,
        )
        for p in people
    ]

@app.put("/api/people/reorder")
def reorder_people(req: ReorderPeopleRequest, db: Session = Depends(get_db)):
    for order, pid in enumerate(req.ids):
        db.query(models.Person).filter(models.Person.id == pid).update({"sort_order": order})
    db.commit()
    return {"ok": True}

@app.post("/api/people", response_model=PersonOut)
def create_person(person: PersonCreate, db: Session = Depends(get_db)):
    db_person = models.Person(**person.model_dump())
    db.add(db_person)
    db.commit()
    db.refresh(db_person)
    return PersonOut(
        id=db_person.id, name=db_person.name, role_id=db_person.role_id,
        role_name=db_person.role.name if db_person.role else None,
        sort_order=db_person.sort_order,
    )

@app.put("/api/people/{person_id}", response_model=PersonOut)
def update_person(person_id: int, person: PersonCreate, db: Session = Depends(get_db)):
    db_person = db.query(models.Person).filter(models.Person.id == person_id).first()
    if not db_person:
        raise HTTPException(status_code=404, detail="Person not found")
    for k, v in person.model_dump().items():
        setattr(db_person, k, v)
    db.commit()
    db.refresh(db_person)
    return PersonOut(
        id=db_person.id, name=db_person.name, role_id=db_person.role_id,
        role_name=db_person.role.name if db_person.role else None,
        sort_order=db_person.sort_order,
    )

@app.delete("/api/people/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db)):
    db_person = db.query(models.Person).filter(models.Person.id == person_id).first()
    if not db_person:
        raise HTTPException(status_code=404, detail="Person not found")
    db.delete(db_person)
    db.commit()
    return {"ok": True}


# ── Projects ──────────────────────────────────────────────────────────────────

@app.get("/api/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).order_by(models.Project.sort_order).all()

@app.put("/api/projects/reorder")
def reorder_projects(req: ReorderRequest, db: Session = Depends(get_db)):
    for order, pid in enumerate(req.ids):
        db.query(models.Project).filter(models.Project.id == pid).update({"sort_order": order})
    db.commit()
    return {"ok": True}

@app.post("/api/projects", response_model=ProjectOut)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_proj = models.Project(**project.model_dump())
    db.add(db_proj)
    db.commit()
    db.refresh(db_proj)
    return db_proj

@app.put("/api/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, project: ProjectCreate, db: Session = Depends(get_db)):
    db_proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_proj:
        raise HTTPException(status_code=404, detail="Project not found")
    for k, v in project.model_dump().items():
        setattr(db_proj, k, v)
    db.commit()
    db.refresh(db_proj)
    return db_proj

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db_proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_proj:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(db_proj)
    db.commit()
    return {"ok": True}


# ── Assignments ───────────────────────────────────────────────────────────────

@app.get("/api/assignments")
def list_assignments(date_from: date, date_to: date, db: Session = Depends(get_db)):
    rows = db.query(models.Assignment).filter(
        and_(models.Assignment.date >= date_from, models.Assignment.date <= date_to)
    ).all()
    return [
        {"id": r.id, "person_id": r.person_id, "project_id": r.project_id, "date": r.date.isoformat()}
        for r in rows
    ]

@app.post("/api/assignments/bulk")
def bulk_assign(req: BulkAssignRequest, db: Session = Depends(get_db)):
    for d in req.dates:
        existing = db.query(models.Assignment).filter(
            and_(models.Assignment.person_id == req.person_id, models.Assignment.date == d)
        ).first()
        if existing:
            existing.project_id = req.project_id
        else:
            db.add(models.Assignment(person_id=req.person_id, project_id=req.project_id, date=d))
    db.commit()
    return {"ok": True, "count": len(req.dates)}

@app.delete("/api/assignments/bulk")
def bulk_delete(req: BulkDeleteRequest, db: Session = Depends(get_db)):
    for d in req.dates:
        db.query(models.Assignment).filter(
            and_(models.Assignment.person_id == req.person_id, models.Assignment.date == d)
        ).delete()
    db.commit()
    return {"ok": True}

@app.delete("/api/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(a)
    db.commit()
    return {"ok": True}


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats(date_from: date, date_to: date, db: Session = Depends(get_db)):
    rows = (
        db.query(
            models.Assignment.person_id,
            models.Assignment.project_id,
            func.count(models.Assignment.id).label("days"),
        )
        .filter(and_(models.Assignment.date >= date_from, models.Assignment.date <= date_to))
        .group_by(models.Assignment.person_id, models.Assignment.project_id)
        .all()
    )

    people = db.query(models.Person).all()
    projects = db.query(models.Project).all()
    role_map = {r.id: r for r in db.query(models.Role).all()}

    # ── People stats ──────────────────────────────────────────────────────────
    allocated_by_person: dict[int, int] = {}
    project_days_by_person: dict[int, dict[int, int]] = {}
    for r in rows:
        allocated_by_person[r.person_id] = allocated_by_person.get(r.person_id, 0) + r.days
        project_days_by_person.setdefault(r.person_id, {})[r.project_id] = r.days

    people_stats = []
    for p in people:
        role = role_map.get(p.role_id) if p.role_id else None
        multiplier = role.multiplier if role else 1.0
        allocated = allocated_by_person.get(p.id, 0)
        allocated_weighted = round(allocated * multiplier, 1)

        people_stats.append({
            "person_id": p.id,
            "name": p.name,
            "role_name": role.name if role else None,
            "role_multiplier": multiplier,
            "allocated": allocated,
            "allocated_weighted": allocated_weighted,
            "by_project": {pid: d for pid, d in project_days_by_person.get(p.id, {}).items()},
        })

    # ── Project stats ─────────────────────────────────────────────────────────
    allocated_by_project: dict[int, int] = {}
    person_days_by_project: dict[int, dict[int, int]] = {}
    for r in rows:
        allocated_by_project[r.project_id] = allocated_by_project.get(r.project_id, 0) + r.days
        person_days_by_project.setdefault(r.project_id, {})[r.person_id] = r.days

    project_stats = []
    for proj in projects:
        allocated = allocated_by_project.get(proj.id, 0)
        remaining_demand = proj.demand_days - allocated

        project_stats.append({
            "project_id": proj.id,
            "name": proj.name,
            "color": proj.color,
            "demand_days": proj.demand_days,         # C: Demand (days)
            "allocated": allocated,                  # D: Allocated = SUBTOTAL(person cols)
            "remaining_demand": remaining_demand,    # Demand − Allocated
            "utilization_pct": round(allocated / proj.demand_days * 100, 1) if proj.demand_days > 0 else 0,
            "by_person": {pid: d for pid, d in person_days_by_project.get(proj.id, {}).items()},
        })

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "people": people_stats,
        "projects": project_stats,
    }
