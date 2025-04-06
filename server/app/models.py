from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import date

class Task(BaseModel):
    room: int
    type: str
    note: str = ""
    corridor: Optional[int] = None
    
class TaskList(BaseModel):
    tasks: List[Task]

class Employee(BaseModel):
    name: str
    istodayworking: bool
    hire_date: date
    
class EmployeeList(BaseModel):
    employees: List[Employee]
    
class CorridorInfo(BaseModel):
    rooms: List[int]
    side: str
    floor: int
    trolley_needed: bool
    
class AssignmentResult(BaseModel):
    employee: str
    total_time: int
    needs_trolley: bool
    assigned_corridors: List[Dict[str, Any]]
    
class AssignmentResponse(BaseModel):
    assignments: List[AssignmentResult]
    trolley_employees: List[str]
    too_many_trolleys: bool 