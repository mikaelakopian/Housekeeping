from fastapi import APIRouter, HTTPException, Body
from typing import List
import json
import os
from ..models import Task, TaskList

router = APIRouter()

# Path to tasks.json file - use absolute path
TASKS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "tasks.json")

@router.get("/tasks", response_model=TaskList)
async def get_tasks():
    """
    Get all tasks from the tasks.json file
    """
    try:
        if os.path.exists(TASKS_FILE):
            with open(TASKS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data
        else:
            return {"tasks": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading tasks: {str(e)}")

@router.post("/tasks", response_model=TaskList)
async def update_tasks(task_list: TaskList = Body(...)):
    """
    Update all tasks in the tasks.json file
    """
    try:
        with open(TASKS_FILE, "w", encoding="utf-8") as f:
            json.dump(task_list.dict(), f, ensure_ascii=False, indent=4)
        return task_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating tasks: {str(e)}")

@router.post("/tasks/add", response_model=TaskList)
async def add_task(task: Task = Body(...)):
    """
    Add a new task to the tasks.json file
    """
    try:
        if os.path.exists(TASKS_FILE):
            with open(TASKS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = {"tasks": []}
        
        # Add the new task
        data["tasks"].append(task.dict())
        
        # Save the updated tasks
        with open(TASKS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding task: {str(e)}")

@router.delete("/tasks/{room}", response_model=TaskList)
async def delete_task(room: int):
    """
    Delete a task by room number
    """
    try:
        if not os.path.exists(TASKS_FILE):
            raise HTTPException(status_code=404, detail="Tasks file not found")
            
        with open(TASKS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Find and remove the task with the specified room
        original_length = len(data["tasks"])
        data["tasks"] = [task for task in data["tasks"] if task.get("room") != room]
        
        if len(data["tasks"]) == original_length:
            raise HTTPException(status_code=404, detail=f"Task for room {room} not found")
        
        # Save the updated tasks
        with open(TASKS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting task: {str(e)}") 