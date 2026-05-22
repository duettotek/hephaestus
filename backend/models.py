from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    multiplier = Column(Float, default=1.0)

    people = relationship("Person", back_populates="role")


class Person(Base):
    __tablename__ = "people"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    sort_order = Column(Integer, default=0)

    role = relationship("Role", back_populates="people")
    assignments = relationship("Assignment", back_populates="person", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    demand_days = Column(Integer, default=0)
    color = Column(String, default="#6366f1")
    sort_order = Column(Integer, default=0)
    pattern_box_group = Column(Integer, nullable=True)

    assignments = relationship("Assignment", back_populates="project", cascade="all, delete-orphan")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("people.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    date = Column(Date, nullable=False)

    __table_args__ = (UniqueConstraint("person_id", "date", name="uq_person_date"),)

    person = relationship("Person", back_populates="assignments")
    project = relationship("Project", back_populates="assignments")
