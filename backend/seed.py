"""Run once to populate the database with data from the Excel file. All values in days."""
from database import SessionLocal, engine, Base
import models

Base.metadata.create_all(bind=engine)

ROLES = [
    {"name": "Manager",                   "multiplier": 0.0},
    {"name": "Architect",                 "multiplier": 0.75},
    {"name": "Team leader",               "multiplier": 1.0},
    {"name": "Software developer senior", "multiplier": 1.0},
    {"name": "Software developer junior", "multiplier": 1.5},
    {"name": "Erp senior",                "multiplier": 1.0},
    {"name": "Erp junior",                "multiplier": 1.5},
    {"name": "Product Manager",           "multiplier": 1.5},
]

# sprint_capacity and pto_days in working days (80h ÷ 8 = 10d, pto_hours ÷ 8)
PEOPLE = [
    {"name": "Salvatore Caputi",   "role": "Architect",                  "sprint_capacity": 10, "pto_days": 1},
    {"name": "Silvano Bergamasco", "role": "Team leader",                 "sprint_capacity": 10, "pto_days": 1},
    {"name": "Luca Stefanuto",     "role": "Software developer junior",   "sprint_capacity": 10, "pto_days": 1},
    {"name": "Pietro Tollot",      "role": "Software developer junior",   "sprint_capacity": 10, "pto_days": 2},
    {"name": "Jessica Busatto",    "role": "Team leader",                 "sprint_capacity": 10, "pto_days": 2},
    {"name": "Akshay Agrawal",     "role": "Software developer senior",   "sprint_capacity": 10, "pto_days": 0},
    {"name": "Alberto Paladin",    "role": "Software developer senior",   "sprint_capacity": 10, "pto_days": 3},
    {"name": "Artem Nehoda",       "role": "Software developer junior",   "sprint_capacity": 10, "pto_days": 2},
    {"name": "Filippo Piovano",    "role": "Software developer junior",   "sprint_capacity": 10, "pto_days": 1},
    {"name": "Davide De Martini",  "role": "Team leader",                 "sprint_capacity": 10, "pto_days": 1},
    {"name": "Mara Zovatti",       "role": "Software developer junior",   "sprint_capacity": 10, "pto_days": 2},
    {"name": "Andrea Brun",        "role": "Software developer junior",   "sprint_capacity": 10, "pto_days": 2},
    {"name": "Alessandro Tolomio", "role": "Software developer junior",   "sprint_capacity": 10, "pto_days": 1},
    {"name": "Ivano Boscolo",      "role": "Software developer senior",   "sprint_capacity": 10, "pto_days": 1},
    {"name": "Matteo Sorgato",     "role": "Product Manager",             "sprint_capacity": 10, "pto_days": 1},
    {"name": "Andrea Degano",      "role": "Erp junior",                  "sprint_capacity": 10, "pto_days": 1},
    {"name": "Francesco Cerabona", "role": "Erp senior",                  "sprint_capacity": 10, "pto_days": 1},
    {"name": "Marta Menegazzi",    "role": "Erp senior",                  "sprint_capacity": 10, "pto_days": 1},
    {"name": "Patrick Riva",       "role": "Manager",                     "sprint_capacity": 10, "pto_days": 1},
]

# demand_days converted from Excel demand_hours ÷ 8
PROJECTS = [
    {"name": "VIP",          "demand_days": 38, "color": "#6366f1"},
    {"name": "Kratos",       "demand_days": 10, "color": "#f59e0b"},
    {"name": "Athena",       "demand_days": 20, "color": "#10b981"},
    {"name": "Industry 4.0", "demand_days": 4,  "color": "#ef4444"},
    {"name": "BTP",          "demand_days": 7,  "color": "#3b82f6"},
]

def seed():
    db = SessionLocal()
    try:
        if db.query(models.Role).count() > 0:
            print("Database already seeded, skipping.")
            return

        role_map = {}
        for r in ROLES:
            role = models.Role(name=r["name"], multiplier=r["multiplier"])
            db.add(role)
            db.flush()
            role_map[r["name"]] = role.id

        for p in PEOPLE:
            db.add(models.Person(
                name=p["name"],
                role_id=role_map.get(p["role"]),
                sprint_capacity=p["sprint_capacity"],
                pto_days=p["pto_days"],
            ))

        for p in PROJECTS:
            db.add(models.Project(**p))

        db.commit()
        print(f"Seeded {len(ROLES)} roles, {len(PEOPLE)} people, {len(PROJECTS)} projects.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
