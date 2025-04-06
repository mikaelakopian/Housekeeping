from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any
import json
import os
from ..models import AssignmentResponse, TaskList
from ..utils import (
    get_corridor, CorridorGroup, assign_groups_to_employees, 
    split_group_if_needed, CORRIDORS, WORK_TIME_MINUTES
)

router = APIRouter()

# Path to tasks.json and employees.json files
TASKS_FILE = "tasks.json"
EMPLOYEES_FILE = "employees.json"

@router.get("/corridors")
async def get_corridors():
    """
    Get all corridor configurations
    """
    return CORRIDORS

@router.post("/assign", response_model=AssignmentResponse)
async def assign_tasks():
    """
    Assign tasks to available employees based on the algorithm
    """
    try:
        # Load employee data
        if not os.path.exists(EMPLOYEES_FILE):
            raise HTTPException(status_code=404, detail="Employees file not found")
            
        with open(EMPLOYEES_FILE, "r", encoding="utf-8") as f:
            employees_data = json.load(f)
            
        available_employees = [emp["name"] for emp in employees_data.get("employees", []) 
                             if emp.get("istodayworking", False)]
        
        if not available_employees:
            raise HTTPException(status_code=400, detail="No employees are working today")
        
        # Load task data
        if not os.path.exists(TASKS_FILE):
            raise HTTPException(status_code=404, detail="Tasks file not found")
            
        with open(TASKS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        tasks = data.get("tasks", [])
        
        if not tasks:
            raise HTTPException(status_code=400, detail="No tasks available")
        
        # Group tasks by corridor
        groups_by_corridor = {}
        for task in tasks:
            room = task.get("room")
            corridor_id = get_corridor(room)
            if corridor_id is None:
                continue
            task["corridor"] = corridor_id
            groups_by_corridor.setdefault(corridor_id, []).append(task)
        
        # Create corridor groups and split if needed
        corridor_groups = []
        for corridor_id, group_tasks in groups_by_corridor.items():
            group = CorridorGroup(corridor_id, group_tasks)
            split_groups = split_group_if_needed(group, available_time=WORK_TIME_MINUTES)
            corridor_groups.extend(split_groups)
        
        # Assign groups to employees
        employees = assign_groups_to_employees(corridor_groups, available_employees)
        
        # Prepare the response
        assignments = [emp.to_dict() for emp in employees]
        trolley_employees = [emp.emp_name for emp in employees if emp.needs_trolley]
        too_many_trolleys = len(trolley_employees) > 2
        
        return {
            "assignments": assignments,
            "trolley_employees": trolley_employees,
            "too_many_trolleys": too_many_trolleys
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error assigning tasks: {str(e)}") 