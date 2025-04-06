from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import tasks, employees, housekeeping, schedule

app = FastAPI(title="Housekeeping API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(employees.router, prefix="/api", tags=["employees"])
app.include_router(housekeeping.router, prefix="/api", tags=["housekeeping"])
app.include_router(schedule.router, prefix="/api", tags=["schedule"])

@app.get("/")
async def root():
    return {"message": "Welcome to Housekeeping API"} 