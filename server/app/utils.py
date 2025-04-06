import json
import math
from typing import List, Dict, Any, Tuple

# Corridor configuration from main.py
CORRIDORS = {
    1: {
        'rooms': list(range(29, 38)), 
        'side': 'west', 
        'floor': 1, 
        'trolley_needed': True
    },
    2: {
        'rooms': list(range(38, 47)), 
        'side': 'west', 
        'floor': 2, 
        'trolley_needed': False  # Коридор с кладовкой
    },
    3: {
        'rooms': list(range(1, 7)), 
        'side': 'east', 
        'floor': 1, 
        'trolley_needed': True
    },
    4: {
        'rooms': list(range(15, 23)), 
        'side': 'east', 
        'floor': 2, 
        'trolley_needed': False  # Коридор с кладовкой
    },
    5: {
        'rooms': list(range(101, 110)), 
        'side': 'east', 
        'floor': 2, 
        'trolley_needed': True
    },
    6: {
        'rooms': list(range(201, 208)), 
        'side': 'east', 
        'floor': 3, 
        'trolley_needed': False  # Коридор с кладовкой
    },
}

# Constants
WORK_TIME_MINUTES = (15 - 9) * 60 - 15  # 6 hours - 15 min break = 345 min

# Get corridor by room number
def get_corridor(room_number: int) -> int:
    for corridor_id, info in CORRIDORS.items():
        if room_number in info['rooms']:
            return corridor_id
    return None

# Calculate cleaning time for a task
def get_cleaning_time(task: Dict[str, Any]) -> int:
    cleaning_type = task.get("type", "").upper()
    if cleaning_type in ["V", "V/N"]:
        base_time = 45
    elif cleaning_type == "B":
        base_time = 15
    elif cleaning_type == "N":
        base_time = 5
    else:
        base_time = 0

    note = task.get("note", "").lower()
    if "кровать" in note:
        base_time += 10
    return base_time

# Calculate transition time between corridors
def transition_time(corr_from: int, corr_to: int) -> int:
    info_from = CORRIDORS[corr_from]
    info_to = CORRIDORS[corr_to]
    if corr_from == corr_to:
        return 1
    if info_from['side'] == info_to['side']:
        if info_from['floor'] == info_to['floor']:
            return 2
        else:
            return 5
    else:
        return 10

# Group structure for corridor tasks
class CorridorGroup:
    def __init__(self, corridor_id: int, tasks: List[Dict[str, Any]]):
        self.corridor_id = corridor_id
        self.tasks = tasks
        self.side = CORRIDORS[corridor_id]['side']
        self.floor = CORRIDORS[corridor_id]['floor']
        self.trolley_needed = CORRIDORS[corridor_id]['trolley_needed']
        self.total_cleaning_time = self.compute_total_time()

    def compute_total_time(self) -> int:
        total = 0
        for task in self.tasks:
            total += get_cleaning_time(task)
        # Internal transitions
        if len(self.tasks) > 1:
            total += (len(self.tasks) - 1) * 1
        return total
    
    def to_dict(self) -> Dict[str, Any]:
        task_list = []
        for task in self.tasks:
            room = task.get("room")
            cleaning_time = get_cleaning_time(task)
            note = task.get("note", "")
            task_list.append({
                "room": room,
                "type": task.get("type"),
                "note": note,
                "cleaning_time": cleaning_time
            })
            
        return {
            "corridor_id": self.corridor_id,
            "floor": self.floor,
            "side": self.side,
            "tasks": task_list,
            "total_time": self.total_cleaning_time
        }

# Assignment structure for employees
class EmployeeAssignment:
    def __init__(self, emp_id: int, emp_name: str):
        self.emp_id = emp_id
        self.emp_name = emp_name
        self.assigned_groups = []
        self.total_time = 0

    def add_group(self, group: CorridorGroup, extra_time: int = 0):
        self.assigned_groups.append(group)
        self.total_time += group.total_cleaning_time + extra_time

    @property
    def needs_trolley(self):
        return any(group.trolley_needed for group in self.assigned_groups)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "employee": self.emp_name,
            "total_time": self.total_time,
            "needs_trolley": self.needs_trolley,
            "assigned_corridors": [group.to_dict() for group in self.assigned_groups]
        }

# Assign groups to employees
def assign_groups_to_employees(corridor_groups: List[CorridorGroup], available_employees: List[str]) -> List[EmployeeAssignment]:
    employees = [EmployeeAssignment(i+1, available_employees[i]) for i in range(len(available_employees))]
    sorted_groups = sorted(corridor_groups, key=lambda g: (CORRIDORS[g.corridor_id]['floor'], g.corridor_id))
    
    for group in sorted_groups:
        best_emp = None
        best_time = None
        for emp in employees:
            if emp.assigned_groups:
                last_group = emp.assigned_groups[-1]
                trans_time = transition_time(last_group.corridor_id, group.corridor_id)
            else:
                trans_time = 0
            candidate_time = emp.total_time + trans_time + group.total_cleaning_time
            if best_emp is None or candidate_time < best_time:
                best_emp = emp
                best_time = candidate_time
        best_emp.add_group(group, trans_time if best_emp.assigned_groups else 0)
    return employees

# Split groups if needed
def split_group_if_needed(group: CorridorGroup, available_time: int = WORK_TIME_MINUTES) -> List[CorridorGroup]:
    if group.total_cleaning_time <= available_time:
        return [group]
    
    num_splits = math.ceil(group.total_cleaning_time / available_time)
    tasks = group.tasks
    split_groups = []
    
    chunk_size = math.ceil(len(tasks) / num_splits)
    for i in range(0, len(tasks), chunk_size):
        chunk = tasks[i:i+chunk_size]
        new_group = CorridorGroup(group.corridor_id, chunk)
        split_groups.append(new_group)
    return split_groups 