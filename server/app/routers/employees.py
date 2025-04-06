from fastapi import APIRouter, HTTPException, Body
from typing import List
import json
import os
from ..models import Employee, EmployeeList
from datetime import date

router = APIRouter()

# Path to employees.json file
EMPLOYEES_FILE = "employees.json"

@router.get("/employees", response_model=EmployeeList)
async def get_employees():
    """
    Get all employees from the employees.json file
    """
    try:
        if os.path.exists(EMPLOYEES_FILE):
            with open(EMPLOYEES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data
        else:
            return {"employees": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading employees: {str(e)}")

@router.get("/employees/working", response_model=List[str])
async def get_working_employees():
    """
    Get names of employees who are working today
    """
    try:
        if os.path.exists(EMPLOYEES_FILE):
            with open(EMPLOYEES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                working_employees = [emp["name"] for emp in data.get("employees", []) 
                                   if emp.get("istodayworking", False)]
                return working_employees
        else:
            return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading employees: {str(e)}")

@router.post("/employees", response_model=EmployeeList)
async def update_employees(employee_list: EmployeeList = Body(...)):
    """
    Update all employees in the employees.json file
    """
    try:
        with open(EMPLOYEES_FILE, "w", encoding="utf-8") as f:
            # Convert dates to strings
            data = employee_list.dict()
            json.dump(data, f, ensure_ascii=False, indent=4)
        return employee_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating employees: {str(e)}")

@router.post("/employees/add", response_model=EmployeeList)
async def add_employee(employee: Employee = Body(...)):
    """
    Add a new employee to the employees.json file
    """
    try:
        if os.path.exists(EMPLOYEES_FILE):
            with open(EMPLOYEES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = {"employees": []}
        
        # Add the new employee
        data["employees"].append({
            "name": employee.name,
            "istodayworking": employee.istodayworking,
            "hire_date": employee.hire_date.isoformat()
        })
        
        # Save the updated employees
        with open(EMPLOYEES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding employee: {str(e)}")

@router.put("/employees/{name}/toggle", response_model=EmployeeList)
async def toggle_employee_working(name: str):
    """
    Toggle the working status of an employee
    """
    try:
        if not os.path.exists(EMPLOYEES_FILE):
            raise HTTPException(status_code=404, detail="Employees file not found")
            
        with open(EMPLOYEES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Find the employee with the specified name
        found = False
        for emp in data.get("employees", []):
            if emp.get("name") == name:
                emp["istodayworking"] = not emp.get("istodayworking", False)
                found = True
                break
        
        if not found:
            raise HTTPException(status_code=404, detail=f"Employee {name} not found")
        
        # Save the updated employees
        with open(EMPLOYEES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error toggling employee status: {str(e)}")

@router.delete("/employees/{name}", response_model=EmployeeList)
async def delete_employee(name: str):
    """
    Delete an employee by name
    """
    try:
        if not os.path.exists(EMPLOYEES_FILE):
            raise HTTPException(status_code=404, detail="Employees file not found")
            
        with open(EMPLOYEES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Find and remove the employee with the specified name
        original_length = len(data.get("employees", []))
        data["employees"] = [emp for emp in data.get("employees", []) if emp.get("name") != name]
        
        if len(data["employees"]) == original_length:
            raise HTTPException(status_code=404, detail=f"Employee {name} not found")
        
        # Save the updated employees
        with open(EMPLOYEES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting employee: {str(e)}") 