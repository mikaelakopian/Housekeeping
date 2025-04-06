from fastapi import APIRouter, HTTPException
import json
import os
from pathlib import Path

router = APIRouter()

# Путь к файлу schedule.json относительно корня проекта
SCHEDULE_PATH = Path(__file__).parent.parent.parent / "schedule.json"

@router.get("/schedule")
async def get_schedule():
    """
    Получить список расписания
    """
    try:
        if not SCHEDULE_PATH.is_file():
            raise HTTPException(status_code=404, detail=f"Schedule file not found at {SCHEDULE_PATH}")
        
        with open(SCHEDULE_PATH, "r", encoding="utf-8") as f:
            schedule_data = json.load(f)
            
        return schedule_data
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid JSON format in schedule file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read schedule: {str(e)}") 